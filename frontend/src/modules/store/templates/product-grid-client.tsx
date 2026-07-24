"use client"

/**
 * Client-side grid controller for ISR archive pages.
 *
 * The server renders EVERY product card in scope once (query-independent →
 * ISR-cacheable HTML). This component then applies sort / price / stock /
 * spec filters and pagination CLIENT-SIDE by showing, hiding and
 * re-ordering the server-rendered cards based on the URL query. Filter
 * controls (SortDropdown, ShopFilters, Pagination…) keep pushing query
 * params exactly as before — nothing re-renders on the server.
 *
 * The URL is read through a tiny <SearchParamsBridge> wrapped in Suspense:
 * during static generation the bridge bails out (fallback null) so the
 * default listing stays in the static HTML for crawlers; on the client it
 * mounts and drives the reactive filtering.
 */
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Pagination } from "@modules/store/components/pagination"

const PRODUCT_LIMIT = 12

export type GridItemMeta = {
  id: string
  /** Cheapest calculated variant price — null when priceless. */
  price: number | null
  inStock: boolean
  upcoming: boolean
  createdAt: string | null
  /** Raw metadata.specs (string values) for spec_* filters. */
  specs: Record<string, unknown>
  /**
   * Facet values keyed by query param (`cat_*`, `opt_*`, `brand`), built
   * by buildFacetIndex from the same product the sidebar counted.
   */
  facets: Record<string, string[]>
}

function SearchParamsBridge({
  onParams,
}: {
  onParams: (qs: string) => void
}) {
  const searchParams = useSearchParams()
  const qs = searchParams.toString()
  useEffect(() => {
    onParams(qs)
  }, [qs, onParams])
  return null
}

/**
 * Filter + sort the in-scope items for the current query. Pagination is
 * NOT applied here — it's owned as local state by the component so page
 * changes never touch the server (the URL is updated via history only).
 */
function applyQuery(items: GridItemMeta[], qs: string) {
  const params = new URLSearchParams(qs)

  const sortBy = params.get("sortBy") || "created_at"
  const minP = params.get("minPrice") ? Number(params.get("minPrice")) : null
  const maxP = params.get("maxPrice") ? Number(params.get("maxPrice")) : null
  const inStockOnly = params.get("inStock") === "true"

  const specFilters: Record<string, string[]> = {}
  // Facet params (`cat_*`, `opt_*`, `brand`) are matched against the
  // product's prebuilt index. OR within a group, AND across groups —
  // picking two sizes widens the results, adding a colour narrows them.
  const facetFilters: Record<string, string[]> = {}
  params.forEach((val, key) => {
    if (!val) return
    const values = val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (!values.length) return

    if (key.startsWith("spec_")) {
      specFilters[key.substring(5)] = values
    } else if (key.startsWith("cat_") || key.startsWith("opt_") || key === "brand") {
      facetFilters[key] = values
    }
  })

  let indices = items.map((_, i) => i)

  indices = indices.filter((i) => {
    const it = items[i]
    if (inStockOnly && !it.inStock) return false
    if (minP !== null || maxP !== null) {
      if (it.price === null) return false
      if (minP !== null && it.price < minP) return false
      if (maxP !== null && it.price > maxP) return false
    }
    for (const [param, filterValues] of Object.entries(facetFilters)) {
      const owned = (it.facets || {})[param]
      if (!owned || !owned.length) return false
      if (!owned.some((v) => filterValues.includes(v))) return false
    }
    for (const [specKey, filterValues] of Object.entries(specFilters)) {
      if (filterValues.length === 0) continue
      const productVal = (it.specs || {})[specKey]
      const isBooleanFilter =
        filterValues.includes("Yes") || filterValues.includes("No")
      if (isBooleanFilter) {
        const isTrue =
          productVal === true ||
          String(productVal).trim() === "true" ||
          String(productVal).trim() === "Yes"
        if (!filterValues.includes(isTrue ? "Yes" : "No")) return false
      } else {
        if (productVal === null || productVal === undefined) return false
        const productParts = String(productVal)
          .trim()
          .split(",")
          .map((s) => s.trim().toLowerCase())
        const selected = filterValues.map((v) => v.trim().toLowerCase())
        if (!productParts.some((p) => selected.includes(p))) return false
      }
    }
    return true
  })

  if (sortBy === "price_asc" || sortBy === "price_desc") {
    indices.sort((a, b) => {
      const pa = items[a].price ?? Number.POSITIVE_INFINITY
      const pb = items[b].price ?? Number.POSITIVE_INFINITY
      return sortBy === "price_asc" ? pa - pb : pb - pa
    })
  } else {
    // created_at (latest first) — server already delivers this order, but
    // re-sorting keeps it correct after price-sort round trips.
    indices.sort((a, b) => {
      const da = items[a].createdAt ? Date.parse(items[a].createdAt!) : 0
      const db = items[b].createdAt ? Date.parse(items[b].createdAt!) : 0
      return db - da
    })
  }

  return { indices }
}

