import { useState } from 'react'
import type { Story } from '../../parser/types'
import { serializeStory } from '../../parser/serializeStory'

/** Soft validation — surfaced as hints, never blocks export (prototype-friendly). */
function validate(story: Story): string[] {
  const warnings: string[] = []
  if (!story.frontmatter.title.trim()) warnings.push('Story has no title.')
  if (!story.items.length) warnings.push('Story has no items.')
  story.items.forEach((it, i) => {
    const n = `Item ${i + 1}`
    if (!it.title.trim()) warnings.push(`${n}: no title.`)
    if (it.type !== 'text' && !it.src?.trim()) warnings.push(`${n}: ${it.type} item has no source path.`)
  })
  return warnings
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'story'
}

/** Export the draft to story.md — download or copy — with validation hints. */
export function ExportBar({ story, uploaded }: { story: Story; uploaded: boolean }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const warnings = validate(story)

  function download() {
    const md = serializeStory(story)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'story.md'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function copy() {
    await navigator.clipboard.writeText(serializeStory(story))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="export">
      <button className="btn btn-accent" onClick={download}>
        ⭳ Export story.md
      </button>
      <button className="btn" onClick={copy}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <button
        className="btn export-warn"
        onClick={() => setOpen((o) => !o)}
        title="Validation"
        data-count={warnings.length}
      >
        {warnings.length ? `⚠ ${warnings.length}` : '✓ ok'}
      </button>

      {open && (
        <div className="export-pop">
          {warnings.length === 0 ? (
            <p>Looks good. Export, then drop story.md into a folder under <code>public/stories/</code> and add it to <code>index.json</code>.</p>
          ) : (
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          {uploaded && (
            <p className="muted">
              Remember to copy your uploaded model file into the story's <code>assets/</code>
              folder — the export references it by path, not contents.
            </p>
          )}
          <p className="muted">Suggested folder: <code>stories/{slugify(story.frontmatter.title)}/</code></p>
        </div>
      )}
    </div>
  )
}
