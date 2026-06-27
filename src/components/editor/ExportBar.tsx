import { useState } from 'react'
import JSZip from 'jszip'
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

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

interface Props {
  story: Story
  /** Uploaded files to package into the bundle, at their export paths. */
  assets: { path: string; file: File }[]
}

/** Export the draft to story.md (download/copy) or a publish-ready bundle zip. */
export function ExportBar({ story, assets }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [building, setBuilding] = useState(false)
  const warnings = validate(story)
  const slug = slugify(story.frontmatter.title)

  function download() {
    triggerDownload(new Blob([serializeStory(story)], { type: 'text/markdown' }), 'story.md')
  }

  async function copy() {
    await navigator.clipboard.writeText(serializeStory(story))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  /** A publish-ready zip: <slug>/story.md + assets/, an index entry, and a how-to. */
  async function downloadBundle() {
    setBuilding(true)
    try {
      const zip = new JSZip()
      const folder = zip.folder(slug)!
      folder.file('story.md', serializeStory(story))
      const seen = new Set<string>()
      for (const { path, file } of assets) {
        if (seen.has(path)) continue
        seen.add(path)
        folder.file(path, file) // e.g. assets/scene.glb
      }
      const entry = {
        id: slug,
        title: story.frontmatter.title,
        author: story.frontmatter.author,
        location: story.frontmatter.location,
        date: story.frontmatter.date,
        path: `stories/${slug}/story.md`,
      }
      zip.file('index-entry.json', JSON.stringify(entry, null, 2))
      zip.file(
        'PUBLISH.txt',
        [
          'To publish this story so others can open it:',
          '',
          `1. Move the "${slug}" folder into public/stories/ in the project.`,
          '2. Open public/stories/index.json and add the object from',
          '   index-entry.json into the "stories" array.',
          `3. Refresh — the story appears on Home and at /story/${slug}.`,
          '',
          'Uploaded files are already included under the assets/ folder.',
          'Any media referenced by a typed path (not uploaded) must be copied',
          `into ${slug}/assets/ yourself.`,
        ].join('\n'),
      )
      const blob = await zip.generateAsync({ type: 'blob' })
      triggerDownload(blob, `${slug}.zip`)
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div className="export">
      <button className="btn btn-accent" onClick={downloadBundle} disabled={building} title="Zip of story.md + uploaded assets + an index entry, ready to drop into public/stories/">
        {building ? '… zipping' : '⭳ Download bundle'}
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
              Looks good. <strong>Download bundle</strong> gives a <code>{slug}.zip</code> —
              unzip the <code>{slug}/</code> folder into <code>public/stories/</code> and
              merge <code>index-entry.json</code> into <code>index.json</code>.
            </p>
          ) : (
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <p className="muted">
            Bundle includes {assets.length} uploaded asset{assets.length === 1 ? '' : 's'}.
            Media referenced by a typed path (not uploaded) isn't bundled — copy it into{' '}
            <code>{slug}/assets/</code> yourself.
          </p>
        </div>
      )}
    </div>
  )
}
