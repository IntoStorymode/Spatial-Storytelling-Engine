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

/** The scan: 3D model source + reader/orientation options (tucked in a disclosure). */
export function SceneForm({ fm, uploadedModel, onChange, onModelPath, onUpload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="ed-fields">
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
            Previewing your uploaded file. On export, place it at <code>{uploadedModel}</code> in the
            story folder.
          </p>
        )}
      </div>

      <details className="ed-disclosure">
        <summary>Scene options</summary>
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

        <label className="ed-field">
          <span>Model orientation</span>
          <select
            value={fm.orientation ?? 'auto'}
            onChange={(e) => {
              const v = e.target.value
              onChange({ orientation: v === 'flip' || v === 'none' ? v : undefined })
            }}
          >
            <option value="auto">Auto — flip .ply splats, leave others as-is</option>
            <option value="flip">Flip upright (180°)</option>
            <option value="none">As-is — no correction</option>
          </select>
          <p className="ed-hint">Fix a splat that loads upside down (e.g. a SuperSplat .splat).</p>
        </label>
      </details>
    </div>
  )
}
