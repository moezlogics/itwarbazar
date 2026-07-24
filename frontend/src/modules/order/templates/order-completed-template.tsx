import { cookies as nextCookies } from "next/headers"

import CartTotals from "@modules/common/components/cart-totals"
import OnboardingCta from "@modules/order/components/onboarding-cta"
import ShippingDetails from "@modules/order/components/shipping-details"
import PaymentDetails from "@modules/order/components/payment-details"
import OrderMapDisplay from "@modules/order/components/order-map-display"
import PurchaseTracker from "@modules/analytics/purchase-tracker"
import OrderTracker from "@modules/order/components/order-tracker"
import GuestOrderSync from "@modules/order/components/guest-order-sync"
import CopyButton from "@modules/order/components/copy-button"
import Thumbnail from "@modules/products/components/thumbnail"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { getSiteSettings, resolveProductCardAspectClass } from "@lib/data/site-settings"
import { convertToLocale } from "@lib/util/money"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
}

/**
 * Order confirmation — designed as a mobile-app receipt.
 *
 * One column, one surface language: a stack of clean white cards on a
 * calm tinted background, each with a small labelled header. No competing
 * gradients or heavy shadows — the hierarchy comes from spacing and a
 * single accent per card. Reads top-to-bottom like a native order screen
 * and scales up to a centred 640px column on desktop without changing
 * shape.
 */
