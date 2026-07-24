import React from "react"

/**
 * Structural page skeletons — one per page archetype so each route's
 * `loading.tsx` shows a placeholder that matches the real layout it's
 * about to render (instead of one generic grid everywhere).
 *
 * All pieces use the shared `.animate-skeleton-pulse` + `.skeleton-top-bar`
 * classes defined in globals.css and the project's surface/line color
 * tokens, so they inherit the active theme automatically.
 */

/** A single product-card placeholder (image + title + price row). */
const CardSkeleton = () => (
  <div className="flex flex-col gap-3">
    <div className="aspect-[3/4] w-full bg-surface rounded-xl border border-line/30" />
    <div className="flex flex-col gap-2 px-0.5">
      <div className="w-3/4 h-3.5 bg-surface rounded-md" />
      <div className="w-1/2 h-3 bg-surface-alt rounded-md" />
    </div>
  </div>
)

/** Responsive product grid (matches the real store/listing grid). */
export const GridSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 large:grid-cols-5 gap-x-2 small:gap-x-4 gap-y-3 small:gap-y-8">
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
)

/**
 * Store / category / collection archive skeleton.
 * Breadcrumb + title + filter-chip row + product grid.
 */
export const ListingSkeleton = () => (
  <div className="container-anvogue pt-4 pb-12 animate-skeleton-pulse" aria-hidden="true">
    {/* Breadcrumb + title */}
    <div className="flex flex-col gap-2.5 mb-5">
      <div className="w-40 h-3 bg-surface-alt rounded-md" />
      <div className="w-56 h-7 bg-surface rounded-md" />
    </div>
    {/* Sort / filter bar */}
    <div className="flex items-center gap-2 mb-6 overflow-hidden">
      {[64, 80, 72, 56, 88].map((w, i) => (
        <div
          key={i}
          className="h-8 bg-surface-alt rounded-full border border-line/40"
          style={{ width: w }}
        />
      ))}
    </div>
    <GridSkeleton count={12} />
  </div>
)

/**
 * Single-product (PDP) skeleton — mirrors the mobile-first product
 * template: breadcrumb, title, side-by-side gallery + specs, price +
 * add-to-cart block, then a related-products rail.
 */
export const ProductDetailSkeleton = () => (
  <div className="animate-skeleton-pulse" aria-hidden="true">
    <div className="container-anvogue pt-3 md:pt-4">
      {/* Breadcrumb */}
      <div className="w-2/3 max-w-md h-3 bg-surface-alt rounded-md mb-3" />

      {/* Mobile: Full-width stacked gallery on top */}
      {/* gap-4 — `gap-4.5` isn't a real Tailwind step and compiled to
          nothing, so the skeleton had no spacing (and didn't match the
          real PDP it stands in for). */}
      <div className="lg:hidden flex flex-col gap-4 mb-5">
        {/* Gallery Image placeholder */}
        <div className="w-full aspect-[3/4] bg-surface rounded-xl border border-line/30" />

        {/* Brand, Title & Rating Stack */}
        <div className="flex flex-col gap-1.5 px-4">
          <div className="w-20 h-3 bg-surface-alt rounded-md" /> {/* Brand */}
          <div className="w-3/4 h-6 bg-surface rounded-md mt-1" /> {/* Title */}
          <div className="w-24 h-4 bg-surface-alt rounded-md mt-1" /> {/* Rating */}
        </div>

        {/* Price, stepper, and actions */}
        <div className="flex flex-col gap-4 px-4 pb-6 mt-2">
          <div className="w-28 h-7 bg-surface rounded-md" /> {/* Price */}
          
          {/* Options select placeholder */}
          <div className="flex flex-col gap-3 py-1">
            <div className="w-16 h-3 bg-surface-alt rounded" />
            <div className="flex gap-2">
              <div className="w-16 h-8 bg-surface rounded-full" />
              <div className="w-16 h-8 bg-surface rounded-full" />
            </div>
          </div>

          {/* Stepper placeholder */}
          <div className="flex flex-col gap-1.5 mb-1">
            <div className="w-12 h-2.5 bg-surface-alt rounded" />
            <div className="w-28 h-9 bg-surface rounded-md" />
          </div>

          {/* Checkout buttons grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="h-11 bg-surface-alt rounded-full border border-line" />
            <div className="h-11 bg-surface rounded-full" />
          </div>
        </div>
      </div>

      {/* Desktop: 2-col gallery | info */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-4">
        <div className="aspect-square w-full bg-surface rounded-xl border border-line/30" />
        <div className="flex flex-col gap-4">
          <div className="w-3/4 h-8 bg-surface rounded-md" />
          <div className="w-1/3 h-5 bg-surface-alt rounded-md" />
          <div className="w-1/4 h-9 bg-surface rounded-md mt-2" />
          <div className="flex flex-col gap-2.5 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-full h-3.5 bg-surface-alt rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Related products rail */}
    <div className="container-anvogue my-8">
      <div className="w-44 h-5 bg-surface rounded-md mb-5" />
      <GridSkeleton count={4} />
    </div>
  </div>
)
