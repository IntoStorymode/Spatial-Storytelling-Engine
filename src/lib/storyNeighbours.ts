/**
 * Linear story-to-story navigation, derived entirely from the deployment's own
 * `stories/index.json`. There is no backend or registry — the index is the only
 * thing the app knows about "other stories" — so neighbours are the entries
 * either side of the current one in the index's own order (which is the order
 * the gallery on Home displays, unsorted). A single-story kiosk export has a
 * one-entry index, so both neighbours are null and every control auto-hides.
 */

export interface Neighbour {
  id: string
  title: string
}

export interface Neighbours {
  prev: Neighbour | null
  next: Neighbour | null
}

/**
 * The stories immediately before and after `id` in index order. Null at the
 * ends (no wrap), and null for both when `id` isn't in the index or is the only
 * entry.
 */
export function storyNeighbours(stories: Neighbour[], id: string | undefined): Neighbours {
  const at = stories.findIndex((s) => s.id === id)
  if (at === -1) return { prev: null, next: null }
  const pick = (i: number): Neighbour | null => {
    const s = stories[i]
    return s ? { id: s.id, title: s.title } : null
  }
  return { prev: pick(at - 1), next: pick(at + 1) }
}

/**
 * Resolve a story's curated link slugs against the live index — keeping only
 * targets that actually exist in this deployment (so a slug absent from a given
 * export never renders a dead link), dropping any self-reference and duplicates,
 * and preserving the author's order. Each result carries the index entry's title.
 */
export function resolveStoryLinks(
  stories: Neighbour[],
  slugs: string[] | undefined,
  currentId: string | undefined,
): Neighbour[] {
  if (!slugs?.length) return []
  const byId = new Map(stories.map((s) => [s.id, s]))
  const seen = new Set<string>()
  const out: Neighbour[] = []
  for (const slug of slugs) {
    if (slug === currentId || seen.has(slug)) continue
    const entry = byId.get(slug)
    if (entry) {
      out.push({ id: entry.id, title: entry.title })
      seen.add(slug)
    }
  }
  return out
}
