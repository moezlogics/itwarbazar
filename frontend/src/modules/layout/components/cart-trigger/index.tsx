"use client"

/**
 * Shared cart trigger — one icon, one badge, one open behaviour.
 *
 * Used by: main header (CartDropdown), PDP AppBar, mobile bottom tab bar.
 * Icon matches the storefront header: Phosphor bold handbag.
 * Click: open cart drawer when admin has it enabled, else go to /cart.
 * Count: live from UserDataProvider (keeps every surface in sync).
 */

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useCartDrawer } from "@lib/context/cart-drawer-context"
import { useUserData } from "@lib/context/user-data-context"
import { HttpTypes } from "@medusajs/types"

export function getCartItemCount(cart?: HttpTypes.StoreCart | null): number {
  return cart?.items?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0
}

/** Canonical cart glyph — same as the main storefront header. */
export function CartHandbagIcon({
  className = "text-[20px]",
  filled = false,
}: {
  className?: string
  /** Tab-bar active state may use the filled weight. */
  filled?: boolean
}) {
  return (
    <i
      className={`${filled ? "ph-fill" : "ph-bold"} ph-handbag ${className}`}
      aria-hidden
    />
  )
}

import type { CSSProperties } from "react"

/** Canonical count badge — primary chip (header style). */
export function CartCountBadge({
  count,
  ringClass = "ring-2 ring-header",
  testId,
  style,
}: {
  count: number
  ringClass?: string
  testId?: string
  style?: CSSProperties
}) {
  if (count <= 0) return null
  return (
    <span
      data-testid={testId}
      className={`absolute -top-0.5 -right-0.5 z-20 min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-primary-fg bg-primary flex items-center justify-center rounded-full tabular-nums ${ringClass}`}
      style={style}
      aria-label={`${count} item${count === 1 ? "" : "s"} in cart`}
    >
      {count > 9 ? "9+" : count}
    </span>
  )
}

export function useCartTrigger() {
  const { cart } = useUserData()
  const { open, enabled } = useCartDrawer()
  const count = getCartItemCount(cart)

  return {
    count,
    cartDrawerEnabled: enabled,
    openCart: open,
  }
}

type Variant = "header" | "appbar"

const shellClass: Record<Variant, string> = {
  header:
    "relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-header-hover text-header-fg hover:text-header-accent transition-all duration-200 hover:scale-[1.05] active:scale-90",
  appbar:
    "relative w-10 h-10 -mr-1 rounded-xl bg-surface text-ink flex items-center justify-center shrink-0 transition-transform active:scale-90",
}

/**
 * Icon button / link used in the header and AppBar.
 * Bottom tab bar uses `CartTabBarItem` (needs label + active chrome).
 */
export default function CartTrigger({
  variant = "header",
  className = "",
  /** Optional override when parent already has cart (e.g. CartDropdown). */
  count: countOverride,
}: {
  variant?: Variant
  className?: string
  count?: number
}) {
  const { count: liveCount, cartDrawerEnabled, openCart } = useCartTrigger()
  const count = typeof countOverride === "number" ? countOverride : liveCount
  const ringClass = variant === "appbar" ? "ring-2 ring-bg" : "ring-2 ring-header"
  const classes = `${shellClass[variant]} ${className}`.trim()
  const label = `Cart, ${count} item${count === 1 ? "" : "s"}`

  const body = (
    <>
      <CartHandbagIcon className="text-[20px]" />
      <CartCountBadge
        count={count}
        ringClass={ringClass}
        testId={variant === "header" ? "nav-cart-count" : undefined}
      />
    </>
  )

  if (cartDrawerEnabled) {
    return (
      <button
        type="button"
        onClick={openCart}
        data-testid="nav-cart-link"
        aria-label={label}
        className={classes}
      >
        {body}
      </button>
    )
  }

  return (
    <LocalizedClientLink
      href="/cart"
      data-testid="nav-cart-link"
      aria-label={label}
      className={classes}
    >
      {body}
    </LocalizedClientLink>
  )
}

/**
 * Bottom-tab cart slot — same handbag + open logic, with tab-bar chrome.
 */
export function CartTabBarItem({
  active,
  rippleKey,
}: {
  active: boolean
  rippleKey: number
}) {
  const { count, cartDrawerEnabled, openCart } = useCartTrigger()
  const label = "Cart"

  const inner = (
    <span
      className={[
        "relative flex flex-col items-center justify-center gap-0.5 w-full h-full",
        "text-[11px] font-semibold tracking-wide",
        "motion-safe:transition-colors motion-safe:duration-200",
        active ? "text-primary" : "",
      ].join(" ")}
      style={active ? undefined : { color: "rgb(var(--color-footer-fg))" }}
    >
      <span
        className={[
          "relative inline-flex items-center justify-center",
          "w-9 h-9 rounded-xl",
          "motion-safe:transition-all motion-safe:duration-300",
          active ? "bg-primary/10 scale-105" : "bg-transparent scale-100",
        ].join(" ")}
        style={{
          transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {active && (
          <span
            key={rippleKey}
            aria-hidden
            className="absolute inset-0 rounded-2xl bg-primary/20 motion-safe:animate-[ping_700ms_ease-out_1]"
          />
        )}
        <CartHandbagIcon
          filled={active}
          className={[
            "text-[22px] leading-none relative z-10",
            "motion-safe:transition-transform motion-safe:duration-300",
            active ? "scale-110" : "scale-100",
          ].join(" ")}
        />
        <CartCountBadge
          count={count}
          ringClass=""
          testId="tabbar-cart-count"
          style={{ boxShadow: "0 0 0 2px rgb(var(--color-footer-bg))" }}
        />
      </span>
      <span className="leading-none">{label}</span>
    </span>
  )

  const shell =
    "group relative flex-1 active:scale-95 motion-safe:transition-transform motion-safe:duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"

  if (cartDrawerEnabled) {
    return (
      <button
        type="button"
        aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
        aria-current={active ? "page" : undefined}
        onClick={openCart}
        className={shell}
      >
        {inner}
      </button>
    )
  }

  return (
    <LocalizedClientLink
      href="/cart"
      aria-current={active ? "page" : undefined}
      className={shell}
    >
      {inner}
    </LocalizedClientLink>
  )
}
