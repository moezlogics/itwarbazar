"use client"

import { useEffect } from "react"
import { getGuestId, addGuestOrder } from "@lib/util/guest"
import { linkGuestOrder } from "@lib/data/guest"
import { notifyCartUpdated } from "@lib/context/user-data-context"

export default function GuestOrderSync({ orderId }: { orderId: string }) {
  useEffect(() => {
    if (!orderId) return

    // Cart cookie is cleared on place-order — refresh badges so header
    // / tab-bar don't keep showing the old count after confirmation.
    notifyCartUpdated()

    const guestId = getGuestId()
    if (!guestId) return

    addGuestOrder(orderId)
    linkGuestOrder(orderId, guestId)
  }, [orderId])

  return null
}
