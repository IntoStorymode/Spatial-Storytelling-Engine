import type { Section } from '../../parser/types'

interface Props {
  sections: Section[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
}

const TYPE_GLYPH: Record<Section['type'], string> = {
  text: '¶',
  image: '▣',
  audio: '♪',
  video: '►',
}

/** Ordered list of story sections: select, reorder, add, remove. */
export function SectionList({ sections, selectedId, onSelect, onAdd, onRemove, onMove }: Props) {
  return (
    <section className="ed-section">
      <div className="ed-section-head">
        <h2 className="ed-h2">Sections</h2>
        <button className="btn ed-chip" onClick={onAdd}>
          + Add
        </button>
      </div>
      <p className="ed-hint">
        Each section is a part of your story. Select one, then give it a waypoint in the 3D
        scene so the immersive view flies the camera there.
      </p>

      <ul className="ed-items">
        {sections.map((section, i) => (
          <li
            key={section.id}
            className={section.id === selectedId ? 'ed-item ed-item-sel' : 'ed-item'}
            onClick={() => onSelect(section.id)}
          >
            <span className="ed-item-glyph" title={section.type}>
              {TYPE_GLYPH[section.type]}
            </span>
            <span className="ed-item-title">
              {section.title || <em className="muted">Untitled</em>}
              {section.waypoint && <span className="ed-item-pin" title="Has a waypoint">📍</span>}
            </span>
            <span className="ed-item-actions">
              <button
                className="ed-icon"
                disabled={i === 0}
                onClick={(e) => {
                  e.stopPropagation()
                  onMove(section.id, -1)
                }}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                className="ed-icon"
                disabled={i === sections.length - 1}
                onClick={(e) => {
                  e.stopPropagation()
                  onMove(section.id, 1)
                }}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                className="ed-icon ed-icon-danger"
                disabled={sections.length === 1}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(section.id)
                }}
                aria-label="Remove"
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
