import yaml from 'js-yaml'
import type { Frontmatter, Hotspot, ItemType, Story, StoryItem } from './types'

const ITEM_TYPES: readonly string[] = ['text', 'image', 'audio', 'video']
const META_RE = /^(type|src|caption):\s*(.*)$/
const HEADING_RE = /^##\s*\[([^\]]+)\]\s*(.*)$/
const HOTSPOT_RE = /^hotspot:\s*$/
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/
const ITEM_SEPARATOR_RE = /^---\s*$/m

function toStr(v: unknown): string {
  if (v == null) return ''
  // Unquoted YAML dates parse to Date; normalize back to a YYYY-MM-DD string.
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

function toTriple(v: unknown): [number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 3) return null
  const nums = v.map(Number)
  if (nums.some((n) => Number.isNaN(n))) return null
  return [nums[0], nums[1], nums[2]]
}

/**
 * Parse a story.md (YAML frontmatter + a sequence of `## [id] title` item blocks)
 * into a Story. Resilient: malformed pieces produce `warnings` rather than throwing.
 * `src`/`model` are kept verbatim (resolved against basePath at render time), which
 * keeps parse→serialize→parse idempotent.
 */
export function parseStory(raw: string, basePath = ''): Story {
  const warnings: string[] = []
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // --- frontmatter ---
  let frontmatter: Frontmatter = { title: '', author: '', location: '', date: '', model: '' }
  let body = text

  const fmMatch = text.match(FRONTMATTER_RE)
  if (fmMatch) {
    try {
      const data = (yaml.load(fmMatch[1]) ?? {}) as Record<string, unknown>
      frontmatter = {
        title: toStr(data.title),
        author: toStr(data.author),
        location: toStr(data.location),
        date: toStr(data.date),
        model: toStr(data.model),
      }
    } catch (e) {
      warnings.push(`Frontmatter parse error: ${String(e)}`)
    }
    body = text.slice(fmMatch[0].length)
  } else {
    warnings.push('No frontmatter block found')
  }

  // --- items ---
  const chunks = body
    .split(ITEM_SEPARATOR_RE)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)

  const items: StoryItem[] = []
  for (const chunk of chunks) {
    const item = parseItem(chunk, warnings)
    if (item) items.push(item)
  }

  return { frontmatter, items, basePath, warnings }
}

function parseItem(chunk: string, warnings: string[]): StoryItem | null {
  const lines = chunk.split('\n')
  const heading = lines[0].match(HEADING_RE)
  if (!heading) {
    warnings.push(`Skipping block without a '## [id] title' heading: "${lines[0].slice(0, 40)}"`)
    return null
  }
  const id = heading[1].trim()
  const title = heading[2].trim()

  const rest = lines.slice(1)
  const hotspotIdx = rest.findIndex((l) => HOTSPOT_RE.test(l))
  const preLines = hotspotIdx === -1 ? rest : rest.slice(0, hotspotIdx)
  const hotspotLines = hotspotIdx === -1 ? [] : rest.slice(hotspotIdx + 1)

  // Metadata (type/src/caption) sits at the top of the preamble; the body follows.
  const meta: Record<string, string> = {}
  let i = 0
  while (i < preLines.length && preLines[i].trim() === '') i++
  while (i < preLines.length) {
    const m = preLines[i].match(META_RE)
    if (!m) break
    meta[m[1]] = m[2].trim()
    i++
  }
  const itemBody = preLines.slice(i).join('\n').trim()

  let type: ItemType = 'text'
  if (meta.type) {
    if (ITEM_TYPES.includes(meta.type)) type = meta.type as ItemType
    else warnings.push(`Item ${id}: unknown type "${meta.type}", defaulting to text`)
  } else {
    warnings.push(`Item ${id}: missing type, defaulting to text`)
  }

  let hotspot: Hotspot | undefined
  if (hotspotLines.length > 0) {
    // Dedent so js-yaml parses the indented sub-block as a top-level mapping.
    const dedented = hotspotLines.map((l) => l.replace(/^\s+/, '')).join('\n')
    try {
      const h = (yaml.load(dedented) ?? {}) as Record<string, unknown>
      const position = toTriple(h.position)
      const target = toTriple(h.target)
      if (position && target) hotspot = { position, target }
      else warnings.push(`Item ${id}: hotspot position/target must each be 3 numbers`)
    } catch (e) {
      warnings.push(`Item ${id}: hotspot parse error: ${String(e)}`)
    }
  }

  const item: StoryItem = { id, title, type, body: itemBody }
  if (meta.src) item.src = meta.src
  if (meta.caption) item.caption = meta.caption
  if (hotspot) item.hotspot = hotspot
  return item
}
