"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "wishlist_handles"

function readWishlist(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((h) => typeof h === "string") : []
  } catch {
    return []
  }
}

function writeWishlist(handles: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(handles))
    window.dispatchEvent(new CustomEvent("wishlist-updated"))
  } catch {}
}

type Props = {
  /** Product handle — the stable key persisted in localStorage. */
  handle?: string | null
  /**
   * "overlay" — absolutely positioned top-right over the card image
   * (FootFlare `.item-bookmark`). "static" — in-flow circular button,
   * used in the PDP fixed bottom bar.
   */
  variant?: "overlay" | "static"
  className?: string
}

/**
 * FootFlare-style bookmark heart. Inactive hearts sit in the template's
 * muted rose-grey; toggling on plays the "heartblast" pop and turns the
 * heart red. Persistence is device-local (localStorage) — there is no
 * account wishlist backend, this mirrors the template behaviour.
 */
export default function WishlistHeart({
  handle,
  variant = "overlay",
  className = "",
}: Props) {
  const [active, setActive] = useState(false)
  // Only animate on user toggles, not on initial hydration.
  const [blast, setBlast] = useState(false)

  useEffect(() => {
    if (!handle) return
    const sync = () => setActive(readWishlist().includes(handle))
    sync()
    window.addEventListener("wishlist-updated", sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener("wishlist-updated", sync)
      window.removeEventListener("storage", sync)
    }
  }, [handle])

  if (!handle) return null

  const toggle = (e: React.MouseEvent) => {
    // Cards wrap the whole tile in a link — keep the tap on the heart.
    e.preventDefault()
    e.stopPropagation()
    const list = readWishlist()
    const next = list.includes(handle)
      ? list.filter((h) => h !== handle)
      : [...list, handle]
    writeWishlist(next)
    setActive(next.includes(handle))
    setBlast(true)
  }

  const shellClass =
    variant === "overlay"
      ? "absolute top-3 right-3 z-[2] w-8 h-8"
      : "relative w-11 h-11 bg-surface"

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={active}
      className={`${shellClass} flex items-center justify-center rounded-full transition-transform active:scale-90 ${className}`}
    >
      <i
        onAnimationEnd={() => setBlast(false)}
        className={`ph-fill ph-heart text-[18px] leading-none transition-colors ${
          blast ? "heart-blast" : ""
        }`}
        style={{ color: active ? "#ff2a4f" : "#C6B4B8" }}
        aria-hidden
      />
    </button>
  )
}
