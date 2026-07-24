"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * "Size chart" link + image viewer for the PDP.
 *
 * Opens the store's size-chart image in a lightweight modal that fades
 * and scales in (mount → next frame → transition), so it feels smooth
 * without pulling in the heavy lightbox library the gallery uses.
 *
 * Closes on backdrop click, the X button, or Escape. Background scroll is
 * locked while open and the image area contains its own overscroll so
 * pinch/scroll never chains to the page behind.
 *
 * The URL is resolved by the caller (admin site-setting → env), so a
 * store without a chart configured simply renders nothing.
 */
export default function SizeChart({ url }: { url?: string | null }) {
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false) // drives the enter transition

  const close = useCallback(() => {
    setShown(false)
    // let the fade-out finish before unmounting
    setTimeout(() => setOpen(false), 180)
  }, [])

  // Enter transition + Escape + scroll lock
  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => setShown(true))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, close])

  if (!url) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/70 hover:text-primary transition-colors underline underline-offset-4 decoration-line active:scale-95"
      >
        <i className="ph-bold ph-ruler text-sm" aria-hidden />
        Size chart
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Size chart"
          onClick={close}
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 transition-opacity duration-200"
          style={{
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(2px)",
            opacity: shown ? 1 : 0,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[88vh] overflow-auto overscroll-contain rounded-2xl bg-bg shadow-2xl transition-all duration-200"
            style={{
              opacity: shown ? 1 : 0,
              transform: shown ? "scale(1)" : "scale(0.96)",
            }}
          >
            <div className="sticky top-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-bg">
              <h2 className="text-sm font-bold text-ink">Size chart</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close size chart"
                className="w-9 h-9 rounded-full bg-surface hover:bg-primary hover:text-primary-fg flex items-center justify-center transition-all active:scale-90"
              >
                <i className="ph-bold ph-x text-sm" aria-hidden />
              </button>
            </div>

            {/* Plain <img> on purpose: the URL is store-configurable, so it
                may point at a domain that isn't in next.config's image
                remotePatterns — next/image would hard-error on those. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Size chart"
              className="w-full h-auto block"
              loading="eager"
            />
          </div>
        </div>
      )}
    </>
  )
}
