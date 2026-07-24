import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BANNERS_MODULE } from "../../../../modules/banners"
import BannersModuleService from "../../../../modules/banners/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: BannersModuleService = req.scope.resolve(BANNERS_MODULE)
  const { id } = req.params
  const banner = await svc.retrieveBanner(id)
  res.json({ banner })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // The Medusa admin UI occasionally uses POST with an override; treat it
  // as a PATCH so the same route handles both idioms.
  return PATCH(req, res)
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const svc: BannersModuleService = req.scope.resolve(BANNERS_MODULE)
  const { id } = req.params
  const body = (req.body || {}) as Record<string, any>

  const update: Record<string, any> = { id }
  const allowed = [
    "title",
    "subtitle",
    "image_url",
    "image_url_mobile",
    "link_url",
    "cta_label",
    "sort_order",
    "is_active",
    "text_position",
    "theme",
    "section_id",
    "image_width",
    "image_height",
  ]
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // Coerce numeric form values so inputs don't persist strings.
  if (typeof update.sort_order === "string") {
    update.sort_order = parseInt(update.sort_order, 10) || 0
  }
  for (const k of ["image_width", "image_height"]) {
    if (k in update) {
      const n =
        typeof update[k] === "number" ? update[k] : parseInt(update[k], 10)
      update[k] = Number.isFinite(n) && n > 0 ? n : null
    }
  }

  const [banner] = await svc.updateBanners([update as any])
  res.json({ banner })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const svc: BannersModuleService = req.scope.resolve(BANNERS_MODULE)
  const { id } = req.params
  await svc.deleteBanners([id])
  res.json({ id, deleted: true })
}
