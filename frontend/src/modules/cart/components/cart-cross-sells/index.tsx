"use client"

import { useEffect, useState } from "react"
import { HttpTypes } from "@medusajs/types"
import { listProducts } from "@lib/data/products"
import { addToCart } from "@lib/data/cart"
import { useUserData } from "@lib/context/user-data-context"
import { appendOptimisticLine } from "@lib/util/optimistic-cart"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { getProductPrice } from "@lib/util/get-product-price"
import { getProductPath, isProductInStock } from "@lib/util/product"
import { PRODUCT_CARD_FIELDS } from "@lib/util/product-card-fields"
import { useSiteSettings } from "@lib/context/site-settings-context"

/** First purchasable variant (in stock / backorder / unmanaged). */
function firstSellableVariant(product: HttpTypes.StoreProduct) {
  const variants = product.variants || []
  return (
    variants.find((v: any) => {
      if (v?.allow_backorder) return true
      if (v?.manage_inventory === false) return true
      return (
        typeof v?.inventory_quantity === "number" && v.inventory_quantity > 0
      )
    }) || variants[0]
  )
}

function pickInStock(
  products: HttpTypes.StoreProduct[],
  excludeIds: Set<string | undefined>,
  take: number
) {
  return products
    .filter((p) => !excludeIds.has(p.id) && isProductInStock(p))
    .slice(0, take)
}

export default function CartCrossSells({ cart }: { cart: HttpTypes.StoreCart }) {
  const { aspectClass: globalAspectClass } = useSiteSettings()
  const { applyCart, optimisticCartUpdate } = useUserData()
  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    if (!cart?.region_id) return

    const fetchCrossSells = async () => {
      try {
        // Collect collection IDs and tags from current cart items to find related products
        const collectionIds = new Set<string>()
        const tagIds = new Set<string>()

        cart.items?.forEach((item: any) => {
          if (item.variant?.product?.collection_id) {
            collectionIds.add(item.variant.product.collection_id)
          }
          item.variant?.product?.tags?.forEach((tag: any) => {
            if (tag.id) tagIds.add(tag.id)
          })
        })

        // Over-fetch so OOS filtering still leaves enough cards.
        const queryParams: HttpTypes.StoreProductListParams = {
          limit: 12,
          is_giftcard: false,
        }
        ;(queryParams as any).fields = PRODUCT_CARD_FIELDS

        if (collectionIds.size > 0) {
          queryParams.collection_id = Array.from(collectionIds)
        } else if (tagIds.size > 0) {
          queryParams.tag_id = Array.from(tagIds)
        }

        const cartProductIds = new Set(cart.items?.map((i) => i.product_id) || [])

        const { response } = await listProducts({
          regionId: cart.region_id,
          queryParams,
        })

        let filtered = pickInStock(response.products, cartProductIds, 2)

        // If no related in-stock products, fallback to recent in-stock
        if (filtered.length === 0) {
          const fallback = await listProducts({
            regionId: cart.region_id,
            queryParams: {
              limit: 12,
              is_giftcard: false,
              fields: PRODUCT_CARD_FIELDS,
            } as any,
          })
          filtered = pickInStock(fallback.response.products, cartProductIds, 2)
        }

        setProducts(filtered)
      } catch (e) {
        console.error("Failed to fetch cross-sells", e)
      } finally {
        setLoading(false)
      }
    }

    fetchCrossSells()
  }, [cart])

  if (loading || products.length === 0) return null

  const handleAdd = async (product: HttpTypes.StoreProduct) => {
    const variant = firstSellableVariant(product)
    if (!variant?.id) return

    setAddingId(product.id!)
    const rollback = optimisticCartUpdate((c) =>
      appendOptimisticLine(c, {
        cartId: cart.id,
        variantId: variant.id!,
        quantity: 1,
        unitPrice: (variant as any).calculated_price?.calculated_amount || 0,
        productId: product.id,
        productHandle: product.handle || undefined,
        productTitle: product.title || undefined,
        variantTitle: variant.title || undefined,
        thumbnail: product.thumbnail,
        productImages: product.images,
      })
    )
    try {
      const fresh = await addToCart({
        variantId: variant.id,
        quantity: 1,
        countryCode: cart.shipping_address?.country_code || "pk",
      })
      applyCart(fresh)
    } catch (e) {
      rollback()
      console.error(e)
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div className="border-t border-line px-5 py-4 bg-surface/30">
      <h3 className="text-[12px] font-semibold text-ink uppercase tracking-wider mb-3">
        You Might Also Like
      </h3>
      <div className="space-y-3">
        {products.map((product) => {
          const variant = firstSellableVariant(product)
          const price = getProductPrice({
            product,
            variantId: variant?.id,
          })
          const displayPrice = price?.variantPrice || price?.cheapestPrice
          const productPath = getProductPath(product)

          return (
            <div key={product.id} className="flex gap-3 bg-bg border border-line p-2.5 rounded-xl shadow-sm">
              <LocalizedClientLink
                href={productPath}
                className={`w-16 shrink-0 rounded-lg overflow-hidden border border-line ${globalAspectClass}`}
              >
                <Thumbnail thumbnail={product.thumbnail} images={product.images} size="square" />
              </LocalizedClientLink>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <LocalizedClientLink
                  href={productPath}
                  className="text-[13px] font-semibold text-ink truncate hover:text-primary transition-colors"
                >
                  {product.title}
                </LocalizedClientLink>
                {displayPrice && (
                  <div className="text-[12px] font-medium text-ink/70 mt-0.5">
                    {displayPrice.calculated_price}
                  </div>
                )}
              </div>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleAdd(product)}
                  disabled={addingId === product.id}
                  className="w-8 h-8 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-fg flex items-center justify-center transition-colors disabled:opacity-50"
                  aria-label="Add to cart"
                >
                  {addingId === product.id ? (
                    <i className="ph-bold ph-spinner animate-spin text-[14px]" aria-hidden />
                  ) : (
                    <i className="ph-bold ph-plus text-[14px]" aria-hidden />
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
