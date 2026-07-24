"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import BannerImage from "./banner-image"
import type { Banner } from "@lib/data/banners"

/**
 * Layout-1 renderer: a single full-width banner that auto-rotates when
 * the section holds more than one.
 *
 * Unlike the old hero, the track has NO fixed aspect ratio — slides are
 * laid out in a scroll-snap row so each keeps its natural height, and the
 * track height is simply the tallest slide. Swiping is native (no JS drag
 * maths), which also makes it feel like an app on touch.
 */
export default function BannerCarousel({
  banners,
  intervalMs = 5000,
}: {
  banners: Banner[]
  intervalMs?: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const pausedUntil = useRef(0)
  const count = banners.length

  const goto = useCallback((n: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: el.clientWidth * n, behavior: "smooth" })
  }, [])

  // Keep the dots in sync with native scrolling.
  const onScroll = useCallback(() => {
    const el = trackRef.current
    if (!el || !el.clientWidth) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }, [])

  useEffect(() => {
    if (count <= 1 || !intervalMs) return
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return
    }
    const id = window.setInterval(() => {
      if (Date.now() < pausedUntil.current) return
      const el = trackRef.current
      if (!el || !el.clientWidth) return
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % count
      el.scrollTo({ left: el.clientWidth * next, behavior: "smooth" })
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [count, intervalMs])

  const hold = () => {
    pausedUntil.current = Date.now() + 15_000
  }

  if (!count) return null

  return (
    <div className="relative group">
      <div
        ref={trackRef}
        onScroll={onScroll}
        onPointerDown={hold}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar overscroll-x-contain"
      >
        {banners.map((b, i) => (
          <div key={b.id} className="w-full shrink-0 snap-center">
            <BannerImage banner={b} priority={i === 0} sizes="100vw" />
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 rounded-full bg-black/25 px-2.5 py-1.5 backdrop-blur-sm">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to banner ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => {
                hold()
                goto(i)
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-5 bg-white" : "w-1.5 bg-white/55"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
