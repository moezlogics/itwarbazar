import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BANNERS_MODULE } from "../../../modules/banners"
import BannersModuleService from "../../../modules/banners/service"

const LAYOUTS = [1, 2, 3]

/** Clamp an incoming layout to a supported column count. */
function normalizeLayout(v: any): number {
  const n = typeof v === "number" ? v : parseInt(v, 10)
  return LAYOUTS.includes(n) ? n : 1
}

/**
 * GET /admin/banner-sections — every section (active + inactive) ordered
 * the same way the storefront renders them.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: BannersModuleService = req.scope.resolve(BANNERS_MODULE)
  const placement = (req.query.placement as string) || undefined

  const [sections, count] = await svc.listAndCountBannerSections(
    placement ? ({ placement } as any) : {},
    { order: { sort_order: "ASC" } as any, take: 100 }
  )

  res.json({ sections, count })
}

/** POST /admin/banner-sections — create a section. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: BannersModuleService = req.scope.resolve(BANNERS_MODULE)
  const body = (req.body || {}) as Record<string, any>

  const [section] = await svc.createBannerSections([
    {
      title: body.title ?? null,
      layout: normalizeLayout(body.layout),
      placement: body.placement || "home",
      sort_order:
        typeof body.sort_order === "number"
          ? body.sort_order
          : parseInt(body.sort_order, 10) || 0,
      is_active: body.is_active !== false,
    } as any,
  ])

  res.status(201).json({ section })
}
