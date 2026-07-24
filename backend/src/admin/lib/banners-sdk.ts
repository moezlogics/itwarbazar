export type AdminBanner = {
  id: string
  title: string | null
  subtitle: string | null
  image_url: string
  image_url_mobile: string | null
  link_url: string | null
  cta_label: string | null
  text_position: string
  theme: string
  sort_order: number
  is_active: boolean
  /** Section this banner belongs to. null = unassigned (legacy carousel). */
  section_id?: string | null
  /** Natural pixel size, measured on upload — drives the storefront ratio. */
  image_width?: number | null
  image_height?: number | null
  created_at?: string
  updated_at?: string
}

/** A CMS layout block that banners are grouped into. */
export type AdminBannerSection = {
  id: string
  title: string | null
  /** Columns: 1 = carousel, 2 = two-up, 3 = three-up (mobile included). */
  layout: number
  placement: string
  sort_order: number
  is_active: boolean
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
  return res.json()
}

export async function listBanners(): Promise<AdminBanner[]> {
  const res = await fetch("/admin/banners", { credentials: "include" })
  const json = await handle<{ banners: AdminBanner[] }>(res)
  return json.banners || []
}

export async function createBanner(
  data: Partial<AdminBanner>
): Promise<AdminBanner> {
  const res = await fetch("/admin/banners", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const json = await handle<{ banner: AdminBanner }>(res)
  return json.banner
}

export async function updateBanner(
  id: string,
  data: Partial<AdminBanner>
): Promise<AdminBanner> {
  const res = await fetch(`/admin/banners/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const json = await handle<{ banner: AdminBanner }>(res)
  return json.banner
}

export async function deleteBanner(id: string): Promise<void> {
  const res = await fetch(`/admin/banners/${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  await handle(res)
}

/* ── Banner sections ─────────────────────────────────────────────── */

export async function listBannerSections(): Promise<AdminBannerSection[]> {
  const res = await fetch("/admin/banner-sections", { credentials: "include" })
  const json = await handle<{ sections: AdminBannerSection[] }>(res)
  return json.sections || []
}

export async function createBannerSection(
  data: Partial<AdminBannerSection>
): Promise<AdminBannerSection> {
  const res = await fetch("/admin/banner-sections", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const json = await handle<{ section: AdminBannerSection }>(res)
  return json.section
}

export async function updateBannerSection(
  id: string,
  data: Partial<AdminBannerSection>
): Promise<AdminBannerSection> {
  const res = await fetch(`/admin/banner-sections/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const json = await handle<{ section: AdminBannerSection }>(res)
  return json.section
}

/** Deleting a section DETACHES its banners rather than destroying them. */
export async function deleteBannerSection(id: string): Promise<void> {
  const res = await fetch(`/admin/banner-sections/${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  await handle(res)
}

/**
 * Read an image's natural pixel size in the browser before upload.
 *
 * The storefront renders every banner at its own aspect ratio, so we
 * capture the real dimensions here and store them with the banner —
 * that's what lets the page reserve exact space (no layout shift) while
 * still never hardcoding a banner height.
 */
export function readImageSize(
  file: File
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const size = { width: img.naturalWidth, height: img.naturalHeight }
        URL.revokeObjectURL(url)
        resolve(size.width && size.height ? size : null)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      img.src = url
    } catch {
      resolve(null)
    }
  })
}
