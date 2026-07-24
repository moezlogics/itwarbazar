import { HttpTypes } from "@medusajs/types"

/**
 * Optimistic cart transforms.
 *
 * These build a plausible next-cart INSTANTLY from data the client
 * already holds, so the drawer, header badge and tab-bar update the
 * moment a shopper taps — no waiting on the server. The real cart from
 * the server action replaces this a beat later (see UserDataContext
 * `applyCart`), so any small drift (tax rounding, promotions) is
 * reconciled automatically. Nothing here is ever persisted.
 */

type Cart = HttpTypes.StoreCart
type LineItem = HttpTypes.StoreCartLineItem

/** Marks a line/cart as not-yet-confirmed so UI can show a subtle pending state. */
export const OPTIMISTIC_FLAG = "__optimistic"

export function isOptimistic(obj: any): boolean {
  return !!obj?.metadata?.[OPTIMISTIC_FLAG]
}

/** Sum line totals into the cart's headline figures (excl. tax/shipping). */
function recompute(cart: Cart): Cart {
  const items = cart.items || []
  const itemSubtotal = items.reduce(
    (sum, i) => sum + (i.unit_price ?? 0) * (i.quantity ?? 0),
    0
  )
  return {
    ...cart,
    // subtotal/total drive the drawer subtotal and free-shipping nudge.
    // We only touch item money here; the server reconciles tax/shipping.
    item_subtotal: itemSubtotal,
    subtotal: itemSubtotal,
    total: itemSubtotal,
  } as Cart
}

/**
 * Add a variant to the cart optimistically. If the same variant is
 * already present, its quantity is bumped instead of adding a duplicate
 * row — mirroring how Medusa merges line items.
 */
export function appendOptimisticLine(
  cart: Cart | null,
  input: {
    cartId: string
    variantId: string
    quantity: number
    unitPrice: number
    productId?: string
    productHandle?: string
    productTitle?: string
    variantTitle?: string
    thumbnail?: string | null
    productImages?: HttpTypes.StoreProductImage[] | null
  }
): Cart | null {
  if (!cart) return cart

  const existing = (cart.items || []).find(
    (i) => i.variant_id === input.variantId && !isOptimistic(i)
  )

  let items: LineItem[]
  if (existing) {
    items = (cart.items || []).map((i) =>
      i.id === existing.id
        ? {
            ...i,
            quantity: (i.quantity ?? 0) + input.quantity,
            total: (i.unit_price ?? 0) * ((i.quantity ?? 0) + input.quantity),
            original_total:
              (i.unit_price ?? 0) * ((i.quantity ?? 0) + input.quantity),
          }
        : i
    )
  } else {
    const line = {
      id: `optimistic_${input.variantId}_${Date.now()}`,
      cart_id: input.cartId,
      variant_id: input.variantId,
      product_id: input.productId,
      product_handle: input.productHandle,
      product_title: input.productTitle,
      title: input.variantTitle || input.productTitle || "",
      thumbnail: input.thumbnail ?? null,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      total: input.unitPrice * input.quantity,
      original_total: input.unitPrice * input.quantity,
      subtotal: input.unitPrice * input.quantity,
      created_at: new Date().toISOString(),
      variant: {
        id: input.variantId,
        title: input.variantTitle,
        product: input.productImages ? { images: input.productImages } : undefined,
      },
      metadata: { [OPTIMISTIC_FLAG]: true },
    } as unknown as LineItem

    items = [line, ...(cart.items || [])]
  }

  return recompute({ ...cart, items })
}

/** Remove a line optimistically. Returns the cart even when it empties. */
export function removeOptimisticLine(cart: Cart | null, lineId: string): Cart | null {
  if (!cart) return cart
  const items = (cart.items || []).filter((i) => i.id !== lineId)
  return recompute({ ...cart, items })
}

/** Set a line's quantity optimistically. */
export function setOptimisticQuantity(
  cart: Cart | null,
  lineId: string,
  quantity: number
): Cart | null {
  if (!cart) return cart
  const items = (cart.items || []).map((i) =>
    i.id === lineId
      ? {
          ...i,
          quantity,
          total: (i.unit_price ?? 0) * quantity,
          original_total: (i.unit_price ?? 0) * quantity,
        }
      : i
  )
  return recompute({ ...cart, items })
}
