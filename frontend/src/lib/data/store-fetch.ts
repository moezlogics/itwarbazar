/**
 * Featherweight replacement for `sdk.client.fetch` on the Medusa /store
 * API. The @medusajs/js-sdk pulls ~28 kB gz (SDK + Buffer polyfill + qs)
 * into every CLIENT bundle that touches it — for calls that only need a
 * base URL, a publishable-key header, and JSON. Client-side data files
 * (reviews, guest orders, returns) import THIS instead so the SDK stays
 * server-only.
 *
 * URL resolution mirrors lib/config.ts: the server talks to the backend
 * over the internal URL, the browser over the public one.
 */

const PUBLIC_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:3212"
const INTERNAL_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || PUBLIC_BACKEND_URL

export const STORE_BACKEND_URL =
  typeof window === "undefined" ? INTERNAL_BACKEND_URL : PUBLIC_BACKEND_URL

type StoreFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  /** Passed straight to Next's fetch — revalidate / tags. */
  next?: { revalidate?: number | false; tags?: string[] }
  cache?: RequestCache
  /** Abort after this many ms so a hung backend never freezes the UI. */
  timeoutMs?: number
}

/**
 * Hard cap on every client request. Without it a single slow/stalled
 * backend call (reviews, trending, guest lookup…) kept the browser's
 * loading indicator spinning indefinitely — the "site never finishes
 * loading" symptom. Callers already try/catch and degrade gracefully,
 * so a timeout just turns an infinite hang into a fast, silent failure.
 */
const DEFAULT_TIMEOUT_MS = 10000

/**
 * Fetch a /store endpoint with the publishable-key header. Throws on a
 * non-2xx response (same contract as sdk.client.fetch, so existing
 * try/catch callsites behave identically).
 */
export async function storeFetch<T>(
  path: string,
  opts: StoreFetchOptions = {}
): Promise<T> {
  const qs = opts.query
    ? "?" +
      Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : ""

  const res = await fetch(`${STORE_BACKEND_URL}${path}${qs}`, {
    method: opts.method || "GET",
    headers: {
      "x-publishable-api-key":
        process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
      ...(opts.body !== undefined
        ? { "content-type": "application/json" }
        : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    ...(opts.next ? { next: opts.next } : {}),
    ...(opts.cache ? { cache: opts.cache } : {}),
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  })

  if (!res.ok) {
    throw new Error(`storeFetch ${path} failed: ${res.status}`)
  }
  return (await res.json()) as T
}
