"use client"

import { useUserData } from "@lib/context/user-data-context"
import CartDropdown from "../cart-dropdown"

export default function CartButton() {
  const { cart, ready } = useUserData()

  // Prevent flash of empty cart during hydration
  if (!ready) {
    return <CartDropdown cart={null} />
  }

  return <CartDropdown cart={cart} />
}
