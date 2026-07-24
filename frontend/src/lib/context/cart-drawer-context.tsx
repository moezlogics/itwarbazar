"use client"

import React, { createContext, useContext, useState, useCallback } from "react"

interface CartDrawerContextType {
  isOpen: boolean
  /** True once the CartDrawer component is mounted (admin setting on). */
  enabled: boolean
  open: () => void
  close: () => void
  setEnabled: (enabled: boolean) => void
}

const CartDrawerContext = createContext<CartDrawerContextType>({
  isOpen: false,
  enabled: false,
  open: () => {},
  close: () => {},
  setEnabled: () => {},
})

export const CartDrawerProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [enabled, setEnabled] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  return (
    <CartDrawerContext.Provider
      value={{ isOpen, enabled, open, close, setEnabled }}
    >
      {children}
    </CartDrawerContext.Provider>
  )
}

export const useCartDrawer = () => useContext(CartDrawerContext)
