"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react"
import { retrieveCustomer } from "@lib/data/customer"
import { retrieveCart, listCartOptions, getCurrentCartId } from "@lib/data/cart"
import { StoreCart, StoreCustomer, StoreCartShippingOption } from "@medusajs/types"

type UserDataContextType = {
  customer: StoreCustomer | null
  cart: StoreCart | null
  shippingOptions: StoreCartShippingOption[]
  ready: boolean
  /** Re-fetch cart (+ customer) from the server and update context. */
  refreshCart: () => Promise<StoreCart | null>
  /**
   * Push a known-good cart straight into context (e.g. the value a cart
   * server action just returned). Skips the multi-request re-hydrate —
   * this is what makes add / remove feel instant.
   */
  applyCart: (cart: StoreCart | null) => void
  /**
   * Apply an optimistic transform to the current cart and return a
   * rollback function. Call before the server round-trip; reconcile with
   * `applyCart` on success or `rollback()` on failure.
   */
  optimisticCartUpdate: (
    updater: (cart: StoreCart | null) => StoreCart | null
  ) => () => void
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined)

/**
 * Custom event name for cart mutations (adds, updates, deletes) triggered
 * inside client components. Listening to this allows the root context to
 * refresh its state immediately, keeping the header badge and drawer sync'd.
 */
const CART_UPDATE_EVENT = "medusa_cart_updated"

export function notifyCartUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CART_UPDATE_EVENT))
    window.dispatchEvent(new CustomEvent("cart-updated"))
  }
}

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<StoreCustomer | null>(null)
  const [cart, setCart] = useState<StoreCart | null>(null)
  const [shippingOptions, setShippingOptions] = useState<StoreCartShippingOption[]>([])
  const [ready, setReady] = useState(false)

  // Monotonic generation — drop stale in-flight hydrates so an older
  // response can't overwrite a newer ATC refresh.
  const genRef = useRef(0)

  const hydrate = useCallback(async (opts?: { keepPreviousOnNull?: boolean }) => {
    const keepPreviousOnNull = opts?.keepPreviousOnNull ?? true
    const gen = ++genRef.current

    try {
      const [cRes, cartId] = await Promise.all([
        retrieveCustomer().catch(() => null),
        getCurrentCartId().catch(() => null),
      ])

      // No cookie → cart is gone (e.g. order just placed). Clear local
      // state so badges don't keep showing the old count.
      if (!cartId) {
        if (gen !== genRef.current) return null
        startTransition(() => {
          setCustomer(cRes)
          setCart(null)
          setShippingOptions([])
          setReady(true)
        })
        return null
      }

      const cartRes = await retrieveCart(cartId).catch(() => null)

      if (gen !== genRef.current) return null

      let options: StoreCartShippingOption[] = []
      if (cartRes) {
        try {
          const { shipping_options } = await listCartOptions()
          options = shipping_options
        } catch {
          /* optional for badge sync */
        }
      }

      if (gen !== genRef.current) return null

      startTransition(() => {
        setCustomer(cRes)
        setCart((prev) => {
          if (cartRes) return cartRes
          // Cookie exists but fetch failed — keep previous to avoid
          // wiping a good cart on a transient network blip.
          if (keepPreviousOnNull) return prev
          return null
        })
        if (cartRes) setShippingOptions(options)
        setReady(true)
      })

      return cartRes
    } catch {
      if (gen === genRef.current) {
        startTransition(() => setReady(true))
      }
      return null
    }
  }, [])

  const refreshCart = useCallback(async () => {
    return hydrate({ keepPreviousOnNull: true })
  }, [hydrate])

  // Set a server-provided cart directly. Bumps the generation so any
  // hydrate still in flight can't overwrite this fresher value.
  const applyCart = useCallback((next: StoreCart | null) => {
    genRef.current++
    startTransition(() => {
      setCart(next)
      setReady(true)
    })
  }, [])

  // Optimistic edit: snapshot the current cart, apply the transform now,
  // hand back a rollback that restores the snapshot (and re-bumps the
  // generation so a late hydrate doesn't resurrect the failed change).
  const optimisticCartUpdate = useCallback(
    (updater: (cart: StoreCart | null) => StoreCart | null) => {
      genRef.current++
      let snapshot: StoreCart | null = null
      startTransition(() => {
        setCart((prev) => {
          snapshot = prev
          return updater(prev)
        })
        setReady(true)
      })
      return () => {
        genRef.current++
        startTransition(() => setCart(snapshot))
      }
    },
    []
  )

  useEffect(() => {
    const handleUpdate = () => {
      void hydrate({ keepPreviousOnNull: true })
    }
    window.addEventListener(CART_UPDATE_EVENT, handleUpdate)
    // Some client mutators (e.g. the chat widget) only dispatch the
    // lightweight "cart-updated" event — listen to it too so the badge
    // and drawer stay in sync no matter who changed the cart.
    window.addEventListener("cart-updated", handleUpdate)
    return () => {
      window.removeEventListener(CART_UPDATE_EVENT, handleUpdate)
      window.removeEventListener("cart-updated", handleUpdate)
    }
  }, [hydrate])

  useEffect(() => {
    void hydrate({ keepPreviousOnNull: true })
  }, [hydrate])

  return (
    <UserDataContext.Provider
      value={{
        customer,
        cart,
        shippingOptions,
        ready,
        refreshCart,
        applyCart,
        optimisticCartUpdate,
      }}
    >
      {children}
    </UserDataContext.Provider>
  )
}

export function useUserData() {
  const context = useContext(UserDataContext)
  if (context === undefined) {
    throw new Error("useUserData must be used within a UserDataProvider")
  }
  return context
}
