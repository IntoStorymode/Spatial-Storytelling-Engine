import { useEffect, useRef, useState } from 'react'
import type { Hotspot, Waypoint } from '../../parser/types'
import { resolveWaypoint } from '../../parser/waypoints'
import { ThreeCanvas } from '../ThreeCanvas'
import type { ThreeViewer } from '../../three/ThreeViewer'

interface Props {
  previewSrc: string
  previewFormat?: string
  /** Splat up-axis override (`flip`/`none`); mirrors the published site's orientation. */
  previewOrientation?: 'flip' | 'none'
  basePath: string
  /** The story's named waypoints (the library) — used to resolve the active one. */
  waypoints: Waypoint[]
  /** Name of the waypoint currently being edited (gizmo + fine-tune), or null. */
  activeWaypoint: string | null
  /** Walk-through vs orbit — owned by the editor so the rail's "go to" can sync it. */
  lookMode: 'orbit' | 'firstPerson'
  onLookMode: (mode: 'orbit' | 'firstPerson') => void
  /** Capture the current camera as a new waypoint. */
  onCapture: (camera: Hotspot) => void
  onRename: (oldName: string, newName: string) => void
  onDelete: (name: string) => void
  /** Set/move/aim the active waypoint's camera. */
  onEditActive: (camera: Hotspot) => void
  /** Expose the viewer so the rail can capture / fly the camera. */
  onViewerReady?: (viewer: ThreeViewer) => void
}

function fmt(t: [number, number, number]): string {
  return t.map((n) => (Math.round(n * 100) / 100).toFixed(2)).join(', ')
}

/**
 * The 3D scene, plus — under it — the editor for the **one selected waypoint**
 * (rename / set-to-view / move-camera / aim-look-point / go-to / delete). Adding
 * and browsing waypoints lives in the rail's Waypoints step; here the author only
 * frames the scene, hits **＋ Add a waypoint**, and fine-tunes the active one.
 */
export function HotspotPlacer({
  previewSrc,
  previewFormat,
  previewOrientation,
  basePath,
  waypoints,
  activeWaypoint,
  lookMode,
  onLookMode,
  onCapture,
  onRename,
  onDelete,
  onEditActive,
  onViewerReady,
}: Props) {
  const viewerRef = useRef<ThreeViewer | null>(null)
  const [ready, setReady] = useState(false)
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

  function goTo(w: Waypoint) {
    const v = viewerRef.current
    if (!v) return
    onLookMode('orbit')
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

  return (
    <div className="hp">
      <div className="hp-canvas">
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
          className="btn btn-accent hp-add"
          onClick={capture}
          title="Save the current view as a new named waypoint"
        >
          ＋ Add a waypoint
        </button>
        <button
          type="button"
          className="hp-lookmode"
          onClick={() => onLookMode(lookMode === 'firstPerson' ? 'orbit' : 'firstPerson')}
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
        {active && activeWaypoint ? (
          <div className="wp-editor">
            <label className="ed-field">
              <span>Waypoint name</span>
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            </label>
            <p className="hp-finetune-label">Adjust</p>
            <div className="ed-chips">
              <button className="btn ed-chip" onClick={setToView} title="Replace this waypoint with the current camera view">
                ◎ Update
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
        ) : (
          <p className="muted hp-empty">
            Select a waypoint in the <strong>Waypoints</strong> panel to edit it here, or frame the
            scene and use <strong>＋ Add a waypoint</strong>.
          </p>
        )}
      </div>
    </div>
  )
}
