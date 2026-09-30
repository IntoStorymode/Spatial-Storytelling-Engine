import type { Section } from '../../parser/types'

/**
 * Renders freeform body text as paragraphs. Blank lines separate paragraphs;
 * this is the one place body text becomes DOM, shared by both reading modes and
 * by the collection landing page.
 *
 * Deliberately not Markdown: nothing here interprets `**bold**`, links or
 * headings, so prose renders as written. Real Markdown in prose bodies is a
 * roadmap item — see ROADMAP.md → Authoring.
 */
export function Prose({ body, className = 'item-body' }: { body: string; className?: string }) {
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <div className={className}>
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  )
}

/** A section's body, as paragraphs. */
export function TextBlock({ section }: { section: Section }) {
  return <Prose body={section.body} />
}