export default async function OrderCompletedTemplate({
  order,
}: OrderCompletedTemplateProps) {
  const cookies = await nextCookies()
  const settings = await getSiteSettings()
  const aspectClass = resolveProductCardAspectClass(settings)
  const siteName = settings.site_name || "our store"
  const whatsapp = settings.whatsapp_number?.replace(/[^0-9+]/g, "") || ""

  const isOnboarding = cookies.get("_medusa_onboarding")?.value === "true"
  const meta = (order.metadata || {}) as Record<string, any>
  const itemCount =
    order.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0
  const orderDate = new Date(order.created_at).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const items = (order.items || [])
    .slice()
    .sort((a, b) => ((a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1))

  return (
    <div className="relative min-h-[calc(100vh-56px)] bg-surface/40">
      <div className="mx-auto w-full max-w-[640px] px-4 py-6 md:py-10 flex flex-col gap-4">
        {isOnboarding && <OnboardingCta orderId={order.id} />}
        <PurchaseTracker order={order} />
        <GuestOrderSync orderId={order.id} />

        <style>{`
          @keyframes oc-pop { 0%{transform:scale(.7);opacity:0} 70%{transform:scale(1.05);opacity:1} 100%{transform:scale(1);opacity:1} }
          @keyframes oc-check { to { stroke-dashoffset: 0 } }
          @keyframes oc-up { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        `}</style>

        {/* ── Hero ── */}
        <header className="flex flex-col items-center text-center pt-2 pb-1">
          <div
            className="relative w-16 h-16 rounded-full bg-success text-white flex items-center justify-center shadow-[0_10px_24px_-10px_rgb(var(--color-success)/0.6)]"
            style={{ animation: "oc-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both" }}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.75}
                d="M5 13l4 4L19 7"
                style={{
                  strokeDasharray: 28,
                  strokeDashoffset: 28,
                  animation: "oc-check 0.5s ease-out 0.25s forwards",
                }}
              />
            </svg>
          </div>

          <h1
            className="mt-4 text-2xl md:text-[28px] font-extrabold tracking-tight text-ink leading-tight"
            data-testid="order-complete-heading"
            style={{ animation: "oc-up 0.4s ease-out 0.1s both" }}
          >
            Order confirmed
          </h1>
          <p
            className="mt-2 text-[13px] text-ink/55 leading-relaxed max-w-sm"
            style={{ animation: "oc-up 0.4s ease-out 0.16s both" }}
          >
            Thanks{order.shipping_address?.first_name ? `, ${order.shipping_address.first_name}` : ""}! {siteName} is
            preparing your order. A confirmation was sent to{" "}
            <span className="font-semibold text-ink">{order.email}</span>.
          </p>
        </header>

        {/* ── Order-number pill ── */}
        <div
          className="flex items-center justify-between rounded-2xl bg-bg border border-line px-4 py-3"
          style={{ animation: "oc-up 0.4s ease-out 0.2s both" }}
        >
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink/40">
              Order number
            </span>
            <span className="font-mono text-base font-bold text-ink leading-tight">
              #{order.display_id}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/40">
                Placed
              </span>
              <span className="text-[12px] font-semibold text-ink">{orderDate}</span>
            </div>
            <CopyButton text={String(order.display_id)} />
          </div>
        </div>

        {/* ── Status tracker ── */}
        <div style={{ animation: "oc-up 0.4s ease-out 0.24s both" }}>
          <OrderTracker order={order} />
        </div>

        {/* ── Receipt: items + totals ── */}
        <section
          className="rounded-2xl bg-bg border border-line overflow-hidden"
          style={{ animation: "oc-up 0.4s ease-out 0.28s both" }}
        >
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-ink flex items-center gap-2">
              <i className="ph-bold ph-receipt text-primary text-base" aria-hidden />
              Order summary
            </h2>
            <span className="text-[11px] font-semibold text-ink/45">
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </span>
          </div>

          <ul className="divide-y divide-line/70">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3 flex gap-3 items-center">
                <div className={`w-14 shrink-0 rounded-xl overflow-hidden border border-line bg-surface ${aspectClass}`}>
                  <Thumbnail thumbnail={item.thumbnail} size="square" aspectClass={aspectClass} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13px] font-semibold text-ink truncate">
                    {item.product_title}
                  </h3>
                  {item.variant?.title && (
                    <LineItemOptions
                      variant={item.variant}
                      className="text-[11px] text-ink/45 mt-0.5 truncate"
                    />
                  )}
                  <p className="text-[11px] text-ink/45 mt-0.5">Qty {item.quantity}</p>
                </div>
                <LineItemPrice
                  item={item}
                  style="tight"
                  currencyCode={order.currency_code}
                  className="text-[13px] font-bold text-ink shrink-0"
                />
              </li>
            ))}
          </ul>

          <div className="px-4 py-3 bg-surface/50 border-t border-line">
            <CartTotals totals={order} />
          </div>
        </section>

        {/* ── Delivery & payment ── */}
        <section
          className="rounded-2xl bg-bg border border-line p-4 space-y-4"
          style={{ animation: "oc-up 0.4s ease-out 0.32s both" }}
        >
          <ShippingDetails order={order} hideHeading={false} />
          <div className="h-px bg-line/60" />
          <PaymentDetails order={order} hideHeading={false} />
        </section>

        {meta.map_lat && meta.map_lng && (
          <div
            className="rounded-2xl overflow-hidden border border-line"
            style={{ animation: "oc-up 0.4s ease-out 0.36s both" }}
          >
            <OrderMapDisplay metadata={meta} />
          </div>
        )}

        {/* ── Primary actions ── */}
        <div
          className="flex flex-col sm:flex-row gap-2.5"
          style={{ animation: "oc-up 0.4s ease-out 0.4s both" }}
        >
          <LocalizedClientLink
            href="/store"
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full bg-primary text-primary-fg text-sm font-bold shadow-[0_8px_22px_-8px_rgb(var(--color-primary)/0.55)] hover:brightness-110 active:scale-[0.98] transition-all"
          >
            Continue shopping
            <i className="ph-bold ph-arrow-right text-[13px]" aria-hidden />
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/account/orders"
            className="flex-1 inline-flex items-center justify-center h-12 rounded-full bg-bg border border-line text-ink text-sm font-semibold hover:bg-surface active:scale-[0.98] transition-all"
          >
            View my orders
          </LocalizedClientLink>
        </div>

        {/* ── Help ── */}
        <div
          className="flex items-center justify-between gap-3 rounded-2xl bg-bg border border-line px-4 py-3.5"
          style={{ animation: "oc-up 0.4s ease-out 0.44s both" }}
        >
          <div className="min-w-0">
            <h3 className="text-[13px] font-bold text-ink">Need help?</h3>
            <p className="text-[11px] text-ink/50 mt-0.5 truncate">
              Delivery, exchanges or refunds — we&apos;ve got you.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
                  `Hi! I need help with order #${order.display_id}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat on WhatsApp"
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-bold text-white bg-[#25D366] hover:brightness-105 transition"
              >
                <i className="ph-fill ph-whatsapp-logo text-base" aria-hidden />
                <span className="hidden xsmall:inline">WhatsApp</span>
              </a>
            )}
            <LocalizedClientLink
              href="/contact"
              className="inline-flex items-center justify-center h-9 px-3 rounded-full text-[12px] font-semibold text-ink border border-line bg-bg hover:bg-surface transition"
            >
              Contact
            </LocalizedClientLink>
          </div>
        </div>
      </div>
    </div>
  )
}
