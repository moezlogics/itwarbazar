import { model } from "@medusajs/framework/utils"

/**
 * A banner SECTION — the CMS container that banners live in.
 *
 * Why sections exist: the storefront used to support exactly one hero
 * carousel at the top of the homepage. Operators need to build a page
 * out of several banner blocks (a hero carousel, then a 2-up promo row,
 * then a 3-up category row, …), each with its own layout — the way
 * Shopify / Wix section builders work.
 *
 * `layout` is the number of COLUMNS the section renders:
 *   1 → single full-width banner, auto-rotating carousel when it holds
 *       more than one banner (this is the legacy hero behaviour)
 *   2 → two side-by-side banners, split on mobile too
 *   3 → three across, still three across on mobile
 *
 * `placement` scopes a section to a surface so the same system can later
 * drive banners on other pages without a schema change. Today the
 * storefront only reads "home".
 */
export const BannerSection = model.define("banner_section", {
  id: model.id({ prefix: "bansec" }).primaryKey(),
  /** Optional heading rendered above the banners. */
  title: model.text().nullable(),
  /** Columns: 1 (carousel), 2, or 3. */
  layout: model.number().default(1),
  /** Surface this section belongs to. "home" today. */
  placement: model.text().default("home"),
  sort_order: model.number().default(0),
  is_active: model.boolean().default(true),
})
