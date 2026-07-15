import type { Story } from '../parser/types'
import { suggestSlug } from './slug'

/**
 * Readiness checks for a draft. The header status pill turns green ("Ready") only
 * when this returns an empty list; otherwise it shows the count and lists what's
 * missing, and Save to gallery is blocked. Previewing is always allowed.
 *
 * `exportName` is the story's slug — its folder name in the export. It's derived
 * from the title, but an all-CJK title yields nothing (see toSlug), so the author
 * has to supply one.
 */
export function validateStory(story: Story, exportName: string): string[] {
  const issues: string[] = []
  const { frontmatter: fm, sections } = story

  if (!fm.title.trim()) issues.push('Story needs a title.')
  if (!exportName.trim()) {
    issues.push(
      `Publish: give the story an export name — its title has no Latin letters to build one from (e.g. "${suggestSlug(fm.date)}").`,
    )
  }
  // The built-in room is a placeholder scene — a real story needs its own scan.
  if (fm.model.startsWith('builtin:')) {
    issues.push('Add your own 3D scan — the built-in room is only a placeholder.')
  }

  if (!sections.length) {
    issues.push('Story has no sections.')
  } else {
    sections.forEach((s, i) => {
      const n = `Section ${i + 1}`
      // A section title is optional — it isn't required to save or export.
      if (s.type !== 'text' && !s.src?.trim()) issues.push(`${n}: ${s.type} section has no source path.`)
    })
    // The first section is the reader's opening view, so it must have a waypoint.
    if (!sections[0].waypoint) issues.push('The first section needs a waypoint (the opening view).')
  }

  return issues
}
