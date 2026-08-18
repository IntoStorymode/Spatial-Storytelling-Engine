import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ThreeViewer } from '../../three/ThreeViewer'
import type { Story } from '../../parser/types'
import { resolveWaypoint } from '../../parser/waypoints'
import { extOf, isSplatExt } from '../../lib/modelFormats'
import { useStoryStore } from '../../store/useStoryStore'
import { StageContext } from './stageContext'
import { DebugHud } from './DebugHud'
import { debugTuning } from '../../three/debugTuning'

/** Dwell time at each hotspot during an auto-tour, before advancing. */
const AUTO_TOUR_DWELL_MS = 3800

/** Identity of a loaded model — reloads only when this changes. */
function modelKey(story: Story, modelFormat?: string): string {
  return `${story.frontmatter.model}|${story.basePath}|${story.frontmatter.orientation ?? ''}|${modelFormat ?? ''}`
}

/**
 * Owns the ONE persistent ThreeViewer for a story and wires it to the store:
 *  - loads the DISPLAYED story's model, and preloads the PENDING story's model
 *    in the background so switching stories never tears the scene down (no flash)
 *  - in Mode A, flies the camera to the active section's hotspot on every change
 *  - sets the per-mode control scheme (orbit vs first-person; wheel zoom/walk)
 *  - runs the auto-tour scheduler
 * Children (PageView / ImmersiveView) swap freely without tearing down the
 * viewer — they only host the canvas via <StageSlot>.
 *
 * Seamless travel: while the reader is on `story`, `pendingStory` (the next
 * story) is loaded off-screen; once its model is ready the viewer commits it in
 * place and calls `onCommit`, so the parent flips the displayed story in the
 * same batch — text, model and camera arrive together, with no black gap.
 */
