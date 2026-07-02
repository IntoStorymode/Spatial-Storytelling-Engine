import { useRef } from 'react'
import type { Frontmatter } from '../../parser/types'

interface Props {
  fm: Frontmatter
  /** Non-null when the model came from a file upload (shows the export path). */
  uploadedModel: string | null
  onChange: (patch: Partial<Frontmatter>) => void
  onModelPath: (value: string) => void
  onUpload: (file: File) => void
}

const MODEL_ACCEPT = '.glb,.gltf,.ply,.splat,.ksplat,.spz'

/** Story metadata + 3D model source (built-in, a path, or an uploaded file). */
export function StoryMetaForm({ fm, uploadedModel, onChange, onModelPath, onUpload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <section className="ed-section">
      <h2 className="ed-h2">Story details</h2>

      <label className="ed-field">
        <span>Title</span>
        <input value={fm.title} onChange={(e) => onChange({ title: e.target.value })} />
      </label>
      <label className="ed-field">
        <span>Author</span>
        <input value={fm.author} onChange={(e) => onChange({ author: e.target.value })} />
      </label>
      <div className="ed-row">
        <label className="ed-field">
          <span>Location</span>
          <input value={fm.location} onChange={(e) => onChange({ location: e.target.value })} />
        </label>
        <label className="ed-field">
          <span>Date</span>
          <input
            type="date"
            value={fm.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </label>
      </div>

      <div className="ed-field">
        <span>3D model</span>
        <input
          value={fm.model}
          onChange={(e) => onModelPath(e.target.value)}
          placeholder="builtin:room or assets/scene.glb"
        />
        <div className="ed-chips">
          <button className="btn ed-chip" onClick={() => onModelPath('builtin:room')}>
            Built-in room
          </button>
          <button className="btn ed-chip" onClick={() => onModelPath('builtin:cube')}>
            Built-in cube
          </button>
          <button className="btn ed-chip" onClick={() => fileRef.current?.click()}>
            Upload file…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={MODEL_ACCEPT}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = '' // allow re-upload of the same name
            }}
          />
        </div>
        {uploadedModel && (
          <p className="ed-hint">
            Previewing your uploaded file. On export, place it at{' '}
            <code>{uploadedModel}</code> in the story folder.
          </p>
        )}
      </div>

      <label className="ed-field">
        <span>Reader navigation (Mode A)</span>
        <select
          value={fm.navigation ?? 'orbit'}
          onChange={(e) =>
            onChange({ navigation: e.target.value === 'firstPerson' ? 'firstPerson' : undefined })
          }
        >
          <option value="orbit">Orbit — circle the model</option>
          <option value="firstPerson">First-person — look around &amp; walk</option>
        </select>
        <p className="ed-hint">The reader can still switch live in the viewer.</p>
      </label>
    </section>
  )
}
