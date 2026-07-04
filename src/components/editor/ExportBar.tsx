import { useEffect, useState } from 'react'
import type { Story } from '../../parser/types'
import { serializeStory } from '../../parser/serializeStory'
import { buildSiteZip, fetchManifest, type Manifest } from '../../publish/buildSite'

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
  /** Uploaded files to package into the site, at their export paths. */
  assets: { path: string; file: File }[]
  /** Fired after a website zip is successfully downloaded (uploads now saved). */
  onBundleDownloaded?: () => void
}

/** Export the draft as story.md (download/copy) or a deploy-anywhere website zip. */
export function ExportBar({ story, assets, onBundleDownloaded }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [building, setBuilding] = useState(false)
  // undefined = still checking; null = unavailable (npm run dev, no build); else ready.
  const [manifest, setManifest] = useState<Manifest | null | undefined>(undefined)
  const warnings = validate(story)
  const slug = slugify(story.frontmatter.title)

  useEffect(() => {
    fetchManifest().then(setManifest)
  }, [])

  function download() {
    triggerDownload(new Blob([serializeStory(story)], { type: 'text/markdown' }), 'story.md')
  }

  async function copy() {
    await navigator.clipboard.writeText(serializeStory(story))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  /** One click → a complete, self-contained website for this story: <slug>-site.zip. */
  async function downloadWebsite() {
    if (!manifest) return
    setBuilding(true)
    try {
      const blob = await buildSiteZip({ story, assets, slug, manifest })
      triggerDownload(blob, `${slug}-site.zip`)
      onBundleDownloaded?.()
    } finally {
      setBuilding(false)
    }
  }

  const websiteReady = !!manifest
  const websiteTitle = websiteReady
    ? 'Complete, self-contained website for this story — unzip and drop the folder on any static host (Netlify, Vercel, S3, …)'
    : 'Available from the built or hosted editor. Under `npm run dev`, run `npm run preview`, or publish with `npm run publish:site -- <slug>`.'

  return (
    <div className="export">
      <button
        className="btn btn-accent"
        onClick={downloadWebsite}
        disabled={building || !websiteReady}
        title={websiteTitle}
      >
        {building ? '… building site' : '⛭ Download website'}
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
              Looks good. <strong>Download website</strong> gives a{' '}
              <code>{slug}-site.zip</code> — a complete, self-contained site. Unzip it and
              drop the <code>{slug}-site/</code> folder on any static host (it opens straight
              into the story).
            </p>
          ) : (
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <p className="muted">
            Site includes {assets.length} uploaded asset{assets.length === 1 ? '' : 's'}.
            Media referenced by a typed path (not uploaded) isn't included — upload it in the
            editor so it ships with the site.
          </p>
          {manifest === null && (
            <p className="muted">
              <strong>Download website</strong> needs the built app, so it's disabled under{' '}
              <code>npm run dev</code>. Use <code>npm run preview</code> (or the hosted editor),
              or publish from a terminal with <code>npm run publish:site -- {slug}</code>.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
