import type { StoryItem } from '../../parser/types'

interface Props {
  items: StoryItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
}

const TYPE_GLYPH: Record<StoryItem['type'], string> = {
  text: '¶',
  image: '▣',
  audio: '♪',
  video: '►',
}

/** Ordered list of story items: select, reorder, add, remove. */
export function ItemList({ items, selectedId, onSelect, onAdd, onRemove, onMove }: Props) {
  return (
    <section className="ed-section">
      <div className="ed-section-head">
        <h2 className="ed-h2">Items</h2>
        <button className="btn ed-chip" onClick={onAdd}>
          + Add
        </button>
      </div>

      <ul className="ed-items">
        {items.map((item, i) => (
          <li
            key={item.id}
            className={item.id === selectedId ? 'ed-item ed-item-sel' : 'ed-item'}
            onClick={() => onSelect(item.id)}
          >
            <span className="ed-item-glyph" title={item.type}>
              {TYPE_GLYPH[item.type]}
            </span>
            <span className="ed-item-title">
              {item.title || <em className="muted">Untitled</em>}
              {item.hotspot && <span className="ed-item-pin" title="Has hotspot">📍</span>}
            </span>
            <span className="ed-item-actions">
              <button
                className="ed-icon"
                disabled={i === 0}
                onClick={(e) => {
                  e.stopPropagation()
                  onMove(item.id, -1)
                }}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                className="ed-icon"
                disabled={i === items.length - 1}
                onClick={(e) => {
                  e.stopPropagation()
                  onMove(item.id, 1)
                }}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                className="ed-icon ed-icon-danger"
                disabled={items.length === 1}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(item.id)
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
