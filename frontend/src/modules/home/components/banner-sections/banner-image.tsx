import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { Banner } from "@lib/data/banners"

/**
 * One banner tile, rendered at the image's OWN aspect ratio.
 *
 * There is deliberately NO fixed height / aspect class anywhere here.
 * Whatever the operator uploads decides how tall the tile is — a wide
 * hero stays short, a tall promo stays tall, and a 2-up or 3-up row is
 * simply the same images at a narrower column width.
 *
 * How the ratio is preserved without layout shift:
 *   • If the banner has stored natural dimensions, <Image> gets them and
 *     `h-auto` lets it scale to the column width. The browser reserves
 *     the exact space from the width/height pair, so nothing jumps.
 *   • Legacy banners (no stored size) fall back to a plain <img> with
 *     `h-auto`, which is still natural-ratio — just not pre-reserved.
 */
export default function BannerImage({
  banner,
  priority,
  sizes,
}: {
  banner: Banner
  priority?: boolean
  sizes: string
}) {
  const hasSize = !!(banner.image_width && banner.image_height)

  const media = hasSize ? (
    <Image
      src={banner.image_url}
      alt={banner.title || ""}
      width={banner.image_width as number}
      height={banner.image_height as number}
      sizes={sizes}
      quality={85}
      priority={priority}
      className="w-full h-auto block"
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.image_url}
      alt={banner.title || ""}
      loading={priority ? "eager" : "lazy"}
      className="w-full h-auto block"
    />
  )

  const inner = (
    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-surface">
      {media}

      {/* Optional text overlay — only when the operator set copy. */}
      {(banner.title || banner.subtitle || banner.cta_label) && (
        <div
          className={`absolute inset-x-0 bottom-0 p-3 sm:p-5 ${
            banner.theme === "light"
              ? "bg-gradient-to-t from-white/85 to-transparent text-neutral-900"
              : "bg-gradient-to-t from-black/70 to-transparent text-white"
          }`}
        >
          {banner.title && (
            <p className="text-sm sm:text-xl font-bold leading-tight drop-shadow-sm line-clamp-2">
              {banner.title}
            </p>
          )}
          {banner.subtitle && (
            <p className="mt-0.5 text-[11px] sm:text-sm opacity-90 line-clamp-2">
              {banner.subtitle}
            </p>
          )}
          {banner.cta_label && (
            <span
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] sm:text-xs font-semibold ${
                banner.theme === "light"
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-900"
              }`}
            >
              {banner.cta_label}
              <i className="ph-bold ph-arrow-right text-[11px]" aria-hidden />
            </span>
          )}
        </div>
      )}
    </div>
  )

  if (!banner.link_url) return inner

  return (
    <LocalizedClientLink
      href={banner.link_url}
      className="block transition-transform active:scale-[0.99]"
      aria-label={banner.title || "Banner"}
    >
      {inner}
    </LocalizedClientLink>
  )
}
