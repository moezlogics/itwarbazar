  import React from "react"
  import Image from "next/image"
  import { HttpTypes } from "@medusajs/types"
  import LocalizedClientLink from "@modules/common/components/localized-client-link"
  import { getProductReviewStats } from "@lib/data/reviews"
  import { getBrandForProduct, listBrands } from "@lib/data/brands"
  import { buildCategoryPath, buildCategoryChain } from "@lib/util/category-path"
  import { buildBrandPath } from "@lib/util/brand-path"
  import { isProductUpcoming } from "@lib/util/product"

  type ProductInfoProps = {
    product: HttpTypes.StoreProduct
    /**
     * `top`        — breadcrumb-only row, rendered above the gallery
     * `title-only` — title + rating (used above gallery on mobile)
     * `specs-only` — clean GSMArena-style specs box (used on mobile split)
     * `brand-only` — only shows the brand link (used under gallery on mobile)
     * `main`       — title + rating + specs (used on desktop right column)
     */
    mode?: "top" | "main" | "title-only" | "specs-only" | "brand-only"
  }

  function StarRating({ rating, count }: { rating: number; count: number }) {
    const stars = [1, 2, 3, 4, 5].map((star) => {
      if (rating >= star) return "full"
      if (rating >= star - 0.5) return "half"
      return "empty"
    })

    return (
      <a
        href="#reviews"
        className="inline-flex items-center gap-1 text-ink/70 hover:text-primary transition-colors"
      >
        <span className="flex items-center text-warning">
          {stars.map((type, i) => (
            <i
              key={i}
              className={`ph-fill ${
                type === "half" ? "ph-star-half" : "ph-star"
              } text-[12px] ${type === "empty" ? "opacity-25" : ""}`}
              aria-hidden
            />
          ))}
        </span>
        <span className="text-[12px]">
          {rating.toFixed(1)} ({count})
        </span>
      </a>
    )
  }

  function BrandInline({
    brand,
    brands,
    compact = false,
  }: {
    brand: { id: string; name: string; handle: string; parent_id: string | null; logo_url?: string | null }
    brands: Array<{ id: string; name: string; handle: string; parent_id: string | null }>
    compact?: boolean
  }) {
    const href = `/${buildBrandPath(brand, brands)}`

    return (
      <LocalizedClientLink
        href={href}
        className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface hover:border-primary/35 hover:bg-primary/5 transition-colors ${
          compact ? "px-2 py-1" : "px-2.5 py-1.5"
        }`}
      >
        <span className={`relative overflow-hidden rounded-full bg-white border border-line/60 ${
          compact ? "w-5 h-5" : "w-6 h-6"
        }`}>
          {brand.logo_url ? (
            <Image
              src={brand.logo_url}
              alt={brand.name}
              fill
              sizes="24px"
              className="object-contain p-0.5"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-ink/70">
              {brand.name.charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <span className={`${compact ? "text-[10px]" : "text-[11px]"} font-semibold text-ink leading-none`}>
          {brand.name}
        </span>
      </LocalizedClientLink>
    )
  }

  const ProductInfo = async ({ product, mode = "main" }: ProductInfoProps) => {
    const primaryCategory = product.categories?.[0]
    const isUpcoming = isProductUpcoming(product)
    const [stats, brand, brands] = await Promise.all([
      getProductReviewStats(product.id).catch(() => null),
      getBrandForProduct(product.id).catch(() => null),
      listBrands().catch(() => []),
    ])

    if (mode === "top") {
      const categoryChain = buildCategoryChain(primaryCategory)
      const brandChain = brand ? (brand.parent_id ? [brands?.find(b => b?.id === brand.parent_id), brand].filter(Boolean) : [brand]) : []

      return (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-[12px] text-ink/45 whitespace-nowrap overflow-x-auto w-full md:flex-wrap"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <LocalizedClientLink href="/" className="hover:text-primary transition-colors">
            Home
          </LocalizedClientLink>
          
          {categoryChain.map((c) => (
            <React.Fragment key={c.id}>
              <i className="ph ph-caret-right text-[10px] text-ink/25" aria-hidden />
              <span>{c.name}</span>
            </React.Fragment>
          ))}

          {brandChain.map((b) => (
            <React.Fragment key={b.id}>
              <i className="ph ph-caret-right text-[10px] text-ink/25" aria-hidden />
              <LocalizedClientLink
                href={`/${buildBrandPath(b, brands)}`}
                className="hover:text-primary transition-colors"
              >
                {b.name}
              </LocalizedClientLink>
            </React.Fragment>
          ))}

          <i className="ph ph-caret-right text-[10px] text-ink/25" aria-hidden />
          <span className="text-ink/55 truncate max-w-[200px]">{product.title}</span>
        </nav>
      )
    }

    const hasRating = !!(stats && stats.reviewCount > 0)

    if (mode === "brand-only") {
      if (!hasBrand) return null
      const parentBrand = brand!.parent_id ? brands?.find(b => b?.id === brand!.parent_id) : null
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          {parentBrand && <BrandInline brand={parentBrand as any} brands={brands as any[]} compact />}
          <BrandInline brand={brand as any} brands={brands as any[]} compact />
        </div>
      )
    }

    if (mode === "title-only") {
      return (
        <div className="flex flex-col gap-1">
          <div
            className="text-[22px] md:text-[26px] font-bold text-ink leading-[1.15] tracking-tight"
            data-testid="product-title"
          >
            {product.title}
          {isUpcoming && (
            <span className="ml-2 inline-flex items-center justify-center text-[6.5px] leading-none font-bold uppercase tracking-wider bg-amber-500 text-white px-[4px] py-[2px] rounded-[1.5px] shadow-sm align-middle">
              Coming Soon
            </span>
          )}
          </div>

          {hasRating && (
            <div className="flex items-center gap-3.5 flex-wrap">
              <StarRating
                rating={stats!.averageRating}
                count={stats!.reviewCount}
              />
            </div>
          )}
        </div>
      )
    }

    if (mode === "specs-only") {
      return null
    }

    // mode === "main": title + (optional) rating — brand sits on the gallery image
    return (
      <div id="product-info" className="flex flex-col gap-2">
        <h1
          className="text-[22px] md:text-[26px] font-bold text-ink leading-[1.15] tracking-tight"
          data-testid="product-title"
        >
          {product.title}
          {isUpcoming && (
            <span className="ml-2 inline-flex items-center justify-center text-[6.5px] leading-none font-bold uppercase tracking-wider bg-amber-500 text-white px-[4px] py-[2px] rounded-[1.5px] shadow-sm align-middle">
              Coming Soon
            </span>
          )}
        </h1>

        {hasRating && (
          <div className="flex items-center gap-3.5 flex-wrap">
            <StarRating
              rating={stats!.averageRating}
              count={stats!.reviewCount}
            />
          </div>
        )}
      </div>
    )
  }

  export default ProductInfo
