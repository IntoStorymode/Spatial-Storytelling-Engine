import type { Collection } from '../parser/types'
import { suggestSlug } from './slug'

/**
 * Readiness checks for a collection draft — the counterpart of validateStory,
 * gating Save to gallery the same way.
 *
 * Deliberately separate rather than a branch in validateStory: that function
 * requires a non-`builtin:` model, at least one section, and a waypoint on the
 * first section, all three of which a collection fails by design. Sharing it
 * would mean teaching every rule to ignore a shape it was never about.
 *
 * `exportName` is the collection's slug — its folder name in the export. It's
 * derived from the title, but an all-CJK title yields nothing (see toSlug), so the
 * author has to supply one.
 *
 * `availableStoryIds` is what the collection's `stories:` list can resolve against
 * right now (the session gallery plus this deployment's index). A reference that
 * resolves to nothing would render as a missing row on the landing page and be
 * dropped from an export, so it blocks rather than warning.
 */
export function validateCollection(
  collection: Collection,
  exportName: string,
  availableStoryIds: Iterable<string> = [],
): string[] {
  const issues: string[] = []

  if (!collection.title.trim()) issues.push('Collection needs a title.')
  if (!exportName.trim()) {
    issues.push(
      `Publish: give the collection an export name — its title has no Latin letters to build one from (e.g. "${suggestSlug(new Date().toISOString().slice(0, 10))}").`,
    )
  }

  if (!collection.stories.length) {
    issues.push('Add at least one story — a collection introduces the stories it lists.')
  } else {
    const available = new Set(availableStoryIds)
    const missing = collection.stories.filter((id) => !available.has(id))
    for (const id of missing) {
      issues.push(`Story "${id}" isn't in your gallery — import or remove it.`)
    }
  }

  if (!collection.body.trim()) {
    issues.push('Add some background text — the landing page is mostly this prose.')
  }

  return issues
}
