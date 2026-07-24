/**
 * Archive facets — filter groups derived from the products ACTUALLY in scope.
 *
 * Every archive (shop, category, sub-category, brand, collection) gets the
 * same treatment: we look at the products the page is about to render and
 * build checkbox groups out of the values those products really carry. No
 * navigation links, no hand-maintained filter config, nothing that can drift
 * out of sync with the catalogue.
 *
 * Three sources, because different stores model the same idea differently:
 *
 *   1. CATEGORIES — grouped by their PARENT category. A store that models
 *      "Condition" or "Size" as a category tree (Condition › Excellent,
 *      Very good) gets one facet group per parent, its children as values.
 *   2. VARIANT OPTIONS — Size / Color / Condition as real Medusa options.
 *   3. SPECS — `metadata.specs`, honouring a spec template's `is_filter`
 *      flag when one exists, and auto-detecting sensible keys when it
 *      doesn't (most stores never fill a template in).
 *
 * A group survives only if it can actually SPLIT the archive: at least two
 * distinct values. A "Color: Black" group on a page where every product is
 * black filters nothing, so it never renders.
 *
 * Query-param convention (all comma-separated, OR within a group, AND
 * across groups — the standard every shopper already knows):
 *
 *   cat_<parent>  category handles     brand      brand handles
 *   opt_<title>   variant option       spec_<key> metadata spec
 *
 * `spec_*` keeps the exact shape the old spec-only filters used, so
 * existing links and the middleware's noindex rule still work.
 */

export type FacetValue = {
  /** Raw value used in the query string. */
  value: string
  /** Human label shown in the sidebar. */
  label: string
  /** How many in-scope products carry it. */
  count: number
}

export type FacetGroup = {
  /** Query-param key, e.g. `opt_size`. */
  param: string
  label: string
  kind: "category" | "brand" | "option" | "spec"
  unit?: string
  values: FacetValue[]
}

type AnyCategory = {
  id?: string
  handle?: string
  name?: string
  parent_category?: AnyCategory | null
  parent_category_id?: string | null
}

export type FacetProduct = {
  id?: string
  categories?: AnyCategory[] | null
  options?: Array<{ title?: string; values?: Array<{ value?: string }> | null }> | null
  metadata?: Record<string, any> | null
}

/** Template field descriptor, as stored on a spec template. */
export type SpecTemplateField = {
  key: string
  label?: string
  unit?: string
  type?: string
  is_filter?: boolean
  options?: string[]
}

export type BuildFacetsOptions = {
  /** Every spec-template field, filterable or not — see resolveSpecKeys. */
  specFields?: Map<string, SpecTemplateField>
  /** Category ids the archive is already scoped to (self + ancestors). */
  excludeCategoryIds?: Set<string>
  /** handle → display name, for the brand facet. */
  brandNames?: Map<string, string>
  /** Hide the brand facet on a brand archive — every product shares it. */
  includeBrand?: boolean
}

/** Medusa auto-creates these for variant-less products. Pure noise. */
const PLACEHOLDER_OPTION = /^default option$/i
const PLACEHOLDER_VALUE = /^default option value$/i

/** A facet needs at least this many distinct values to be worth showing. */
const MIN_VALUES = 2
/** Guard against a runaway group (e.g. a free-text spec). */
const MAX_VALUES = 50
/** Longer than this and it's prose, not a facet value. */
const MAX_VALUE_LEN = 48
/** Above this cardinality an un-templated spec is almost certainly free text. */
const AUTO_SPEC_MAX_DISTINCT = 30

