import { useEffect, useRef, useState } from 'react'
import {
  bundleFromDrop,
  bundleFromZip,
  bundleFromDirectory,
  canPickDirectory,
} from '../publish/importBundle'
import type { Bundle } from '../publish/importSite'

interface Props {
  busy: boolean
  onBundle: (bundle: Bundle) => void
  onCancel: () => void
}

/**
 * Pick an exported story to import — as the .zip, or as the folder you unzipped it
 * into. A native file picker can only be one or the other (`webkitdirectory` switches
 * the OS dialog into folder mode), so the drop zone is what unifies them: both shapes
 * can be dropped on it. The two "choose" links are the click-only fallback.
 */
export function ImportDialog({ busy, onBundle, onCancel }: Props) {
  const zipRef = useRef<HTMLInputElement>(null)
  const dirRef = useRef<HTMLInputElement | null>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  async function take(build: () => Promise<Bundle>) {
    setError(null)
    try {
      onBundle(await build())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import a story"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">Import a story</h2>

        <div
          className={over ? 'import-drop is-over' : 'import-drop'}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            void take(() => bundleFromDrop(e.dataTransfer.items))
          }}
        >
          {busy ? (
            <p>… reading the story</p>
          ) : (
            <>
              <p className="import-drop-lead">Drop the exported story here</p>
              <p className="muted">
                the <code>.zip</code>, or the folder you unzipped it into
              </p>
            </>
          )}
        </div>

        {error && <p className="import-error">{error}</p>}

        <p className="modal-message">
          Or choose{' '}
          <button className="linkish" onClick={() => zipRef.current?.click()} disabled={busy}>
            a .zip
          </button>
          {canPickDirectory() && (
            <>
              {' '}
              /{' '}
              <button className="linkish" onClick={() => dirRef.current?.click()} disabled={busy}>
                a folder
              </button>
            </>
          )}
          . A large scan imports faster from a folder — nothing has to be decompressed.
        </p>

        <input
          ref={zipRef}
          type="file"
          accept=".zip"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = '' // allow re-picking the same file
            if (f) void take(() => bundleFromZip(f))
          }}
        />
        <input
          ref={(el) => {
            dirRef.current = el
            if (el) el.webkitdirectory = true // the DOM prop exists; React's types omit it
          }}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const files = e.target.files
            const picked = files?.length ? Array.from(files) : null
            e.target.value = ''
            if (picked) void take(async () => bundleFromDirectory(picked))
          }}
        />

        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
