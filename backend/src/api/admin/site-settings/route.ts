import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { SITE_SETTINGS_MODULE } from "../../../modules/site-settings"
import SiteSettingsModuleService from "../../../modules/site-settings/service"

// GET /admin/site-settings — fetch all settings as key-value map
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: SiteSettingsModuleService = req.scope.resolve(SITE_SETTINGS_MODULE)
  const settings = await svc.getAll()
  res.json({ settings })
}

// POST/PUT /admin/site-settings — bulk upsert
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  return PUT(req, res)
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const svc: SiteSettingsModuleService = req.scope.resolve(SITE_SETTINGS_MODULE)
  const body = (req.body || {}) as Record<string, any>
  const payload = (body.settings || body) as Record<string, any>
  await svc.bulkUpsert(payload)
  const settings = await svc.getAll()

  // Bust the storefront's cache immediately. The revalidate-storefront
  // subscriber listens for `site-settings.updated` and drops the
  // "site-settings" tag on the Next.js storefront — which also refreshes
  // the archive pages, since their render now reads these settings (e.g.
  // the "Hide from filters" list). Without this, a saved setting only
  // took effect after the passive ISR window (~minutes). Never fatal.
  try {
    const eventBus = req.scope.resolve(Modules.EVENT_BUS) as any
    await eventBus?.emit?.({ name: "site-settings.updated", data: {} })
  } catch (e) {
    console.warn("[site-settings] revalidation event emit failed:", (e as Error)?.message)
  }

  res.json({ settings })
}
