import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../../thumbnail"
import type { ProductCardProps } from "./types"

/**
 * FootFlare card — the storefront's product tile.
 *
 *   • image on a soft rounded surface
 *   • condition badge top-left (preloved grade)
 *   • sale "% OFF" badge top-right when discounted
 *   • below: title, size, price + circular arrow CTA
 */
export default function FootFlareCard({
  productPath,
  product,
  isFeatured,
  aspectClass,
  cheapestPrice,
  isSale,
  conditionLabel,
  sizeLabel,
  thumbnailAlt,
  priority,
}: ProductCardProps) {
  const href = productPath || `/products/${product.handle}`

  const saleBadge =
    isSale && cheapestPrice?.percentage_diff
      ? `${cheapestPrice.percentage_diff}% OFF`
      : null

  return (
    <article
      className={`group relative flex flex-col h-full card-press${
        priority ? "" : " cv-card"
      }`}
    >
      {/* Media tile */}
      <div className="relative overflow-hidden rounded-lg sm:rounded-xl">
        <LocalizedClientLink
          href={href}
          aria-label={product.title}
          data-testid="product-link"
        >
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            size="full"
            isFeatured={isFeatured}
            aspectClass={aspectClass}
            alt={thumbnailAlt}
            priority={priority}
            data-testid="product-wrapper"
          />
        </LocalizedClientLink>

        {/* Condition — top-left (always keeps its spot) */}
        {conditionLabel && (
          <span
            className="absolute top-2 left-2 z-[2] pointer-events-none max-w-[calc(100%-4.5rem)] truncate rounded-full px-2 py-[3px] text-[9px] sm:text-[10px] font-semibold leading-none tracking-wide shadow-sm bg-bg/95 text-ink border border-line/70 backdrop-blur-sm"
            title={conditionLabel}
          >
            {conditionLabel}
          </span>
        )}

        {/* Sale OFF — top-right (never covers condition) */}
        {saleBadge && (
          <span
            className="absolute top-2 right-2 z-[2] pointer-events-none truncate rounded-full px-2 py-[3px] text-[9px] sm:text-[10px] font-semibold leading-none tracking-wide shadow-sm bg-danger text-white"
            title={saleBadge}
          >
            {saleBadge}
          </span>
        )}
      </div>

      {/* Content — title/size/price left, arrow CTA right */}
      <div className="mt-1.5 sm:mt-2.5 flex items-end justify-between gap-1.5 sm:gap-2 flex-1 min-h-0 pl-1 pb-1 sm:pl-1.5 sm:pb-1.5">
        <div className="min-w-0 flex-1">
          <LocalizedClientLink
            href={href}
            data-testid="product-title"
            className="text-xs sm:text-sm font-medium text-ink leading-4 sm:leading-5 line-clamp-2 hover:text-primary transition-colors"
          >
            {product.title}
          </LocalizedClientLink>

          {sizeLabel && (
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-ink/55 leading-tight truncate">
              Size: {sizeLabel}
            </p>
          )}

          {cheapestPrice && (
            <div className="mt-0.5 sm:mt-1 flex items-baseline gap-1 flex-wrap">
              <span className="text-sm sm:text-lg font-semibold text-ink leading-none">
                {cheapestPrice.calculated_price}
              </span>
              {isSale && (
                <del className="text-[11px] sm:text-[13px] font-light text-ink/50 leading-none">
                  {cheapestPrice.original_price}
                </del>
              )}
            </div>
          )}
        </div>

        <LocalizedClientLink
          href={href}
          aria-label={`View ${product.title}`}
          className="shrink-0 w-7 h-7 sm:w-[30px] sm:h-[30px] rounded-full bg-surface text-ink flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-primary-fg mb-0.5"
        >
          <i className="ph-bold ph-arrow-right text-[12px] sm:text-[14px]" aria-hidden />
        </LocalizedClientLink>
      </div>
    </article>
  )
}
