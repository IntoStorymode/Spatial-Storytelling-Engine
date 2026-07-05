import { useState } from 'react'
import type { Story } from '../../parser/types'
import { serializeStory } from '../../parser/serializeStory'
import { triggerDownload } from '../../publish/download'

/** Soft validation — surfaced as hints, never blocks saving (prototype-friendly). */
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

interface Props {
  story: Story
  /** Uploaded files referenced by the draft (shown in the summary). */
  assets: { path: string; file: File }[]
  /** Finish → add this story to the session gallery (then export from there). */
  onSave: () => void
}

/** Editor actions: save the draft to the gallery, or grab the raw story.md. */
export function ExportBar({ story, assets, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const warnings = validate(story)

  function download() {
    triggerDownload(new Blob([serializeStory(story)], { type: 'text/markdown' }), 'story.md')
  }

  async function copy() {
    await navigator.clipboard.writeText(serializeStory(story))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="export">
      <button
        className="btn btn-accent"
        onClick={onSave}
        title="Add this story to your gallery — then choose it (and any others) to export as a website"
      >
        💾 Save to gallery
      </button>
      <button className="btn" onClick={download} title="Just the story.md text file">
        story.md
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
            <p>
              Looks good. <strong>Save to gallery</strong> adds this story to your gallery; from
              there you pick which stories to export as a deployable website.
            </p>
          ) : (
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <p className="muted">
            {assets.length} uploaded asset{assets.length === 1 ? '' : 's'} will be bundled on
            export. Media referenced by a typed path (not uploaded) isn't included — upload it in
            the editor so it ships with the site.
          </p>
        </div>
      )}
    </div>
  )
}
