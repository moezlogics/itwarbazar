import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tag } from "@medusajs/icons"
import { Container, Heading, Button, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { fetchSettings, saveSettings } from "../../lib/settings-sdk"

/**
 * Category Display — one setting that controls how big category icons
 * render EVERYWHERE they appear on the storefront: the homepage rail,
 * the shop page, category pages and subcategory rails.
 *
 * The value is the DESKTOP diameter in px. The storefront derives the
 * mobile size from it (~72%, floor 40px) so an operator tunes a single
 * number and both breakpoints stay proportional — see
 * `lib/util/category-icon-size.ts` on the storefront side.
 */

const DEFAULT = 84
const MIN = 44
const MAX = 160

/** Same derivation the storefront uses, so this preview is truthful. */
const mobileFor = (d: number) => Math.max(40, Math.round(d * 0.72))

const SAMPLE = ["Men", "Women", "Kids", "Shoes", "Bags"]

const Page = () => {
  const [size, setSize] = useState<number>(DEFAULT)
  const [initial, setInitial] = useState<number>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
      .then((s: any) => {
        const parsed = parseInt(String(s?.category_icon_size ?? ""), 10)
        const v = Number.isFinite(parsed)
          ? Math.min(MAX, Math.max(MIN, parsed))
          : DEFAULT
        setSize(v)
        setInitial(v)
      })
      .catch((e) => toast.error("Load failed: " + (e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const dirty = size !== initial

  const onSave = async () => {
    setSaving(true)
    try {
      await saveSettings({ category_icon_size: String(size) } as any)
      setInitial(size)
      toast.success("Category icon size saved")
    } catch (e: any) {
      toast.error("Save failed: " + (e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  const Preview = ({ px, caption }: { px: number; caption: string }) => (
    <div style={{ flex: 1, minWidth: 260 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: "#6b7280",
          marginBottom: 8,
        }}
      >
        {caption} — {px}px
      </p>
      <div
        style={{
          display: "flex",
          gap: 14,
          overflowX: "auto",
          padding: 14,
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          background: "#fafafa",
        }}
      >
        {SAMPLE.map((name) => (
          <div
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flexShrink: 0,
              width: px + 8,
            }}
          >
            <div
              style={{
                width: px,
                height: px,
                borderRadius: 12,
                background:
                  "linear-gradient(135deg, rgba(16,185,129,.35), rgba(16,185,129,.75))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#065f46",
                fontWeight: 600,
                fontSize: Math.max(12, Math.round(px / 4)),
              }}
            >
              {name.charAt(0)}
            </div>
            <span
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "#374151",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <Container className="p-0">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 16,
          borderBottom: "1px solid #e5e7eb",
          gap: 12,
        }}
      >
        <div>
          <Heading level="h1" className="text-lg font-semibold">
            Category Display
          </Heading>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Icon size applies everywhere categories appear — homepage, shop,
            category and subcategory pages.
          </p>
        </div>
        <Button
          size="small"
          variant="primary"
          onClick={onSave}
          disabled={loading || saving || !dirty}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <p style={{ fontSize: 13, color: "#6b7280" }}>Loading…</p>
        ) : (
          <>
            <div style={{ maxWidth: 460, marginBottom: 20 }}>
              <label
                htmlFor="cat-icon-size"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  color: "#6b7280",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Desktop icon size
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  id="cat-icon-size"
                  type="range"
                  min={MIN}
                  max={MAX}
                  step={2}
                  value={size}
                  onChange={(e) => setSize(parseInt(e.target.value, 10))}
                  style={{ flex: 1 }}
                />
                <span
                  style={{
                    width: 62,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {size}px
                </span>
              </div>
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                Mobile is derived automatically ({mobileFor(size)}px) so both
                breakpoints stay proportional. Default {DEFAULT}px.
                {dirty && (
                  <span style={{ color: "#d97706", fontWeight: 600 }}>
                    {" "}
                    Unsaved changes.
                  </span>
                )}
              </p>
            </div>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <Preview px={size} caption="Desktop preview" />
              <Preview px={mobileFor(size)} caption="Mobile preview" />
            </div>
          </>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Category Display",
  icon: Tag,
})

export default Page
