"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useMemo } from "react"
import type { FacetGroup } from "@lib/util/facets"

type FilterChip = {
  label: string
  onRemove: () => void
}

/**
 * Renders the currently-applied filters as removable chips and a
 * "Clear all" action. Reads the relevant query params from the URL
 * directly and emits `router.replace()` mutations.
 *
 * Facet chips are driven by the same `facets` the sidebar renders, which
 * is how a chip can say "EUR 42" while the URL carries the category
 * handle `men-eur-42`. Removing a chip drops that ONE value, leaving the
 * rest of its group intact.
 */
const ActiveFilters = ({
  currentCategoryName,
  facets = [],
}: {
  currentCategoryName?: string
  facets?: FacetGroup[]
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const remove = useCallback(
    (keys: string[]) => {
      const params = new URLSearchParams(searchParams)
      for (const k of keys) params.delete(k)
      params.delete("page")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  /** Drop a single value from a multi-value facet param. */
  const removeValue = useCallback(
    (param: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      const rest = (params.get(param) || "")
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v && v !== value)
      if (rest.length) params.set(param, rest.join(","))
      else params.delete(param)
      params.delete("page")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const chips: FilterChip[] = useMemo(() => {
    const list: FilterChip[] = []

    for (const group of facets) {
      const raw = searchParams.get(group.param)
      if (!raw) continue
      const selected = raw.split(",").map((v) => v.trim()).filter(Boolean)
      for (const value of selected) {
        const match = group.values.find((v) => v.value === value)
        list.push({
          label: `${group.label}: ${match?.label ?? value}`,
          onRemove: () => removeValue(group.param, value),
        })
      }
    }

    const minP = searchParams.get("minPrice")
    const maxP = searchParams.get("maxPrice")
    const inStock = searchParams.get("inStock") === "true"

    if (minP && maxP) {
      list.push({
        label: `Price ${minP} – ${maxP}`,
        onRemove: () => remove(["minPrice", "maxPrice"]),
      })
    } else if (minP) {
      list.push({ label: `Min ${minP}`, onRemove: () => remove(["minPrice"]) })
    } else if (maxP) {
      list.push({ label: `Max ${maxP}`, onRemove: () => remove(["maxPrice"]) })
    }

    if (inStock) {
      list.push({ label: "In stock", onRemove: () => remove(["inStock"]) })
    }

    return list
  }, [searchParams, remove, removeValue, facets])

  if (!chips.length && !currentCategoryName) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {currentCategoryName && (
        <span className="inline-flex items-center gap-1.5 h-8 pl-3 pr-3 rounded-full bg-primary/10 text-primary text-[12px] font-semibold ring-1 ring-primary/20">
          <i className="ph-fill ph-bookmark-simple text-[11px]" aria-hidden />
          {currentCategoryName}
        </span>
      )}
      {chips.map((c, i) => (
        <button
          key={i}
          onClick={c.onRemove}
          className="group inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full bg-surface text-ink/80 text-[12px] font-medium border border-line hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-200 hover:scale-[1.03]"
        >
          {c.label}
          <span className="w-4 h-4 rounded-full bg-ink/10 group-hover:bg-primary group-hover:text-primary-fg flex items-center justify-center transition-colors">
            <i className="ph-bold ph-x text-[8px]" aria-hidden />
          </span>
        </button>
      ))}
      {chips.length > 0 && (
        <button
          onClick={() =>
            remove(["minPrice", "maxPrice", "inStock", ...facets.map((f) => f.param)])
          }
          className="text-[12px] font-medium text-ink/60 underline underline-offset-4 decoration-dotted hover:text-danger hover:decoration-solid ml-1 transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

export default ActiveFilters
