import { Metadata } from "next"
import NotFoundPage from "@modules/common/components/not-found-page"

/**
 * Global 404. Next.js renders this with HTTP status 404 automatically
 * when `notFound()` is called from a server component or when no route
 * matches. One shared, server-rendered layout is used across every 404
 * in the app (see `not-found-page`).
 */
export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you're looking for doesn't exist.",
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return <NotFoundPage />
}
