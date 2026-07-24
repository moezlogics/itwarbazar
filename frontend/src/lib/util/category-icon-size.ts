import type { SiteSettings } from "@lib/data/site-settings"

/**
 * Category icon sizing — ONE source of truth for every surface that
 * renders a category rail (homepage, shop, category and subcategory
 * pages), driven by the admin setting `category_icon_size`.
 *
 * Stored as the DESKTOP diameter in px. The mobile size is derived
 * (~72% of desktop, floored at 40px) so an operator only has to tune one
 * number and both breakpoints stay proportional.
 */
export type CategoryIconSize = {
  /** Icon diameter on phones, px. */
  mobile: number
  /** Icon diameter on `md:` and up, px. */
  desktop: number
  /** Width of the whole tile (icon + label), px — mobile. */
  tileMobile: number
  /** Width of the whole tile, px — desktop. */
  tileDesktop: number
}

export const CATEGORY_ICON_SIZE_DEFAULT = 84
export const CATEGORY_ICON_SIZE_MIN = 44
export const CATEGORY_ICON_SIZE_MAX = 160

/** Clamp + derive both breakpoints from the single admin value. */
export function resolveCategoryIconSize(
  settings?: SiteSettings | Record<string, any> | null
): CategoryIconSize {
  const raw = (settings as any)?.category_icon_size
  const parsed = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10)
  const desktop = Number.isFinite(parsed)
    ? Math.min(CATEGORY_ICON_SIZE_MAX, Math.max(CATEGORY_ICON_SIZE_MIN, parsed))
    : CATEGORY_ICON_SIZE_DEFAULT

  const mobile = Math.max(40, Math.round(desktop * 0.72))

  return {
    mobile,
    desktop,
    // A little breathing room around the icon for the label.
    tileMobile: mobile + 8,
    tileDesktop: desktop + 8,
  }
}
