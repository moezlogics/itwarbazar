// NOTE: uses the featherweight storeFetch (not the Medusa SDK) — this
// file is imported by CLIENT components (guest dashboard / order sync)
// and the SDK would drag ~28 kB gz into those bundles.
import { storeFetch } from "./store-fetch"

export async function fetchGuestOrders(guestId: string, orderIds: string[]) {
  try {
    const data = await storeFetch<{ orders: any[] }>("/store/my-orders/by-guest", {
      query: {
        guest_id: guestId,
        order_ids: orderIds.join(","),
      },
      cache: "no-store",
    })
    return data?.orders || []
  } catch (error) {
    console.error("[Guest Orders Fetch] Error:", error)
    return []
  }
}

export async function fetchGuestReviews(guestId: string) {
  try {
    const data = await storeFetch<{ reviews: any[] }>("/store/my-reviews/by-guest", {
      query: {
        guest_id: guestId,
      },
      cache: "no-store",
    })
    return data?.reviews || []
  } catch (error) {
    console.error("[Guest Reviews Fetch] Error:", error)
    return []
  }
}

export async function linkGuestOrder(orderId: string, guestId: string) {
  try {
    const data = await storeFetch<{ success: boolean }>("/store/my-orders/link-guest", {
      method: "POST",
      body: {
        order_id: orderId,
        guest_id: guestId,
      },
    })
    return data?.success || false
  } catch (error) {
    console.error("[Link Guest Order Fetch] Error:", error)
    return false
  }
}
