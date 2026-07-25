import { Metadata } from "next"
import { Suspense } from "react"

import { GridSkeleton } from "@modules/skeletons/templates/page-skeletons"
import { getRegion } from "@lib/data/regions"
import { getSiteSettings } from "@lib/data/site-settings"
import { parseCategoryBar } from "@lib/util/category-bar"
import { listBannerSections } from "@lib/data/banners"
import { canonicalUrl, ROBOTS_INDEX } from "@lib/util/seo-url"
import BannerSections from "@modules/home/components/banner-sections"
import ProductRail from "@modules/home/components/featured-products/product-rail"
import CategoryCarouselServer from "@modules/home/components/category-carousel/server"
import { listBrands } from "@lib/data/brands"
import { BrandsRailLayout } from "@modules/store/components/mobile-brands-sidebar"

/**
 * ISR — the homepage was the ONLY high-traffic route still rendering
 * on every request (ƒ in the build output) while product pages were
 * already cached (●). Every data source here is force-cache/revalidate
 * (banners 60s, settings, brands, products), so the page itself can be
 * served from the full-route cache and re-rendered in the background.
 * Same proven pattern as [...slug]: revalidate + empty static params.
 */
export const revalidate = 300
export async function generateStaticParams() {
  // Empty on purpose — the backend may be offline at build time. Each
  // countryCode renders once on first hit, then serves from cache.
  return []
}


/**
 * Homepage metadata comes from admin site-settings (SEO section) so operators
 * can update titles/descriptions without a redeploy. The root layout already
 * supplies default metadataBase + title template; this just refines the
 * homepage copy.
 */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings()
  const title = s.seo_home_title?.trim()
  const description = s.seo_home_description?.trim()
  const ogImage = s.seo_default_og_image?.trim()

  const home = canonicalUrl("/")

  const meta: Metadata = {
    // Homepage canonical mirrors the root URL — no `/<countryCode>` prefix
    // (the middleware adds that internally; the public URL never shows
    // it). Without this Google has nothing to consolidate against and
    // www / non-www / query-string variants compete for the same signal.
    alternates: { canonical: home },
    robots: ROBOTS_INDEX,
  }
  if (title) meta.title = title
  if (description) meta.description = description
  if (ogImage) {
    meta.openGraph = {
      title,
      description,
      url: home,
      images: [{ url: ogImage }],
      type: "website",
    }
    meta.twitter = {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    }
  } else {
    meta.openGraph = { url: home, type: "website" }
  }
  return meta
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params

  // Parallelize independent fetches so the homepage TTFB stays tight.
  const [region, bannerSections, settings, brands] = await Promise.all([
    getRegion(countryCode),
    listBannerSections("home"),
    getSiteSettings(),
    listBrands().catch(() => []),
  ])

  if (!region) return null

  const brandItems = (brands || [])
    .filter((b) => b.is_active)
    .map((b) => ({
      id: b.id,
      name: b.name,
      handle: b.handle,
      logo_url: b.logo_url,
      parent_id: b.parent_id,
    }))

  // Admin "Homepage Builder" sections — an ordered list of category rails
  // configured in /app/homepage and stored in site_settings as a JSON
  // string under `homepage_sections`. Malformed/empty → just the Latest
  // rail shows (back-compat).
  type HomeSection = {
    category_id: string
    category_name: string
    category_handle: string
    limit?: number
  }
  let homeSections: HomeSection[] = []
  try {
    const raw = (settings as any).homepage_sections
    if (raw && typeof raw === "string") {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        homeSections = parsed.filter(
          (s: any) => s && s.category_id && s.category_handle && s.category_name
        )
      }
    }
  } catch {
    /* malformed config → no category rails */
  }

  // Admin-curated top category bar (Homepage editor → "Top Category Bar").
  // mode "all" → all top-level; "custom" → chosen ids; "hidden" → no bar.
  const topCategoryBar = parseCategoryBar((settings as any).homepage_top_categories)

  return (
    <div className="container-anvogue pt-2 pb-6">
      {/* Banner CMS — admin-managed sections, each with its own layout
          (1 = carousel, 2 or 3 = split grid). Full width, above the
          brands sidebar; renders nothing when no banners are uploaded. */}
      {bannerSections.length > 0 && (
        <div className="mb-4 small:mb-6">
          <BannerSections sections={bannerSections} />
        </div>
      )}

      {/* Category icons — their OWN full-width container, like the
          banners. They used to live inside the products column (to the
          right of the brands sidebar), which squeezed them into a narrow
          strip sitting on top of the product grid. */}
      <div className="mb-3 small:mb-5">
        <CategoryCarouselServer
          selectedIds={topCategoryBar.ids}
          hidden={topCategoryBar.hidden}
        />
      </div>

      <BrandsRailLayout brands={brandItems}>
          {/* Show latest products directly below the categories.
              Wrapped in Suspense so the server STREAMS: the shell (sidebar
              + category rail + hero) flushes to the browser immediately and
              this product grid fills in a beat later behind a skeleton —
              instead of the whole page waiting for the product query before
              ANY pixels paint. This is the "above-fold first, rest streams"
              feel. */}
          <ul className="flex flex-col mt-0">
            <li>
              {/* Above-the-fold rail rendered IN THE SHELL (no Suspense):
                  its first product image is the mobile LCP. Behind a
                  Suspense skeleton the image swapped in late and Lighthouse
                  couldn't settle an LCP (NO_LCP → Performance errored). The
                  listing query is ISR-cached, so this rarely blocks TTFB,
                  and in return the LCP image ships in the initial HTML. */}
              <ProductRail region={region} />
            </li>
          </ul>

          {/* Admin-configured category rails (Homepage Builder), in order.
              Each streams independently so a slow category query never
              blocks the rest of the page. */}
          {homeSections.map((s) => (
            <ul key={s.category_id} className="flex flex-col mt-6 sm:mt-10">
              <li>
                <Suspense
                  fallback={<GridSkeleton count={Math.min(8, s.limit || 8)} />}
                >
                  <ProductRail
                    region={region}
                    category={{
                      id: s.category_id,
                      name: s.category_name,
                      handle: s.category_handle,
                    }}
                    limit={s.limit || 8}
                  />
                </Suspense>
              </li>
            </ul>
          ))}

          {/* Homepage Bottom Content */}
          {settings.page_home_content && (
            <div className="py-12 border-t border-line/45">
              <div className="max-w-3xl mx-auto">
                <div
                  className="prose prose-sm md:prose-base max-w-none text-secondary leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: settings.page_home_content }}
                />
              </div>
            </div>
          )}
      </BrandsRailLayout>
    </div>
  )
}
