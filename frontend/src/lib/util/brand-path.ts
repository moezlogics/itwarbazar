import type { Brand } from "@lib/data/brands"

/**
 * Build the canonical URL path for a brand by walking its
 * `parent_id` chain up to the root. Returns a slash-separated
 * string of handles — `apple/mac/m4-air` — that callers concatenate
 * with `/brands/` (and an optional locale prefix) to form an href.
 *
 * Inputs:
 *   • `brand`     — the leaf brand to render.
 *   • `allBrands` — a flat list of every brand the storefront has
 *                   loaded (from `listBrands()`). We index it once
 *                   so deep chains are O(depth) lookups.
 *
 * Mirrors `buildCategoryPath()` in spirit but uses an `id → brand`
 * map because Medusa categories ship `parent_category` embedded in
 * the row, while brands only carry `parent_id` and we have to
 * resolve siblings ourselves.
 *
 * Defensive on missing parents: a chain that points at a deleted
 * or unloaded parent is truncated at that point rather than
 * producing a URL with `undefined` segments.
 */
export function buildBrandPath(
  brand: Pick<Brand, "id" | "handle" | "parent_id">,
  allBrands: Array<Pick<Brand, "id" | "handle" | "parent_id">>
): string {
  if (!brand?.handle) return ""

  const byId = new Map<string, Pick<Brand, "id" | "handle" | "parent_id">>()
  for (const b of allBrands) {
    if (b?.id) byId.set(b.id, b)
  }

  const segments: string[] = [brand.handle]
  const visited = new Set<string>([brand.id])

  let parentId = brand.parent_id
  while (parentId) {
    if (visited.has(parentId)) break // cycle-safe — should never happen
    const parent = byId.get(parentId)
    if (!parent || !parent.handle) break // unknown / orphan — stop
    visited.add(parent.id)
    segments.unshift(parent.handle)
    parentId = parent.parent_id
  }

  return segments.join("/")
}

/**
 * Builds the dynamic canonical URL path for a brand without the legacy `/brands` prefix.
 * Example: `/apple` or `/apple/mac`
 */
export function getBrandPath(
  brand: any,
  allBrands: any[]
): string {
  if (!brand) return "/"
  const path = buildBrandPath(brand, allBrands) || brand.handle
  return `/${path}`
}

