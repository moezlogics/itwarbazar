import "server-only"

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:3212"

export type Banner = {
  id: string
  title: string | null
  subtitle: string | null
  image_url: string
  image_url_mobile: string | null
  link_url: string | null
  cta_label: string | null
  sort_order: number
  is_active: boolean
  text_position?: string | null
  theme?: string | null
  /**
   * Natural pixel size of the image, captured at upload. Used to render
   * each banner at its OWN aspect ratio with no layout shift. Null on
   * banners uploaded before this existed.
   */
  image_width?: number | null
  image_height?: number | null
}

/** A CMS block of banners with its own column layout. */
export type BannerSection = {
  id: string
  title: string | null
  /** Columns: 1 = carousel, 2 = two-up, 3 = three-up (mobile included). */
  layout: number
  sort_order: number
  banners: Banner[]
}

/**
 * Fetch the banner CMS payload for a surface (default: homepage).
 *
 * Returns ordered sections, each with its own layout and banners. Falls
 * back to [] on any error so the page always renders.
 *
 * Back-compat: an older backend (before banner sections) returns only a
 * flat `banners` array — we wrap it into a single carousel section so the
 * storefront keeps working during a staged deploy.
 */
export async function listBannerSections(
  placement = "home"
): Promise<BannerSection[]> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/store/banners?placement=${encodeURIComponent(placement)}`,
      {
        headers: {
          "x-publishable-api-key":
            process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
        },
        // Short revalidate so admin edits propagate quickly without a rebuild.
        next: { revalidate: 60, tags: ["banners"] },
        cache: "force-cache",
      }
    )
    if (!res.ok) return []
    const data = await res.json()

    if (Array.isArray(data.sections)) {
      return data.sections as BannerSection[]
    }

    // Older backend — synthesize one carousel section.
    const flat = (data.banners || []) as Banner[]
    return flat.length
      ? [{ id: "legacy", title: null, layout: 1, sort_order: 0, banners: flat }]
      : []
  } catch (e) {
    console.error("[banners] list failed", e)
    return []
  }
}
