/**
 * Reading the optional `collections` key out of a deployment's
 * `stories/index.json`.
 *
 * The key is a top-level *sibling* of `stories`, never an element of it. That
 * placement is what makes a collection export safe for an older engine: every
 * index reader in the app does `(await res.json()).stories ?? []`, so an extra
 * sibling key is structurally invisible to them. A collection added to the
 * `stories` array instead would be rendered as a story card, spliced into
 * prev/next, and could be picked as the VR viewer's default.
 */

/** A collection's registry entry — enough to list and link it without a second fetch. */
export interface CollectionIndexEntry {
  id: string
  title: string
  /** Path to the collection.md, relative to the deployment root. */
  path: string
  /** Optional cover image, relative to the deployment root. */
  cover?: string
  /** Optional freeform line under the title. */
  subtitle?: string
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * The `collections` entries from a parsed index.json, keeping only well-formed
 * ones. Tolerant by design: an absent key, a non-array value, or a malformed
 * entry yields fewer results rather than an error, so a hand-edited index can
 * never break the gallery.
 */
export function readCollectionEntries(json: unknown): CollectionIndexEntry[] {
  if (!json || typeof json !== 'object') return []
  const raw = (json as Record<string, unknown>).collections
  if (!Array.isArray(raw)) return []

  const out: CollectionIndexEntry[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (!isNonEmptyString(o.id) || !isNonEmptyString(o.path)) continue
    if (seen.has(o.id)) continue
    seen.add(o.id)
    out.push({
      id: o.id.trim(),
      title: isNonEmptyString(o.title) ? o.title : o.id.trim(),
      path: o.path.trim(),
      ...(isNonEmptyString(o.cover) ? { cover: o.cover.trim() } : {}),
      ...(isNonEmptyString(o.subtitle) ? { subtitle: o.subtitle.trim() } : {}),
    })
  }
  return out
}

/**
 * Where a collection's `collection.md` lives by convention, for an id that has
 * no index entry. Mirrors the VR viewer's convention fallback: a local,
 * gitignored collection previews without editing the tracked index.json.
 */
export function collectionPathFor(id: string): string {
  return `collections/${id}/collection.md`
}

/**
 * The collection this deployment is *hosted as*, if any — i.e. the one whose
 * landing page stands in for Home.
 *
 * Only on a published (exported) site: there the collection is the site's front
 * door, so `/` renders it and a story's back link names it. In the authoring app
 * Home is the author's own gallery, which they still need, so this is null and a
 * collection is reached at `/collection/<id>` instead.
 *
 * One collection per export, so the first entry wins.
 */
export function hostCollectionEntry(json: unknown, published: boolean): CollectionIndexEntry | null {
  if (!published) return null
  return readCollectionEntries(json)[0] ?? null
}
