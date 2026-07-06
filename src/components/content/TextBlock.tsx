import type { Section } from '../../parser/types'

/**
 * Renders an section's freeform body as paragraphs. Blank lines separate
 * paragraphs; this is the one place body text becomes DOM, shared by both modes.
 */
export function TextBlock({ section }: { section: Section }) {
  const paragraphs = section.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <div className="item-body">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  )
}
