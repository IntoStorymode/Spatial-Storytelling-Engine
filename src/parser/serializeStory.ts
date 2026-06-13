import type { Story, StoryItem } from './types'

/** Round to ~4 decimals and drop trailing zeros so coords stay readable. */
function fmtNum(n: number): string {
  return String(Math.round(n * 1e4) / 1e4)
}

function fmtTriple(t: [number, number, number]): string {
  return `[${t.map(fmtNum).join(', ')}]`
}

/**
 * Serialize a Story back into the story.md format. The exact inverse of parseStory:
 * `parseStory(serializeStory(s))` reproduces `s` (frontmatter + items).
 */
export function serializeStory(story: Story): string {
  const fm = story.frontmatter
  const head = [
    '---',
    `title: "${fm.title}"`,
    `author: "${fm.author}"`,
    `location: "${fm.location}"`,
    `date: "${fm.date}"`,
    `model: "${fm.model}"`,
    '---',
  ].join('\n')

  const body = story.items.map(serializeItem).join('\n\n---\n\n')

  return `${head}\n\n${body}\n`
}

function serializeItem(item: StoryItem): string {
  const lines: string[] = [`## [${item.id}] ${item.title}`, '', `type: ${item.type}`]
  if (item.src) lines.push(`src: ${item.src}`)
  if (item.caption) lines.push(`caption: ${item.caption}`)
  if (item.body) {
    lines.push('', item.body)
  }
  if (item.hotspot) {
    lines.push('', 'hotspot:')
    lines.push(`  position: ${fmtTriple(item.hotspot.position)}`)
    lines.push(`  target: ${fmtTriple(item.hotspot.target)}`)
  }
  return lines.join('\n')
}
