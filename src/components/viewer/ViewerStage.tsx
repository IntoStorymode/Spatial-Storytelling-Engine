import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ThreeViewer } from '../../three/ThreeViewer'
import type { Story } from '../../parser/types'
import { useStoryStore } from '../../store/useStoryStore'
import { StageContext } from './stageContext'

/** Dwell time at each hotspot during an auto-tour, before advancing. */
const AUTO_TOUR_DWELL_MS = 3800

/**
 * Owns the ONE persistent ThreeViewer for a story and wires it to the store:
 *  - loads the model once (reloads only when the story's model changes)
 *  - in Mode A, flies the camera to the active item's hotspot on every change
 *  - frees the wheel for navigation in Mode A (re-enables dolly in Mode B)
 *  - runs the auto-tour scheduler
 * Children (PageView / ImmersiveView) swap freely without tearing down the
 * viewer — they only host the canvas via <StageSlot>.
 */
export function ViewerStage({ story, children }: { story: Story; children: ReactNode }) {
  const { items, basePath, frontmatter } = story
  const [viewer, setViewer] = useState<ThreeViewer | null>(null)

  // One stable host div; the viewer renders into it for the component's life.
  const hostRef = useRef<HTMLDivElement | null>(null)
  if (!hostRef.current) {
    const el = document.createElement('div')
    el.style.width = '100%'
    el.style.height = '100%'
    hostRef.current = el
  }

  const mode = useStoryStore((s) => s.mode)
  const activeIndex = useStoryStore((s) => s.activeIndex)
  const autoTour = useStoryStore((s) => s.autoTour)
  const setItemCount = useStoryStore((s) => s.setItemCount)
  const step = useStoryStore((s) => s.step)

  const reducedMotion = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    [],
  )

  // Create the engine once.
  useEffect(() => {
    const v = new ThreeViewer(hostRef.current!)
    setViewer(v)
    return () => v.dispose()
  }, [])

  const [loadError, setLoadError] = useState<string | null>(null)

  // Load (or swap) the model.
  useEffect(() => {
    if (!viewer) return
    setLoadError(null)
    viewer.setModel(frontmatter.model, basePath).catch((e) => {
      console.error('Model load failed:', e)
      setLoadError(e instanceof Error ? e.message : String(e))
    })
  }, [viewer, frontmatter.model, basePath])

  // Keep the store's item count in sync for navigation bounds.
  useEffect(() => setItemCount(items.length), [items.length, setItemCount])

  // Wheel drives navigation in Mode A, dolly in Mode B.
  useEffect(() => {
    viewer?.setWheelDolly(mode === 'page')
  }, [viewer, mode])

  // Camera ↔ active item. In Mode A, fly to the active hotspot on every change
  // (and when first entering immersive). Mode B leaves the camera to free orbit.
  useEffect(() => {
    if (!viewer || mode !== 'immersive') return
    const animate = !reducedMotion
    const hotspot = items[activeIndex]?.hotspot
    if (hotspot) viewer.flyTo(hotspot.position, hotspot.target, animate)
    else viewer.frameObject(viewer.scene, animate)
  }, [viewer, mode, activeIndex, items, reducedMotion])

  // Auto-tour: schedule the next advance after the dwell. Reschedules on each
  // activeIndex change; cleared when the tour is off or the mode leaves immersive.
  useEffect(() => {
    if (!autoTour || mode !== 'immersive') return
    const id = window.setTimeout(() => step(1, { wrap: true }), AUTO_TOUR_DWELL_MS)
    return () => window.clearTimeout(id)
  }, [autoTour, mode, activeIndex, step])

  return (
    <StageContext.Provider value={{ hostEl: hostRef.current, viewer }}>
      {loadError && (
        <div className="model-error" role="alert">
          <strong>3D model failed to load.</strong>
          <span>{loadError}</span>
        </div>
      )}
      {children}
    </StageContext.Provider>
  )
}
