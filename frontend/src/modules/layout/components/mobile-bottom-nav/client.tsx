"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { CartTabBarItem } from "@modules/layout/components/cart-trigger"

/**
 * App-style bottom tab bar — visible only on `< small` viewports.
 *
 * Cart uses the shared CartTabBarItem (same handbag + drawer logic as
 * the main header and PDP AppBar).
 */

type Slot = {
  /** Either an internal route (link) OR a no-route action like `ai`. */
  href: string | null
  label: string
  /** Phosphor icon name without the weight prefix. */
  icon: string
  /** Match function so route → active state is robust across locales. */
  matches: (pathname: string) => boolean
  /** When set, the slot is rendered as the central elevated FAB. */
  fab?: boolean
  /** Custom-event name dispatched on click instead of navigation. */
  emit?: string
  /** Shared cart trigger (handbag + drawer). */
  cart?: boolean
}

type Props = Record<string, never>

// Strip the `[countryCode]` segment so route matching works in
// every locale: `/pk/cart` → `/cart`.
const stripLocale = (p: string): string => {
  if (!p) return "/"
  const parts = p.split("/").filter(Boolean)
  // Locale codes are exactly 2 characters in our catalogue.
  if (parts.length && parts[0].length === 2) parts.shift()
  return "/" + parts.join("/")
}

