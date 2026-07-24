import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Input, Badge, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"

/**
 * Discount — set a sale price for this product without leaving the page.
 *
 * Replaces the usual chore of building a price list, attaching the
 * product, then typing each variant's price. Enter a sale price (or a %
 * off) per variant and save; the storefront then shows the base price
 * struck through with the sale price and a discount badge.
 *
 * Under the hood this drives a REAL, product-scoped `sale` price list
 * (see /admin/product-discount/[id]) — not a cosmetic metadata field —
 * so the cart and checkout also charge the discounted amount.
 */

type Row = {
  variant_id: string
  title: string
  currency_code: string
  base_amount: number
  sale_amount: number | null
}

const jfetch = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, { credentials: "include", ...init })
  if (!res.ok) {
    let msg = await res.text()
    try {
      msg = JSON.parse(msg).error || msg
    } catch {}
    throw new Error(msg || `HTTP ${res.status}`)
  }
  return res.json()
}

const money = (n: number, cur: string) =>
  `${(cur || "").toUpperCase()} ${Number(n || 0).toLocaleString()}`

const ProductDiscountWidget = () => {
  const { id: productId } = useParams()
  const [rows, setRows] = useState<Row[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [hasDiscount, setHasDiscount] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    try {
      const data = await jfetch(`/admin/product-discount/${productId}`)
      setRows(data.variants || [])
      setHasDiscount(!!data.price_list_id)
      setEdits({})
    } catch (e: any) {
      toast.error("Load failed: " + (e?.message || e))
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    load()
  }, [load])

  /** Current value for a row — the edit if touched, else the saved sale. */
  const valueOf = (r: Row) =>
    edits[r.variant_id] !== undefined
      ? edits[r.variant_id]
      : r.sale_amount != null
      ? String(r.sale_amount)
      : ""

  const dirty = useMemo(
    () =>
      rows.some((r) => {
        const v = edits[r.variant_id]
        if (v === undefined) return false
        const saved = r.sale_amount != null ? String(r.sale_amount) : ""
        return v !== saved
      }),
    [rows, edits]
  )

  /** Apply the same % off to every variant, computed from its own base. */
  const applyPercent = (pct: number) => {
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return
    const next: Record<string, string> = {}
    for (const r of rows) {
      if (!r.base_amount) continue
      next[r.variant_id] = String(Math.round(r.base_amount * (1 - pct / 100)))
    }
    setEdits(next)
  }

  const onSave = async () => {
    const prices = rows
      .map((r) => {
        const raw = valueOf(r)
        if (raw === "") return null
        const amount = Number(raw)
        if (!Number.isFinite(amount) || amount <= 0) return null
        return { variant_id: r.variant_id, amount }
      })
      .filter(Boolean)

    if (!prices.length) {
      toast.error("Enter at least one sale price.")
      return
    }
    const invalid = rows.filter((r) => {
      const raw = valueOf(r)
      return raw !== "" && Number(raw) >= r.base_amount
    })
    if (invalid.length) {
      toast.error(
        `Sale price must be lower than the base price (${invalid[0].title}).`
      )
      return
    }

    setSaving(true)
    try {
      await jfetch(`/admin/product-discount/${productId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices }),
      })
      toast.success("Discount saved — live on the storefront")
      await load()
    } catch (e: any) {
      toast.error("Save failed: " + (e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  const onRemove = async () => {
    if (!window.confirm("Remove the discount from this product?")) return
    setSaving(true)
    try {
      await jfetch(`/admin/product-discount/${productId}`, { method: "DELETE" })
      toast.success("Discount removed")
      await load()
    } catch (e: any) {
      toast.error("Remove failed: " + (e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  if (!productId) return null

  return (
    <Container className="p-4">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <Heading level="h2" className="text-base font-semibold">
            Discount
          </Heading>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Set a sale price per variant. The storefront shows the old price
            struck through, and checkout charges the discounted amount.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {hasDiscount && (
            <Badge size="2xsmall" color="green">
              Active
            </Badge>
          )}
          {hasDiscount && (
            <Button
              size="small"
              variant="secondary"
              onClick={onRemove}
              disabled={loading || saving}
            >
              Remove
            </Button>
          )}
          <Button
            size="small"
            variant="primary"
            onClick={onSave}
            disabled={loading || saving || !dirty}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: "#6b7280" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 12, color: "#6b7280" }}>No variants found.</p>
      ) : (
        <>
          {/* Quick % shortcuts — fill every variant from its own base price */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 11, color: "#6b7280", marginRight: 2 }}>
              Quick:
            </span>
            {[10, 20, 30, 40, 50].map((p) => (
              <Button
                key={p}
                size="small"
                variant="secondary"
                disabled={saving}
                onClick={() => applyPercent(p)}
              >
                {p}% off
              </Button>
            ))}
            <Button
              size="small"
              variant="transparent"
              disabled={saving}
              onClick={() => setEdits(Object.fromEntries(rows.map((r) => [r.variant_id, ""])))}
            >
              Clear
            </Button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r) => {
              const raw = valueOf(r)
              const amount = Number(raw)
              const valid =
                raw !== "" && Number.isFinite(amount) && amount > 0 && amount < r.base_amount
              const tooHigh = raw !== "" && Number.isFinite(amount) && amount >= r.base_amount
              const pct = valid
                ? Math.round(((r.base_amount - amount) / r.base_amount) * 100)
                : null

              return (
                <div
                  key={r.variant_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      Base {money(r.base_amount, r.currency_code)}
                    </div>
                  </div>

                  <div style={{ width: 150 }}>
                    <Input
                      type="number"
                      min={0}
                      size="small"
                      placeholder="Sale price"
                      value={raw}
                      disabled={saving || !r.base_amount}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [r.variant_id]: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div style={{ width: 110, textAlign: "right" }}>
                    {tooHigh ? (
                      <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>
                        Must be lower
                      </span>
                    ) : valid ? (
                      <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>
                        −{pct}% off
                      </span>
                    ) : r.base_amount ? (
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>No discount</span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#d97706" }}>Set a price first</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 10 }}>
            Leave a variant blank to keep it at full price. Removing the
            discount deletes the price list this widget created — price lists
            you built by hand are never touched.
          </p>
        </>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
})

export default ProductDiscountWidget
