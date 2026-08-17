import { Link } from 'react-router-dom'
import type { Neighbour } from '../../lib/storyNeighbours'
import { useStoryStore } from '../../store/useStoryStore'

/**
 * Mode A navigation: Prev / Next plus the auto-tour on/off toggle. Manual
 * stepping turns the auto-tour off (one gesture = one section); the tour button
 * starts a self-running pass through every hotspot.
 *
 * The section Prev/Next buttons are disabled exactly at the first/last section —
 * precisely where travelling to another story makes sense — so those slots are
 * reused: at the first section the Prev slot becomes "Previous story", at the
 * last section the Next slot becomes "Next story" (when a neighbour exists). With
 * no neighbour (e.g. a single-story kiosk export) the disabled section button
 * stays, so there's never a dead link.
 */
export function NavControls({ prev, next }: { prev: Neighbour | null; next: Neighbour | null }) {
  const activeIndex = useStoryStore((s) => s.activeIndex)
  const sectionCount = useStoryStore((s) => s.sectionCount)
  const step = useStoryStore((s) => s.step)
  const autoTour = useStoryStore((s) => s.autoTour)
  const setAutoTour = useStoryStore((s) => s.setAutoTour)
  const toggleAutoTour = useStoryStore((s) => s.toggleAutoTour)

  function manualStep(delta: number) {
    setAutoTour(false)
    step(delta)
  }

  const atFirst = activeIndex === 0
  const atLast = activeIndex >= sectionCount - 1

  return (
    <div className="nav-controls">
      {atFirst && prev ? (
        <Link
          to={`/story/${prev.id}`}
          className="btn nav-btn nav-btn-story"
          title={prev.title}
          aria-label={`Previous story: ${prev.title}`}
        >
          ‹ Prev story
        </Link>
      ) : (
        <button
          className="btn nav-btn"
          onClick={() => manualStep(-1)}
          disabled={atFirst}
          aria-label="Previous section"
        >
          ← Prev
        </button>
      )}

      <button
        className={autoTour ? 'btn btn-accent tour-btn' : 'btn tour-btn'}
        onClick={toggleAutoTour}
      >
        {autoTour ? '❚❚ Stop tour' : '▶ Auto-tour'}
      </button>

      {atLast && next ? (
        <Link
          to={`/story/${next.id}`}
          className="btn nav-btn nav-btn-story"
          title={next.title}
          aria-label={`Next story: ${next.title}`}
        >
          Next story ›
        </Link>
      ) : (
        <button
          className="btn nav-btn"
          onClick={() => manualStep(1)}
          disabled={atLast}
          aria-label="Next section"
        >
          Next →
        </button>
      )}
    </div>
  )
}
