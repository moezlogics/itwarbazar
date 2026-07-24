"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useState, useTransition } from "react"
import type { FacetGroup } from "@lib/util/facets"

type Props = {
  /**
   * Facet groups derived from the products in THIS archive — see
   * lib/util/facets. Whatever the products actually carry (categories,
   * variant options, specs) becomes a checkbox group; nothing is
   * hard-coded and nothing is a navigation link.
   */
  facets?: FacetGroup[]
  minPriceParam?: string
  maxPriceParam?: string
  priceBounds?: { min: number; max: number; currency: string }
  inDrawer?: boolean
}

/**
 * Reusable animated Accordion wrapper for premium UI styling.
 */
const AccordionItem = ({
  title,
  icon,
  activeCount = 0,
  defaultOpen = false,
  children,
}: {
  title: string
  icon: string
  activeCount?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-line last:border-b-0 py-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left group focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-surface text-ink/75 group-hover:bg-primary/5 group-hover:text-primary transition-all">
            <i className={`ph-bold ${icon} text-[15px]`} />
          </span>
          <span className="font-semibold text-ink/80 text-[12px] tracking-wider uppercase">{title}</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center bg-primary text-primary-fg text-[10px] font-bold rounded-full w-5 h-5 shadow-sm">
              {activeCount}
            </span>
          )}
        </div>
        <i className={`ph ph-caret-down text-[13px] text-ink/40 group-hover:text-ink transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="mt-4 animate-fade-in-top transition-all duration-300">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Custom modern checkbox wrapper.
 */
const CustomCheckbox = ({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  count?: number
}) => {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none py-1.5 group">
      <div className="relative flex items-center justify-center shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${
          checked
            ? "border-primary bg-primary text-primary-fg"
            : "border-line bg-bg group-hover:border-primary/50"
        }`}>
          {checked && <i className="ph-bold ph-check text-[10px]" />}
        </div>
      </div>
      <span className="text-sm text-ink/85 group-hover:text-primary transition-colors font-medium flex-1 min-w-0 truncate">
        {label}
      </span>
      {typeof count === "number" && (
        <span className="text-[11px] text-ink/40 tabular-nums shrink-0">{count}</span>
      )}
    </label>
  )
}

/**
 * Custom iOS-style toggle switch.
 */
