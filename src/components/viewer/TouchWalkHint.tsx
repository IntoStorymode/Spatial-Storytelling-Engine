import { useEffect, useMemo, useState } from 'react'
import { useStoryStore } from '../../store/useStoryStore'

// Show the gesture hint once per browser session, not on every first-person entry.
let shownThisSession = false

/**
 * A one-time coach hint for first-person on touch, where the movement gestures
 * aren't self-evident: one finger looks, two fingers move, pinch walks. Only
 * appears on coarse-pointer (touch) devices while first-person is active.
 */
export function TouchWalkHint() {
  const navMode = useStoryStore((s) => s.navMode)
  const coarse = useMemo(() => window.matchMedia?.('(pointer: coarse)').matches ?? false, [])
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (navMode !== 'firstPerson' || !coarse || shownThisSession) return
    shownThisSession = true
    setShow(true)
    const t = window.setTimeout(() => setShow(false), 6000)
    return () => window.clearTimeout(t)
  }, [navMode, coarse])

  // Leaving first-person dismisses it immediately.
  useEffect(() => {
    if (navMode !== 'firstPerson') setShow(false)
  }, [navMode])

  if (!show) return null
  return (
    <div className="touch-walk-hint" role="status">
      <span>
        <strong>First-person</strong> · one finger looks · two fingers move · pinch to walk
      </span>
      <button
        type="button"
        className="touch-walk-hint-close"
        onClick={() => setShow(false)}
        aria-label="Dismiss hint"
      >
        ✕
      </button>
    </div>
  )
}
