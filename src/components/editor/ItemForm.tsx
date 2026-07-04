import { useRef } from 'react'
import type { ItemType, StoryItem } from '../../parser/types'

interface Props {
  item: StoryItem
  onChange: (patch: Partial<StoryItem>) => void
  onChangeType: (type: ItemType) => void
  /** Register an uploaded media file for this item (blob preview + bundling). */
  onUpload: (file: File) => void
  /** True when this item's src came from an upload (shows a hint). */
  uploaded: boolean
}

const TYPES: ItemType[] = ['text', 'image', 'audio', 'video']
const ACCEPT: Record<Exclude<ItemType, 'text'>, string> = {
  image: 'image/*',
  audio: 'audio/*',
  video: 'video/*',
}

/** Edit the selected item — title, type, per-type src/caption, and body. */
export function ItemForm({ item, onChange, onChangeType, onUpload, uploaded }: Props) {
  const isMedia = item.type !== 'text'
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <section className="ed-section">
      <h2 className="ed-h2">
        Item <span className="muted">{item.id}</span>
      </h2>
      <p className="ed-hint">
        The content of this story section. Set its waypoint — the camera view Mode A flies
        to — in the 3D scene on the right.
      </p>

      <label className="ed-field">
        <span>Title</span>
        <input value={item.title} onChange={(e) => onChange({ title: e.target.value })} />
      </label>

      <div className="ed-field">
        <span>Type</span>
        <div className="ed-chips">
          {TYPES.map((t) => (
            <button
              key={t}
              className={t === item.type ? 'btn btn-accent ed-chip' : 'btn ed-chip'}
              onClick={() => onChangeType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isMedia && (
        <>
          <label className="ed-field">
            <span>Source path</span>
            <input
              value={item.src ?? ''}
              onChange={(e) => onChange({ src: e.target.value })}
              placeholder="assets/photo.jpg"
            />
          </label>
          <div className="ed-chips">
            <button className="btn ed-chip" onClick={() => fileRef.current?.click()}>
              Upload file…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT[item.type as Exclude<ItemType, 'text'>]}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onUpload(f)
                e.target.value = '' // allow re-upload of the same name
              }}
            />
          </div>
          {uploaded && (
            <p className="ed-hint">
              Previewing your uploaded file. Use <strong>Download website</strong> on export to
              get it packaged at <code>{item.src}</code> automatically.
            </p>
          )}
          <label className="ed-field">
            <span>Caption</span>
            <input
              value={item.caption ?? ''}
              onChange={(e) => onChange({ caption: e.target.value })}
            />
          </label>
        </>
      )}

      <label className="ed-field">
        <span>Body</span>
        <textarea
          rows={6}
          value={item.body}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder="Write the narrative for this item…"
        />
      </label>
    </section>
  )
}
