import { useRef } from 'react'
import type { SectionType, Section, Waypoint } from '../../parser/types'

interface Props {
  section: Section
  /** The story's named waypoints, for the assign-a-view picker. */
  waypoints: Waypoint[]
  onChange: (patch: Partial<Section>) => void
  onChangeType: (type: SectionType) => void
  /** Register an uploaded media file for this section (blob preview + bundling). */
  onUpload: (file: File) => void
  /** True when this section's src came from an upload (shows a hint). */
  uploaded: boolean
  /** Point this section at a named waypoint (or none). */
  onAssignWaypoint: (name: string | undefined) => void
}

const TYPES: SectionType[] = ['text', 'image', 'audio', 'video']
const ACCEPT: Record<Exclude<SectionType, 'text'>, string> = {
  image: 'image/*',
  audio: 'audio/*',
  video: 'video/*',
}

/** Edit the selected section — title, type, per-type src/caption, body, and its waypoint. */
export function SectionForm({
  section,
  waypoints,
  onChange,
  onChangeType,
  onUpload,
  uploaded,
  onAssignWaypoint,
}: Props) {
  const isMedia = section.type !== 'text'
  const isPlayable = section.type === 'audio' || section.type === 'video'
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="ed-subsection">
      <h3 className="ed-h3">
        Selected section <span className="muted">{section.id}</span>
      </h3>

      <label className="ed-field">
        <span>Title</span>
        <input
          value={section.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="New section"
        />
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
              Previewing your uploaded file. It's bundled into the site automatically at{' '}
              <code>{section.src}</code> when you export — nothing to place by hand.
            </p>
          )}
          <label className="ed-field">
            <span>Caption</span>
            <input
              value={section.caption ?? ''}
              onChange={(e) => onChange({ caption: e.target.value })}
            />
          </label>
          {isPlayable && (
            <>
              <label className="ed-field ed-field-checkbox">
                <input
                  type="checkbox"
                  checked={section.autoplay ?? false}
                  onChange={(e) => onChange({ autoplay: e.target.checked || undefined })}
                />
                <span>Auto-play in immersive view</span>
              </label>
              <p className="ed-hint">
                Plays as the reader arrives at this section. Page view always waits for play.
              </p>
            </>
          )}
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

      <div className="ed-field">
        <span>Waypoint — the view the immersive mode flies to</span>
        <select
          value={section.waypoint ?? ''}
          onChange={(e) => onAssignWaypoint(e.target.value || undefined)}
        >
          <option value="">None — default framing</option>
          {waypoints.map((w) => (
            <option key={w.name} value={w.name}>
              {w.name}
            </option>
          ))}
        </select>
        <p className="ed-hint">
          Add and edit waypoints in the <strong>Waypoints</strong> step, using
          <strong> ＋ Add a waypoint</strong> on the 3D scene.
        </p>
      </div>
    </div>
  )
}