export function slugifyParam(input: string): string {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

/** "Red, Blue" → ["Red","Blue"]; single values pass straight through. */
function splitMulti(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

const SIZE_ORDER = [
  "xxs", "xs", "s", "small", "m", "medium", "l", "large",
  "xl", "xxl", "2xl", "xxxl", "3xl", "4xl",
]

/**
 * Natural ordering: clothing sizes in wearing order, numbers numerically
 * ("9 EUR" before "10 EUR"), everything else alphabetically.
 */
export function compareFacetValues(a: string, b: string): number {
  const ia = SIZE_ORDER.indexOf(a.trim().toLowerCase())
  const ib = SIZE_ORDER.indexOf(b.trim().toLowerCase())
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1

  const na = parseFloat(a)
  const nb = parseFloat(b)
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb

  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
}

/** Tally of value → {label, count}, kept insertion-safe by a Map. */
type Tally = Map<string, { label: string; count: number }>

function bump(tally: Tally, value: string, label?: string) {
  const cur = tally.get(value)
  if (cur) cur.count += 1
  else tally.set(value, { label: label || value, count: 1 })
}

/**
 * Turn a tally into a renderable group, or null when it cannot discriminate.
 * This single gate is why no archive ever shows a useless filter.
 */
function finalize(
  param: string,
  label: string,
  kind: FacetGroup["kind"],
  tally: Tally,
  unit?: string
): FacetGroup | null {
  if (tally.size < MIN_VALUES) return null

  let values: FacetValue[] = Array.from(tally.entries()).map(([value, v]) => ({
    value,
    label: v.label,
    count: v.count,
  }))

  // Too many to render usefully — keep the most common, then restore
  // natural order so the list still reads S, M, L rather than by count.
  if (values.length > MAX_VALUES) {
    values.sort((a, b) => b.count - a.count)
    values = values.slice(0, MAX_VALUES)
  }
  values.sort((a, b) => compareFacetValues(a.label, b.label))

  return { param, label, kind, unit, values }
}

/**
 * Decide which spec keys are filterable.
 *
 * A key described by a spec template obeys that template's `is_filter`
 * flag — an operator who said "don't filter on this" is respected. A key
 * the template says nothing about falls back to auto-detection, so stores
 * that never configured a template still get working filters.
 */
function resolveSpecKeys(
  products: FacetProduct[],
  specFields?: Map<string, SpecTemplateField>
): Map<string, { label: string; unit?: string }> {
  const distinct = new Map<string, Set<string>>()

  for (const p of products) {
    const specs = (p.metadata?.specs || {}) as Record<string, unknown>
    for (const [key, raw] of Object.entries(specs)) {
      if (raw === null || raw === undefined) continue
      const str = String(raw).trim()
      if (!str) continue
      if (!distinct.has(key)) distinct.set(key, new Set())
      for (const part of splitMulti(str)) distinct.get(key)!.add(part)
    }
  }

  const out = new Map<string, { label: string; unit?: string }>()
  for (const [key, values] of Array.from(distinct.entries())) {
    const field = specFields?.get(key)

    if (field) {
      if (!field.is_filter) continue
      out.set(key, { label: field.label || key, unit: field.unit })
      continue
    }

    // Auto-detect: must split the archive, stay small, and not be prose.
    if (values.size < MIN_VALUES) continue
    if (values.size > AUTO_SPEC_MAX_DISTINCT) continue
    if (values.size >= products.length) continue // ~unique per product
    let prose = false
    for (const v of Array.from(values)) {
      if (v.length > MAX_VALUE_LEN) {
        prose = true
        break
      }
    }
    if (prose) continue

    out.set(key, { label: humanizeKey(key) })
  }
  return out
}

/** `screen_size` → `Screen Size`. */
export function humanizeKey(key: string): string {
  return String(key)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Build every facet group for an archive from the products in scope.
 *
 * Pure and synchronous — pass it the same list the grid renders and the
 * counts are guaranteed to match what a shopper sees.
 */
export function buildFacets(
  products: FacetProduct[],
  opts: BuildFacetsOptions = {}
): FacetGroup[] {
  if (!products.length) return []

  const {
    specFields,
    excludeCategoryIds,
    brandNames,
    includeBrand = true,
  } = opts

  const groups: FacetGroup[] = []

  // ── 1. Categories, grouped by parent ──────────────────────────────────
  // Stores routinely model Size / Condition / Style as category trees, so
  // each parent becomes a facet group and its children become the values.
  const catGroups = new Map<
    string,
    { label: string; parentHandle: string; tally: Tally }
  >()

  for (const p of products) {
    // De-dupe within a product: two categories under one parent must not
    // double-count that product.
    const seen = new Set<string>()
    for (const cat of p.categories || []) {
      if (!cat?.handle) continue
      // Dropped as a facet VALUE (admin "Hide from filters", or the
      // archive's own category/ancestors).
      if (cat.id && excludeCategoryIds?.has(cat.id)) continue

      const parent = cat.parent_category
      // Dropped as a whole GROUP: hiding a parent hides its filter group.
      if (parent?.id && excludeCategoryIds?.has(parent.id)) continue
      const parentKey = parent?.id || parent?.handle || "__top__"
      const parentHandle = parent?.handle || "top"
      const groupLabel = parent?.name || "Category"
      const dedupeKey = `${parentKey}::${cat.handle}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      if (!catGroups.has(parentKey)) {
        catGroups.set(parentKey, {
          label: groupLabel,
          parentHandle,
          tally: new Map(),
        })
      }
      bump(catGroups.get(parentKey)!.tally, cat.handle, cat.name || cat.handle)
    }
  }

  for (const { label, parentHandle, tally } of Array.from(catGroups.values())) {
    const g = finalize(
      `cat_${slugifyParam(parentHandle)}`,
      label,
      "category",
      tally
    )
    if (g) groups.push(g)
  }

  // ── 2. Brand ──────────────────────────────────────────────────────────
  if (includeBrand) {
    const tally: Tally = new Map()
    for (const p of products) {
      const handle = p.metadata?.brand
      if (typeof handle !== "string" || !handle.trim()) continue
      bump(tally, handle, brandNames?.get(handle) || humanizeKey(handle))
    }
    const g = finalize("brand", "Brand", "brand", tally)
    if (g) groups.push(g)
  }

  // ── 3. Variant options ────────────────────────────────────────────────
  const optGroups = new Map<string, { label: string; tally: Tally }>()
  for (const p of products) {
    for (const opt of p.options || []) {
      const title = (opt?.title || "").trim()
      if (!title || PLACEHOLDER_OPTION.test(title)) continue

      const key = slugifyParam(title)
      if (!key) continue
      if (!optGroups.has(key)) optGroups.set(key, { label: title, tally: new Map() })

      const seen = new Set<string>()
      for (const v of opt.values || []) {
        const value = (v?.value || "").trim()
        if (!value || PLACEHOLDER_VALUE.test(value)) continue
        if (value.length > MAX_VALUE_LEN) continue
        if (seen.has(value)) continue // one product counts once per value
        seen.add(value)
        bump(optGroups.get(key)!.tally, value)
      }
    }
  }
  for (const [key, { label, tally }] of Array.from(optGroups.entries())) {
    const g = finalize(`opt_${key}`, label, "option", tally)
    if (g) groups.push(g)
  }

  // ── 4. Specs ──────────────────────────────────────────────────────────
  const specKeys = resolveSpecKeys(products, specFields)
  for (const [key, meta] of Array.from(specKeys.entries())) {
    const tally: Tally = new Map()
    const isBoolean = specFields?.get(key)?.type === "boolean"

    for (const p of products) {
      const raw = (p.metadata?.specs || {})[key]
      if (raw === null || raw === undefined) continue
      const str = String(raw).trim()
      if (!str) continue

      if (isBoolean) {
        bump(tally, str === "true" || str === "Yes" ? "Yes" : "No")
      } else {
        const seen = new Set<string>()
        for (const part of splitMulti(str)) {
          if (part.length > MAX_VALUE_LEN) continue
          if (seen.has(part)) continue
          seen.add(part)
          bump(tally, part)
        }
      }
    }

    const g = finalize(`spec_${key}`, meta.label, "spec", tally, meta.unit)
    if (g) groups.push(g)
  }

  return groups
}

/**
 * Per-product filter index — the minimum a client needs to evaluate the
 * facet query without re-fetching. Mirrors buildFacets exactly, so a value
 * offered as a facet always matches the products it was counted from.
 */
export function buildFacetIndex(product: FacetProduct): Record<string, string[]> {
  const index: Record<string, string[]> = {}
  const add = (param: string, value: string) => {
    if (!index[param]) index[param] = []
    if (!index[param].includes(value)) index[param].push(value)
  }

  for (const cat of product.categories || []) {
    if (!cat?.handle) continue
    const parentHandle = cat.parent_category?.handle || "top"
    add(`cat_${slugifyParam(parentHandle)}`, cat.handle)
  }

  const brand = product.metadata?.brand
  if (typeof brand === "string" && brand.trim()) add("brand", brand)

  for (const opt of product.options || []) {
    const title = (opt?.title || "").trim()
    if (!title || PLACEHOLDER_OPTION.test(title)) continue
    const key = slugifyParam(title)
    if (!key) continue
    for (const v of opt.values || []) {
      const value = (v?.value || "").trim()
      if (!value || PLACEHOLDER_VALUE.test(value)) continue
      add(`opt_${key}`, value)
    }
  }

  return index
}

/** Query-param prefixes this system owns — used for chips and noindex. */
export const FACET_PARAM_PREFIXES = ["cat_", "opt_", "spec_"]

export function isFacetParam(key: string): boolean {
  return key === "brand" || FACET_PARAM_PREFIXES.some((p) => key.startsWith(p))
}
