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
  const productImages = preparePdpGalleryImages(product)
  if (!selectedVariantId || !product.variants) {
    return productImages
  }

  const variant = product.variants.find((v: any) => v.id === selectedVariantId)
  const variantImages = variant?.images ?? []
  if (!variant || variantImages.length === 0) {
    return productImages
  }

  const imageIdsMap = new Map(variantImages.map((i: any) => [i.id, true]))
  // Keep admin rank order; only drop images that aren't on this variant.
  // Synthetic thumbnail rows (id "product-thumbnail") stay if their URL
  // matches a variant image URL.
  const variantUrls = new Set(
    variantImages.map((i: any) => normalizeImageUrl(i?.url)).filter(Boolean)
  )
  return productImages.filter(
    (i: any) =>
      (i.id && imageIdsMap.has(i.id)) ||
      (i.url && variantUrls.has(normalizeImageUrl(i.url)))
  )
}

/** Strip CDN/query noise so thumbnail ↔ gallery URL matching is reliable. */
function normalizeImageUrl(url?: string | null): string {
  if (!url) return ""
  return url.split("?")[0].replace(/\/$/, "").trim()
}

/**
 * Build the PDP gallery list so it matches admin media:
 *  1. Sort by Medusa `image.rank` (admin drag-and-drop order)
 *  2. Ensure the featured `product.thumbnail` is present — cards already
 *     show it, but Medusa stores thumbnail separately from `images[]`,
 *     so it can be missing from the gallery entirely.
 */
export function preparePdpGalleryImages(product: {
  thumbnail?: string | null
  images?: Array<{
    id?: string
    url?: string | null
    rank?: number | null
  }> | null
}): HttpTypes.StoreProductImage[] {
  const sorted = [...(product.images ?? [])]
    .filter((i) => !!i?.url)
    .sort((a, b) => {
      const ra = typeof a.rank === "number" ? a.rank : Number.MAX_SAFE_INTEGER
      const rb = typeof b.rank === "number" ? b.rank : Number.MAX_SAFE_INTEGER
      return ra - rb
    }) as HttpTypes.StoreProductImage[]

  const thumb = product.thumbnail?.trim()
  if (!thumb) return sorted

  const thumbKey = normalizeImageUrl(thumb)
  const alreadyInGallery = sorted.some(
    (i) => normalizeImageUrl(i.url) === thumbKey
  )
  if (alreadyInGallery) return sorted

  // Featured URL isn't in images[] — prepend so PDP matches the product card.
  return [
    {
      id: "product-thumbnail",
      url: thumb,
      rank: -1,
    } as HttpTypes.StoreProductImage,
    ...sorted,
  ]
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


