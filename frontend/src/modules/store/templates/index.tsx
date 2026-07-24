import { Suspense } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import SortDropdown from "@modules/store/components/sort-dropdown"
import ActiveFilters from "@modules/store/components/active-filters"
import ShopFilters from "@modules/store/components/shop-filters"
import MobileFilterDrawer from "@modules/store/components/mobile-filter-drawer"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { listCategories } from "@lib/data/categories"
import { listBrands } from "@lib/data/brands"
import { listProducts } from "@lib/data/products"
import { PRODUCT_ARCHIVE_FIELDS } from "@lib/util/product-card-fields"
import { buildFacets, type SpecTemplateField } from "@lib/util/facets"
import { isProductInStock } from "@lib/util/product"
import { getCacheOptions } from "@lib/data/cookies"
import { sdk } from "@lib/config"
import PaginatedProducts from "./paginated-products"
import { BrandsRailLayout } from "@modules/store/components/mobile-brands-sidebar"
import { listBannerSections } from "@lib/data/banners"
import BannerSections from "@modules/home/components/banner-sections"

type Props = {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  minPrice?: string
  maxPrice?: string
  inStock?: string
  /** When rendered from a category landing page. */
  categoryId?: string
  /**
   * Category id + every descendant id (parent archive roll-up). When
   * present this drives the product query so a parent category shows
   * sub-category products too. Falls back to `[categoryId]`.
   */
  categoryIds?: string[]
  /** When rendered from a collection landing page. */
  collectionId?: string
  /**
   * When rendered from a brand landing page — the set of product IDs
   * linked to that brand. Passed straight through to PaginatedProducts
   * so the grid only shows products belonging to the brand.
   */
  productsIds?: string[]
  currentCategoryHandle?: string
  currentCategoryName?: string
  /** Page header — overridden for categories / collections. */
  title?: string
  /** Breadcrumb trail override. */
  breadcrumbs?: Array<{ label: string; href?: string }>
  /** Custom children to render below title (e.g. category carousels) */
  children?: React.ReactNode
  searchParams?: Record<string, any>
  /**
   * Which banner placement to render at the TOP of this archive.
   *
   * Banners are not homepage-only: an operator can target any surface —
   * `"store"` for the shop page, `"category:<id>"` for one category or
   * subcategory, `"brand:<id>"` for a brand page. Pass the key the page
   * represents and this template renders that placement's sections above
   * everything else. Omit it and no banners render.
   */
  bannerPlacement?: string
}

/**
 * Shop / archive template — Shopify-premium layout:
 *   [Breadcrumb]
 *   [Title]                                    [Sort ▾]
 *   ────────────────────────────────────────────────────
 *   [Filter Sidebar]  |  [Chips]  [Count]
 *                     |  [Product grid]
 *                     |  [Pagination]
 *
 * On mobile, the sidebar collapses into a "Filters" pill that opens a
 * slide-in drawer.
 */