/** The filter/sort signature of a query, ignoring the page number. */
function filterSignature(qs: string): string {
  const p = new URLSearchParams(qs)
  p.delete("page")
  p.sort()
  return p.toString()
}

export default function ProductGridClient({
  items,
  cards,
  totalCount,
}: {
  items: GridItemMeta[]
  /** Server-rendered cards, same order as `items`. */
  cards: React.ReactNode[]
  /** Backend total for the unfiltered scope (may exceed items.length). */
  totalCount: number
}) {
  // null → not hydrated yet → render the server default (page 1, latest).
  const [qs, setQs] = useState<string | null>(null)
  // Pagination is LOCAL state — clicking a page never hits the server.
  const [page, setPage] = useState(1)
  const gridTopRef = useRef<HTMLDivElement>(null)
  const firstLoad = useRef(true)
  const filterKeyRef = useRef<string | null>(null)

  // Seed the page from the URL on first hydration (so a shared
  // `?page=3` link opens on page 3), then reset to 1 whenever the
  // FILTER/SORT signature changes — a new filter should start at page 1.
  useEffect(() => {
    if (qs === null) return
    const sig = filterSignature(qs)
    if (firstLoad.current) {
      firstLoad.current = false
      filterKeyRef.current = sig
      const urlPage = Math.max(
        1,
        parseInt(new URLSearchParams(qs).get("page") || "1", 10) || 1
      )
      if (urlPage !== 1) setPage(urlPage)
    } else if (sig !== filterKeyRef.current) {
      filterKeyRef.current = sig
      setPage(1)
    }
  }, [qs])

  const view = useMemo(() => {
    const { indices } = applyQuery(items, qs ?? "")
    const totalPages = Math.max(1, Math.ceil(indices.length / PRODUCT_LIMIT))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * PRODUCT_LIMIT
    const visible = indices.slice(start, start + PRODUCT_LIMIT)
    return { indices, visible, totalPages, page: safePage }
  }, [items, qs, page])

  // Instant page change: update local state + reflect it in the URL via
  // history (no navigation, no RSC round-trip), then scroll to the grid.
  const handlePageChange = useCallback((next: number) => {
    setPage(next)
    const params = new URLSearchParams(window.location.search)
    if (next <= 1) params.delete("page")
    else params.set("page", String(next))
    const nextQs = params.toString()
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (nextQs ? `?${nextQs}` : "")
    )
    gridTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const isFiltered = !!qs && qs.length > 0
  const shownTotal = isFiltered ? view.indices.length : Math.max(totalCount, view.indices.length)

  if (items.length === 0 || view.visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-large border border-dashed border-line bg-surface/40">
        <Suspense fallback={null}>
          <SearchParamsBridge onParams={setQs} />
        </Suspense>
        <i className="ph ph-package text-5xl text-ink/30 mb-4" aria-hidden />
        <p className="text-base font-semibold text-ink mb-1">No products found</p>
        <p className="text-sm text-ink/60">
          Try adjusting your filters or check back later.
        </p>
      </div>
    )
  }

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsBridge onParams={setQs} />
      </Suspense>
      <div ref={gridTopRef} className="scroll-mt-24" />
      <p className="text-xs text-ink/55 mb-4">
        Showing <span className="text-ink font-medium">{view.visible.length}</span>{" "}
        of {shownTotal} {shownTotal === 1 ? "product" : "products"}
      </p>
      <ul
        className="grid grid-cols-2 xsmall:grid-cols-3 small:grid-cols-4 medium:grid-cols-6 large:grid-cols-8 gap-x-2 small:gap-x-3 gap-y-3 small:gap-y-6"
        data-testid="products-list"
      >
        {view.visible.map((i) => (
          <li key={items[i].id}>{cards[i]}</li>
        ))}
      </ul>
      {view.totalPages > 1 && (
        <Pagination
          data-testid="product-pagination"
          page={view.page}
          totalPages={view.totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </>
  )
}
