"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import ShopFilters from "../shop-filters"
import type { FacetGroup } from "@lib/util/facets"

type Props = {
  /** Facet groups for this archive — see lib/util/facets. */
  facets?: FacetGroup[]
  resultCount: number
}

/**
 * Mobile filter drawer — portaled to `document.body` so it always sits
 * above the sticky header (z-50), brands rail (z-30), and bottom tab bar
 * (z-40). Rendering inside the archive tree trapped its z-index in a
 * lower stacking context, so Close / Show results were often covered.
 */
const MobileFilterDrawer = ({ facets = [], resultCount }: Props) => {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock background scroll + hide chrome that fights the sheet.
  useEffect(() => {
    if (!open) return

    const scrollY = window.scrollY
    const { style } = document.body
    style.position = "fixed"
    style.top = `-${scrollY}px`
    style.left = "0"
    style.right = "0"
    style.overflow = "hidden"
    style.width = "100%"
    document.body.classList.add("overlay-open")

    return () => {
      style.position = ""
      style.top = ""
      style.left = ""
      style.right = ""
      style.overflow = ""
      style.width = ""
      document.body.classList.remove("overlay-open")
      window.scrollTo(0, scrollY)
    }
  }, [open])

  const drawer =
    open && (
      <>
        <div
          className="fixed inset-0 z-[200] bg-ink/40 backdrop-blur-[3px] small:hidden touch-none"
          onClick={() => setOpen(false)}
          aria-hidden
        />
        <aside
          className="fixed inset-y-0 right-0 z-[201] flex h-[100dvh] max-h-[100dvh] w-[min(92vw,380px)] flex-col bg-bg border-l border-line shadow-pop small:hidden"
          style={{ animation: "mobileDrawerSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          {/* Header — always visible */}
          <div className="flex shrink-0 items-center justify-between border-b border-line bg-bg px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <i className="ph-bold ph-sliders-horizontal text-base text-primary" />
              </span>
              <span className="text-base font-bold text-ink">Filters</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface transition-all hover:bg-primary hover:text-primary-fg active:scale-90"
            >
              <i className="ph-bold ph-x text-sm" />
            </button>
          </div>

          {/* Scrollable filters */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y px-5 pb-4">
            <ShopFilters facets={facets} inDrawer />
          </div>

          {/* Footer — always visible above safe area / tab bar */}
          <div
            className="shrink-0 border-t border-line bg-bg p-4"
            style={{
              paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-fg shadow-soft transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <span>Show results</span>
              {resultCount > 0 && (
                <span className="rounded-full bg-primary-fg/20 px-2 py-0.5 text-[11px] font-extrabold text-primary-fg">
                  {resultCount}
                </span>
              )}
            </button>
          </div>
        </aside>

        <style>{`
          @keyframes mobileDrawerSlideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>
      </>
    )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="small:hidden inline-flex h-10 items-center gap-2 rounded-full border border-line bg-bg px-5 text-sm font-semibold text-ink shadow-soft transition-all hover:bg-surface active:scale-95"
        aria-label="Open filters"
      >
        <i className="ph-bold ph-sliders-horizontal text-[14px]" aria-hidden />
        <span>Filters</span>
      </button>

      {mounted && drawer ? createPortal(drawer, document.body) : null}
    </>
  )
}

export default MobileFilterDrawer
