import { MedusaService } from "@medusajs/framework/utils"
import { Banner } from "./models/banner"
import { BannerSection } from "./models/banner-section"

class BannersModuleService extends MedusaService({
  Banner,
  BannerSection,
}) {}

export default BannersModuleService
