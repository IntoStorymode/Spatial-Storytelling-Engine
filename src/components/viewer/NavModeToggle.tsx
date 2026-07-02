import { useStoryStore } from '../../store/useStoryStore'

/**
 * Mode A reader control: switch camera navigation between orbit (circle the
 * model) and first-person (look around in place + WASD walk on desktop). Seeded
 * from the story's `navigation` default; this lets the reader try the other.
 */
export function NavModeToggle() {
  const navMode = useStoryStore((s) => s.navMode)
  const toggleNavMode = useStoryStore((s) => s.toggleNavMode)
  return (
    <button
      className="btn mode-toggle"
      onClick={toggleNavMode}
      title="Switch how you move the camera in this scene"
    >
      {navMode === 'orbit' ? '🛰 Orbit' : '🚶 First-person'}
    </button>
  )
}
