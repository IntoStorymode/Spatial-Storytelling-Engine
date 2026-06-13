import { useStoryStore } from '../../store/useStoryStore'

/**
 * Mode A navigation: Prev / Next plus the auto-tour on/off toggle. Manual
 * stepping turns the auto-tour off (one gesture = one item); the tour button
 * starts a self-running pass through every hotspot.
 */
export function NavControls() {
  const activeIndex = useStoryStore((s) => s.activeIndex)
  const itemCount = useStoryStore((s) => s.itemCount)
  const step = useStoryStore((s) => s.step)
  const autoTour = useStoryStore((s) => s.autoTour)
  const setAutoTour = useStoryStore((s) => s.setAutoTour)
  const toggleAutoTour = useStoryStore((s) => s.toggleAutoTour)

  function manualStep(delta: number) {
    setAutoTour(false)
    step(delta)
  }

  return (
    <div className="nav-controls">
      <button
        className="btn nav-btn"
        onClick={() => manualStep(-1)}
        disabled={activeIndex === 0}
        aria-label="Previous item"
      >
        ← Prev
      </button>

      <button
        className={autoTour ? 'btn btn-accent tour-btn' : 'btn tour-btn'}
        onClick={toggleAutoTour}
      >
        {autoTour ? '❚❚ Stop tour' : '▶ Auto-tour'}
      </button>

      <button
        className="btn nav-btn"
        onClick={() => manualStep(1)}
        disabled={activeIndex >= itemCount - 1}
        aria-label="Next item"
      >
        Next →
      </button>
    </div>
  )
}