export function ViewerStage({
  story,
  pendingStory,
  onCommit,
  modelFormat,
  pendingModelBytes,
  children,
}: {
  story: Story
  /** The next story to preload; defaults to `story` (no deferral, e.g. preview). */
  pendingStory?: Story
  /** Fired once the pending model is committed, so the parent can show it. */
  onCommit?: (committed: Story) => void
  /** Format hint for a blob: model URL (preview of an uploaded file). */
  modelFormat?: string
  /** The pending model's byte size — the download-% total when the host omits Content-Length. */
  pendingModelBytes?: number
  children: ReactNode
}) {
  const { sections, frontmatter } = story
  const pending = pendingStory ?? story
  // The opening view — resolve the named waypoint `start` references. Used by the
  // Mode A camera effect; the model's opening frame is set at commit (per story).
  const start = resolveWaypoint(frontmatter, frontmatter.start)
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
  const arrive = useStoryStore((s) => s.arrive)

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
  // True while preloading the NEXT story's model during travel — drives a subtle,
  // non-blocking hint while the current scene stays visible underneath.
  const [swapping, setSwapping] = useState(false)
  // Set once the first model has ever been committed — gates the full spinner
  // (shown only before the very first story appears).
  const [hasCommitted, setHasCommitted] = useState(false)
  // Download progress (0–99) of the loading model, or null when not computable.
  // Only surfaced once a load has run past ~1s (see `slowLoad`), so quick loads
  // don't flash a number. Reflects download bytes, not the decode that follows.
  const [progress, setProgress] = useState<number | null>(null)
  const [slowLoad, setSlowLoad] = useState(false)
  // Model key of the currently committed model, or null before the first commit.
  const committedKeyRef = useRef<string | null>(null)
  // Whether Mode A has shown its opening frame yet (resets when leaving immersive).
  const openedRef = useRef(false)

  // Preload the PENDING story's model while the current scene stays fully visible,
  // then commit it in place (add new → frame → dispose old — never an empty scene)
  // and hand off to `onCommit` so the parent flips the displayed story in the same
  // batch. `opening` here is the PENDING story's, not the displayed one's.
  useEffect(() => {
    if (!viewer) return
    const key = modelKey(pending, modelFormat)
    if (committedKeyRef.current === key) {
      // Same model already on screen (e.g. re-navigating to the current story) —
      // just make sure the parent shows it; no reload.
      onCommit?.(pending)
      return
    }
    let cancelled = false
    const isFirst = committedKeyRef.current === null
    setLoadError(null)
    setLoading(true)
    if (!isFirst) setSwapping(true) // first load uses the full spinner instead

    // Reveal a percentage only once a load is genuinely slow (~1s+), so fast
    // swaps don't flicker a number.
    setProgress(null)
    setSlowLoad(false)
    const slowTimer = window.setTimeout(() => !cancelled && setSlowLoad(true), 1000)

    // For a splat, Spark streams the fetch and the browser decompresses, so the
    // bytes read climb toward the model's UNCOMPRESSED size — which is what the
    // index stamped. Prefer that stamped total: it's correct even when the host
    // serves the model compressed and drops Content-Length (Vercel Brotli), and
    // when the server total IS the compressed size (which would overshoot). Only
    // splats get this — a mesh's XHR progress can't be trusted against it.
    const stampedTotal =
      isSplatExt(extOf(pending.frontmatter.model)) && pendingModelBytes ? pendingModelBytes : 0

    viewer
      .loadModelObject(
        pending.frontmatter.model,
        pending.basePath,
        modelFormat,
        pending.frontmatter.orientation,
        (loaded, serverTotal) => {
          if (cancelled) return
          const total = stampedTotal > 0 ? stampedTotal : serverTotal
          // Cap at 99: the 100% download still has a decode tail, so never show
          // a "done" number while the scene is still coming up.
          if (total > 0) setProgress(Math.min(99, Math.round((loaded / total) * 100)))
        },
      )
      .then((obj) => {
        if (cancelled || viewer.isDisposed) {
          viewer.discard(obj) // a newer target superseded this, or we were torn down
          return
        }
        viewer.commitModel(obj) // add new, frame, dispose old — one visible frame
        openedRef.current = false // the arriving story opens on its own start view
        arrive(!isFirst) // reset section/tour; keep the reader's mode on travel
        const pOpening =
          resolveWaypoint(pending.frontmatter, pending.sections[0]?.waypoint) ??
          resolveWaypoint(pending.frontmatter, pending.frontmatter.start)
        if (pOpening) viewer.flyTo(pOpening.position, pOpening.target, false)
        committedKeyRef.current = key
        setHasCommitted(true)
        onCommit?.(pending)
      })
      .catch((e) => {
        console.error('Model load failed:', e)
        setLoadError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        window.clearTimeout(slowTimer)
        if (cancelled) return
        setLoading(false)
        setSwapping(false)
        setSlowLoad(false)
        setProgress(null)
      })

    return () => {
      cancelled = true
      window.clearTimeout(slowTimer)
    }
  }, [viewer, pending, modelFormat, pendingModelBytes, arrive, onCommit])

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
    else viewer.frameObject(animate)
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

  // A percentage suffix, only once the load has run slow enough to warrant it.
  const pct = slowLoad && progress != null ? ` ${progress}%` : ''

  return (
    <StageContext.Provider value={{ hostEl: hostRef.current, viewer }}>
      {debugTuning().debug && <DebugHud viewer={viewer} />}
      {loadError && (
        <div className="model-error" role="alert">
          <strong>3D model failed to load.</strong>
          <span>{loadError}</span>
        </div>
      )}
      {loading && !loadError && !hasCommitted && (
        <div className="model-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          Loading model…{pct}
        </div>
      )}
      {children}
      {/* Travel hint: the current scene stays visible while the next story's model
          loads; this is a small, non-blocking status, not a cover. */}
      {swapping && (
        <div className="story-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          Loading story…{pct}
        </div>
      )}
    </StageContext.Provider>
  )
}
