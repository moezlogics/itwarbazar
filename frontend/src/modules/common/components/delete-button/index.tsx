"use client"

import { deleteLineItem } from "@lib/data/cart"
import { useUserData } from "@lib/context/user-data-context"
import { removeOptimisticLine } from "@lib/util/optimistic-cart"
import { useRouter } from "next/navigation"
import { useState } from "react"

const DeleteButton = ({
  id,
  children,
  className,
  "data-testid": testId,
}: {
  id: string
  children?: React.ReactNode
  className?: string
  "data-testid"?: string
}) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const { applyCart, optimisticCartUpdate } = useUserData()
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)
    // Drop the row from the drawer / badges immediately.
    const rollback = optimisticCartUpdate((c) => removeOptimisticLine(c, id))
    try {
      const fresh = await deleteLineItem(id)
      applyCart(fresh)
      // The /cart page is RSC — refresh in the background so its server
      // list catches up too. The drawer already updated optimistically,
      // so this never blocks what the shopper sees.
      router.refresh()
    } catch {
      rollback()
      setIsDeleting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      data-testid={testId}
      className={
        className ??
        "flex items-center gap-1 text-ink/40 hover:text-danger transition-colors text-xs"
      }
      aria-label="Remove item"
    >
      {isDeleting ? (
        <i className="ph-bold ph-spinner animate-spin text-sm" aria-hidden />
      ) : (
        <i className="ph-bold ph-trash text-sm" aria-hidden />
      )}
      {children && <span>{children}</span>}
    </button>
  )
}

export default DeleteButton
