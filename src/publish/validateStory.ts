import type { Story } from '../parser/types'

/**
 * Readiness checks for a draft. The header status pill turns green ("Ready")
 * only when this returns an empty list; otherwise it shows the count and lists
 * what's missing. Soft — nothing here blocks saving or previewing; it just tells
 * the author what still needs doing before the story is worth sharing.
 */
export function validateStory(story: Story): string[] {
  const issues: string[] = []
  const { frontmatter: fm, sections } = story

  if (!fm.title.trim()) issues.push('Story needs a title.')
  // The built-in room is a placeholder scene — a real story needs its own scan.
  if (fm.model.startsWith('builtin:')) {
    issues.push('Add your own 3D scan — the built-in room is only a placeholder.')
  }

  if (!sections.length) {
    issues.push('Story has no sections.')
  } else {
    sections.forEach((s, i) => {
      const n = `Section ${i + 1}`
      if (!s.title.trim()) issues.push(`${n}: needs a title.`)
      if (s.type !== 'text' && !s.src?.trim()) issues.push(`${n}: ${s.type} section has no source path.`)
    })
    // The first section is the reader's opening view, so it must have a waypoint.
    if (!sections[0].waypoint) issues.push('The first section needs a waypoint (the opening view).')
  }

  return issues
}
