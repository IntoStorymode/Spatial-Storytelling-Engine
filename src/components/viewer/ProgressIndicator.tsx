import { useStoryStore } from '../../store/useStoryStore'

/** Mode A position read-out: `02 / 03` plus a dot per section. */
export function ProgressIndicator() {
  const activeIndex = useStoryStore((s) => s.activeIndex)
  const sectionCount = useStoryStore((s) => s.sectionCount)
  if (sectionCount === 0) return null
  return (
    <div className="progress">
      <span className="progress-count">
        {String(activeIndex + 1).padStart(2, '0')} / {String(sectionCount).padStart(2, '0')}
      </span>
      <span className="progress-dots">
        {Array.from({ length: sectionCount }, (_, i) => (
          <span key={i} className={i === activeIndex ? 'dot dot-on' : 'dot'} />
        ))}
      </span>
    </div>
  )
}
