"use client"

import { addToCart } from "@lib/data/cart"
import { trackAddToCart } from "@lib/analytics"
import { useUserData } from "@lib/context/user-data-context"
import { appendOptimisticLine } from "@lib/util/optimistic-cart"
import { useCartDrawer } from "@lib/context/cart-drawer-context"

import { HttpTypes } from "@medusajs/types"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import ProductPrice from "../product-price"

import { useRouter } from "next/navigation"
import OptionSelect from "@modules/products/components/product-actions/option-select"

import QuantityStepper from "../quantity-stepper"

import WhatsAppOrderButton from "@modules/common/components/whatsapp-button"
import SizeChart from "@modules/products/components/size-chart"
import ProductTrustBadges from "@modules/products/components/product-trust-badges"
import { getProductPrice } from "@lib/util/get-product-price"
import { getPreorderState } from "@lib/util/preorder"
import CompareButton from "@modules/products/components/compare/compare-button"
import { useCompare, CompareItem, COMPARE_MAX } from "@modules/products/components/compare/context"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
  whatsappNumber?: string
  whatsappBuyNowEnabled?: boolean
  /** Store size-chart image (admin site-setting → env). Hidden when unset. */
  sizeChartUrl?: string | null
  reviewStats?: {
    averageRating: number
    reviewCount: number
  } | null
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt: any) => {
    acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

// Flat string-record equality — replaces lodash.isEqual, which was the
// only reason the FULL lodash bundle (~24 kB gz) shipped on every PDP.
// Variant option maps are Record<option_id, value>, so shallow is exact.
const sameOptions = (
  a?: Record<string, string | undefined>,
  b?: Record<string, string | undefined>
) => {
  if (!a || !b) return a === b
  const ak = Object.keys(a)
  if (ak.length !== Object.keys(b).length) return false
  return ak.every((k) => a[k] === b[k])
}

/**
 * PDP action panel — compact, professional.
 *
 * Buy It Now → goes DIRECTLY to checkout (not cart page).
 */
export default function ProductActions({
  product,
  disabled,
  whatsappNumber,
  whatsappBuyNowEnabled = true,
  sizeChartUrl,
  reviewStats,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [qty, setQty] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [isBuyingNow, setIsBuyingNow] = useState(false)
  const [stockWarning, setStockWarning] = useState<string | null>(null)
  const countryCode = useParams().countryCode as string
  const compareContext = useCompare()
  const { open: openCartDrawer } = useCartDrawer()
  const { cart, applyCart, optimisticCartUpdate } = useUserData()

  // Manage body class for hiding bottom nav on PDP
  useEffect(() => {
    document.body.classList.add("is-pdp-page")
    return () => {
      document.body.classList.remove("is-pdp-page")
    }
  }, [])

  // Preselect on first load — first value of each option (falls back to
  // variants[0] if that combo isn't a real variant). Never re-force after
  // the shopper has picked something.
  useEffect(() => {
    const variants = product.variants ?? []
    if (variants.length === 0) return
    if (Object.keys(options).length > 0) return

    const variantFromUrl = variants.find((v) => v.id === searchParams.get("v_id"))
    if (variantFromUrl) {
      setOptions(optionsAsKeymap(variantFromUrl.options) ?? {})
      return
    }

    // Prefer the first listed value of every option (Size → first size, etc.)
    const defaults: Record<string, string> = {}
    for (const opt of product.options ?? []) {
      const first = opt.values?.[0]?.value
      if (opt.id && first) defaults[opt.id] = first
    }

    const matching =
      Object.keys(defaults).length > 0
        ? variants.find((v) =>
            sameOptions(optionsAsKeymap(v.options), defaults)
          )
        : undefined

    setOptions(
      optionsAsKeymap((matching ?? variants[0]).options) ?? defaults
    )
  }, [options, product.variants, product.options, searchParams])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }
    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return sameOptions(variantOptions, options)
    })
  }, [product.variants, options])

  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({ ...prev, [optionId]: value }))
  }

  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return sameOptions(variantOptions, options)
    })
  }, [product.variants, options])

  // Keep selected variant synced to the URL so refresh / share preserves it.
  //
  // Skip products with a single variant — there's nothing to choose, and
  // pushing ?v_id=... onto every PDP just pollutes the URL bar (and any
  // share / copy-link the user does) without benefit. Multi-variant
  // products still get the round-trip so refresh keeps the user's choice.
  useEffect(() => {
    const totalVariants = product.variants?.length ?? 0
    if (totalVariants <= 1) return

    const params = new URLSearchParams(searchParams.toString())
    const value = isValidVariant ? selectedVariant?.id : null

    if (params.get("v_id") === value) return

    if (value) params.set("v_id", value)
    else params.delete("v_id")

    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [selectedVariant, isValidVariant])

  const inStock = useMemo(() => {
    if (selectedVariant && !selectedVariant.manage_inventory) return true
    if (selectedVariant?.allow_backorder) return true
    if (
      selectedVariant?.manage_inventory &&
      (selectedVariant?.inventory_quantity || 0) > 0
    ) {
      return true
    }
    return false
  }, [selectedVariant])

  // Pre-order state from product metadata. When active we swap CTA
  // labels ("Add to Cart" → "Pre-order Now", "Buy Now" →
  // "Pre-order & Pay") and bypass the stock check so the buttons
  // remain enabled even when inventory is zero pre-launch.
  const preorder = useMemo(
    () => getPreorderState(product.metadata),
    [product.metadata]
  )

  const stockQty = selectedVariant?.inventory_quantity ?? 0
  const stockLabel = useMemo(() => {
    if (!selectedVariant) return null
    if (!inStock)
      return { text: "Out of stock", className: "bg-danger/10 text-danger" }
    if (
      selectedVariant.manage_inventory &&
      !selectedVariant.allow_backorder &&
      stockQty > 0 &&
      stockQty <= 10
    ) {
      return {
        text: `Only ${stockQty} left`,
        className: "bg-warning/15 text-warning",
      }
    }
    return { text: "In stock", className: "bg-success/10 text-success" }
  }, [selectedVariant, inStock, stockQty])

  // How many of the selected variant are already sitting in the cart
  const qtyInCart = useMemo(() => {
    if (!selectedVariant?.id || !cart?.items?.length) return 0
    return cart.items
      .filter((i) => i.variant_id === selectedVariant.id)
      .reduce((sum, i) => sum + (i.quantity || 0), 0)
  }, [cart?.items, selectedVariant?.id])

  // Hard inventory cap (ignored for preorder / backorder / unmanaged)
  const managesHardStock =
    !!selectedVariant?.manage_inventory &&
    !selectedVariant?.allow_backorder &&
    !preorder.isPreorder

  const maxAddable = managesHardStock
    ? Math.max(0, stockQty - qtyInCart)
    : 99

  // Keep qty within what can still be added when stock/cart changes
  useEffect(() => {
    if (!managesHardStock) return
    const cap = Math.max(1, maxAddable || 1)
    if (qty > cap) setQty(cap)
  }, [managesHardStock, maxAddable, qty])

  // Clear warning when the shopper switches variant
  useEffect(() => {
    setStockWarning(null)
  }, [selectedVariant?.id])

  const stockLimitMessage = (addingQty: number): string | null => {
    if (!managesHardStock) return null
    if (stockQty <= 0) return "This item is out of stock."
    if (qtyInCart + addingQty > stockQty) {
      if (qtyInCart >= stockQty) {
        return stockQty === 1
          ? "Only 1 left in stock — it's already in your cart."
          : `Only ${stockQty} left in stock — you already have ${qtyInCart} in your cart.`
      }
      const canAdd = Math.max(0, stockQty - qtyInCart)
      return stockQty === 1
        ? "Only 1 left in stock. You can't add more than that."
        : `Only ${stockQty} left in stock${
            qtyInCart > 0 ? ` (${qtyInCart} already in your cart)` : ""
          }. You can add ${canAdd} more.`
    }
    return null
  }

  const actionsRef = useRef<HTMLDivElement>(null)

  const trackAdd = () => {
    if (!selectedVariant) return
    trackAddToCart({
      id: product.id,
      title: product.title || "",
      variant: selectedVariant.title || "",
      price: selectedVariant.calculated_price?.calculated_amount || 0,
      quantity: qty,
      currency: selectedVariant.calculated_price?.currency_code || "usd",
    })
  }

  /** Optimistic line built from data already on the page. */
  const optimisticInput = () => ({
    cartId: cart?.id || "pending",
    variantId: selectedVariant!.id!,
    quantity: qty,
    unitPrice: selectedVariant!.calculated_price?.calculated_amount || 0,
    productId: product.id,
    productHandle: product.handle || undefined,
    productTitle: product.title || undefined,
    variantTitle: selectedVariant!.title || undefined,
    thumbnail: product.thumbnail,
    productImages: product.images,
  })

  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    const warn = stockLimitMessage(qty)
    if (warn) {
      setStockWarning(warn)
      return null
    }
    setStockWarning(null)
    setIsAdding(true)

    // Show the item in the drawer the instant they tap — the drawer opens
    // already populated instead of empty-then-filling.
    const rollback = optimisticCartUpdate((c) =>
      appendOptimisticLine(c, optimisticInput())
    )
    openCartDrawer()

    try {
      const fresh = await addToCart({
        variantId: selectedVariant.id,
        quantity: qty,
        countryCode,
      })
      applyCart(fresh)
      trackAdd()
    } catch (e) {
      rollback()
      setStockWarning(
        "Couldn't add that quantity — there may not be enough stock left."
      )
    } finally {
      setIsAdding(false)
    }
  }

  // Buy It Now → add to cart then go DIRECTLY to checkout
  const handleBuyItNow = async () => {
    if (!selectedVariant?.id) return

    const warn = stockLimitMessage(qty)
    if (warn) {
      setStockWarning(warn)
      return
    }
    setStockWarning(null)
    setIsBuyingNow(true)
    const rollback = optimisticCartUpdate((c) =>
      appendOptimisticLine(c, optimisticInput())
    )
    try {
      const fresh = await addToCart({
        variantId: selectedVariant.id,
        quantity: qty,
        countryCode,
      })
      applyCart(fresh)
      trackAdd()
      router.push(`/${countryCode}/checkout`)
    } catch (e) {
      rollback()
      setIsBuyingNow(false)
      setStockWarning(
        "Couldn't place that order — there may not be enough stock left."
      )
    }
  }

  // For pre-order products the inventory check is intentionally
  // ignored — admins use pre-order specifically because stock isn't
  // available yet. They still need a selected, valid variant though.
  const disabledAdd =
    (!preorder.isPreorder && !inStock) ||
    !selectedVariant ||
    !!disabled ||
    isAdding ||
    !isValidVariant

  // Sticky Bar button labels and disabling states
  const stickyButtonText = useMemo(() => {
    if (!selectedVariant && (product.variants?.length ?? 0) > 1) {
      return "Select Variant"
    }
    if (preorder.isPreorder) {
      return "Pre-order Now"
    }
    if (!inStock || (selectedVariant && !isValidVariant)) {
      return "Out of stock"
    }
    return "Add to Cart"
  }, [selectedVariant, product.variants, preorder.isPreorder, inStock, isValidVariant])

  const disabledStickyAdd =
    (selectedVariant && !preorder.isPreorder && !inStock) ||
    (selectedVariant && !isValidVariant) ||
    !!disabled ||
    isAdding

  const handleStickyAddToCart = async () => {
    if (!selectedVariant) {
      actionsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    await handleAddToCart()
  }

  const handleCompareClick = () => {
    if (!product.handle) return

    const currentCategoryId = product.categories?.[0]?.id ?? null
    const currentCategoryName = product.categories?.[0]?.name ?? null

    const currentItems = compareContext.items
    const sameCategoryItems = currentCategoryId 
      ? currentItems.filter((item) => item.categoryId === currentCategoryId)
      : []
    
    const currentItem: CompareItem = {
      handle: product.handle,
      title: product.title || product.handle,
      thumbnail: product.thumbnail || null,
      categoryId: currentCategoryId,
      categoryName: currentCategoryName,
    }

    const nextItems = [...sameCategoryItems]
    if (!nextItems.some((item) => item.handle === currentItem.handle)) {
      nextItems.push(currentItem)
    }

    const finalItems = nextItems.slice(0, COMPARE_MAX)
    compareContext.replaceAll(finalItems)

    const nextHandles = finalItems.map((item) => item.handle)
    router.push(`/${countryCode}/compare?h=${nextHandles.join(",")}`)
  }

  // ── Selling toggle (admin: product.metadata.for_sale) ──────────────
  // When OFF (the DEFAULT — unset products are not sellable online), the
  // product still shows fully (price, variants, specs, stock) but every
  // PURCHASE control is hidden: quantity stepper, Buy Now, Add to Cart,
  // WhatsApp-order, and the mobile sticky bar's add button. The product
  // is otherwise a complete, indexable PDP. Admin flips it ON per product
  // in the "Selling" widget. Variants are never touched.
  const forSale =
    (product.metadata as any)?.for_sale !== false &&
    (product.metadata as any)?.for_sale !== "false"
  // Compare defaults OFF (only an explicit `true` enables it).
  const comparable =
    (product.metadata as any)?.comparable === true ||
    (product.metadata as any)?.comparable === "true"

  return (
    <div className="flex flex-col gap-3.5" ref={actionsRef}>
      {/* Price — shown in-flow on all viewports (sticky bar also shows it
          on phones for thumb reach). */}
      <div className="w-full">
        <ProductPrice product={product} variant={selectedVariant} size="lg" />
      </div>

      {/* Variant pickers */}
      {(product.variants?.length ?? 0) > 1 && (
        <div className="flex flex-col gap-3 py-1">
          {(product.options || []).map((option) => (
            <OptionSelect
              key={option.id}
              option={option}
              current={options[option.id]}
              updateOption={setOptionValue}
              title={option.title ?? ""}
              data-testid="product-options"
              disabled={!!disabled || isAdding}
            />
          ))}
          {sizeChartUrl && (
            <div className="-mt-1">
              <SizeChart url={sizeChartUrl} />
            </div>
          )}
        </div>
      )}

      {/* Single-variant products still deserve the size chart link. */}
      {(product.variants?.length ?? 0) <= 1 && sizeChartUrl && (
        <div className="py-1">
          <SizeChart url={sizeChartUrl} />
        </div>
      )}

      {/* Stock status — just above quantity / buy actions */}
      {forSale && stockLabel && (
        <div className="flex items-center gap-2 text-xs font-medium text-ink/75 self-start">
          <span className="relative flex h-2 w-2">
            {!preorder.isPreorder && inStock && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                stockLabel.text.startsWith("Only") ? "bg-warning" : "bg-success"
              }`} />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              !inStock ? "bg-danger" : stockLabel.text.startsWith("Only") ? "bg-warning" : "bg-success"
            }`} />
          </span>
          <span>{stockLabel.text}</span>
          {qtyInCart > 0 && inStock && (
            <span className="text-ink/45">· {qtyInCart} in cart</span>
          )}
        </div>
      )}

      {/* Quantity Stepper — compact horizontal row on mobile */}
      {forSale && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink/50">
              Quantity
            </span>
            <QuantityStepper
              value={qty}
              onChange={(v) => {
                setStockWarning(null)
                setQty(v)
              }}
              min={1}
              max={
                managesHardStock
                  ? Math.max(1, maxAddable || 1)
                  : 99
              }
              disabled={!!disabled || isAdding || !inStock}
              onMaxAttempt={() => {
                const msg =
                  stockLimitMessage(qty + 1) ||
                  (stockQty === 1
                    ? "Only 1 left in stock."
                    : `Only ${stockQty} left in stock.`)
                setStockWarning(msg)
              }}
            />
          </div>

          {stockWarning && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] font-medium text-warning leading-snug"
            >
              <i className="ph-fill ph-warning-circle text-[14px] mt-0.5 shrink-0" aria-hidden />
              <span>{stockWarning}</span>
            </div>
          )}
        </div>
      )}

      {/* Add to Cart + Buy it now — side-by-side on all viewports.
          Hidden entirely when the product isn't for sale. */}
      {forSale && (
      <>
      {/* Buy Now + Add to Cart side-by-side (50/50) on every viewport.
          The fixed bottom bar ALSO carries Add to Cart on phones — both
          are intentional: in-flow for shoppers reading the options,
          bottom bar for thumb reach. */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleBuyItNow}
          disabled={disabledAdd || isBuyingNow}
          className="inline-flex items-center justify-center gap-1.5 h-12 px-3 sm:px-4 rounded-full bg-bg border border-primary text-primary text-[15px] sm:text-base font-bold tracking-wide transition-all duration-200 hover:bg-primary/5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBuyingNow ? (
            <>
              <i className="ph-bold ph-spinner animate-spin text-sm" aria-hidden />
              Processing…
            </>
          ) : preorder.isPreorder ? (
            "Pre-order & Pay"
          ) : (
            "Buy Now"
          )}
        </button>
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={disabledAdd}
          data-testid="add-product-button"
          className="inline-flex items-center justify-center gap-1.5 h-12 px-3 sm:px-4 rounded-full bg-primary text-primary-fg text-[15px] sm:text-base font-bold tracking-wide transition-all duration-200 shadow-[0_4px_14px_-6px_rgb(var(--color-primary)/0.4)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAdding ? (
            <>
              <i className="ph-bold ph-spinner animate-spin text-sm" aria-hidden />
              {preorder.isPreorder ? "Reserving…" : "Adding…"}
            </>
          ) : (
            // Same label logic as the sticky bar — before a variant is
            // picked this reads "Select Variant" (the old inline ternary
            // checked `!options` which is never true for {}, so it showed
            // a misleading "Out of stock" pre-selection).
            stickyButtonText
          )}
        </button>
      </div>

      {/* Order on WhatsApp — only when the selected variant is purchasable */}
      {whatsappNumber &&
        whatsappBuyNowEnabled &&
        selectedVariant &&
        isValidVariant &&
        (inStock || preorder.isPreorder) && (
        <WhatsAppOrderButton
          productTitle={product.title || ""}
          productHandle={product.handle || ""}
          whatsappNumber={whatsappNumber}
        />
      )}

      {/* Trust / policy tiles — below ATC */}
      <ProductTrustBadges />
      </>
      )}

      {/* Add-to-Compare — shown unless comparable is explicitly disabled */}
      {comparable && (
        <CompareButton
          product={{
            handle: product.handle,
            title: product.title,
            thumbnail: product.thumbnail,
            categoryId: product.categories?.[0]?.id ?? null,
            categoryName: product.categories?.[0]?.name ?? null,
          }}
          variant="pdp"
          className="w-full hidden lg:inline-flex"
        />
      )}

      {/* Mobile Fixed Bottom Bar — FootFlare `total-cart` layout:
          [price] · [Add To Cart pill] — keep within viewport on sale prices */}
      {forSale && (
        <div
          className="small:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg/95 backdrop-blur-md border-t border-line/60 px-3 py-2.5 flex items-center gap-2 max-w-[100vw] overflow-hidden shadow-[0_-8px_30px_rgba(0,0,0,0.08)]"
          style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
        >
          <StickyBarPrice product={product} selectedVariant={selectedVariant} />

          <button
            type="button"
            onClick={handleStickyAddToCart}
            disabled={disabledStickyAdd}
            className="h-11 px-3.5 sm:px-5 rounded-full bg-primary text-primary-fg text-[12px] sm:text-[13px] font-bold tracking-wide flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_-6px_rgb(var(--color-primary)/0.4)] hover:brightness-110 shrink-0 max-w-[48%]"
          >
            {isAdding ? (
              <>
                <i className="ph-bold ph-spinner animate-spin text-base" aria-hidden />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <i className="ph ph-shopping-cart-simple text-base" aria-hidden />
                <span>{stickyButtonText}</span>
              </>
            )}
          </button>
        </div>
      )}

    </div>
  )
}

/**
 * Big price block for the mobile fixed bottom bar (FootFlare
 * `.total-cart .price`). Tracks the selected variant so the amount
 * updates as the shopper picks options.
 */
function StickyBarPrice({
  product,
  selectedVariant,
}: {
  product: HttpTypes.StoreProduct
  selectedVariant?: HttpTypes.StoreProductVariant
}) {
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: selectedVariant?.id,
  })
  const price = selectedVariant ? variantPrice : cheapestPrice

  if (!price) return <div className="flex-1" />

  const isSale = price.price_type === "sale"

  return (
    <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center gap-0.5 pr-1">
      {isSale && (
        <del className="text-[10px] leading-none text-ink/45 truncate" suppressHydrationWarning>
          {price.original_price}
        </del>
      )}
      <span
        className="text-[18px] sm:text-[22px] font-bold leading-none text-ink truncate"
        suppressHydrationWarning
      >
        {price.calculated_price}
      </span>
    </div>
  )
}
