import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import StoreTemplate from "@modules/store/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import CategoryCarousel from "@modules/home/components/category-carousel"
import { buildCategoryPath, buildCategoryPathFromList } from "@lib/util/category-path"
import { listCategories, collectDescendantCategoryIds } from "@lib/data/categories"
import { getSiteSettings } from "@lib/data/site-settings"
import { resolveCategoryIconSize } from "@lib/util/category-icon-size"
import { resolveSubcategorySections } from "@lib/util/subcategory-sections"

export default async function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
  searchParams,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
  searchParams?: any
}) {
  if (!category || !countryCode) notFound()

  // Roll the parent category up over its whole subtree so its archive
  // page shows products filed under sub-categories too (Medusa's
  // category_id filter is not recursive on its own).
  const allCategories = await listCategories().catch(() => [])
  const categoryIds = collectDescendantCategoryIds(
    category.id,
    allCategories as any[]
  )

  // Build breadcrumb chain (reversed so root is first). Each
  // breadcrumb href uses the *full* parent-prefixed path so that
  // intermediate categories link to their canonical URL, not to a
  // possibly-404ing leaf-only handle.
  const parents: HttpTypes.StoreProductCategory[] = []
  const getParents = (cat: HttpTypes.StoreProductCategory) => {
    if (cat.parent_category) {
      parents.unshift(cat.parent_category)
      getParents(cat.parent_category)
    }
  }
  getParents(category)

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/store" },
    ...parents.map((p) => ({
      label: p.name,
      href: `/${buildCategoryPath(p)}`,
    })),
    { label: category.name },
  ]

  // Pre-compute the current category's path so subcategory carousel
  // items can be rendered as full parent-prefixed paths.
  const currentPath = buildCategoryPath(category)
  const categoryById = new Map(
    (allCategories || []).map((c: any) => [c.id, c])
  )

  const richContent = (category as any).metadata?.content as string | undefined

  // Admin-configured subcategory sections (category.metadata
  // `subcategory_sections`) + the shared category-icon size setting.
  const subcategorySections = resolveSubcategorySections(
    (category.category_children || []) as any[],
    (category as any).metadata?.subcategory_sections
  )
  const iconSize = resolveCategoryIconSize(
    await getSiteSettings().catch(() => ({} as any))
  )

  return (
    <>
      <StoreTemplate
        categoryId={category.id}
        categoryIds={categoryIds}
        currentCategoryHandle={category.handle}
        currentCategoryName={category.name}
        title={category.name}
        breadcrumbs={breadcrumbs}
        countryCode={countryCode}
        /* Banners targeted at THIS category (or subcategory) — the admin
           picks the category when creating the banner section. */
        bannerPlacement={`category:${category.id}`}
      >
        {/* Subcategory rails — ONE OR MORE admin-defined sections.
            The operator picks which children appear and can split them
            into titled groups ("Shop by Type", "Shop by Size", …). With
            nothing configured this renders a single untitled rail with
            every child, exactly as before. */}
        {subcategorySections.map((section, i) => (
          <div key={section.title || i} className="mb-2">
            {section.title && (
              <h2 className="mb-1 text-sm md:text-base font-bold text-ink">
                {section.title}
              </h2>
            )}
            <CategoryCarousel
              ariaLabel={section.title || "Subcategories"}
              iconSize={iconSize}
              items={section.items.map((c) => {
                // Resolve the child from the flat catalog so we can rebuild
                // the full parent path even when `category_children` lacks
                // nested `parent_category` (leaf-only → 404).
                const full = categoryById.get(c.id) || c
                const path =
                  buildCategoryPathFromList(full as any, allCategories as any[]) ||
                  `${currentPath}/${c.handle}`
                return {
                  id: c.id,
                  name: c.name,
                  handle: path,
                  image: (c as any).metadata?.image || null,
                }
              })}
            />
          </div>
        ))}
      </StoreTemplate>

      {/* Rich content from admin — rendered below products */}
      {richContent && (
        <div className="container-anvogue pb-12">
          <div className="border-t border-line pt-8 mt-4">
            <div
              className="prose prose-sm max-w-none text-ink/80 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: richContent }}
            />
          </div>
        </div>
      )}
    </>
  )
}
