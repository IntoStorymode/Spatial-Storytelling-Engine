interface Candidate {
  id: string
  title: string
  /** Where it came from, so the author can tell a draft from a bundled example. */
  source: 'gallery' | 'index'
}

interface Props {
  /** Story ids in the collection, in the author's order. */
  picked: string[]
  /** Everything that could be picked, gallery first. */
  candidates: Candidate[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onMove: (index: number, dir: -1 | 1) => void
}

/**
 * Pick and order the stories a collection introduces.
 *
 * The order is the artefact, not a display preference: it sets the landing page's
 * list and the order the export writes `stories/index.json`, which is what makes
 * previous/next inside a story follow the collection. So the picked list is an
 * explicit ordered list with ↑/↓, not a set of checkboxes.
 */
export function CollectionStoryPicker({ picked, candidates, onAdd, onRemove, onMove }: Props) {
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const unpicked = candidates.filter((c) => !picked.includes(c.id))

  return (
    <div className="coll-picker">
      <h3 className="ed-h3">
        Stories in this collection <span className="muted">· the order readers get</span>
      </h3>

      {picked.length === 0 ? (
        <p className="ed-hint">None yet — add one below.</p>
      ) : (
        <ol className="coll-picked">
          {picked.map((id, i) => {
            const found = byId.get(id)
            return (
              <li key={id} className={found ? 'coll-picked-row' : 'coll-picked-row is-missing'}>
                <span className="coll-picked-n" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="coll-picked-title">
                  {found ? found.title : id}
                  {!found && <span className="muted"> · not in your gallery</span>}
                </span>
                <span className="coll-picked-actions">
                  <button
                    type="button"
                    className="btn ed-chip"
                    onClick={() => onMove(i, -1)}
                    disabled={i === 0}
                    title="Move up"
                    aria-label={`Move ${found?.title ?? id} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn ed-chip"
                    onClick={() => onMove(i, 1)}
                    disabled={i === picked.length - 1}
                    title="Move down"
                    aria-label={`Move ${found?.title ?? id} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn ed-chip"
                    onClick={() => onRemove(id)}
                    title="Remove from this collection"
                    aria-label={`Remove ${found?.title ?? id}`}
                  >
                    ×
                  </button>
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {unpicked.length > 0 && (
        <div className="coll-add">
          <h3 className="ed-h3">Add a story</h3>
          <ul className="coll-add-list">
            {unpicked.map((c) => (
              <li key={c.id}>
                <button type="button" className="btn ed-chip" onClick={() => onAdd(c.id)}>
                  + {c.title}
                </button>
                {c.source === 'index' && <span className="muted"> · example</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="ed-hint">
        Removing a story here never touches the story itself — a collection only points at them, and
        a story can belong to several collections.
      </p>
    </div>
  )
}
