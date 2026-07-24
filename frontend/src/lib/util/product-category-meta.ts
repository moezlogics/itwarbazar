import { HttpTypes } from "@medusajs/types"

/** Condition category handles → display labels (preloved shoe grading). */
const CONDITION_BY_HANDLE: Record<string, string> = {
  "brand-new-like-new": "Brand New/Like New",
  excellent: "Excellent",
  "very-good": "Very Good",
  good: "Good",
}

/** Match by category name when handle differs in admin. */
const CONDITION_BY_NAME: Record<string, string> = {
  "brand new/like new": "Brand New/Like New",
  excellent: "Excellent",
  "very good": "Very Good",
  good: "Good",
}

const SIZE_HANDLE_RE =
  /^(?:men|women|kids)-eur-(\d{2})$|^eur-(\d{2})$/

function leafHandle(handle: string): string {
  const parts = handle.trim().toLowerCase().split("/").filter(Boolean)
  return parts[parts.length - 1] ?? handle.trim().toLowerCase()
}

function resolveConditionLabel(handle?: string | null, name?: string | null): string | null {
  if (handle) {
    const byHandle = CONDITION_BY_HANDLE[leafHandle(handle)]
    if (byHandle) return byHandle
  }
  if (name) {
    const byName = CONDITION_BY_NAME[name.trim().toLowerCase()]
    if (byName) return byName
  }
  return null
}

/**
 * Resolve the product's condition label from its assigned Medusa
 * categories (e.g. /brand-new-like-new → "Brand New/Like New").
 */
export function getProductConditionLabel(
  product: Pick<HttpTypes.StoreProduct, "categories" | "metadata">
): string | null {
  for (const cat of product.categories ?? []) {
    const label = resolveConditionLabel(cat.handle, cat.name)
    if (label) return label
  }

  const meta = product.metadata?.condition
  if (typeof meta === "string" && meta.trim()) {
    return (
      resolveConditionLabel(meta, meta) ??
      meta.trim()
    )
  }

  return null
}

/**
 * Resolve shoe size from size categories (men/women/kids EUR handles).
 * Returns e.g. "EUR 42" for handle `men-eur-42`.
 */
export function getProductSizeLabel(
  product: Pick<HttpTypes.StoreProduct, "categories">
): string | null {
  for (const cat of product.categories ?? []) {
    const handle = leafHandle(cat.handle ?? "")
    if (!handle) continue

    const match = handle.match(SIZE_HANDLE_RE)
    if (match) {
      const sizeNum = match[1] ?? match[2]
      return `EUR ${sizeNum}`
    }
  }
  return null
}
