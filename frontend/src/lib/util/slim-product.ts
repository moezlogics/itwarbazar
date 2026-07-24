import { HttpTypes } from "@medusajs/types"

/**
 * Shallow clone and strip heavy CMS / rich-text fields from a product object
 * before passing it to interactive client components. Prevents serializing
 * the same 11KB+ markdown description strings multiple times in the RSC Flight
 * payload.
 */
export function slimProductForClient(product: HttpTypes.StoreProduct) {
  const metadata = { ...(product.metadata || {}) }
  
  // Strip heavy fields from metadata
  delete metadata.description
  delete metadata.content
  delete metadata.reviews
  delete metadata.faq
  delete metadata.trust_badges

  return {
    ...product,
    description: undefined,
    subtitle: undefined,
    metadata,
  }
}
