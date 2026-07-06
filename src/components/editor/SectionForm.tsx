import { useRef } from 'react'
import type { SectionType, Section } from '../../parser/types'

interface Props {
  section: Section
  onChange: (patch: Partial<Section>) => void
  onChangeType: (type: SectionType) => void
  /** Register an uploaded media file for this section (blob preview + bundling). */
  onUpload: (file: File) => void
  /** True when this section's src came from an upload (shows a hint). */
  uploaded: boolean
}

const TYPES: SectionType[] = ['text', 'image', 'audio', 'video']
const ACCEPT: Record<Exclude<SectionType, 'text'>, string> = {
  image: 'image/*',
  audio: 'audio/*',
  video: 'video/*',
}

/** Edit the selected section — title, type, per-type src/caption, and body. */
export function SectionForm({ section, onChange, onChangeType, onUpload, uploaded }: Props) {
  const isMedia = section.type !== 'text'
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <section className="ed-section">
      <h2 className="ed-h2">
        Section <span className="muted">{section.id}</span>
      </h2>
      <p className="ed-hint">
        The content of this story section. Set its waypoint — the camera view Mode A flies
        to — in the 3D scene on the right.
      </p>

      <label className="ed-field">
        <span>Title</span>
        <input value={section.title} onChange={(e) => onChange({ title: e.target.value })} />
      </label>

      <div className="ed-field">
        <span>Type</span>
        <div className="ed-chips">
          {TYPES.map((t) => (
            <button
              key={t}
              className={t === section.type ? 'btn btn-accent ed-chip' : 'btn ed-chip'}
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
              value={section.src ?? ''}
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
              accept={ACCEPT[section.type as Exclude<SectionType, 'text'>]}
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
              get it packaged at <code>{section.src}</code> automatically.
            </p>
          )}
          <label className="ed-field">
            <span>Caption</span>
            <input
              value={section.caption ?? ''}
              onChange={(e) => onChange({ caption: e.target.value })}
            />
          </label>
        </>
      )}

      <label className="ed-field">
        <span>Body</span>
        <textarea
          rows={6}
          value={section.body}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder="Write the narrative for this section…"
        />
      </label>
    </section>
  )
}