const ToggleSwitch = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) => {
  return (
    <label className="flex items-center justify-between cursor-pointer select-none py-1.5 group">
      <span className="text-sm text-ink/85 group-hover:text-primary transition-colors font-medium">{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-10 h-6 rounded-full transition-colors duration-200 ease-in-out ${checked ? "bg-primary" : "bg-line"}`} />
        <div className={`absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-in-out shadow-soft ${checked ? "translate-x-4" : ""}`} />
      </div>
    </label>
  )
}

/**
 * Pick a Phosphor icon for a facet group from its label, falling back to
 * something sensible per facet kind. Purely cosmetic — an unknown label
 * still gets a usable icon.
 */
function getFacetIcon(group: FacetGroup): string {
  const k = `${group.label} ${group.param}`.toLowerCase()

  if (k.includes("size")) return "ph-ruler"
  if (k.includes("colour") || k.includes("color")) return "ph-palette"
  if (k.includes("condition") || k.includes("grade")) return "ph-seal-check"
  if (k.includes("material") || k.includes("fabric")) return "ph-scissors"
  if (k.includes("style") || k.includes("fit")) return "ph-t-shirt"
  if (k.includes("ram") || k.includes("storage") || k.includes("memory")) return "ph-database"
  if (k.includes("battery") || k.includes("charging") || k.includes("power")) return "ph-battery-full"
  if (k.includes("camera") || k.includes("lens")) return "ph-camera"
  if (k.includes("display") || k.includes("screen") || k.includes("resolution")) return "ph-monitor"
  if (k.includes("processor") || k.includes("chipset") || k.includes("cpu") || k.includes("gpu")) return "ph-cpu"
  if (k.includes("pta") || k.includes("warranty")) return "ph-shield-check"
  if (k.includes("wifi") || k.includes("bluetooth") || k.includes("nfc") || k.includes("network")) return "ph-wifi-high"
  if (k.includes("speaker") || k.includes("audio") || k.includes("sound")) return "ph-speaker-high"

  if (group.kind === "brand") return "ph-tag"
  if (group.kind === "category") return "ph-squares-four"
  if (group.kind === "option") return "ph-swatches"
  return "ph-sliders-horizontal"
}

/** How many groups start expanded before the rest collapse. */
const OPEN_BY_DEFAULT = 3

/**
 * Archive filter sidebar.
 *
 * Every group here is a FACET computed from the products on this page —
 * check a box and the grid narrows in place. There are no category or
 * brand links: navigation belongs to the menu and breadcrumbs, filtering
 * belongs here. Because the groups are derived, the same component works
 * unchanged on the shop page, a category, a sub-category, a brand or a
 * collection, on a store that models its attributes as specs, as variant
 * options, or as a category tree.
 */
const ShopFilters = ({
  facets = [],
  minPriceParam = "minPrice",
  maxPriceParam = "maxPrice",
  priceBounds,
  inDrawer = false,
}: Props) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const minPriceValue = searchParams.get(minPriceParam) || ""
  const maxPriceValue = searchParams.get(maxPriceParam) || ""
  const inStock = searchParams.get("inStock") === "true"

  const [minLocal, setMinLocal] = useState(minPriceValue)
  const [maxLocal, setMaxLocal] = useState(maxPriceValue)

  const activePriceCount = minPriceValue || maxPriceValue ? 1 : 0
  const activeAvailabilityCount = inStock ? 1 : 0

  const updateParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams)
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k)
        else params.set(k, v)
      }
      params.delete("page") // reset pagination
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router, searchParams]
  )

  const applyPrice = () => {
    updateParam({
      [minPriceParam]: minLocal || null,
      [maxPriceParam]: maxLocal || null,
    })
  }

  /** Values currently checked in a facet group. */
  const selectedFor = useCallback(
    (param: string) => {
      const raw = searchParams.get(param) || ""
      return raw
        ? raw.split(",").map((v) => v.trim()).filter(Boolean)
        : []
    },
    [searchParams]
  )

  /** One toggle for every facet kind — the param key is the only variable. */
  const toggleFacet = useCallback(
    (param: string, val: string, checked: boolean) => {
      let values = selectedFor(param)
      if (checked) {
        if (!values.includes(val)) values.push(val)
      } else {
        values = values.filter((v) => v !== val)
      }
      updateParam({ [param]: values.length ? values.join(",") : null })
    },
    [selectedFor, updateParam]
  )

  const facetParams = facets.map((f) => f.param)
  const hasActiveFilters =
    !!minPriceValue ||
    !!maxPriceValue ||
    inStock ||
    facetParams.some((p) => !!searchParams.get(p))

  const clearAll = () => {
    setMinLocal("")
    setMaxLocal("")
    const params = new URLSearchParams(searchParams)
    params.delete(minPriceParam)
    params.delete(maxPriceParam)
    params.delete("inStock")
    params.delete("page")
    for (const p of facetParams) params.delete(p)

    const keep = params.toString()
    router.replace(keep ? `${pathname}?${keep}` : pathname, { scroll: false })
  }

  return (
    <div
      className={`${inDrawer ? "px-4" : ""} text-sm text-ink pb-6`}
      data-testid="shop-filters"
    >
      {facets.map((group, i) => {
        const selected = selectedFor(group.param)
        return (
          <AccordionItem
            key={group.param}
            title={group.label}
            icon={getFacetIcon(group)}
            activeCount={selected.length}
            defaultOpen={selected.length > 0 || i < OPEN_BY_DEFAULT}
          >
            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto no-scrollbar pt-1 pr-1">
              {group.values.map((v) => (
                <CustomCheckbox
                  key={v.value}
                  checked={selected.includes(v.value)}
                  onChange={(checked) => toggleFacet(group.param, v.value, checked)}
                  label={`${v.label}${group.unit ? ` ${group.unit}` : ""}`}
                  count={v.count}
                />
              ))}
            </div>
          </AccordionItem>
        )
      })}

      {/* Price range */}
      <AccordionItem title="Price" icon="ph-coins" activeCount={activePriceCount} defaultOpen={false}>
        {priceBounds && (
          <p className="text-xs text-ink/50 mb-3.5 font-medium">
            {priceBounds.currency.toUpperCase()} {priceBounds.min} – {priceBounds.max}
          </p>
        )}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="numeric"
              placeholder="Min"
              value={minLocal}
              onChange={(e) => setMinLocal(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyPrice()
              }}
              className="w-full h-[38px] px-3 text-sm rounded-xl border border-line bg-bg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium"
            />
          </div>
          <span className="text-ink/30 font-medium">—</span>
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="numeric"
              placeholder="Max"
              value={maxLocal}
              onChange={(e) => setMaxLocal(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyPrice()
              }}
              className="w-full h-[38px] px-3 text-sm rounded-xl border border-line bg-bg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium"
            />
          </div>
        </div>
        <button
          onClick={applyPrice}
          className="mt-3.5 w-full h-9 rounded-xl bg-surface border border-line hover:border-primary/30 text-xs font-semibold text-ink transition-all focus:outline-none"
        >
          Apply Price Filter
        </button>
      </AccordionItem>

      {/* Availability */}
      <AccordionItem title="Availability" icon="ph-check-circle" activeCount={activeAvailabilityCount} defaultOpen={true}>
        <div className="flex flex-col gap-2 pt-1">
          <ToggleSwitch
            checked={inStock}
            onChange={(checked) => updateParam({ inStock: checked ? "true" : null })}
            label="In stock only"
          />
        </div>
      </AccordionItem>

      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="mt-6 w-full h-[42px] rounded-xl border border-line hover:border-primary text-sm font-semibold text-ink/75 hover:bg-surface transition-all focus:outline-none flex items-center justify-center gap-1.5"
        >
          <i className="ph-bold ph-trash-simple text-sm" />
          Clear all filters
        </button>
      )}
    </div>
  )
}

export default ShopFilters
