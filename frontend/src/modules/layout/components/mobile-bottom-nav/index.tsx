"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import MobileBottomNavClient from "./client"

export default function MobileBottomNav() {
  const pathname = usePathname()
  const [isPdp, setIsPdp] = useState(false)

  useEffect(() => {
    const checkPdp = () => {
      setIsPdp(document.body.classList.contains("is-pdp-page"))
    }
    checkPdp()

    const observer = new MutationObserver(checkPdp)
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [pathname])

  if (isPdp) {
    return null
  }

  return <MobileBottomNavClient />
}
