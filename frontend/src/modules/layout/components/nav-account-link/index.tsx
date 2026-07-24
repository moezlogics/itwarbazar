"use client"

import { useUserData } from "@lib/context/user-data-context"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function NavAccountLink() {
  const { customer, ready } = useUserData()

  if (!ready) {
    return (
      <LocalizedClientLink
        className="hover:text-primary transition-colors duration-150"
        href="/account"
        data-testid="nav-account-link"
      >
        Sign in
      </LocalizedClientLink>
    )
  }

  return (
    <LocalizedClientLink
      className="hover:text-primary transition-colors duration-150"
      href="/account"
      data-testid="nav-account-link"
    >
      {customer ? "Account" : "Sign in"}
    </LocalizedClientLink>
  )
}

export function NavMobileAccountLink() {
  const { customer, ready } = useUserData()

  return (
    <LocalizedClientLink
      href="/account"
      aria-label={customer ? "Account" : "Sign in"}
      className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-header-hover text-header-fg hover:text-header-accent transition-all active:scale-90 relative"
    >
      <i className="ph-bold ph-user text-[20px]" aria-hidden />
      {ready && customer && (
        <span
          className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-success border border-header"
          aria-hidden
        />
      )}
    </LocalizedClientLink>
  )
}
