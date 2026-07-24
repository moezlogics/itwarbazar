import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Photo } from "@medusajs/icons"
import { Container, Heading, Button, Input, Badge, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  listBannerSections,
  createBannerSection,
  updateBannerSection,
  deleteBannerSection,
  listBanners,
  updateBanner,
  type AdminBannerSection,
  type AdminBanner,
} from "../../lib/banners-sdk"

/**
 * Banner Sections — the layout builder for the storefront's banner CMS.
 *
 * A "section" is one block of banners with its own column layout:
 *   1 → full-width, auto-rotating carousel when it holds several banners
 *   2 → two across (also two across on mobile)
 *   3 → three across (also three across on mobile)
 *
 * Sections render top-to-bottom in `sort_order`, so an operator can build
 * a homepage out of stacked blocks (hero carousel → 2-up promo → 3-up
 * category row) without a developer.
 *
 * Banner ARTWORK is still managed on the Banners page; here you choose
 * the structure and drag each banner into the section it belongs to.
 * Deleting a section never deletes banners — they're just detached.
 */

const LAYOUTS = [
  { value: 1, label: "1 — Full width carousel", hint: "One banner at a time, auto-rotates" },
  { value: 2, label: "2 — Two across", hint: "Split in two, on mobile too" },
  { value: 3, label: "3 — Three across", hint: "Three in a row, on mobile too" },
]

/**
 * Where a section renders. Banners are NOT homepage-only — a section can
 * target any surface, and on archive pages it renders at the very top.
 *   home             → homepage
 *   store            → the main /store shop archive
 *   category:<id>    → one category OR subcategory page
 *   brand:<id>       → one brand page
 */
type PlacementOption = { value: string; label: string; group: string }

function buildPlacementOptions(
  categories: { id: string; name: string }[],
  brands: { id: string; name: string }[]
): PlacementOption[] {
  return [
    { value: "home", label: "Homepage", group: "Pages" },
    { value: "store", label: "Shop (all products)", group: "Pages" },
    ...categories.map((c) => ({
      value: `category:${c.id}`,
      label: c.name,
      group: "Categories & subcategories",
    })),
    ...brands.map((b) => ({
      value: `brand:${b.id}`,
      label: b.name,
      group: "Brands",
    })),
  ]
}

/** Human label for a stored placement value. */
function placementLabel(value: string, options: PlacementOption[]): string {
  return options.find((o) => o.value === value)?.label || value
}

const box: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 14,
  background: "#fff",
}

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#6b7280",
  display: "block",
  marginBottom: 4,
}

const selectStyle: React.CSSProperties = {
  height: 36,
  width: "100%",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "0 10px",
  fontSize: 13,
  background: "#fff",
}

/** Miniature of how a layout will look, so the choice is obvious. */
const LayoutPreview = ({ layout }: { layout: number }) => {
  const cols = layout === 3 ? 3 : layout === 2 ? 2 : 1
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 4,
        width: 96,
      }}
      aria-hidden
    >
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "#e5e7eb",
            borderRadius: 4,
            // Fewer columns = wider art, so the preview gets shorter —
            // mirrors how the real thing behaves with natural ratios.
            height: cols === 1 ? 26 : cols === 2 ? 40 : 52,
          }}
        />
      ))}
    </div>
  )
}

