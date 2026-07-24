"use server"

import { cache } from "react"
import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listRegions = cache(async () => {
  const next = {
    ...(await getCacheOptions("regions")),
  }

  return sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ regions }) => regions)
    .catch(medusaError)
})

export const retrieveRegion = cache(async (id: string) => {
  // Use the GLOBAL "regions" tag, not "regions-<id>". Per-id tags fall
  // outside GLOBAL_REVALIDATE_TAGS, so getCacheOptions fell through to
  // getCacheTag → cookies() — and that single cookies() read made every
  // ISR page that lists products by regionId (homepage rails, related
  // products) throw "Page changed from static to dynamic" (500) on its
  // first uncached render. Regions rarely change; one shared tag is fine.
  const next = {
    ...(await getCacheOptions("regions")),
  }

  return sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ region }) => region)
    .catch(medusaError)
})

const regionMap = new Map<string, HttpTypes.StoreRegion>()

export const getRegion = async (countryCode: string) => {
  try {
    if (regionMap.has(countryCode)) {
      return regionMap.get(countryCode)
    }

    const regions = await listRegions()

    if (!regions) {
      return null
    }

    regions.forEach((region) => {
      region.countries?.forEach((c) => {
        regionMap.set(c?.iso_2 ?? "", region)
      })
    })

    const region = countryCode
      ? regionMap.get(countryCode)
      : regionMap.get("pk")

    return region
  } catch (e: any) {
    return null
  }
}
