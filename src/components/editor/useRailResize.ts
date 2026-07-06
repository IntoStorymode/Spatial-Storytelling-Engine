import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_WIDTH = 420
const MIN_WIDTH = 320
const MAX_WIDTH = 720
// Matches the editor's stacking breakpoint in theme.css.
const STACK_QUERY = '(max-width: 820px)'

const clamp = (n: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n))

/**
 * Draggable + collapsible left-rail layout for the editor. Native pointer
 * events only (no deps): drag the divider to resize the forms rail, or collapse
 * it to hand the whole width to the 3D stage. Below the 820px breakpoint the
 * rail stacks on top of the stage, so we drop the inline width there and let the
 * stylesheet own the sizing. Not persisted — resets to 420px on reload.
 */
export function useRailResize() {
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [collapsed, setCollapsed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [stacked, setStacked] = useState(false)
  const drag = useRef<{ startX: number; startW: number } | null>(null)

  // Track the stacked (narrow) layout so we know when to yield width control.
  useEffect(() => {
    const mq = window.matchMedia(STACK_QUERY)
    const sync = () => setStacked(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { startX: e.clientX, startW: width }
      setDragging(true)
    },
    [width],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    setWidth(clamp(drag.current.startW + (e.clientX - drag.current.startX)))
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  return {
    collapsed,
    toggleCollapsed: () => setCollapsed((c) => !c),
    dragging,
    // Inline width applies only in the side-by-side layout; when stacked the
    // stylesheet owns the width (full-width rail on top), so pass no style.
    railStyle: stacked ? undefined : { width },
    resizerHandlers: { onPointerDown, onPointerMove, onPointerUp },
  }
}
