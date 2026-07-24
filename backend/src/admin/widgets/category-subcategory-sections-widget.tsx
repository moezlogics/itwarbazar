import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Input, Badge, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"

/**
 * Subcategory Sections — controls how a category page presents its
 * children on the storefront.
 *
 * By default every child is dumped into one rail, which stops making
 * sense once a category has children of different KINDS (a "Men"
 * category can hold types, sizes, colours…). Here an operator builds an
 * ordered list of titled sections and picks exactly which children go in
 * each — e.g. "Shop by Type" then "Shop by Size".
 *
 * Persisted as JSON on the category's own metadata
 * (`subcategory_sections`), so there's no schema change and the config
 * travels with the category. Children left out of every section simply
 * don't render. No sections configured → the storefront falls back to
 * showing all children in one untitled rail (previous behaviour).
 */

type Section = { title: string; category_ids: string[] }
type Child = { id: string; name: string }

const box: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
  background: "#fff",
}

const jfetch = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, { credentials: "include", ...init })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

const CategorySubcategorySectionsWidget = () => {
  const { id: categoryId } = useParams()
  const [children, setChildren] = useState<Child[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [metadata, setMetadata] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    if (!categoryId) return
    setLoading(true)
    try {
      const { product_category } = await jfetch(
        `/admin/product-categories/${categoryId}?fields=id,metadata,*category_children`
      )
      const kids: Child[] = (product_category?.category_children || []).map(
        (c: any) => ({ id: c.id, name: c.name })
      )
      setChildren(kids)

      const meta = (product_category?.metadata || {}) as Record<string, any>
      setMetadata(meta)

      let parsed: Section[] = []
      try {
        const raw = meta.subcategory_sections
        const arr = typeof raw === "string" ? JSON.parse(raw) : raw
        if (Array.isArray(arr)) {
          parsed = arr.map((s: any) => ({
            title: typeof s?.title === "string" ? s.title : "",
            category_ids: Array.isArray(s?.category_ids)
              ? s.category_ids.filter((x: any) => typeof x === "string")
              : [],
          }))
        }
      } catch {
        /* malformed → start empty */
      }
      setSections(parsed)
      setDirty(false)
    } catch (e: any) {
      toast.error("Load failed: " + (e?.message || e))
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => {
    load()
  }, [load])

  const assigned = useMemo(
    () => new Set(sections.flatMap((s) => s.category_ids)),
    [sections]
  )
  const unassigned = children.filter((c) => !assigned.has(c.id))

  const mutate = (fn: (draft: Section[]) => Section[]) => {
    setSections((prev) => fn([...prev]))
    setDirty(true)
  }

  const addSection = () =>
    mutate((d) => [...d, { title: "", category_ids: [] }])

  const removeSection = (i: number) =>
    mutate((d) => d.filter((_, idx) => idx !== i))

  const moveSection = (i: number, dir: -1 | 1) =>
    mutate((d) => {
      const j = i + dir
      if (j < 0 || j >= d.length) return d
      ;[d[i], d[j]] = [d[j], d[i]]
      return d
    })

  const setTitle = (i: number, title: string) =>
    mutate((d) => d.map((s, idx) => (idx === i ? { ...s, title } : s)))

  const toggleChild = (i: number, childId: string) =>
    mutate((d) =>
      d.map((s, idx) => {
        if (idx !== i) {
          // A child belongs to exactly one section — remove it elsewhere.
          return { ...s, category_ids: s.category_ids.filter((x) => x !== childId) }
        }
        const has = s.category_ids.includes(childId)
        return {
          ...s,
          category_ids: has
            ? s.category_ids.filter((x) => x !== childId)
            : [...s.category_ids, childId],
        }
      })
    )

  const onSave = async () => {
    if (!categoryId) return
    // Drop empty sections so we never persist dead config.
    const clean = sections
      .map((s) => ({ title: s.title.trim(), category_ids: s.category_ids }))
      .filter((s) => s.category_ids.length > 0)

    setSaving(true)
    try {
      await jfetch(`/admin/product-categories/${categoryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: {
            ...metadata,
            // Empty → remove the key so the storefront falls back to
            // "show every child in one rail".
            subcategory_sections: clean.length ? JSON.stringify(clean) : "",
          },
        }),
      })
      toast.success("Subcategory sections saved")
      await load()
    } catch (e: any) {
      toast.error("Save failed: " + (e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  if (!categoryId) return null

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
            Subcategory Sections
          </Heading>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Choose which subcategories show on this category page, and split
            them into titled groups. Leave empty to show all of them in one
            rail.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {dirty && (
            <span style={{ fontSize: 11, color: "#d97706" }}>Unsaved</span>
          )}
          <Button size="small" variant="secondary" onClick={addSection} disabled={loading || saving}>
            Add section
          </Button>
          <Button size="small" variant="primary" onClick={onSave} disabled={loading || saving || !dirty}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: "#6b7280" }}>Loading…</p>
      ) : children.length === 0 ? (
        <p style={{ fontSize: 12, color: "#6b7280" }}>
          This category has no subcategories yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sections.length === 0 && (
            <div style={{ ...box, color: "#6b7280", fontSize: 12 }}>
              No sections — the storefront currently shows all{" "}
              {children.length} subcategories in a single rail. Add a section
              to curate and group them.
            </div>
          )}

          {sections.map((s, i) => (
            <div key={i} style={box}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <Input
                  size="small"
                  placeholder={`Section title (e.g. "Shop by Size")`}
                  value={s.title}
                  onChange={(e) => setTitle(i, e.target.value)}
                  disabled={saving}
                />
                <Badge size="2xsmall" color={s.category_ids.length ? "green" : "grey"}>
                  {s.category_ids.length}
                </Badge>
                <Button size="small" variant="secondary" disabled={saving || i === 0} onClick={() => moveSection(i, -1)}>
                  ↑
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={saving || i === sections.length - 1}
                  onClick={() => moveSection(i, 1)}
                >
                  ↓
                </Button>
                <Button size="small" variant="danger" disabled={saving} onClick={() => removeSection(i)}>
                  Remove
                </Button>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {children.map((c) => {
                  const on = s.category_ids.includes(c.id)
                  const elsewhere = !on && assigned.has(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChild(i, c.id)}
                      disabled={saving}
                      title={
                        elsewhere
                          ? "In another section — clicking moves it here"
                          : undefined
                      }
                      style={{
                        fontSize: 12,
                        padding: "5px 10px",
                        borderRadius: 999,
                        cursor: "pointer",
                        border: on ? "1px solid #111827" : "1px solid #e5e7eb",
                        background: on ? "#111827" : elsewhere ? "#f3f4f6" : "#fff",
                        color: on ? "#fff" : elsewhere ? "#9ca3af" : "#111827",
                      }}
                    >
                      {c.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {sections.length > 0 && (
            <p style={{ fontSize: 11, color: "#9ca3af" }}>
              {unassigned.length === 0
                ? "Every subcategory is placed."
                : `${unassigned.length} subcategory(ies) not in any section — they won't show on the storefront: ${unassigned
                    .map((c) => c.name)
                    .join(", ")}`}
            </p>
          )}
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product_category.details.after",
})

export default CategorySubcategorySectionsWidget
