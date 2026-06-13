import { useStoryStore } from '../../store/useStoryStore'

/** Switches between Mode B (page) and Mode A (immersive), preserving position. */
export function ModeToggle() {
  const mode = useStoryStore((s) => s.mode)
  const toggleMode = useStoryStore((s) => s.toggleMode)
  return (
    <button className="btn mode-toggle" onClick={toggleMode}>
      {mode === 'page' ? '◐ Immersive view' : '☰ Page view'}
    </button>
  )
}
