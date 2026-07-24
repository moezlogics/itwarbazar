import { Metadata } from "next"
import NotFoundPage from "@modules/common/components/not-found-page"

export const metadata: Metadata = {
  title: "Cart not found",
  description: "The cart you tried to access does not exist.",
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <NotFoundPage
      title="We couldn't find that cart"
      description="This cart no longer exists or has expired. Start a new one by adding something you like."
    />
  )
}
