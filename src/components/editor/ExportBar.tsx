import { useState } from 'react'
import type { Story } from '../../parser/types'
import { serializeStory } from '../../parser/serializeStory'
import { triggerDownload } from '../../publish/download'

interface Props {
  story: Story
  /** Uploaded files referenced by the draft (shown in the bundling note). */
  assets: { path: string; file: File }[]
}

/** Raw-file export: grab the story.md text directly (Save-to-gallery lives in the header). */
export function ExportBar({ story, assets }: Props) {
  const [copied, setCopied] = useState(false)

  function download() {
    triggerDownload(new Blob([serializeStory(story)], { type: 'text/markdown' }), 'story.md')
  }

  async function copy() {
    await navigator.clipboard.writeText(serializeStory(story))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="ed-fields">
      <div className="export">
        <button className="btn" onClick={download} title="Just the story.md text file">
          ⬇ story.md
        </button>
        <button className="btn" onClick={copy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <p className="ed-hint">
        {assets.length} uploaded asset{assets.length === 1 ? '' : 's'} will be bundled when you
        export a website from the gallery. Media referenced by a typed path (not uploaded) isn't
        included — upload it in the editor so it ships with the site.
      </p>
    </div>
  )
}
