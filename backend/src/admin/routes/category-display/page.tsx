import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tag } from "@medusajs/icons"
import { Container, Heading, Button, Input, Badge, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { fetchSettings, saveSettings } from "../../lib/settings-sdk"

/**
 * Category Display — two related controls that live together because both
 * shape how categories appear on the storefront:
 *
 *  1. Icon size — the DESKTOP diameter (px) of category icons everywhere
 *     they render (homepage rail, shop, category & subcategory pages). The
 *     storefront derives the mobile size (~72%, floor 40px).
 *
 *  2. Hide from filters — categories ticked here are dropped from the
 *     archive filter sidebar (the auto-generated facets). Tick a
 *     sub-category to remove it as a filter option; tick a parent to hide
 *     its whole filter group. Navigation/menus are unaffected — this only
 *     touches the filters. Stored as a comma-separated id list in the
 *     `filter_excluded_category_ids` setting and read by the storefront's
 *     facet builder.
 */

const DEFAULT = 84
const MIN = 44
const MAX = 160

/** Same derivation the storefront uses, so this preview is truthful. */
const mobileFor = (d: number) => Math.max(40, Math.round(d * 0.72))

const SAMPLE = ["Men", "Women", "Kids", "Shoes", "Bags"]

type Cat = {
  id: string
  name: string
  handle: string
  parentName: string | null
}

const jfetch = async (url: string) => {
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

const Page = () => {
  const [size, setSize] = useState<number>(DEFAULT)
  const [initialSize, setInitialSize] = useState<number>(DEFAULT)

  const [cats, setCats] = useState<Cat[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [initialExcluded, setInitialExcluded] = useState<string>("")
  const [search, setSearch] = useState("")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchSettings(),
      jfetch(
        "/admin/product-categories?fields=id,name,handle,parent_category.id,parent_category.name&limit=1000"
      ).catch(() => ({ product_categories: [] })),
    ])
      .then(([s, c]: any[]) => {
        const parsed = parseInt(String(s?.category_icon_size ?? ""), 10)
        const v = Number.isFinite(parsed)
          ? Math.min(MAX, Math.max(MIN, parsed))
          : DEFAULT
        setSize(v)
        setInitialSize(v)

        const list: Cat[] = (c?.product_categories || []).map((x: any) => ({
          id: x.id,
          name: x.name,
          handle: x.handle,
          parentName: x.parent_category?.name || null,
        }))
        list.sort((a, b) =>
          `${a.parentName || ""} ${a.name}`.localeCompare(
            `${b.parentName || ""} ${b.name}`
          )
        )
        setCats(list)

        const raw = String(s?.filter_excluded_category_ids ?? "")
        const ids = raw.split(",").map((t) => t.trim()).filter(Boolean)
        // Keep only ids that still exist, so a deleted category self-cleans.
        const valid = new Set(list.map((x) => x.id))
        const kept = ids.filter((id) => valid.has(id))
        setExcluded(new Set(kept))
        setInitialExcluded(kept.slice().sort().join(","))
      })
      .catch((e) => toast.error("Load failed: " + (e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const excludedKey = useMemo(
    () => Array.from(excluded).sort().join(","),
    [excluded]
  )
  const dirty = size !== initialSize || excludedKey !== initialExcluded

  const filteredCats = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cats
    return cats.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.parentName || "").toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q)
    )
  }, [cats, search])

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const onSave = async () => {
    setSaving(true)
    try {
      await saveSettings({
        category_icon_size: String(size),
        filter_excluded_category_ids: Array.from(excluded).join(","),
      } as any)
      setInitialSize(size)
      setInitialExcluded(excludedKey)
      toast.success("Category display settings saved")
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

  const sectionLabel = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
    color: "#6b7280",
    display: "block",
    marginBottom: 6,
  }

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
            Icon size and which categories appear in the storefront filters.
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
            {/* ── Icon size ── */}
            <div style={{ maxWidth: 460, marginBottom: 20 }}>
              <label htmlFor="cat-icon-size" style={sectionLabel}>
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
                Mobile is derived automatically ({mobileFor(size)}px). Default{" "}
                {DEFAULT}px.
              </p>
            </div>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>
              <Preview px={size} caption="Desktop preview" />
              <Preview px={mobileFor(size)} caption="Mobile preview" />
            </div>

            {/* ── Hide from filters ── */}
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 20, maxWidth: 620 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 4,
                }}
              >
                <label style={{ ...sectionLabel, marginBottom: 0 }}>
                  Hide from filters
                </label>
                {excluded.size > 0 && (
                  <Badge size="2xsmall" color="orange">
                    {excluded.size} hidden
                  </Badge>
                )}
              </div>
              <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
                Ticked categories won&apos;t appear as options in the archive
                filter sidebar. Tick a sub-category to hide just that option, or
                a parent to hide its whole filter group. Menus and pages are
                unaffected.
              </p>

              <div style={{ marginBottom: 8, maxWidth: 320 }}>
                <Input
                  size="small"
                  placeholder="Search categories…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {cats.length === 0 ? (
                <p style={{ fontSize: 12, color: "#9ca3af" }}>
                  No categories found.
                </p>
              ) : (
                <div
                  style={{
                    maxHeight: 320,
                    overflowY: "auto",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 6,
                  }}
                >
                  {filteredCats.map((c) => {
                    const on = excluded.has(c.id)
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "7px 8px",
                          borderRadius: 8,
                          cursor: "pointer",
                          background: on ? "rgba(217,119,6,0.06)" : "transparent",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(c.id)}
                        />
                        <span style={{ fontSize: 13, color: "#111827" }}>
                          {c.parentName && (
                            <span style={{ color: "#9ca3af" }}>
                              {c.parentName} ›{" "}
                            </span>
                          )}
                          <span style={{ fontWeight: 500 }}>{c.name}</span>
                        </span>
                      </label>
                    )
                  })}
                  {filteredCats.length === 0 && (
                    <p style={{ fontSize: 12, color: "#9ca3af", padding: 8 }}>
                      No categories match “{search}”.
                    </p>
                  )}
                </div>
              )}
            </div>

            {dirty && (
              <p style={{ fontSize: 11, color: "#d97706", fontWeight: 600, marginTop: 12 }}>
                Unsaved changes.
              </p>
            )}
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
