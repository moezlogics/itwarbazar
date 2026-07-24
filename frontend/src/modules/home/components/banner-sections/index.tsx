import BannerImage from "./banner-image"
import BannerCarousel from "./carousel"
import type { BannerSection } from "@lib/data/banners"

/**
 * Renders the banner CMS: every active section, in order, each using the
 * column layout the operator picked.
 *
 *   layout 1 → one full-width banner, auto-rotating carousel if several
 *   layout 2 → two across — ALSO two across on mobile (not stacked)
 *   layout 3 → three across — ALSO three across on mobile
 *
 * "Also on mobile" is the point of the 2/3 layouts: the operator uploads
 * taller artwork for those, and the grid keeps the split so the page
 * looks like the mock-ups rather than collapsing to a single column.
 *
 * No section, banner, or image has a fixed height — each tile is exactly
 * as tall as its own artwork at the current column width.
 */
export default function BannerSections({
  sections,
}: {
  sections: BannerSection[]
}) {
  if (!sections?.length) return null

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {sections.map((section, si) => {
        const cols = section.layout === 3 ? 3 : section.layout === 2 ? 2 : 1
        // Each tile is 1/cols of the viewport, so the browser can pick a
        // correctly-sized source instead of always fetching full width.
        const sizes =
          cols === 1
            ? "100vw"
            : cols === 2
            ? "(max-width: 640px) 50vw, 50vw"
            : "(max-width: 640px) 33vw, 33vw"

        return (
          <section key={section.id} aria-label={section.title || undefined}>
            {section.title && (
              <h2 className="mb-2 sm:mb-3 text-base sm:text-lg font-bold text-ink">
                {section.title}
              </h2>
            )}

            {cols === 1 ? (
              <BannerCarousel banners={section.banners} />
            ) : (
              <div
                className={`grid gap-2 sm:gap-4 ${
                  cols === 2 ? "grid-cols-2" : "grid-cols-3"
                }`}
              >
                {section.banners.map((b, i) => (
                  <BannerImage
                    key={b.id}
                    banner={b}
                    // Only the very first section is above the fold.
                    priority={si === 0 && i < cols}
                    sizes={sizes}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