const Page = () => {
  const [sections, setSections] = useState<AdminBannerSection[]>([])
  const [banners, setBanners] = useState<AdminBanner[]>([])
  const [placements, setPlacements] = useState<PlacementOption[]>(
    buildPlacementOptions([], [])
  )
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, b] = await Promise.all([listBannerSections(), listBanners()])
      setSections(s)
      setBanners(b)

      // Targets for the "Show on" picker. Best-effort: if either list
      // fails we still offer Homepage / Shop rather than breaking the page.
      const [cats, brs] = await Promise.all([
        fetch("/admin/product-categories?limit=200&fields=id,name", {
          credentials: "include",
        })
          .then((r) => (r.ok ? r.json() : { product_categories: [] }))
          .catch(() => ({ product_categories: [] })),
        fetch("/admin/brands", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : { brands: [] }))
          .catch(() => ({ brands: [] })),
      ])
      setPlacements(
        buildPlacementOptions(
          (cats?.product_categories || []).map((c: any) => ({
            id: c.id,
            name: c.name,
          })),
          (brs?.brands || []).map((b: any) => ({ id: b.id, name: b.name }))
        )
      )
    } catch (e: any) {
      toast.error("Load failed: " + (e?.message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const bannersBySection = useMemo(() => {
    const map = new Map<string, AdminBanner[]>()
    const loose: AdminBanner[] = []
    for (const b of banners) {
      if (b.section_id) {
        if (!map.has(b.section_id)) map.set(b.section_id, [])
        map.get(b.section_id)!.push(b)
      } else {
        loose.push(b)
      }
    }
    return { map, loose }
  }, [banners])

  const addSection = async () => {
    setBusy(true)
    try {
      const nextOrder =
        sections.reduce((m, s) => Math.max(m, s.sort_order), 0) + 1
      await createBannerSection({
        title: null,
        layout: 1,
        placement: "home",
        sort_order: nextOrder,
        is_active: true,
      })
      toast.success("Section added")
      await load()
    } catch (e: any) {
      toast.error("Create failed: " + (e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const patch = async (id: string, data: Partial<AdminBannerSection>) => {
    setBusy(true)
    try {
      await updateBannerSection(id, data)
      await load()
    } catch (e: any) {
      toast.error("Save failed: " + (e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const removeSection = async (s: AdminBannerSection) => {
    const owned = bannersBySection.map.get(s.id)?.length || 0
    const msg = owned
      ? `Delete this section? Its ${owned} banner(s) will be kept and moved to "Unassigned".`
      : "Delete this section?"
    if (!window.confirm(msg)) return
    setBusy(true)
    try {
      await deleteBannerSection(s.id)
      toast.success("Section deleted")
      await load()
    } catch (e: any) {
      toast.error("Delete failed: " + (e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const move = async (s: AdminBannerSection, dir: -1 | 1) => {
    const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order)
    const i = sorted.findIndex((x) => x.id === s.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= sorted.length) return
    setBusy(true)
    try {
      await Promise.all([
        updateBannerSection(sorted[i].id, { sort_order: sorted[j].sort_order }),
        updateBannerSection(sorted[j].id, { sort_order: sorted[i].sort_order }),
      ])
      await load()
    } catch (e: any) {
      toast.error("Reorder failed: " + (e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const assign = async (bannerId: string, sectionId: string | null) => {
    setBusy(true)
    try {
      await updateBanner(bannerId, { section_id: sectionId })
      await load()
    } catch (e: any) {
      toast.error("Assign failed: " + (e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const ordered = [...sections].sort((a, b) => a.sort_order - b.sort_order)

  const BannerChip = ({ b }: { b: AdminBanner }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 6,
        background: "#fafafa",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={b.image_url}
        alt=""
        style={{
          width: 54,
          height: 36,
          objectFit: "cover",
          borderRadius: 5,
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {b.title || "(untitled banner)"}
        </div>
        <div style={{ fontSize: 10, color: "#9ca3af" }}>
          {b.image_width && b.image_height
            ? `${b.image_width}×${b.image_height}`
            : "size unknown — re-upload to enable exact ratio"}
          {!b.is_active && " · hidden"}
        </div>
      </div>
      <select
        value={b.section_id || ""}
        disabled={busy}
        onChange={(e) => assign(b.id, e.target.value || null)}
        style={{ ...selectStyle, width: 150, height: 30, fontSize: 12 }}
        aria-label="Move banner to section"
      >
        <option value="">Unassigned</option>
        {ordered.map((s, i) => (
          <option key={s.id} value={s.id}>
            {s.title?.trim() || `Section ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <Container className="p-0">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 16,
          borderBottom: "1px solid #e5e7eb",
          gap: 12,
        }}
      >
        <div>
          <Heading level="h1" className="text-lg font-semibold">
            Banner Sections
          </Heading>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Build the storefront out of stacked banner blocks. Each section
            picks its own layout; banners keep their own natural size — no
            fixed banner height anywhere.
          </p>
        </div>
        <Button size="small" variant="primary" onClick={addSection} disabled={busy}>
          Add section
        </Button>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {loading ? (
          <p style={{ fontSize: 13, color: "#6b7280" }}>Loading…</p>
        ) : (
          <>
            {ordered.length === 0 && (
              <div style={{ ...box, textAlign: "center", color: "#6b7280" }}>
                <p style={{ fontSize: 13 }}>
                  No sections yet. Add one, then move banners into it below.
                </p>
                <p style={{ fontSize: 11, marginTop: 6 }}>
                  Until then, all banners render as a single carousel — the
                  original behaviour.
                </p>
              </div>
            )}

            {ordered.map((s, idx) => {
              const owned = bannersBySection.map.get(s.id) || []
              return (
                <div key={s.id} style={box}>
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <LayoutPreview layout={s.layout} />

                    <div style={{ flex: 1, minWidth: 240 }}>
                      <span style={label}>Section title (optional)</span>
                      <Input
                        size="small"
                        placeholder={`Section ${idx + 1}`}
                        defaultValue={s.title || ""}
                        disabled={busy}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if ((s.title || "") !== v) patch(s.id, { title: v || null })
                        }}
                      />
                    </div>

                    <div style={{ width: 220 }}>
                      <span style={label}>Show on</span>
                      <select
                        value={s.placement || "home"}
                        disabled={busy}
                        onChange={(e) => patch(s.id, { placement: e.target.value })}
                        style={selectStyle}
                      >
                        {["Pages", "Categories & subcategories", "Brands"].map(
                          (group) => {
                            const opts = placements.filter((p) => p.group === group)
                            if (!opts.length) return null
                            return (
                              <optgroup key={group} label={group}>
                                {opts.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </optgroup>
                            )
                          }
                        )}
                      </select>
                      <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                        {s.placement === "home"
                          ? "Top of the homepage"
                          : "Top of that page, above the products"}
                      </p>
                    </div>

                    <div style={{ width: 210 }}>
                      <span style={label}>Layout</span>
                      <select
                        value={s.layout}
                        disabled={busy}
                        onChange={(e) =>
                          patch(s.id, { layout: parseInt(e.target.value, 10) })
                        }
                        style={selectStyle}
                      >
                        {LAYOUTS.map((l) => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                      <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                        {LAYOUTS.find((l) => l.value === s.layout)?.hint}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: 6, alignItems: "center", paddingTop: 18 }}>
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={busy || idx === 0}
                        onClick={() => move(s, -1)}
                        title="Move up"
                      >
                        ↑
                      </Button>
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={busy || idx === ordered.length - 1}
                        onClick={() => move(s, 1)}
                        title="Move down"
                      >
                        ↓
                      </Button>
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => patch(s.id, { is_active: !s.is_active })}
                      >
                        {s.is_active ? "Hide" : "Show"}
                      </Button>
                      <Button
                        size="small"
                        variant="danger"
                        disabled={busy}
                        onClick={() => removeSection(s)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ ...label, marginBottom: 0 }}>
                        Banners in this section
                      </span>
                      <Badge size="2xsmall" color={owned.length ? "green" : "grey"}>
                        {owned.length}
                      </Badge>
                      {!s.is_active && (
                        <Badge size="2xsmall" color="orange">
                          Section hidden
                        </Badge>
                      )}
                    </div>
                    {owned.length === 0 ? (
                      <p style={{ fontSize: 12, color: "#9ca3af" }}>
                        Empty — assign banners from the list below. An empty
                        section renders nothing on the storefront.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {owned
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((b) => (
                            <BannerChip key={b.id} b={b} />
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Unassigned pool */}
            <div style={box}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ ...label, marginBottom: 0 }}>Unassigned banners</span>
                <Badge size="2xsmall" color={bannersBySection.loose.length ? "orange" : "grey"}>
                  {bannersBySection.loose.length}
                </Badge>
              </div>
              <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>
                These render as one carousel at the very top (legacy
                behaviour). Move them into a section to control their layout.
              </p>
              {bannersBySection.loose.length === 0 ? (
                <p style={{ fontSize: 12, color: "#9ca3af" }}>
                  None — every banner belongs to a section.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {bannersBySection.loose.map((b) => (
                    <BannerChip key={b.id} b={b} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Banner Sections",
  icon: Photo,
})

export default Page
