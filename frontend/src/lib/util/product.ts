import { HttpTypes } from "@medusajs/types";

export const isSimpleProduct = (product: HttpTypes.StoreProduct): boolean => {
    return product.options?.length === 1 && product.options[0].values?.length === 1;
}

/**
 * Builds the dynamic canonical URL path for a product based on its
 * primary category and brand.
 * 
 * URL structure:
 *   - Both brand & category: `/[brand_handle]/[category_handle]/[product_handle]`
 *   - Category only:         `/[category_handle]/[product_handle]`
 *   - Brand only:            `/[brand_handle]/[product_handle]`
 *   - Neither:               `/[product_handle]`
 *
 * @param product  — the product object (must have `handle`, optionally `categories`, `metadata`, `collection`)
 * @param brand    — optional resolved Brand from the brands system (has `handle`)
 */
export function getProductPath(
  product: any,
  brand?: { handle?: string } | null
): string {
  if (!product || !product.handle) return "/"
  return `/products/${product.handle}`
}

/**
 * Filter product images to show only those belonging to the currently selected variant.
 * If no variant is selected or the variant has no specific images, returns all product images.
 */
export function getImagesForVariant(product: any, selectedVariantId?: string) {
  const productImages = product.images ?? []
  if (!selectedVariantId || !product.variants) {
    return productImages
  }

  const variant = product.variants.find((v: any) => v.id === selectedVariantId)
  const variantImages = variant?.images ?? []
  if (!variant || variantImages.length === 0) {
    return productImages
  }

  const imageIdsMap = new Map(variantImages.map((i: any) => [i.id, true]))
  return productImages.filter((i: any) => imageIdsMap.has(i.id))
}

/**
 * True when ANY variant is purchasable: has stock, allows backorder, or
 * doesn't manage inventory. Pre-order products count as in stock (they're
 * sellable by design even at zero inventory).
 *
 * Used to HIDE out-of-stock products from the homepage rails and archive
 * grids (admin decision: OOS items stay reachable via search + direct
 * URL, where the PDP renders with disabled buy buttons — but they don't
 * take up space on the main browsing surfaces).
 *
 * Requires `+variants.inventory_quantity,+variants.manage_inventory` in
 * the fetch fields (PRODUCT_CARD_FIELDS already includes both).
 */
export function isProductInStock(product: any): boolean {
  if (!product) return false
  // Pre-order window open → sellable regardless of inventory.
  const meta = product.metadata || {}
  if (meta.preorder_open === true || meta.preorder_open === "true") return true

  const variants = product.variants || []
  if (variants.length === 0) return false
  return variants.some((v: any) => {
    if (v?.allow_backorder) return true
    if (v?.manage_inventory === false) return true
    return (
      typeof v?.inventory_quantity === "number" && v.inventory_quantity > 0
    )
  })
}

/**
 * Check if a product's launch/release date is in the future.
 */
export function isProductUpcoming(product: any): boolean {
  if (!product) return false
  const specs = product.metadata?.specs
  const releaseDateStr = specs?.release_date || product.metadata?.release_date || specs?.launch_date || product.metadata?.launch_date
  if (!releaseDateStr) return false

  const str = String(releaseDateStr).trim()
  const parts = str.split("-")
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const dateValue = new Date(year, month, day)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return dateValue > today
    }
  }
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return parsed > today
  }
  return false
}


