"use client"

import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import { useRef, useState, useCallback, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

// The lightbox library + its 4 plugins + CSS are a heavy JS chunk that's
// only needed AFTER the shopper taps an image. Load it lazily (ssr:false,
// mounted only once first opened) so it stays out of the initial PDP
// bundle — PageSpeed flagged Total Blocking Time ~1s on the product page.
const ProductLightbox = dynamic(() => import("./product-lightbox"), {
  ssr: false,
})

type VideoItem = {
  url: string
  poster?: string
}

type GalleryItem = {
  type: "image" | "video"
  url: string
  id?: string
  /** Video poster / thumbnail */
  poster?: string
}

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  /** Video URLs from product.metadata.videos */
  videos?: VideoItem[]
  /**
   * Map of image URL → alt text (CDN-generated). Resolved server-side in
   * the product page so every <img alt={...}> carries the AI-generated
   * description instead of a generic "Product image 1" placeholder.
   */
  altMap?: Record<string, string>
  /** Fallback alt — typically the product title. */
  altFallback?: string
  aspectRatioClass?: string
  /**
   * variant id → image ids. When ?v_id= is present the gallery narrows
   * client-side (ISR pages cannot read the query string server-side).
   */
  variantImageIds?: Record<string, string[]>
  /** Brand chip overlaid top-left on the main stage. */
  brandBadge?: {
    name: string
    logoUrl?: string | null
    href: string
  } | null
}

/**
 * Professional PDP gallery — Shopify-style zoom with lens overlay.
 *
 * Layout — desktop (≥ lg):
 *   [vertical thumbnails]  [main image/video (aspect 4/5)]
 *                          └ hover = semi-transparent lens + magnified crop
 *                          └ click = open lightbox
 *
 * Layout — mobile:
 *   [main image/video] (swipe-navigable with dots)
 *   [horizontal thumbnail strip]
 */
