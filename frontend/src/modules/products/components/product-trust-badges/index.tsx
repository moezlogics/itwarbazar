import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const TRUST_ITEMS = [
  {
    label: "7 Days Easy Return",
    icon: "https://cdn.itwarbazar.pk/uploads/2026/07/7-days-return-TcFiTkuM.webp",
    href: "/refund-policy",
  },
  {
    label: "Professionally Cleaned",
    icon: "https://cdn.itwarbazar.pk/uploads/2026/07/professionaly-cleaned-1yBC2h0m.webp",
  },
  {
    label: "100% Original Branded",
    icon: "https://cdn.itwarbazar.pk/uploads/2026/07/original-branded-U2HvdBzZ.webp",
  },
] as const

/**
 * Three equal trust tiles below the ATC row — always one row on mobile
 * (no wrap). Box radius follows theme `--radius-btn`.
 */
export default function ProductTrustBadges() {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
      {TRUST_ITEMS.map((item) => {
        const inner = (
          <>
            <span className="relative w-11 h-11 sm:w-12 sm:h-12 shrink-0">
              <Image
                src={item.icon}
                alt=""
                fill
                sizes="48px"
                className="object-contain"
              />
            </span>
            <span className="text-[11px] sm:text-[12px] font-bold text-ink leading-snug text-center">
              {item.label}
            </span>
          </>
        )

        const className =
          "flex flex-col items-center justify-center gap-1.5 sm:gap-2 min-h-[88px] sm:min-h-[100px] px-1.5 py-2.5 border border-ink/80 bg-bg text-center transition-colors"

        const style = { borderRadius: "var(--radius-btn)" }

        return (
          <li key={item.label} className="min-w-0">
            {"href" in item && item.href ? (
              <LocalizedClientLink
                href={item.href}
                className={`${className} hover:border-primary hover:bg-primary/5`}
                style={style}
              >
                {inner}
              </LocalizedClientLink>
            ) : (
              <div className={className} style={style}>
                {inner}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
