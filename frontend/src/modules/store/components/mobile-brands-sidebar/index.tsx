"use client"

import { usePathname } from "next/navigation"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getBrandPath } from "@lib/util/brand-path"

type BrandItem = {
  id: string
  name: string
  handle: string
  logo_url: string | null
  parent_id: string | null
}

type Props = {
  brands: BrandItem[]
}

// Helper to strip the 2-character country code prefix from the path (e.g. /pk/store -> /store)
const stripLocale = (p: string): string => {
  if (!p) return "/"
  const parts = p.split("/").filter(Boolean)
  if (parts.length && parts[0].length === 2) parts.shift()
  return "/" + parts.join("/")
}

/** Shared rail + sticky aside — height follows content (not full viewport). */
export const BRANDS_RAIL_ASIDE_CLASS =
  "w-[68px] small:w-[110px] flex-shrink-0 self-start sticky top-[56px] small:top-[64px] max-h-[calc(100vh-56px-44px)] small:max-h-[calc(100vh-64px)] overflow-y-auto z-30"

export const BRANDS_RAIL_ROW_CLASS =
  "flex gap-4 small:gap-6 -mx-4 small:mx-0"

export const BRANDS_RAIL_CONTENT_CLASS =
  "flex-1 min-w-0 p-3 small:p-0"

/**
 * Shared shell so homepage and archive pages render the brands rail
 * with identical width, gap, sticky behavior, and content padding.
 */
export function BrandsRailLayout({
  brands,
  children,
}: {
  brands: BrandItem[]
  children: React.ReactNode
}) {
  return (
    <div className={BRANDS_RAIL_ROW_CLASS}>
      <aside className={BRANDS_RAIL_ASIDE_CLASS}>
        <MobileBrandsSidebar brands={brands} />
      </aside>
      <div className={BRANDS_RAIL_CONTENT_CLASS}>{children}</div>
    </div>
  )
}

/**
 * Brands rail — FootFlare "Top Brands" styling on the existing sidebar
 * logic (top-level brands only, Shop All entry, active-route detection).
 * Each brand is a circular white tile (template `.dz-icon-box
 * .fill-white`) with the name below; the active brand gets a primary
 * ring + left indicator strip.
 */
export default function MobileBrandsSidebar({ brands }: Props) {
  const pathname = usePathname() || "/"
  const cleanPath = stripLocale(pathname)

  // Filter out sub-brands for the main sidebar to keep it clean, showing only top-level brands
  const topBrands = brands.filter((b) => !b.parent_id)

  const isAllActive = cleanPath === "/" || cleanPath === "/store"

  return (
    <div className="flex flex-col bg-surface-alt/80 border-r border-line/45 overflow-y-auto no-scrollbar backdrop-blur-md">
      {/* Scrollable list */}
      <ul className="flex flex-col gap-0.5 small:gap-1 py-2 small:py-3">
        {/* "Shop All" Item */}
        <SidebarItem href="/store" label="Shop All" active={isAllActive}>
          <div
            className={[
              "w-11 h-11 small:w-[60px] small:h-[60px] rounded-full flex items-center justify-center transition-all shrink-0 border",
              isAllActive
                ? "bg-primary text-primary-fg border-primary shadow-md"
                : "bg-white text-neutral-900 border-line/70 shadow-sm group-hover:border-primary/40 group-hover:shadow-md",
            ].join(" ")}
          >
            <i className="ph-bold ph-squares-four text-lg small:text-2xl" aria-hidden />
          </div>
        </SidebarItem>

        {/* Brand Items */}
        {topBrands.map((brand) => {
          const brandHref = getBrandPath(brand, brands)
          const isActive =
            cleanPath === brandHref || cleanPath.startsWith(brandHref + "/")

          return (
            <SidebarItem
              key={brand.id}
              href={brandHref}
              label={brand.name}
              active={isActive}
            >
              <div
                className={[
                  "relative w-11 h-11 small:w-[60px] small:h-[60px] rounded-full overflow-hidden bg-white border flex items-center justify-center transition-all shrink-0",
                  isActive
                    ? "border-primary ring-2 ring-primary/25 shadow-md scale-[1.05]"
                    : "border-line/70 shadow-sm group-hover:border-primary/40 group-hover:shadow-md",
                ].join(" ")}
              >
                {brand.logo_url ? (
                  <Image
                    src={brand.logo_url}
                    alt={brand.name}
                    fill
                    sizes="(max-width: 1024px) 44px, 60px"
                    className="object-contain p-1.5 small:p-2 transition-transform group-hover:scale-110"
                  />
                ) : (
                  <span className="text-neutral-900 text-sm small:text-lg font-semibold">
                    {brand.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
            </SidebarItem>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Shared tile shell — circular icon/logo on top, tiny label below,
 * primary indicator strip on the left when active.
 */
function SidebarItem({
  href,
  label,
  active,
  children,
}: {
  href: string
  label: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <li className="relative px-1.5 small:px-2">
      <LocalizedClientLink
        href={href}
        className={[
          "group flex flex-col items-center justify-center gap-1 py-2 px-0.5 small:py-2.5 small:px-1 text-center transition-all rounded-xl relative",
          "focus-visible:outline-none focus-visible:bg-surface",
          active
            ? "text-primary font-semibold"
            : "text-ink/60 hover:text-primary",
        ].join(" ")}
      >
        {/* Active primary indicator strip on the left */}
        {active && (
          <span
            className="absolute left-0 top-3 bottom-3 w-[3px] small:w-1 rounded-r-full bg-primary"
            aria-hidden
          />
        )}

        {children}

        <span className="text-[9px] small:text-[11px] leading-tight break-words max-w-[52px] small:max-w-[72px] transition-colors">
          {label}
        </span>
      </LocalizedClientLink>
    </li>
  )
}
