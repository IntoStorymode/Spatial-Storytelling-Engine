import yaml from 'js-yaml'
import type { Frontmatter, Hotspot, SectionType, Story, Section, Waypoint } from './types'

const SECTION_TYPES: readonly string[] = ['text', 'image', 'audio', 'video']
const META_RE = /^(type|src|caption|waypoint):\s*(.*)$/
const HEADING_RE = /^##\s*\[([^\]]+)\]\s*(.*)$/
const HOTSPOT_RE = /^hotspot:\s*$/
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/
const SECTION_SEPARATOR_RE = /^---\s*$/m

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

/** A `{ position: [...], target: [...] }` mapping → Hotspot, or null if malformed. */
function toHotspot(v: unknown): Hotspot | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const position = toTriple(o.position)
  const target = toTriple(o.target)
  return position && target ? { position, target } : null
}

/** A `{ name, position, target }` frontmatter entry → Waypoint, or null if malformed. */
function toWaypoint(v: unknown): Waypoint | null {
  if (!v || typeof v !== 'object') return null
  const name = toStr((v as Record<string, unknown>).name).trim()
  const h = toHotspot(v)
  return name && h ? { name, position: h.position, target: h.target } : null
}

/**
 * Parse a story.md (YAML frontmatter + a sequence of `## [id] title` section blocks)
 * into a Story. Resilient: malformed pieces produce `warnings` rather than throwing.
 * `src`/`model` are kept verbatim (resolved against basePath at render time), which
 * keeps parse→serialize→parse idempotent.
 *
 * Cameras are named waypoints defined in the frontmatter `waypoints` list;
 * sections and `start` reference them by name. Legacy files that inline a
 * `hotspot:`/`start:` camera still load — each is migrated into a synthesized
 * named waypoint (silently), so old and hand-authored stories keep working.
 */
export function parseStory(raw: string, basePath = ''): Story {
  const warnings: string[] = []
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // --- frontmatter ---
  let frontmatter: Frontmatter = { title: '', author: '', location: '', date: '', model: '' }
  // The story's named cameras — seeded from frontmatter, then any legacy inline
  // cameras (section hotspots / inline start) are appended as synthesized entries.
  const waypoints: Waypoint[] = []
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
      if (data.waypoints !== undefined) {
        if (Array.isArray(data.waypoints)) {
          for (const entry of data.waypoints) {
            const wp = toWaypoint(entry)
            if (!wp) {
              warnings.push('Frontmatter waypoints: each needs a name and position/target of 3 numbers')
            } else if (waypoints.some((w) => w.name === wp.name)) {
              warnings.push(`Frontmatter waypoints: duplicate name "${wp.name}"`)
            } else {
              waypoints.push(wp)
            }
          }
        } else {
          warnings.push('Frontmatter waypoints: expected a list')
        }
      }
      if (data.start !== undefined) {
        if (typeof data.start === 'string') {
          frontmatter.start = data.start.trim() // reference validated after sections
        } else {
          // Legacy inline start camera → synthesize a "start" waypoint.
          const h = toHotspot(data.start)
          if (h) {
            if (!waypoints.some((w) => w.name === 'start')) {
              waypoints.push({ name: 'start', position: h.position, target: h.target })
            }
            frontmatter.start = 'start'
          } else {
            warnings.push('Frontmatter start: expected a waypoint name, or position/target of 3 numbers')
          }
        }
      }
      if (data.navigation !== undefined) {
        const nav = toStr(data.navigation)
        if (nav === 'orbit' || nav === 'firstPerson') frontmatter.navigation = nav
        else warnings.push(`Frontmatter navigation: expected "orbit" or "firstPerson", got "${nav}"`)
      }
      if (data.orientation !== undefined) {
        const orient = toStr(data.orientation)
        if (orient === 'flip' || orient === 'none') frontmatter.orientation = orient
        else warnings.push(`Frontmatter orientation: expected "flip" or "none", got "${orient}"`)
      }
    } catch (e) {
      warnings.push(`Frontmatter parse error: ${String(e)}`)
    }
    body = text.slice(fmMatch[0].length)
  } else {
    warnings.push('No frontmatter block found')
  }

  // --- sections ---
  const chunks = body
    .split(SECTION_SEPARATOR_RE)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)

  const sections: Section[] = []
  for (const chunk of chunks) {
    const section = parseSection(chunk, warnings, waypoints)
    if (section) sections.push(section)
  }

  if (waypoints.length) frontmatter.waypoints = waypoints

  // Flag references that don't resolve (helps catch typos / deleted waypoints).
  const names = new Set(waypoints.map((w) => w.name))
  for (const it of sections) {
    if (it.waypoint && !names.has(it.waypoint)) {
      warnings.push(`Section ${it.id}: waypoint "${it.waypoint}" is not defined`)
    }
  }
  if (frontmatter.start && !names.has(frontmatter.start)) {
    warnings.push(`Frontmatter start: waypoint "${frontmatter.start}" is not defined`)
  }

  return { frontmatter, sections, basePath, warnings }
}

function parseSection(chunk: string, warnings: string[], waypoints: Waypoint[]): Section | null {
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

  // Metadata (type/src/caption/waypoint) sits at the top of the preamble; the body follows.
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

  let type: SectionType = 'text'
  if (meta.type) {
    if (SECTION_TYPES.includes(meta.type)) type = meta.type as SectionType
    else warnings.push(`Section ${id}: unknown type "${meta.type}", defaulting to text`)
  } else {
    warnings.push(`Section ${id}: missing type, defaulting to text`)
  }

  const section: Section = { id, title, type, body: itemBody }
  if (meta.src) section.src = meta.src
  if (meta.caption) section.caption = meta.caption

  if (meta.waypoint) {
    // New format: an explicit reference to a named waypoint.
    section.waypoint = meta.waypoint
  } else if (hotspotLines.length > 0) {
    // Legacy inline hotspot → synthesize a waypoint named after the section id.
    // Dedent so js-yaml parses the indented sub-block as a top-level mapping.
    const dedented = hotspotLines.map((l) => l.replace(/^\s+/, '')).join('\n')
    try {
      const h = toHotspot(yaml.load(dedented))
      if (h) {
        if (!waypoints.some((w) => w.name === id)) {
          waypoints.push({ name: id, position: h.position, target: h.target })
        }
        section.waypoint = id
      } else {
        warnings.push(`Section ${id}: hotspot position/target must each be 3 numbers`)
      }
    } catch (e) {
      warnings.push(`Section ${id}: hotspot parse error: ${String(e)}`)
    }
  }

  return section
}
