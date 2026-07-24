"use client"

import { usePathname } from "next/navigation"
import {
  ProductDetailSkeleton,
  ListingSkeleton,
} from "@modules/skeletons/templates/page-skeletons"

/**
 * The `[...slug]` catch-all renders products (`/products/[handle]`),
 * category archives (`/men`, `/men/eur-42`, …), and brand listings.
 *
 * loading.tsx has no route params, so we infer from the URL:
 *   • `/products/...` → PDP skeleton
 *   • everything else → listing / category skeleton
 *
 * The old heuristic (`segments.length >= 2` → product) broke nested
 * subcategory pages — `/men/eur-42` falsely showed the single-product
 * skeleton instead of the category grid.
 */
export default function Loading() {
  const pathname = usePathname() || ""
  const segments = pathname.split("/").filter(Boolean)
  // Strip locale prefix (`/pk/...`)
  if (segments.length && segments[0].length === 2) {
    segments.shift()
  }

  const isProductDetail = segments[0] === "products"

  return isProductDetail ? <ProductDetailSkeleton /> : <ListingSkeleton />
}
