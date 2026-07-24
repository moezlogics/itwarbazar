import Link from "next/link"

/**
 * The single, canonical 404 for the whole storefront.
 *
 * Replaces the old `not-found-variants` component, which picked one of
 * EIGHT layouts at random inside a `useEffect`. That caused three real
 * problems the shop owner reported:
 *   1. "different layouts" — the page looked like a different site on
 *      every visit, which reads as broken rather than playful.
 *   2. A pulsing skeleton flashed first (variant is null until hydration)
 *      and then swapped in a full-height layout — a guaranteed layout
 *      shift on every 404.
 *   3. Client-side exceptions: all that art ran as client JS (one variant
 *      even used styled-jsx), so any error there hit the root error
 *      boundary and showed "Application error: a client-side exception
 *      has occurred" instead of a 404.
 *
 * This version is a pure SERVER component — zero client JS, nothing to
 * hydrate, nothing to randomise, so it cannot produce any of the above.
 *
 * Links are plain `next/link` with public paths: the middleware rewrites
 * `/` → `/<countryCode>` internally, and this component also renders at
 * the ROOT (outside the `[countryCode]` segment) where a localized link
 * helper has no country param to read.
 */
export default function NotFoundPage({
  title = "This page doesn't exist",
  description = "The link may be broken, or the page may have been moved or removed.",
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        {/* Mark */}
        <div
          className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{
            background: "rgb(var(--color-surface))",
            border: "1px solid rgb(var(--color-border))",
          }}
        >
          <i
            className="ph-bold ph-magnifying-glass text-[34px] text-ink/35"
            aria-hidden
          />
        </div>

        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.28em] text-ink/45">
          Error 404
        </p>

        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-ink leading-tight">
          {title}
        </h1>

        <p className="mt-3 text-sm text-ink/60 leading-relaxed">
          {description}
        </p>

        {/* Search — the most useful next step on a dead URL */}
        <form
          action="/search"
          method="get"
          role="search"
          className="mt-7 flex items-center gap-2"
        >
          <input
            type="search"
            name="q"
            placeholder="Search products…"
            aria-label="Search products"
            className="flex-1 h-11 px-4 rounded-full border border-line bg-bg text-sm text-ink placeholder:text-ink/40 outline-none focus:border-primary transition-colors"
          />
          <button
            type="submit"
            className="h-11 px-5 rounded-full bg-primary text-primary-fg text-sm font-semibold transition-all active:scale-[0.98] hover:brightness-110"
          >
            Search
          </button>
        </form>

        {/* CTAs */}
        <div className="mt-4 flex flex-wrap gap-2.5 justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-line text-ink text-sm font-semibold transition-all active:scale-[0.98] hover:bg-surface"
          >
            <i className="ph-bold ph-house text-base" aria-hidden />
            Back to home
          </Link>
          <Link
            href="/store"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-line text-ink text-sm font-semibold transition-all active:scale-[0.98] hover:bg-surface"
          >
            Continue shopping
            <i className="ph-bold ph-arrow-right text-base" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  )
}
