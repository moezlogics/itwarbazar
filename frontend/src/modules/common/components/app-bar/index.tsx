"use client"

import { useRouter } from "next/navigation"
import CartTrigger from "@modules/layout/components/cart-trigger"

type Props = {
  /** Centred screen title, e.g. "Product Details", "My Cart". */
  title: string
  /** Cart button on the right. Off on the cart/checkout screens themselves. */
  showCart?: boolean
  /** Where back goes when there's no history to pop. */
  fallbackHref?: string
}

/**
 * Mobile app bar for "sub-screens" — product, cart, checkout, order.
 *
 *   [◀ back]        Title        [🛍 cart]
 *
 * Cart uses the shared CartTrigger (same handbag icon + drawer logic
 * as the main header and bottom tab bar).
 */
export default function AppBar({
  title,
  showCart = true,
  fallbackHref = "/",
}: Props) {
  const router = useRouter()

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <>
      {/* Spacer — the bar is fixed so it never scrolls away. */}
      <div id="app-bar" aria-hidden className="small:hidden h-14" />

      <div className="small:hidden fixed top-0 inset-x-0 z-40 bg-bg/95 supports-[backdrop-filter]:bg-bg/85 backdrop-blur-xl border-b border-line/50">
        <div className="h-14 px-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="w-10 h-10 -ml-1 rounded-xl bg-surface text-ink flex items-center justify-center shrink-0 transition-transform active:scale-90"
          >
            <i className="ph-bold ph-caret-left text-[18px]" aria-hidden />
          </button>

          <h2 className="flex-1 text-center text-[15px] font-semibold text-ink truncate">
            {title}
          </h2>

          {showCart ? (
            <CartTrigger variant="appbar" />
          ) : (
            /* Keeps the title optically centred when there's no cart button. */
            <span className="w-10 h-10 -mr-1 shrink-0" aria-hidden />
          )}
        </div>
      </div>
    </>
  )
}
