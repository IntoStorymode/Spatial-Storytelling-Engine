import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Story } from '../../parser/types'
import { useStoryStore } from '../../store/useStoryStore'
import { StageSlot } from './StageSlot'
import { OverlayPanel } from './OverlayPanel'
import { NavControls } from './NavControls'
import { ProgressIndicator } from './ProgressIndicator'
import { ModeToggle } from './ModeToggle'
import { NavModeToggle } from './NavModeToggle'
import { TouchWalkHint } from './TouchWalkHint'

const STEP_COOLDOWN_MS = 650 // lock so one keypress = one item

/**
 * Mode A — the immersive view. The persistent canvas fills the screen; the
 * active item shows as an overlay. Arrow keys and Prev/Next advance one item
 * (locked during the camera transition); the store's camera effect flies to that
 * item's hotspot. The wheel is left to the scene — zoom in orbit, walk in
 * first-person — and to the overlay panel (native scroll), matching Mode B.
 * Any manual nav cancels the auto-tour.
 */
export function ImmersiveView({ story }: { story: Story }) {
  const step = useStoryStore((s) => s.step)
  const setAutoTour = useStoryStore((s) => s.setAutoTour)
  const containerRef = useRef<HTMLDivElement>(null)
  const topbarRef = useRef<HTMLDivElement>(null)
  const lockRef = useRef(false)

  // Publish the topbar's real height so the (top-anchored, mobile) overlay panel
  // always starts just below it — even if a long label wraps the bar to two rows.
  useEffect(() => {
    const bar = topbarRef.current
    const host = containerRef.current
    if (!bar || !host) return
    const ro = new ResizeObserver(() => {
      host.style.setProperty('--immersive-topbar-h', `${bar.offsetHeight}px`)
    })
    ro.observe(bar)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    function lockedStep(delta: number) {
      if (lockRef.current) return
      lockRef.current = true
      setAutoTour(false) // manual nav cancels the tour
      step(delta)
      window.setTimeout(() => {
        lockRef.current = false
      }, STEP_COOLDOWN_MS)
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

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, setAutoTour])

  return (
    <div className="immersive" ref={containerRef}>
      <StageSlot className="immersive-canvas" />

      <div className="immersive-topbar" ref={topbarRef}>
        <Link to="/" className="back">
          ← All stories
        </Link>
        <div className="topbar-toggles">
          <NavModeToggle />
          <ModeToggle />
        </div>
      </div>

      <OverlayPanel story={story} />
      <TouchWalkHint />

      <div className="immersive-footer">
        <ProgressIndicator />
        <NavControls />
      </div>
    </div>
  )
}
