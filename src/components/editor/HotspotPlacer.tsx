import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { Hotspot, Section, Waypoint } from '../../parser/types'
import { countUsage, resolveWaypoint } from '../../parser/waypoints'
import { ThreeCanvas } from '../ThreeCanvas'
import type { ThreeViewer } from '../../three/ThreeViewer'

interface Props {
  previewSrc: string
  previewFormat?: string
  /** Splat up-axis override (`flip`/`none`); mirrors the published site's orientation. */
  previewOrientation?: 'flip' | 'none'
  basePath: string
  /** The story's named waypoints (the library). */
  waypoints: Waypoint[]
  /** Sections, for per-waypoint usage counts. */
  sections: Section[]
  /** Name of the waypoint currently being edited (gizmo + fine-tune), or null. */
  activeWaypoint: string | null
  /** Capture the current camera as a new waypoint. */
  onCapture: (camera: Hotspot) => void
  onSelectWaypoint: (name: string | null) => void
  onRename: (oldName: string, newName: string) => void
  onDelete: (name: string) => void
  /** Set/move/aim the active waypoint's camera. */
  onEditActive: (camera: Hotspot) => void
  /** Expose the viewer so the section form can capture the current view. */
  onViewerReady?: (viewer: ThreeViewer) => void
}

function fmt(t: [number, number, number]): string {
  return t.map((n) => (Math.round(n * 100) / 100).toFixed(2)).join(', ')
}

/**
 * The 3D scene plus the story's **waypoint library**: capture named camera views,
 * select one to edit (rename / set-to-view / move-camera / aim-look-point /
 * go-to / delete), and see how many sections use each. Sections reference these
 * by name (assigned in the section form); several may share one.
 */
