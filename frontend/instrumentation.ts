/**
 * Server-process resilience.
 *
 * This storefront runs as a SINGLE Next.js process (see ecosystem.config.js
 * `instances: 1`). With one instance, ANY unhandled promise rejection or
 * uncaught exception anywhere in the server crashes the whole process —
 * and while PM2 restarts it (~5–15s with restart_delay + listen_timeout)
 * every visitor gets a 502. That is the "site chalti hai phir ruk jati
 * hai" (works, then briefly dies) symptom.
 *
 * A stray rejected promise (a fire-and-forget fetch, a background
 * revalidation, an SDK call whose caller forgot to await) should NEVER
 * take the site down. We log it loudly — so the cause still shows up in
 * `logs/storefront-error.log` — but keep the process alive and serving.
 *
 * Next runs this once per server start (Node runtime only).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  process.on("unhandledRejection", (reason: unknown) => {
    console.error(
      "[resilience] unhandledRejection (kept process alive):",
      reason instanceof Error ? reason.stack || reason.message : reason
    )
  })

  process.on("uncaughtException", (err: Error) => {
    // Adding this listener overrides Node's default "print + exit". We log
    // and continue: one bad request handler must not kill every other
    // in-flight request and take the whole site offline. If the process
    // is ever genuinely wedged, PM2's health checks still recycle it.
    console.error(
      "[resilience] uncaughtException (kept process alive):",
      err?.stack || err?.message || err
    )
  })
}
