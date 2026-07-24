import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Input, Badge, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"

/**
 * "Stock" widget — one-screen inventory editing on the product page.
 *
 * Medusa's default flow (Inventory page → find inventory item → open →
 * edit location level) is far too many steps for a small store. This
 * widget shows every variant of the product with its CURRENT stock
 * quantity in a single editable list; typing a number and hitting Save
 * writes the location levels through the official batch endpoint:
 *
 *   POST /admin/inventory-items/location-levels/batch
 *     { create: [...], update: [...], delete: [] }
 *
 * Levels that don't exist yet for the store's stock location are
 * CREATED automatically — so a freshly added product needs zero setup
 * beyond typing its stock number here. Uses the FIRST stock location
 * (these stores run a single warehouse).
 *
 * Variants with "Manage inventory" turned off show as "Not tracked"
 * (they're always purchasable regardless of stock).
 */

type VariantRow = {
  variantId: string
  title: string
  sku: string | null
  manageInventory: boolean
  allowBackorder: boolean
  inventoryItemId: string | null
  /** Existing level at the chosen location (null = level not created yet) */
  levelExists: boolean
  stocked: number
}

const jfetch = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, { credentials: "include", ...init })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

const ProductStockWidget = () => {
  const { id: productId } = useParams()
  const [rows, setRows] = useState<VariantRow[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [locationId, setLocationId] = useState<string | null>(null)
  const [locationName, setLocationName] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    try {
      // 1. Variants + their inventory-item links
      const { product } = await jfetch(
        `/admin/products/${productId}?fields=id,*variants,*variants.inventory_items`
      )
      // 2. Store's stock location (single-warehouse stores → first one)
      const { stock_locations } = await jfetch(`/admin/stock-locations?limit=1`)
      const loc = stock_locations?.[0]
      setLocationId(loc?.id ?? null)
      setLocationName(loc?.name ?? "")

      // 3. Current levels for every inventory item in one request
      const iitemIds: string[] = (product?.variants || [])
        .flatMap((v: any) =>
          (v.inventory_items || []).map((l: any) => l.inventory_item_id)
        )
        .filter(Boolean)

      const levelByItem = new Map<string, { stocked: number }>()
      if (loc?.id && iitemIds.length) {
        const qs = iitemIds.map((i) => `id[]=${encodeURIComponent(i)}`).join("&")
        const { inventory_items } = await jfetch(
          `/admin/inventory-items?limit=200&fields=id,*location_levels&${qs}`
        )
        for (const item of inventory_items || []) {
          const lvl = (item.location_levels || []).find(
            (l: any) => l.location_id === loc.id
          )
          if (lvl) {
            levelByItem.set(item.id, {
              stocked: Number(lvl.stocked_quantity ?? 0),
            })
          }
        }
      }

      const nextRows: VariantRow[] = (product?.variants || []).map((v: any) => {
        const iitemId: string | null =
          v.inventory_items?.[0]?.inventory_item_id ?? null
        const lvl = iitemId ? levelByItem.get(iitemId) : undefined
        return {
          variantId: v.id,
          title: v.title || "Default",
          sku: v.sku || null,
          manageInventory: v.manage_inventory !== false,
          allowBackorder: !!v.allow_backorder,
          inventoryItemId: iitemId,
          levelExists: !!lvl,
          stocked: lvl?.stocked ?? 0,
        }
      })
      setRows(nextRows)
      setEdits({})
    } catch (e: any) {
      toast.error("Stock load failed: " + (e?.message || e))
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    load()
  }, [load])

  const dirty = useMemo(
    () =>
      rows.some((r) => {
        const e = edits[r.variantId]
        return e !== undefined && e !== "" && Number(e) !== r.stocked
      }),
    [rows, edits]
  )

  const onSave = async () => {
    if (!locationId) {
      toast.error("No stock location found — create one in Settings → Locations first.")
      return
    }
    const create: any[] = []
    const update: any[] = []
    for (const r of rows) {
      const raw = edits[r.variantId]
      if (raw === undefined || raw === "") continue
      const qty = Math.max(0, Math.floor(Number(raw)))
      if (Number.isNaN(qty) || qty === r.stocked) continue
      if (!r.inventoryItemId) continue
      const entry = {
        inventory_item_id: r.inventoryItemId,
        location_id: locationId,
        stocked_quantity: qty,
      }
      if (r.levelExists) update.push(entry)
      else create.push(entry)
    }
    if (!create.length && !update.length) return

    setSaving(true)
    try {
      await jfetch(`/admin/inventory-items/location-levels/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ create, update, delete: [] }),
      })
      toast.success("Stock updated")
      await load()
    } catch (e: any) {
      toast.error("Stock save failed: " + (e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  const inStockNow = (r: VariantRow) => {
    if (!r.manageInventory || r.allowBackorder) return true
    const e = edits[r.variantId]
    const qty = e !== undefined && e !== "" ? Number(e) : r.stocked
    return qty > 0
  }

  return (
    <Container className="p-4">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div>
          <Heading level="h2" className="text-base font-semibold">
            Stock
          </Heading>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            Type the quantity and Save — levels are created automatically
            {locationName ? ` at “${locationName}”` : ""}. Zero = shown as out
            of stock and hidden from homepage/archives.
          </p>
        </div>
        <Button
          variant="primary"
          size="small"
          onClick={onSave}
          disabled={loading || saving || !dirty}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: "#6b7280" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 12, color: "#6b7280" }}>No variants found.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r) => (
            <div
              key={r.variantId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.title}
                </div>
                {r.sku && (
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{r.sku}</div>
                )}
              </div>

              {!r.manageInventory ? (
                <Badge size="2xsmall" color="grey">
                  Not tracked
                </Badge>
              ) : !r.inventoryItemId ? (
                <Badge size="2xsmall" color="orange">
                  No inventory item
                </Badge>
              ) : (
                <>
                  <Badge
                    size="2xsmall"
                    color={inStockNow(r) ? "green" : "red"}
                  >
                    {inStockNow(r) ? "In stock" : "Out of stock"}
                  </Badge>
                  <Input
                    type="number"
                    min={0}
                    size="small"
                    style={{ width: 90 }}
                    value={edits[r.variantId] ?? String(r.stocked)}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [r.variantId]: e.target.value,
                      }))
                    }
                    disabled={saving}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
})

export default ProductStockWidget