export function HotspotPlacer({
  previewSrc,
  previewFormat,
  previewOrientation,
  basePath,
  waypoints,
  sections,
  activeWaypoint,
  onCapture,
  onSelectWaypoint,
  onRename,
  onDelete,
  onEditActive,
  onViewerReady,
}: Props) {
  const viewerRef = useRef<ThreeViewer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [lookMode, setLookMode] = useState<'orbit' | 'firstPerson'>('firstPerson')
  const [error, setError] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')

  const active = resolveWaypoint({ waypoints }, activeWaypoint ?? undefined) ?? null

  // Apply the chosen look mode (orbit vs first-person walk-through).
  useEffect(() => {
    const v = viewerRef.current
    if (v && ready) v.setLookMode(lookMode)
  }, [ready, lookMode])

  // Keep the in-scene gizmo (camera + look-point + view line) in sync with the
  // active waypoint being edited.
  const activeKey = active ? [...active.position, ...active.target].join(',') : null
  useEffect(() => {
    const v = viewerRef.current
    if (!v || !ready) return
    v.setHotspotGizmo(active ?? null)
  }, [ready, activeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset the rename draft whenever the active waypoint changes.
  useEffect(() => {
    setNameDraft(activeWaypoint ?? '')
  }, [activeWaypoint])

  // Leaving placing mode (or unmount) must always re-enable orbit.
  useEffect(() => {
    const v = viewerRef.current
    if (v) v.setControlsEnabled(!placing)
  }, [placing])

  function capture() {
    const v = viewerRef.current
    if (!v) return
    onCapture(v.getView())
  }

  function setToView() {
    const v = viewerRef.current
    if (!v) return
    onEditActive(v.getView())
  }

  function moveCamera() {
    const v = viewerRef.current
    if (!v || !active) return
    onEditActive({ position: v.getView().position, target: active.target })
  }

  function goTo(w: Waypoint) {
    const v = viewerRef.current
    if (!v) return
    setLookMode('orbit')
    void v.flyToView(w.position, w.target, true)
  }

  function commitName() {
    const n = nameDraft.trim()
    if (!activeWaypoint) return
    // Revert on empty, unchanged, or a name already in use.
    if (!n || n === activeWaypoint || waypoints.some((w) => w.name === n)) {
      setNameDraft(activeWaypoint)
      return
    }
    onRename(activeWaypoint, n)
  }

  function onCanvasClick(e: MouseEvent<HTMLDivElement>) {
    if (!placing || !active) return
    const v = viewerRef.current
    const el = containerRef.current
    if (!v || !el) return
    const rect = el.getBoundingClientRect()
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
    const target = v.raycastToWorld(ndcX, ndcY)
    onEditActive({ position: active.position, target })
    setPlacing(false)
  }

  return (
    <div className="hp">
      <div
        ref={containerRef}
        className={placing ? 'hp-canvas hp-canvas-placing' : 'hp-canvas'}
        onClick={onCanvasClick}
      >
        <ThreeCanvas
          model={previewSrc}
          modelFormat={previewFormat}
          modelOrientation={previewOrientation}
          basePath={basePath}
          onReady={(v) => {
            viewerRef.current = v
            v.setFlyEnabled(true) // WASD/QE fly-cam, editor only
            v.setLookMode(lookMode)
            setReady(true)
            onViewerReady?.(v)
          }}
          onError={(err) => setError(String(err))}
        />
        {error && <div className="hp-error">{error}</div>}
        <button
          type="button"
          className="hp-lookmode"
          onClick={() => setLookMode((m) => (m === 'firstPerson' ? 'orbit' : 'firstPerson'))}
          title="Switch between walking through the scene and orbiting it"
        >
          {lookMode === 'firstPerson' ? '🚶 First-person' : '🛰 Orbit'}
        </button>
        <p className="hp-nav-hint">
          {lookMode === 'firstPerson' ? (
            <>
              Drag look · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk ·{' '}
              <kbd>Q</kbd><kbd>E</kbd> down/up · <kbd>Shift</kbd> faster
            </>
          ) : (
            <>
              Drag orbit · scroll zoom · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move ·{' '}
              <kbd>Q</kbd><kbd>E</kbd> down/up · <kbd>Shift</kbd> faster
            </>
          )}
        </p>
      </div>

      <div className="hp-tools">
        <div className="wp-head">
          <p className="hp-scope">
            Waypoints <span className="muted">— named camera views</span>
          </p>
          <button
            className="btn btn-accent ed-chip"
            onClick={capture}
            title="Save the current view as a new named waypoint"
          >
            ＋ Capture this view
          </button>
        </div>

        {waypoints.length === 0 ? (
          <p className="muted">
            No views yet. Frame the scene, then <strong>Capture this view</strong> to make your first
            waypoint.
          </p>
        ) : (
          <ul className="wp-list">
            {waypoints.map((w) => {
              const isActive = w.name === activeWaypoint
              const uses = countUsage(sections, w.name)
              return (
                <li
                  key={w.name}
                  className={isActive ? 'wp-row wp-row-active' : 'wp-row'}
                  onClick={() => onSelectWaypoint(isActive ? null : w.name)}
                >
                  <span className="hp-key hp-key-cam">●</span>
                  <span className="wp-name">{w.name}</span>
                  <span className="wp-usage" title={`${uses} section(s) use this view`}>
                    {uses || '—'}
                  </span>
                  <button
                    className="ed-icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      goTo(w)
                    }}
                    title="Fly the camera to this view"
                  >
                    ↩
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {active && activeWaypoint && (
          <div className="wp-editor">
            <label className="ed-field">
              <span>Name</span>
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            </label>
            <p className="hp-finetune-label">Adjust</p>
            <div className="ed-chips">
              <button className="btn ed-chip" onClick={setToView} title="Replace with the current camera view">
                ◎ Set to view
              </button>
              <button className="btn ed-chip" onClick={moveCamera} title="Move only the camera; keep the look-point">
                🎥 Move camera
              </button>
              <button
                className={placing ? 'btn btn-accent ed-chip' : 'btn ed-chip'}
                onClick={() => setPlacing((p) => !p)}
                title="Click a spot on the model to aim the camera at it"
              >
                {placing ? '… click a point' : '📍 Aim look-point'}
              </button>
              <button className="btn ed-chip" onClick={() => goTo(active)} title="Fly the camera here">
                ↩ Go to
              </button>
              <button className="btn ed-chip ed-chip-danger" onClick={() => onDelete(activeWaypoint)}>
                🗑 Delete
              </button>
            </div>
            <div className="hp-readout">
              <div>
                <span className="hp-key hp-key-cam">●</span> camera [{fmt(active.position)}]
              </div>
              <div>
                <span className="hp-key hp-key-look">●</span> look-point [{fmt(active.target)}]
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
