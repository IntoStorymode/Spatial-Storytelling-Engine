import type { Story, Section } from './types'

/** Round to ~4 decimals and drop trailing zeros so coords stay readable. */
function fmtNum(n: number): string {
  return String(Math.round(n * 1e4) / 1e4)
}

function fmtTriple(t: [number, number, number]): string {
  return `[${t.map(fmtNum).join(', ')}]`
}

/**
 * Serialize a Story back into the story.md format. The exact inverse of parseStory:
 * `parseStory(serializeStory(s))` reproduces `s` (frontmatter + sections).
 */
export function serializeStory(story: Story): string {
  const fm = story.frontmatter
  const headLines = [
    '---',
    `title: "${fm.title}"`,
    `author: "${fm.author}"`,
    `location: "${fm.location}"`,
    `date: "${fm.date}"`,
    `model: "${fm.model}"`,
  ]
  if (fm.navigation) headLines.push(`navigation: "${fm.navigation}"`)
  if (fm.orientation) headLines.push(`orientation: "${fm.orientation}"`)
  if (fm.waypoints && fm.waypoints.length) {
    headLines.push('waypoints:')
    for (const w of fm.waypoints) {
      headLines.push(
        `  - name: "${w.name}"`,
        `    position: ${fmtTriple(w.position)}`,
        `    target: ${fmtTriple(w.target)}`,
      )
    }
  }
  if (fm.start) headLines.push(`start: ${fm.start}`)
  headLines.push('---')
  const head = headLines.join('\n')

  const body = story.sections.map(serializeSection).join('\n\n---\n\n')

  return `${head}\n\n${body}\n`
}

function serializeSection(section: Section): string {
  const lines: string[] = [`## [${section.id}] ${section.title}`, '', `type: ${section.type}`]
  if (section.src) lines.push(`src: ${section.src}`)
  if (section.caption) lines.push(`caption: ${section.caption}`)
  if (section.autoplay) lines.push('autoplay: true')
  if (section.waypoint) lines.push(`waypoint: ${section.waypoint}`)
  if (section.body) {
    lines.push('', section.body)
  }
  return lines.join('\n')
}
