/**
 * Admin-controlled subcategory sections for a category page.
 *
 * By default a category page shows ALL of its children in one rail. That
 * doesn't scale: a "Men" category can have sizes, types, colours and
 * occasions under it, and dumping them into one strip is meaningless.
 *
 * So an operator can configure, per category, an ordered list of titled
 * SECTIONS and choose exactly which children appear in each — e.g.
 *   [{ title: "Shop by Type",  category_ids: [...] },
 *    { title: "Shop by Size",  category_ids: [...] }]
 *
 * Stored as a JSON string on the category's own metadata under
 * `subcategory_sections`, so it needs no schema change and travels with
 * the category (export/import, backups) for free.
 *
 * Back-compat: no config (or malformed JSON) → a single untitled section
 * containing every child, i.e. exactly the old behaviour.
 */
export type SubcategorySection = {
  /** Optional heading shown above the rail. */
  title?: string | null
  /** Ordered child-category ids to show in this section. */
  category_ids: string[]
}

type ChildLike = { id: string; name?: string; handle?: string }

export type ResolvedSubcategorySection<T extends ChildLike> = {
  title: string | null
  items: T[]
}

/** Parse the raw metadata value into sections. Never throws. */
export function parseSubcategorySections(raw: unknown): SubcategorySection[] {
  if (!raw) return []
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((s: any) => ({
        title: typeof s?.title === "string" ? s.title : null,
        category_ids: Array.isArray(s?.category_ids)
          ? s.category_ids.filter((id: any) => typeof id === "string")
          : [],
      }))
      .filter((s) => s.category_ids.length > 0)
  } catch {
    return []
  }
}

/**
 * Resolve the admin config against the category's actual children.
 *
 * - Only ids that are real children are kept (so deleting a subcategory
 *   can't leave a broken tile behind).
 * - Order follows the admin's chosen order, not the API's.
 * - No config → one untitled section with every child (legacy behaviour).
 */
export function resolveSubcategorySections<T extends ChildLike>(
  children: T[],
  raw: unknown
): ResolvedSubcategorySection<T>[] {
  const kids = children || []
  if (!kids.length) return []

  const sections = parseSubcategorySections(raw)
  if (!sections.length) {
    return [{ title: null, items: kids }]
  }

  const byId = new Map(kids.map((c) => [c.id, c]))
  return sections
    .map((s) => ({
      title: s.title?.trim() ? s.title.trim() : null,
      items: s.category_ids
        .map((id) => byId.get(id))
        .filter((c): c is T => !!c),
    }))
    .filter((s) => s.items.length > 0)
}
