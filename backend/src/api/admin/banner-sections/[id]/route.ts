import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BANNERS_MODULE } from "../../../../modules/banners"
import BannersModuleService from "../../../../modules/banners/service"

const LAYOUTS = [1, 2, 3]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: BannersModuleService = req.scope.resolve(BANNERS_MODULE)
  const section = await svc.retrieveBannerSection(req.params.id)
  res.json({ section })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  return PATCH(req, res)
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const svc: BannersModuleService = req.scope.resolve(BANNERS_MODULE)
  const { id } = req.params
  const body = (req.body || {}) as Record<string, any>

  const update: Record<string, any> = { id }
  for (const key of ["title", "layout", "placement", "sort_order", "is_active"]) {
    if (key in body) update[key] = body[key]
  }

  if ("layout" in update) {
    const n =
      typeof update.layout === "number"
        ? update.layout
        : parseInt(update.layout, 10)
    update.layout = LAYOUTS.includes(n) ? n : 1
  }
  if (typeof update.sort_order === "string") {
    update.sort_order = parseInt(update.sort_order, 10) || 0
  }

  const [section] = await svc.updateBannerSections([update as any])
  res.json({ section })
}

/**
 * DELETE /admin/banner-sections/:id
 *
 * The section's banners are NOT deleted — they're detached
 * (`section_id = null`) so an operator never loses uploaded artwork by
 * removing a layout block. Detached banners fall back into the implicit
 * legacy carousel, and can be reassigned to another section.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const svc: BannersModuleService = req.scope.resolve(BANNERS_MODULE)
  const { id } = req.params

  const owned = await svc.listBanners({ section_id: id } as any, { take: 500 })
  if (owned.length) {
    await svc.updateBanners(
      (owned as any[]).map((b) => ({ id: b.id, section_id: null }))
    )
  }

  await svc.deleteBannerSections([id])
  res.json({ id, deleted: true, detached_banners: owned.length })
}