export default function MobileBottomNavClient(_props: Props = {}) {
  const rawPath = usePathname() || "/"
  const path = stripLocale(rawPath)

  /**
   * Slot order matters: index 2 is rendered as the elevated center
   * FAB. Home now occupies the notch — it's the highest-traffic
   * destination, so promoting it to the always-thumb-reachable centre
   * matches Instagram / Reddit / Threads conventions. The AI launcher
   * keeps its prominence as a regular side tab with the same robot
   * glyph; tapping it still dispatches `open-ai-chat`.
   */
  const slots: Slot[] = useMemo(
    () => [
      {
        // Search — /search is just a redirect-to-home page; the
        // real search UI is the SmartSearchBar overlay listening for
        // the `open-mobile-search` event. Emit instead of navigating.
        href: null,
        label: "Search",
        icon: "magnifying-glass",
        matches: (p) => p.startsWith("/search"),
        emit: "open-mobile-search",
      },
      {
        // Support assistant — opens the chat sheet without route change.
        href: null,
        label: "Support",
        icon: "headset",
        matches: () => false,
        emit: "open-ai-chat",
      },
      {
        // Center-notch FAB — Home.
        href: "/",
        label: "Home",
        icon: "house",
        matches: (p) => p === "/" || p === "",
        fab: true,
      },
      {
        href: "/cart",
        label: "Cart",
        icon: "handbag",
        matches: (p) => p.startsWith("/cart"),
        cart: true,
      },
      {
        href: "/account",
        label: "Account",
        icon: "user-circle",
        matches: (p) => p.startsWith("/account"),
      },
    ],
    []
  )

  // Hide the bar entirely on the checkout page — the user is in a
  // single-purpose flow and any chrome competes for attention.
  if (path.startsWith("/checkout")) return null

  // Track the haptic press for the FAB so we can stage the launch
  // animation: a 120 ms scale-down on tap, then the chat opens.
  const [fabPressed, setFabPressed] = useState(false)

  // Ripple ping on tab change — gives the active icon a one-shot
  // "wave" that re-emits whenever the matched slot index changes,
  // mimicking Flutter's `InkWell` ripple. Pure CSS via `key` reset.
  const activeIdx = slots.findIndex((s) => s.matches(path))
  const [rippleKey, setRippleKey] = useState(0)
  const lastIdxRef = useRef(activeIdx)
  useEffect(() => {
    if (lastIdxRef.current !== activeIdx) {
      setRippleKey((k) => k + 1)
      lastIdxRef.current = activeIdx
    }
  }, [activeIdx])

  return (
    <>
      {/* Spacer so the fixed bar never covers page content. The
          notched FAB lives ABOVE the bar so the spacer only needs to
          match the bar's own height. Compact 46px bar — tighter than
          UIKit's 49pt and Material's 56dp for a more app-like feel. */}
      <div
        aria-hidden
        className="block small:hidden h-[var(--mobile-tabbar-h,44px)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      />

      <nav
        role="navigation"
        aria-label="Primary"
        className="small:hidden fixed bottom-0 inset-x-0 z-40"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          ["--mobile-tabbar-h" as any]: "44px",
        }}
      >
        {/* Curved Background Wrapper — solid admin footer theme colors
            (theme_footer_bg / theme_footer_border), not the page bg or
            translucent glass. Matches the desktop footer palette. */}
        <div 
          className="absolute inset-0 -z-10 flex flex-col pointer-events-none"
          style={{
            filter: "drop-shadow(0 -8px 20px rgba(0,0,0,0.08))",
          }}
        >
          {/* Top portion (44px) with the curve in the middle */}
          <div className="flex h-[44px] w-full items-stretch">
            <div 
              className="flex-1" 
              style={{ 
                backgroundColor: "rgb(var(--color-footer-bg))",
                borderTop: "1px solid rgb(var(--color-footer-border))",
                borderTopLeftRadius: "var(--radius-mobile-footer, 24px)",
              }} 
            />
            <div className="w-[100px] h-[44px] shrink-0 relative bg-transparent">
              <svg
                width="100"
                height="44"
                viewBox="0 0 100 44"
                className="absolute inset-0 w-full h-full"
                fill="none"
              >
                {/* Solid footer-bg cutout shape */}
                <path
                  d="M 0 0 L 15 0 C 30 0, 32 24, 50 24 C 68 24, 70 0, 85 0 L 100 0 L 100 44 L 0 44 Z"
                  fill="rgb(var(--color-footer-bg))"
                />
                {/* Top edge border — admin footer border color */}
                <path
                  d="M 0 0.5 L 15 0.5 C 30 0.5, 32 24.5, 50 24.5 C 68 24.5, 70 0.5, 85 0.5 L 100 0.5"
                  stroke="rgb(var(--color-footer-border))"
                  strokeWidth="1"
                  fill="none"
                />
              </svg>
            </div>
            <div 
              className="flex-1" 
              style={{ 
                backgroundColor: "rgb(var(--color-footer-bg))",
                borderTop: "1px solid rgb(var(--color-footer-border))",
                borderTopRightRadius: "var(--radius-mobile-footer, 24px)",
              }} 
            />
          </div>
          {/* Bottom portion (safe area) — same solid footer bg */}
          <div
            className="flex-1"
            style={{ backgroundColor: "rgb(var(--color-footer-bg))" }}
          />
        </div>

        {/* Active-tab top accent dot — sits above the icon, animates
            from one slot to the next via translate3d for 60 fps. */}
        {activeIdx >= 0 && !slots[activeIdx]?.fab && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 h-[3px] w-1/5 rounded-b-full bg-primary motion-safe:transition-transform motion-safe:duration-[450ms]"
            style={{
              transform: `translate3d(${activeIdx * 100}%, 0, 0) scaleX(0.45)`,
              transformOrigin: "center",
              transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
            }}
          />
        )}

        <ul className="grid grid-cols-5 h-[44px] items-stretch">
          {slots.map((s, idx) => {
            const active = s.matches(path)

            // ── Center elevated FAB ─────────────────────────────────
            if (s.fab) {
              // Visual FAB shell. Re-used whether the slot is a route
              // (renders inside <Link>) or an event emitter (inside
              // <button>) so animation & notch stay in lock-step.
              const fabClass = [
                "absolute left-1/2 -translate-x-1/2 -top-4",
                "w-11 h-11 rounded-full",
                "bg-primary text-primary-fg",
                "flex items-center justify-center",
                "shadow-[0_6px_14px_-6px_rgba(0,0,0,0.30)]",
                "motion-safe:transition-transform motion-safe:duration-200",
                "active:scale-95 hover:scale-[1.04]",
                fabPressed ? "scale-90" : "scale-100",
                "focus-visible:outline-none",
              ].join(" ")
              const fabStyle = {
                transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
                // Solid notch ring matching admin footer background
                boxShadow:
                  "0 0 0 3px rgb(var(--color-footer-bg)), 0 6px 14px -6px rgba(0,0,0,0.30)",
              } as const
              const fabBody = (
                <i
                  className={`ph-fill ph-${s.icon} text-[22px]`}
                  aria-hidden
                />
              )

              return (
                <li key={s.label} className="flex relative">
                  {/* Notch removed in favor of curved SVG background */}
                  {s.href ? (
                    <Link
                      href={s.href}
                      prefetch={false}
                      aria-label={s.label}
                      aria-current={active ? "page" : undefined}
                      onClick={() => {
                        setFabPressed(true)
                        setTimeout(() => setFabPressed(false), 200)
                      }}
                      className={fabClass}
                      style={fabStyle}
                    >
                      {fabBody}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      aria-label={s.label}
                      onClick={(e) => {
                        e.preventDefault()
                        setFabPressed(true)
                        setTimeout(() => setFabPressed(false), 200)
                        try {
                          window.dispatchEvent(
                            new CustomEvent(s.emit || "open-ai-chat")
                          )
                        } catch {}
                      }}
                      className={fabClass}
                      style={fabStyle}
                    >
                      {fabBody}
                    </button>
                  )}
                  {/* Empty label slot to preserve grid spacing — the
                      FAB itself floats so it has no in-flow content. */}
                  <span className="sr-only">{s.label}</span>
                </li>
              )
            }

            // ── Cart — shared handbag + drawer (same as header / AppBar)
            if (s.cart) {
              return (
                <li key={s.label} className="flex">
                  <CartTabBarItem
                    active={active}
                    rippleKey={rippleKey}
                  />
                </li>
              )
            }

            // ── Side tabs ───────────────────────────────────────────
            const inner = (
              <span
                className={[
                  "relative flex flex-col items-center justify-center gap-0.5 w-full h-full",
                  "text-[11px] font-semibold tracking-wide",
                  "motion-safe:transition-colors motion-safe:duration-200",
                  active ? "text-primary" : "",
                ].join(" ")}
                style={
                  active
                    ? undefined
                    : { color: "rgb(var(--color-footer-fg))" }
                }
              >
                {/* Icon container — pops on active state with a
                    Flutter-style overshoot, plus a ripple key reset
                    so each activation triggers a one-shot wave. */}
                <span
                  className={[
                    "relative inline-flex items-center justify-center",
                    "w-9 h-9 rounded-xl",
                    "motion-safe:transition-all motion-safe:duration-300",
                    active
                      ? "bg-primary/10 scale-105"
                      : "bg-transparent scale-100",
                  ].join(" ")}
                  style={{
                    transitionTimingFunction:
                      "cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                >
                  {/* One-shot ripple */}
                  {active && (
                    <span
                      key={`${rippleKey}-${idx}`}
                      aria-hidden
                      className="absolute inset-0 rounded-2xl bg-primary/20 motion-safe:animate-[ping_700ms_ease-out_1]"
                    />
                  )}

                  <i
                    className={[
                      active ? "ph-fill" : "ph",
                      `ph-${s.icon}`,
                      "text-[22px] leading-none relative z-10",
                      "motion-safe:transition-transform motion-safe:duration-300",
                      active ? "scale-110" : "scale-100",
                    ].join(" ")}
                    style={{
                      transitionTimingFunction:
                        "cubic-bezier(0.34,1.56,0.64,1)",
                      ...(active
                        ? {}
                        : { color: "rgb(var(--color-footer-fg))" }),
                    }}
                    aria-hidden
                  />
                </span>

                <span className="leading-none">{s.label}</span>
              </span>
            )

            return (
              <li key={s.href || s.label} className="flex">
                {s.href ? (
                  <Link
                    href={s.href}
                    prefetch={false}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "group relative flex-1",
                      "active:scale-95 motion-safe:transition-transform motion-safe:duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                    ].join(" ")}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-label={s.label}
                    onClick={() => {
                      // Side-tab buttons (no href) trigger a custom
                      // event that another component listens to —
                      // currently used by the AI chat sheet.
                      if (!s.emit) return
                      try {
                        window.dispatchEvent(new CustomEvent(s.emit))
                      } catch {}
                    }}
                    className="group relative flex-1 active:scale-95 motion-safe:transition-transform motion-safe:duration-150"
                  >
                    {inner}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
