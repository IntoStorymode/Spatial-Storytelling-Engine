import yaml from 'js-yaml'
import type { Collection } from './types'

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/

function toStr(v: unknown): string {
  if (v == null) return ''
  // Unquoted YAML dates parse to Date; normalize back to a YYYY-MM-DD string.
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

/**
 * Parse a collection.md (YAML frontmatter + a freeform prose body) into a
 * Collection. Resilient in the same way as parseStory: malformed pieces produce
 * `warnings` rather than throwing, and `cover` is kept verbatim (resolved against
 * basePath at render time) so parse→serialize→parse is idempotent.
 *
 * Unlike a story, the body is NOT split into sections — a collection is one
 * continuous piece of background prose, so everything after the frontmatter is
 * kept as-is. That is why this is a separate entry point rather than a branch in
 * parseStory: a collection has no sections, no model and no waypoints, and
 * borrowing Story would make those absences sentinel values every consumer has
 * to remember to ignore.
 */
export function parseCollection(raw: string, basePath = ''): Collection {
  const warnings: string[] = []
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  let title = ''
  let subtitle: string | undefined
  let cover: string | undefined
  let stories: string[] = []
  let body = text

  const fmMatch = text.match(FRONTMATTER_RE)
  if (fmMatch) {
    try {
      const data = (yaml.load(fmMatch[1]) ?? {}) as Record<string, unknown>
      // `type` is the file's self-identification. It is optional (the filename
      // already says what this is) but a wrong value means the author believes
      // this file is something else, which is worth saying out loud.
      if (data.type !== undefined && toStr(data.type).trim() !== 'collection') {
        warnings.push(`Frontmatter type: expected "collection", got "${toStr(data.type)}"`)
      }
      title = toStr(data.title)
      if (data.subtitle !== undefined) {
        const s = toStr(data.subtitle).trim()
        if (s) subtitle = s
      }
      if (data.cover !== undefined) {
        const c = toStr(data.cover).trim()
        if (c) cover = c
      }
      if (data.stories !== undefined) {
        if (Array.isArray(data.stories)) {
          const ids = data.stories
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .map((s) => s.trim())
          if (ids.length !== data.stories.length) {
            warnings.push('Frontmatter stories: each entry must be a non-empty story id')
          }
          stories = ids
        } else {
          warnings.push('Frontmatter stories: expected a list of story ids')
        }
      }
    } catch (e) {
      warnings.push(`Frontmatter parse error: ${String(e)}`)
    }
    body = text.slice(fmMatch[0].length)
  } else {
    warnings.push('No frontmatter block found')
  }

  if (!title) warnings.push('Frontmatter title: a collection needs a title')
  if (!stories.length) warnings.push('Frontmatter stories: a collection lists no stories')

  return {
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(cover ? { cover } : {}),
    stories,
    body: body.trim(),
    basePath,
    warnings,
  }
}

/**
 * Serialize a Collection back into the collection.md format. The exact inverse
 * of parseCollection: `parseCollection(serializeCollection(c))` reproduces `c`
 * (title, subtitle, cover, stories and body).
 */
export function serializeCollection(collection: Collection): string {
  const headLines = ['---', 'type: collection', `title: "${collection.title}"`]
  if (collection.subtitle) headLines.push(`subtitle: "${collection.subtitle}"`)
  if (collection.cover) headLines.push(`cover: "${collection.cover}"`)
  if (collection.stories.length) {
    headLines.push('stories:')
    for (const id of collection.stories) headLines.push(`  - "${id}"`)
  }
  headLines.push('---')

  return `${headLines.join('\n')}\n\n${collection.body}\n`
}
