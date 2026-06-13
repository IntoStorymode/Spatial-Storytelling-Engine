import type { StoryItem } from '../../parser/types'

/**
 * Renders an item's freeform body as paragraphs. Blank lines separate
 * paragraphs; this is the one place body text becomes DOM, shared by both modes.
 */
export function TextBlock({ item }: { item: StoryItem }) {
  const paragraphs = item.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <div className="item-body">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  )
}
