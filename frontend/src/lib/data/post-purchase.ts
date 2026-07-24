// NOTE: uses the featherweight storeFetch (not the Medusa SDK) — this
// file is imported by the CLIENT return-wizard and the SDK would drag
// ~28 kB gz into that bundle. The my-* routes only need the
// publishable-key header (order ownership is checked via order_id).
import { storeFetch } from "./store-fetch"

export async function createStoreReturn(orderId: string, items: any[], returnShipping?: any) {
  return storeFetch<{ success: boolean; return: any }>("/store/my-returns", {
    method: "POST",
    body: {
      order_id: orderId,
      items,
      return_shipping: returnShipping,
    },
  })
}

export async function createStoreExchange(orderId: string, items: any[], returnShipping?: any, additionalItems?: any[]) {
  return storeFetch<{ success: boolean; exchange: any }>("/store/my-exchanges", {
    method: "POST",
    body: {
      order_id: orderId,
      items,
      return_shipping: returnShipping,
      additional_items: additionalItems,
    },
  })
}

export async function createStoreClaim(orderId: string, type: string, items: any[], returnShipping?: any, additionalItems?: any[]) {
  return storeFetch<{ success: boolean; claim: any }>("/store/my-claims", {
    method: "POST",
    body: {
      order_id: orderId,
      type, // "refund" or "replace"
      items,
      return_shipping: returnShipping,
      additional_items: additionalItems,
    },
  })
}

export async function listReturnReasons() {
  try {
    const data = await storeFetch<{ return_reasons: any[] }>(
      "/store/return-reasons"
    )
    return data?.return_reasons || []
  } catch (error) {
    console.error("[Return Reasons Fetch] Failed:", error)
    // Fallback default reasons if the endpoint fails
    return [
      { id: "wrong_size", label: "Wrong Size", value: "wrong_size" },
      { id: "defective", label: "Defective/Damaged", value: "defective" },
      { id: "not_as_described", label: "Not as Described", value: "not_as_described" },
      { id: "changed_mind", label: "Changed my Mind", value: "changed_mind" },
      { id: "other", label: "Other", value: "other" },
    ]
  }
}
