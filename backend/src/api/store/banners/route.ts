import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BANNERS_MODULE } from "../../../modules/banners"
import BannersModuleService from "../../../modules/banners/service"
import { cached } from "../../../utils/cache-response"

/**
 * GET /store/banners — public banner payload for the storefront.
 *
 * Returns BOTH shapes:
 *   • `sections` — the CMS structure: active sections (ordered) each with
 *     their active banners (ordered). This is what the storefront renders.
 *   • `banners`  — the legacy flat list of every active banner, kept so an
 *     older storefront build keeps working after this deploys.
 *
 * Banners whose `section_id` is null (created before sections existed) are
 * grouped into an implicit leading carousel section so nothing disappears
 * when this ships.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: BannersModuleService = req.scope.resolve(BANNERS_MODULE)
  const placement = (req.query.placement as string) || "home"

  const payload = await cached(
    req.scope,
    `store:banners:v2:${placement}`,
    120,
    async () => {
      const [banners, sections] = await Promise.all([
        svc.listBanners(
          { is_active: true },
          { order: { sort_order: "ASC" } as any, take: 200 }
        ),
        svc.listBannerSections(
          { is_active: true, placement },
          { order: { sort_order: "ASC" } as any, take: 50 }
        ),
      ])

      const byId = new Map<string, any[]>()
      const orphans: any[] = []
      for (const b of banners as any[]) {
        if (b.section_id) {
          if (!byId.has(b.section_id)) byId.set(b.section_id, [])
          byId.get(b.section_id)!.push(b)
        } else {
          orphans.push(b)
        }
      }

      const built = (sections as any[]).map((s) => ({
        id: s.id,
        title: s.title,
        layout: s.layout,
        sort_order: s.sort_order,
        banners: byId.get(s.id) || [],
      }))

      // Legacy banners (no section yet) lead as a single carousel so the
      // homepage looks exactly as it did before this feature shipped.
      //
      // HOMEPAGE ONLY: these predate placements, and the homepage is
      // where they used to render. Including them on every placement
      // would splash old hero artwork across every category and brand
      // page the moment this deploys.
      if (placement === "home" && orphans.length) {
        built.unshift({
          id: "legacy",
          title: null,
          layout: 1,
          sort_order: -1,
          banners: orphans,
        })
      }

      return {
        sections: built.filter((s) => s.banners.length > 0),
        banners,
      }
    }
  )

  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120")
  res.json(payload)
}
