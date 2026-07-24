"use client"

import dynamic from "next/dynamic"

/**
 * Client-side lazy wrapper for <ProductReviews>.
 *
 * The reviews block (form, star widgets, photo upload, avatar logic —
 * ~500 lines) lives BELOW the fold inside the description tabs, and its
 * content is fetched client-side anyway (nothing SSR'd to lose). Loading
 * it `ssr:false` splits it out of the PDP's first-load chunk so the
 * above-the-fold page hydrates sooner; the chunk streams in right after.
 */
const ProductReviewsInner = dynamic(() => import("./index"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-3" aria-hidden>
      <div className="h-6 w-40 bg-surface rounded" />
      <div className="h-24 bg-surface rounded-xl" />
      <div className="h-24 bg-surface rounded-xl" />
    </div>
  ),
})

export default function ProductReviewsLazy(
  props: React.ComponentProps<typeof ProductReviewsInner>
) {
  return <ProductReviewsInner {...props} />
}
