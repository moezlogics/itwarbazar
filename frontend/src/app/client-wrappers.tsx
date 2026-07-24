"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useUserData } from "@lib/context/user-data-context"
import { ChatWidgetErrorBoundary } from "@modules/chat-widget/error-boundary"

const PushPromptInner = dynamic(() => import("@modules/push/push-prompt"), { ssr: false })
const SmoothScrollInner = dynamic(() => import("@modules/common/components/smooth-scroll"), { ssr: false })
const TopProgressInner = dynamic(() => import("@modules/common/components/top-progress-bar"), { ssr: false })

export function ClientTopProgress() {
  return <TopProgressInner />
}

/**
 * Routes that render their own <AppBar> instead of the storefront header.
 *
 * MUST stay in sync with the inline <head> script in app/layout.tsx, and
 * ONLY list routes that actually render a bar — a route in here without
 * one has no header and no way back at all.
 *   products  → AppBar in the product template
 *   cart      → AppBar in the cart template
 *   checkout  → AppBar in the (checkout) layout
 *   account   → AccountMobileTopBar (signed in) / AppBar (guest)
 */
const APP_BAR_ROUTE_RE =
  /^\/(?:[a-z]{2}\/)?(?:products|cart|checkout|account)(?:\/|$)/

/**
 * Keeps the `app-bar-route` class on <html> in sync with the current route.
 *
 * An inline <head> script sets it on first paint (so the storefront header
 * never flashes before the page's own app bar). That script only runs on a
 * full document load, so without this the class would go stale on
 * client-side navigation — leaving the header hidden after moving from,
 * say, a product page to the homepage.
 */
export function PdpRouteSync() {
  const pathname = usePathname()
  useEffect(() => {
    document.documentElement.classList.toggle(
      "app-bar-route",
      APP_BAR_ROUTE_RE.test(pathname || "")
    )
  }, [pathname])
  return null
}

export function ClientPushPrompt() {
  const { customer } = useUserData()
  return <PushPromptInner customerId={customer?.id || null} />
}

/**
 * Chat widget loader — the widget is the single heaviest client chunk
 * (2k+ lines), and `dynamic({ ssr:false })` still fetched it on EVERY
 * page right after hydration, competing with images/interaction on
 * mobile. Instead we import() it only when:
 *   1. the browser goes idle (requestIdleCallback), or
 *   2. the user taps the Support tab (`open-ai-chat`) — in which case
 *      the tap is replayed after the chunk mounts so the sheet opens.
 */
export function ClientChatWidget({
  whatsappNumber,
  whatsappChatbotEnabled,
}: {
  whatsappNumber: string | null
  whatsappChatbotEnabled: boolean
}) {
  const { customer } = useUserData()
  const [Widget, setWidget] = useState<React.ComponentType<any> | null>(null)
  const pendingOpen = useRef(false)
  const loadingRef = useRef(false)

  const loadWidget = useCallback(() => {
    if (loadingRef.current) return
    loadingRef.current = true
    import("@modules/chat-widget")
      .then((m) => setWidget(() => m.default))
      .catch(() => {
        loadingRef.current = false
      })
  }, [])

  useEffect(() => {
    if (Widget) return
    const onIntent = () => {
      pendingOpen.current = true
      loadWidget()
    }
    window.addEventListener("open-ai-chat", onIntent)

    let idleId: number | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    if ("requestIdleCallback" in window) {
      idleId = (window as any).requestIdleCallback(loadWidget, { timeout: 5000 })
    } else {
      timeoutId = setTimeout(loadWidget, 3000)
    }
    return () => {
      window.removeEventListener("open-ai-chat", onIntent)
      if (idleId !== undefined) (window as any).cancelIdleCallback?.(idleId)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [Widget, loadWidget])

  // Replay a Support tap that arrived while the chunk was still loading —
  // the widget registers its own `open-ai-chat` listener on mount, so a
  // fresh event after mount opens the sheet exactly as a direct tap would.
  useEffect(() => {
    if (Widget && pendingOpen.current) {
      pendingOpen.current = false
      window.dispatchEvent(
        new CustomEvent("open-ai-chat", { detail: { open: true } })
      )
    }
  }, [Widget])

  if (!Widget) return null

  return (
    <ChatWidgetErrorBoundary>
      <Widget
        customerId={customer?.id || null}
        whatsappNumber={whatsappNumber}
        whatsappChatbotEnabled={whatsappChatbotEnabled}
      />
    </ChatWidgetErrorBoundary>
  )
}

export function ClientSmoothScroll() {
  return <SmoothScrollInner />
}