const StoreTemplate = async ({
  sortBy,
  page,
  countryCode,
  minPrice,
  maxPrice,
  inStock,
  categoryId,
  categoryIds,
  collectionId,
  productsIds,
  currentCategoryHandle,
  currentCategoryName,
  title,
  breadcrumbs,
  children,
  searchParams,
  bannerPlacement,
}: Props) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  // Banner sections targeted at THIS page. Never fatal — a banner fetch
  // failure must not take down the archive, so it falls back to [].
  const pageBanners = bannerPlacement
    ? await listBannerSections(bannerPlacement).catch(() => [])
    : []

  // Category product query rolls up descendants when available.
  const effectiveCategoryIds =
    categoryIds && categoryIds.length
      ? categoryIds
      : categoryId
      ? [categoryId]
      : undefined

  const [categories, brands, allProductsInScopeRes, specTemplatesRes] = await Promise.all([
    listCategories().catch(() => []),
    listBrands().catch(() => []),
    // When scoped to a brand with NO products (productsIds === []), skip
    // the catalog query entirely. Passing `id: []` makes Medusa drop the
    // filter and return everything, which would compute the facets from
    // the whole catalog instead of the (empty) brand scope.
    //
    // NOTE: these query params must stay byte-identical to the ones
    // PaginatedProducts uses — same fields, same limit, same order — so
    // Next's fetch cache serves BOTH from a single upstream request.
    productsIds !== undefined && productsIds.length === 0
      ? Promise.resolve({ response: { products: [], count: 0 } })
      : listProducts({
          pageParam: 1,
          queryParams: {
            limit: 100,
            fields: PRODUCT_ARCHIVE_FIELDS,
            order: "created_at",
            ...(effectiveCategoryIds ? { category_id: effectiveCategoryIds } : {}),
            ...(productsIds && productsIds.length ? { id: productsIds } : {}),
            ...(collectionId ? { collection_id: [collectionId] } : {}),
          },
          countryCode,
        }).catch(() => ({ response: { products: [], count: 0 } })),
    // Spec templates change about as often as the catalogue schema, but
    // this fetch carried no cache options at all — so every archive
    // render paid a fresh 0.4–1.4s round-trip for data that is
    // effectively static. `spec-templates` is already a global
    // revalidate tag, so the backend subscriber still busts it on edit.
    getCacheOptions("spec-templates")
      .then((next) =>
        sdk.client.fetch<{ spec_templates: any[] }>(`/store/spec-templates`, {
          next,
          cache: "force-cache",
        })
      )
      .catch(() => ({ spec_templates: [] })),
  ])

  // Out-of-stock products are hidden from archive grids (see
  // PaginatedProducts), so the facets must be computed from the same
  // filtered set — otherwise a shopper clicks "Size 42 (3)" and lands on
  // two results.
  const allProductsInScope = (allProductsInScopeRes.response.products || []).filter(
    isProductInStock
  )
  const specTemplates = specTemplatesRes.spec_templates || []

  // Every spec-template field, filterable or not. buildFacets needs the
  // full set: a field marked `is_filter: false` is an explicit "don't
  // filter on this", which is different from a field no template mentions
  // at all (those get auto-detected).
  const specFields = new Map<string, SpecTemplateField>()
  for (const t of specTemplates) {
    for (const g of t.template_data?.groups || []) {
      for (const f of g.fields || []) {
        if (f?.key) specFields.set(f.key, f as SpecTemplateField)
      }
    }
  }

  // The brands rail still renders the brand tree; the sidebar no longer
  // does (it shows a Brand FACET instead).
  const brandItems = (brands || [])
    .filter((b: any) => b.is_active)
    .map((b: any) => ({
      id: b.id,
      name: b.name,
      handle: b.handle,
      logo_url: b.logo_url || null,
      parent_id: (b as any).parent_id ?? null,
      sort_order: b.sort_order ?? 0,
    }))

  const activeCategoryObj = currentCategoryHandle
    ? (categories || []).find((c: any) => c.handle === currentCategoryHandle)
    : null

  // The archive's own category and its ancestors are never offered as
  // filters: every product here already belongs to them, so ticking one
  // would change nothing. Descendants stay — those DO narrow the page.
  const excludeCategoryIds = new Set<string>()
  for (
    let node: any = activeCategoryObj, guard = 0;
    node && guard < 10;
    node = node.parent_category, guard++
  ) {
    if (node.id) excludeCategoryIds.add(node.id)
  }

  const facets = buildFacets(allProductsInScope as any[], {
    specFields,
    excludeCategoryIds,
    brandNames: new Map(brandItems.map((b: any) => [b.handle, b.name])),
    // A brand archive is entirely one brand — that facet cannot split it.
    includeBrand: productsIds === undefined,
  })

  const crumbs =
    breadcrumbs ||
    [
      { label: "Home", href: "/" },
      { label: title || "Shop" },
    ]

  return (
    <div className="container-anvogue pt-2 pb-6" data-testid="category-container">
      {/* Page banners — full width above the brands rail (homepage pattern). */}
      {pageBanners.length > 0 && (
        <div className="mb-4 small:mb-6" data-testid="archive-banners">
          <BannerSections sections={pageBanners} />
        </div>
      )}

      {/* Category / subcategory rails + brand hero — also full width ABOVE
          the brands sidebar, matching homepage (banners + categories outside
          the products column). */}
      {children && <div className="mb-3 small:mb-5">{children}</div>}

      <BrandsRailLayout brands={brandItems}>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 mb-3 flex-wrap">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <span key={i} className="flex items-center gap-1.5">
              {c.href && !last ? (
                <LocalizedClientLink
                  href={c.href}
                  className="text-[12px] text-ink/55 hover:text-primary transition-colors"
                >
                  {c.label}
                </LocalizedClientLink>
              ) : (
                <span className="text-[12px] text-ink font-medium">{c.label}</span>
              )}
              {!last && <i className="ph ph-caret-right text-[10px] text-ink/40" aria-hidden />}
            </span>
          )
        })}
      </nav>

      {/* Title */}
      <div className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-line mb-4">
        <h1
          className="text-2xl md:text-3xl font-semibold tracking-tight text-ink"
          data-testid="store-page-title"
        >
          {title || "All Products"}
        </h1>
        <div className="flex items-center gap-2">
          <MobileFilterDrawer
            facets={facets}
            resultCount={0 /* resolved client-side by ShopFilters summary bar */}
          />
          <SortDropdown />
        </div>
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-1 small:grid-cols-[250px_1fr] gap-6">
        {/* Desktop sidebar — present on EVERY archive. Price and
            availability always apply, so it never renders empty. */}
        <aside className="hidden small:block">
          <div className="sticky top-[84px] max-h-[calc(100vh-100px)] overflow-y-auto no-scrollbar pr-1">
            <ShopFilters facets={facets} />
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0">
          {/* Active filter chips row */}
          <div className="mb-3 min-h-[2rem]">
            <ActiveFilters currentCategoryName={currentCategoryName} facets={facets} />
          </div>

          <Suspense fallback={<SkeletonProductGrid />}>
            <PaginatedProducts
              countryCode={countryCode}
              categoryId={categoryId}
              categoryIds={effectiveCategoryIds}
              collectionId={collectionId}
              productsIds={productsIds}
            />
          </Suspense>
        </div>
      </div>
      </BrandsRailLayout>
    </div>
  )
}

export default StoreTemplate