const ImageGallery = ({
  images,
  videos,
  altMap,
  altFallback,
  aspectRatioClass,
  variantImageIds,
  brandBadge,
}: ImageGalleryProps) => {
  const aspectClass = aspectRatioClass || "aspect-square"
  const altFor = (url: string, index: number) =>
    (altMap && altMap[url]) || altFallback || `Product image ${index + 1}`
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  // Lazily mount the (heavy) lightbox on first open, then keep it mounted
  // so its close animation still plays. Keeps its JS chunk out of the
  // initial PDP load.
  const [lightboxMounted, setLightboxMounted] = useState(false)
  useEffect(() => {
    if (lightboxIndex >= 0) setLightboxMounted(true)
  }, [lightboxIndex])
  const [isZooming, setIsZooming] = useState(false)
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  const zoomRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const mobileScrollRef = useRef<HTMLDivElement>(null)

  const searchParams = useSearchParams()
  const vId = searchParams.get("v_id")

  const safeImages = useMemo(() => {
    const all = (images || []).filter((i) => !!i?.url)
    const vId = searchParams.get("v_id")
    if (!vId || !variantImageIds?.[vId]?.length) return all
    const allowed = new Set(variantImageIds[vId])
    const narrowed = all.filter((img) => img.id && allowed.has(img.id))
    return narrowed.length > 0 ? narrowed : all
  }, [images, searchParams, variantImageIds])

  // Reset to first slide when variant selection changes.
  useEffect(() => {
    setActiveIndex(0)
  }, [vId])
  const safeVideos = (videos || []).filter((v) => !!v?.url)

  // Build unified gallery items: images first, then videos
  const galleryItems: GalleryItem[] = [
    ...safeImages.map((img) => ({
      type: "image" as const,
      url: img.url!,
      id: img.id,
    })),
    ...safeVideos.map((vid, i) => ({
      type: "video" as const,
      url: vid.url,
      poster: vid.poster,
      id: `video-${i}`,
    })),
  ]

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = zoomRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setOrigin({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    })
  }, [])

  const handleThumbnailClick = (index: number) => {
    setActiveIndex(index)
    if (mobileScrollRef.current) {
      const width = mobileScrollRef.current.offsetWidth
      mobileScrollRef.current.scrollTo({
        left: width * index,
        behavior: "smooth"
      })
    }
  }

  const handleMobileScroll = () => {
    if (mobileScrollRef.current) {
      const scrollLeft = mobileScrollRef.current.scrollLeft
      const width = mobileScrollRef.current.offsetWidth
      if (width > 0) {
        const newIndex = Math.round(scrollLeft / width)
        if (newIndex !== activeIndex) {
          setActiveIndex(newIndex)
        }
      }
    }
  }

  if (!galleryItems.length) {
    return (
      <div className={`${aspectClass} w-full rounded-xl bg-surface flex items-center justify-center`}>
        <i className="ph ph-image text-5xl text-ink/30" aria-hidden />
      </div>
    )
  }

  const active = galleryItems[activeIndex] || galleryItems[0]
  const isActiveVideo = active.type === "video"

  // Build lightbox slides
  const lightboxSlides = galleryItems.map((item) => {
    if (item.type === "video") {
      return {
        type: "video" as const,
        width: 1280,
        height: 720,
        poster: item.poster,
        sources: [
          {
            src: item.url,
            type: getVideoMimeType(item.url),
          },
        ],
      }
    }
    return { src: item.url }
  })

  return (
    <>
      <div className="flex flex-col gap-3 lg:gap-4 w-full">
        {/* Main stage */}
        <div className="min-w-0 relative w-full">
          {/* Desktop View: only visible on lg and up */}
          <div className="hidden lg:block relative w-full">
            {isActiveVideo ? (
              /* ──── Video player ──── */
              <div
                className={`relative ${aspectClass} w-full rounded-xl bg-ink/5 overflow-hidden group cursor-pointer border border-primary/25`}
                onClick={() => setLightboxIndex(activeIndex)}
              >
                <video
                  ref={videoRef}
                  src={active.url}
                  poster={active.poster}
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                  controls
                  controlsList="nodownload"
                  playsInline
                  preload="metadata"
                  onClick={(e) => e.stopPropagation()}
                />
                <BrandImageBadge badge={brandBadge} />
                {/* Fullscreen hint */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(activeIndex) }}
                  className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-bg/90 backdrop-blur text-ink flex items-center justify-center shadow-soft opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  aria-label="Open video in fullscreen"
                >
                  <i className="ph-bold ph-arrows-out text-xs" aria-hidden />
                </button>
              </div>
            ) : (
              /* ──── Shopify-style hover zoom with lens overlay ──── */
              <div
                ref={zoomRef}
                onMouseEnter={() => setIsZooming(true)}
                onMouseLeave={() => setIsZooming(false)}
                onMouseMove={handleMouseMove}
                onClick={() => setLightboxIndex(activeIndex)}
                className={`relative ${aspectClass} w-full rounded-xl bg-bg overflow-hidden cursor-zoom-in group border border-primary/25`}
                role="button"
                tabIndex={0}
                aria-label="Open product image in lightbox"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setLightboxIndex(activeIndex)
                  }
                }}
              >
                {active?.url && (
                  <Image
                    key={active.url}
                    src={active.url}
                    alt={altFor(active.url, activeIndex)}
                    fill
                    priority={activeIndex === 0}
                    sizes="50vw"
                    quality={80}
                    className={`object-cover ${isZooming ? "" : "transition-all duration-300 ease-in-out"}`}
                    style={isZooming ? {
                      transform: "scale(2)",
                      transformOrigin: `${origin.x}% ${origin.y}%`
                    } : undefined}
                  />
                )}
                <BrandImageBadge badge={brandBadge} />
                {/* Enlarge hint */}
                <span
                  className={`absolute bottom-2.5 right-2.5 bg-bg/90 backdrop-blur text-ink text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shadow-soft pointer-events-none ${isZooming ? "opacity-0" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                  aria-hidden
                >
                  <i className="ph-bold ph-magnifying-glass-plus text-[10px]" />
                  Click to enlarge
                </span>
              </div>
            )}
          </div>

          {/* Mobile View — stretch to device width (cancel container
              1rem gutters) so the bordered stage is edge-to-edge. */}
          <div className="block lg:hidden relative -mx-4 w-[calc(100%+2rem)]">
            <div
              ref={mobileScrollRef}
              onScroll={handleMobileScroll}
              className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide w-full"
              style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {galleryItems.map((item, i) => (
                <div
                  key={item.id || i}
                  onClick={() => setLightboxIndex(i)}
                  className={`w-full shrink-0 snap-center relative ${aspectClass} bg-bg overflow-hidden cursor-zoom-in border border-primary/30`}
                >
                  {item.type === "video" ? (
                    <video
                      src={item.url}
                      poster={item.poster}
                      className="absolute inset-0 w-full h-full object-contain bg-black"
                      controls
                      controlsList="nodownload"
                      playsInline
                      preload="metadata"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <Image
                      src={item.url}
                      alt={altFor(item.url, i)}
                      fill
                      priority={i === 0}
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      quality={75}
                      className="object-cover"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Brand chip — top left over the mobile stage */}
            <BrandImageBadge badge={brandBadge} />

            {/* Prev/Next arrows on mobile */}
            {galleryItems.length > 1 && (
              <GalleryArrows
                activeIndex={activeIndex}
                total={galleryItems.length}
                onChange={handleThumbnailClick}
              />
            )}

            {/* In-image thumbnail strip — bottom center over the main stage */}
            {galleryItems.length > 1 && (
              <div
                className="absolute bottom-3 inset-x-0 z-20 flex justify-center pointer-events-none px-3"
                aria-label="Gallery thumbnails"
              >
                <div className="pointer-events-auto flex flex-row gap-1.5 overflow-x-auto max-w-full scrollbar-hide items-center rounded-full bg-bg/85 backdrop-blur-md border border-line/50 px-2 py-1.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)]">
                  {galleryItems.map((item, i) => {
                    const isActive = i === activeIndex
                    const thumbSrc =
                      item.type === "video"
                        ? item.poster || undefined
                        : item.url

                    return (
                      <button
                        key={item.id || i}
                        type="button"
                        aria-pressed={isActive}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleThumbnailClick(i)
                        }}
                        className={`relative shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-surface transition-all duration-200 ${
                          isActive
                            ? "ring-2 ring-primary scale-105"
                            : "ring-1 ring-line/40 opacity-70"
                        }`}
                      >
                        {thumbSrc ? (
                          <Image
                            src={thumbSrc}
                            alt={
                              item.type === "video"
                                ? `${altFallback || "Product"} video ${i + 1}`
                                : altFor(item.url, i)
                            }
                            fill
                            sizes="40px"
                            quality={80}
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-ink/10 flex items-center justify-center">
                            <i className="ph-fill ph-video-camera text-xs text-ink/40" aria-hidden />
                          </div>
                        )}
                        {item.type === "video" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-ink/25">
                            <i className="ph-fill ph-play text-[8px] text-white ml-0.5" aria-hidden />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop thumbnails — below the main stage (mobile uses in-image strip) */}
        {galleryItems.length > 1 && (
          <div className={`hidden lg:flex flex-row gap-2 overflow-x-auto py-1.5 scrollbar-hide items-center w-full scroll-smooth ${
            galleryItems.length < 5 ? "justify-center" : "justify-center"
          }`}>
            {galleryItems.map((item, i) => {
              const isActive = i === activeIndex
              const thumbSrc =
                item.type === "video"
                  ? item.poster || undefined
                  : item.url

              return (
                <button
                  key={item.id || i}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleThumbnailClick(i)}
                  className={`relative shrink-0 w-[72px] h-[72px] rounded-lg overflow-hidden bg-surface transition-all duration-200 ${
                    isActive
                       ? "ring-2 ring-primary"
                      : "ring-1 ring-line/50 opacity-60 hover:opacity-100"
                  }`}
                >
                  {thumbSrc ? (
                    <Image
                      src={thumbSrc}
                      alt={
                        item.type === "video"
                          ? `${altFallback || "Product"} video ${i + 1}`
                          : altFor(item.url, i)
                      }
                      fill
                      sizes="72px"
                      quality={85}
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-ink/10 flex items-center justify-center">
                      <i className="ph-fill ph-video-camera text-base text-ink/40" aria-hidden />
                    </div>
                  )}

                  {item.type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-ink/20">
                      <div className="w-6 h-6 rounded-full bg-bg/90 flex items-center justify-center shadow-sm">
                        <i className="ph-fill ph-play text-[10px] text-ink ml-0.5" aria-hidden />
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {lightboxMounted && (
        <ProductLightbox
          open={lightboxIndex >= 0}
          close={() => setLightboxIndex(-1)}
          index={lightboxIndex < 0 ? 0 : lightboxIndex}
          slides={lightboxSlides}
        />
      )}
    </>
  )
}

/**
 * Infer MIME type from video URL extension.
 */
function getVideoMimeType(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase()
  switch (ext) {
    case "webm": return "video/webm"
    case "ogg": case "ogv": return "video/ogg"
    case "mov": return "video/quicktime"
    case "avi": return "video/x-msvideo"
    default: return "video/mp4"
  }
}

/** Brand chip — top-left over the main gallery stage. */
function BrandImageBadge({
  badge,
}: {
  badge?: ImageGalleryProps["brandBadge"]
}) {
  if (!badge?.name) return null

  return (
    <div className="absolute top-2.5 left-2.5 z-20 pointer-events-auto">
      <LocalizedClientLink
        href={badge.href}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1.5 rounded-full bg-bg/90 backdrop-blur-md border border-line/60 pl-1 pr-2.5 py-1 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35)] hover:border-primary/40 transition-colors"
      >
        <span className="relative w-6 h-6 overflow-hidden rounded-full bg-white border border-line/50 shrink-0">
          {badge.logoUrl ? (
            <Image
              src={badge.logoUrl}
              alt={badge.name}
              fill
              sizes="24px"
              className="object-contain p-0.5"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[9px] font-bold text-ink/70">
              {badge.name.charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <span className="text-[11px] font-semibold text-ink leading-none max-w-[7.5rem] truncate">
          {badge.name}
        </span>
      </LocalizedClientLink>
    </div>
  )
}

/**
 * Mobile-only prev/next arrow buttons — rendered inside the media container
 * so `absolute top-1/2` is scoped to the image/video, not a taller parent.
 */
function GalleryArrows({
  activeIndex,
  total,
  onChange,
}: {
  activeIndex: number
  total: number
  onChange: (i: number) => void
}) {
  return (
    <div className="lg:hidden absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-3 pointer-events-none z-20">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange((activeIndex - 1 + total) % total) }}
        aria-label="Previous image"
        className="pointer-events-auto w-8 h-8 rounded-full bg-surface/90 backdrop-blur border border-line flex items-center justify-center shadow-md text-ink/75"
      >
        <i className="ph-bold ph-caret-left text-xs" aria-hidden />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange((activeIndex + 1) % total) }}
        aria-label="Next image"
        className="pointer-events-auto w-8 h-8 rounded-full bg-surface/90 backdrop-blur border border-line flex items-center justify-center shadow-md text-ink/75"
      >
        <i className="ph-bold ph-caret-right text-xs" aria-hidden />
      </button>
    </div>
  )
}

export default ImageGallery
