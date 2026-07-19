import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ThreeViewer } from '../../three/ThreeViewer'
import type { Story } from '../../parser/types'
import { resolveWaypoint } from '../../parser/waypoints'
import { useStoryStore } from '../../store/useStoryStore'
import { StageContext } from './stageContext'
import { DebugHud } from './DebugHud'
import { debugTuning } from '../../three/debugTuning'

/** Dwell time at each hotspot during an auto-tour, before advancing. */
const AUTO_TOUR_DWELL_MS = 3800

/**
 * Owns the ONE persistent ThreeViewer for a story and wires it to the store:
 *  - loads the model once (reloads only when the story's model changes)
 *  - in Mode A, flies the camera to the active section's hotspot on every change
 *  - sets the per-mode control scheme (orbit vs first-person; wheel zoom/walk)
 *  - runs the auto-tour scheduler
 * Children (PageView / ImmersiveView) swap freely without tearing down the
 * viewer — they only host the canvas via <StageSlot>.
 */
export function ViewerStage({
  story,
  modelFormat,
  children,
}: {
  story: Story
  /** Format hint for a blob: model URL (preview of an uploaded file). */
  modelFormat?: string
  children: ReactNode
}) {
  const { sections, basePath, frontmatter } = story
  // The opening view — resolve the named waypoint `start` references.
  const start = resolveWaypoint(frontmatter, frontmatter.start)
  // What the page view opens on: the FIRST SECTION's starting point (its
  // waypoint), so a story — especially a 3DGS scene, whose default bounding-box
  // framing is the whole point cloud from far off — lands exactly where the
  // story begins. Fall back to the story-level start, then to default framing.
  const opening = resolveWaypoint(frontmatter, sections[0]?.waypoint) ?? start
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
  const setSectionCount = useStoryStore((s) => s.setSectionCount)
  const step = useStoryStore((s) => s.step)
  const navMode = useStoryStore((s) => s.navMode)
  const setNavMode = useStoryStore((s) => s.setNavMode)
  const videoPlaying = useStoryStore((s) => s.videoPlaying)

  // Seed the reader's navigation from the story's default whenever a new story
  // (or preview draft) loads; the reader can then toggle it live without
  // re-seeding. Keyed on the frontmatter identity so each story/preview re-seeds
  // even if two stories share the same value.
  useEffect(() => {
    setNavMode(frontmatter.navigation ?? 'firstPerson')
  }, [frontmatter, setNavMode])

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
  const [loading, setLoading] = useState(false)
  // Whether Mode A has shown its opening frame yet (resets when leaving immersive).
  const openedRef = useRef(false)

  // Load (or swap) the model. After it frames, snap to the opening view (the
  // first section's starting point) over the default bounding-box framing.
  useEffect(() => {
    if (!viewer) return
    setLoadError(null)
    setLoading(true)
    viewer
      .setModel(frontmatter.model, basePath, modelFormat, frontmatter.orientation)
      .then(() => {
        if (opening) viewer.flyTo(opening.position, opening.target, false)
      })
      .catch((e) => {
        console.error('Model load failed:', e)
        setLoadError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }, [viewer, frontmatter.model, basePath, modelFormat, frontmatter.orientation, opening])

  // A fresh entry into Mode A should open on the story start view, not jump
  // straight to section 1's waypoint — so reset the "opened" latch in Mode B.
  useEffect(() => {
    if (mode !== 'immersive') openedRef.current = false
  }, [mode])

  // Keep the store's section count in sync for navigation bounds.
  useEffect(() => setSectionCount(sections.length), [sections.length, setSectionCount])

  // Apply the control scheme for the current mode + reader nav mode. The wheel,
  // over the canvas, behaves the same in both modes — zoom in orbit, walk
  // forward/back in first-person — while wheel over the overlay panel scrolls it:
  //  - Mode B (page): orbit, wheel dollies the inline model, no fly-cam.
  //  - Mode A (immersive): orbit → wheel dollies; first-person → fly-cam on
  //    (WASD/QE, two-finger touch, and wheel = forward/back).
  useEffect(() => {
    if (!viewer) return
    if (mode === 'page') {
      viewer.setFlyEnabled(false)
      viewer.setLookMode('orbit')
      viewer.setWheelDolly(true)
      return
    }
    if (navMode === 'firstPerson') {
      viewer.setLookMode('firstPerson')
      viewer.setFlyEnabled(true)
      viewer.setWheelDolly(false) // wheel drives walk via the fly wheel handler, not dolly
    } else {
      viewer.setFlyEnabled(false)
      viewer.setLookMode('orbit')
      viewer.setWheelDolly(true) // wheel zooms the model
    }
  }, [viewer, mode, navMode])

  // Camera ↔ active section. In Mode A, place the camera at the active hotspot on
  // every change (and when first entering immersive), honoring the reader's nav
  // mode: orbit frames the waypoint, first-person stands the eye at it. Mode B
  // leaves the camera to free orbit. Re-runs on navMode so toggling re-places.
  useEffect(() => {
    if (!viewer || mode !== 'immersive') return
    const animate = !reducedMotion
    const place = (position: [number, number, number], target: [number, number, number]) =>
      navMode === 'firstPerson'
        ? viewer.flyToFirstPerson(position, target, animate)
        : viewer.flyTo(position, target, animate)
    // First entry into Mode A honors the story start view as the opening frame;
    // an section's own waypoint takes over only once the reader navigates.
    if (!openedRef.current) {
      openedRef.current = true
      if (start) {
        place(start.position, start.target)
        return
      }
    }
    const hotspot = resolveWaypoint(frontmatter, sections[activeIndex]?.waypoint)
    if (hotspot) place(hotspot.position, hotspot.target)
    else if (start) place(start.position, start.target)
    else viewer.frameObject(viewer.scene, animate)
  }, [viewer, mode, activeIndex, sections, reducedMotion, start, navMode, frontmatter])

  // Auto-tour: schedule the next advance after the dwell. Reschedules on each
  // activeIndex change; cleared when the tour is off or the mode leaves immersive.
  // Held while a video plays so the reader isn't flown off mid-clip (it resumes
  // when the video pauses/ends — videoPlaying flips false).
  useEffect(() => {
    if (!autoTour || mode !== 'immersive' || videoPlaying) return
    const id = window.setTimeout(() => step(1, { wrap: true }), AUTO_TOUR_DWELL_MS)
    return () => window.clearTimeout(id)
  }, [autoTour, mode, activeIndex, step, videoPlaying])

  // Quiesce the render loop (and its per-frame splat sort) while a video plays so
  // the decoder/compositor get the main thread; interaction overrides it in the
  // viewer, and releasing catches the scene up.
  useEffect(() => {
    viewer?.setRenderPaused(videoPlaying)
  }, [viewer, videoPlaying])

  return (
    <StageContext.Provider value={{ hostEl: hostRef.current, viewer }}>
      {debugTuning().debug && <DebugHud viewer={viewer} />}
      {loadError && (
        <div className="model-error" role="alert">
          <strong>3D model failed to load.</strong>
          <span>{loadError}</span>
        </div>
      )}
      {loading && !loadError && (
        <div className="model-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          Loading model…
        </div>
      )}
      {children}
    </StageContext.Provider>
  )
}
