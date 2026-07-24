import { HttpTypes } from "@medusajs/types"

type LineItemOptionsProps = {
  variant: HttpTypes.StoreProductVariant | undefined
  className?: string
  "data-testid"?: string
  "data-value"?: HttpTypes.StoreProductVariant
}

const LineItemOptions = ({
  variant,
  className,
  "data-testid": dataTestid,
  "data-value": dataValue,
}: LineItemOptionsProps) => {
  if (!variant?.title) return null

  return (
    <p
      data-testid={dataTestid}
      className={className ?? "text-[11px] text-ink/50 truncate"}
    >
      {variant.title}
    </p>
  )
}

export default LineItemOptions
