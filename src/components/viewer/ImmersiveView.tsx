import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Story } from '../../parser/types'
import { useStoryStore } from '../../store/useStoryStore'
import { StageSlot } from './StageSlot'
import { OverlayPanel } from './OverlayPanel'
import { NavControls } from './NavControls'
import { ProgressIndicator } from './ProgressIndicator'
import { ModeToggle } from './ModeToggle'

const WHEEL_THRESHOLD = 60 // accumulated |deltaY| for one step
const STEP_COOLDOWN_MS = 650 // lock so one gesture/keypress = one item

/**
 * Mode A — the immersive view. The persistent canvas fills the screen; the
 * active item shows as an overlay. Scroll wheel, arrow keys, and Prev/Next each
 * advance exactly one item (locked during the camera transition); the store's
 * camera effect flies to that item's hotspot. Any manual move cancels auto-tour.
 */
export function ImmersiveView({ story }: { story: Story }) {
  const step = useStoryStore((s) => s.step)
  const setAutoTour = useStoryStore((s) => s.setAutoTour)
  const containerRef = useRef<HTMLDivElement>(null)
  const lockRef = useRef(false)
  const accRef = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function lockedStep(delta: number) {
      if (lockRef.current) return
      lockRef.current = true
      setAutoTour(false) // manual nav cancels the tour
      step(delta)
      window.setTimeout(() => {
        lockRef.current = false
      }, STEP_COOLDOWN_MS)
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault() // keep the page from scrolling behind the scene
      if (lockRef.current) {
        accRef.current = 0
        return
      }
      accRef.current += e.deltaY
      if (Math.abs(accRef.current) >= WHEEL_THRESHOLD) {
        const dir = accRef.current > 0 ? 1 : -1
        accRef.current = 0
        lockedStep(dir)
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        lockedStep(1)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        lockedStep(-1)
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
  }, [step, setAutoTour])

  return (
    <div className="immersive" ref={containerRef}>
      <StageSlot className="immersive-canvas" />

      <div className="immersive-topbar">
        <Link to="/" className="back">
          ← All stories
        </Link>
        <ModeToggle />
      </div>

      <OverlayPanel story={story} />

      <div className="immersive-footer">
        <ProgressIndicator />
        <NavControls />
      </div>
    </div>
  )
}
