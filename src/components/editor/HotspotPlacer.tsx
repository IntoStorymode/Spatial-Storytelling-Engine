import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { Hotspot, StoryItem } from '../../parser/types'
import { ThreeCanvas } from '../ThreeCanvas'
import type { ThreeViewer } from '../../three/ThreeViewer'

interface Props {
  previewSrc: string
  previewFormat?: string
  basePath: string
  selected: StoryItem | null
  onHotspotChange: (hotspot: Hotspot | undefined) => void
  /** The story's opening camera (Mode A initial view), and its setter. */
  start: Hotspot | null
  onStartChange: (start: Hotspot | undefined) => void
}

function fmt(t: [number, number, number]): string {
  return t.map((n) => (Math.round(n * 100) / 100).toFixed(2)).join(', ')
}

/**
 * Embeds the 3D scene for the editor and binds a hotspot to the selected item:
 *  - Use current view  → capture camera position + look target in one click
 *  - Capture position  → camera position only (keeps the target)
 *  - Place target      → next click in the scene raycasts a world point
 * A sprite marks the bound target.
 */
export function HotspotPlacer({
  previewSrc,
  previewFormat,
  basePath,
  selected,
  onHotspotChange,
  start,
  onStartChange,
}: Props) {
  const viewerRef = useRef<ThreeViewer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [lookMode, setLookMode] = useState<'orbit' | 'firstPerson'>('firstPerson')
  const [error, setError] = useState<string | null>(null)

  // Apply the chosen look mode (orbit vs first-person walk-through).
  useEffect(() => {
    const v = viewerRef.current
    if (v && ready) v.setLookMode(lookMode)
  }, [ready, lookMode])

  const hotspot = selected?.hotspot
  const hotspotKey = hotspot ? [...hotspot.position, ...hotspot.target].join(',') : null

  // Keep the in-scene gizmo (camera + look-point + view line) in sync with the
  // selected item's hotspot.
  useEffect(() => {
    const v = viewerRef.current
    if (!v || !ready) return
    v.setHotspotGizmo(hotspot ?? null)
  }, [ready, hotspotKey, selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // The story start gizmo (green) is shown persistently alongside the item one.
  const startKey = start ? [...start.position, ...start.target].join(',') : null
  useEffect(() => {
    const v = viewerRef.current
    if (!v || !ready) return
    v.setStartGizmo(start ?? null)
  }, [ready, startKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function setStartToView() {
    const v = viewerRef.current
    if (!v) return
    onStartChange(v.getView())
  }

  // Leaving placing mode (or unmount) must always re-enable orbit.
  useEffect(() => {
    const v = viewerRef.current
    if (v) v.setControlsEnabled(!placing)
  }, [placing])

  function useCurrentView() {
    const v = viewerRef.current
    if (!v || !selected) return
    const view = v.getView()
    onHotspotChange({ position: view.position, target: view.target })
  }

  function capturePosition() {
    const v = viewerRef.current
    if (!v || !selected) return
    const view = v.getView()
    onHotspotChange({ position: view.position, target: hotspot?.target ?? view.target })
  }

  function clearHotspot() {
    onHotspotChange(undefined)
    viewerRef.current?.setHotspotGizmo(null)
  }

  function onCanvasClick(e: MouseEvent<HTMLDivElement>) {
    if (!placing || !selected) return
    const v = viewerRef.current
    const el = containerRef.current
    if (!v || !el) return
    const rect = el.getBoundingClientRect()
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
    const target = v.raycastToWorld(ndcX, ndcY)
    const position = hotspot?.position ?? v.getView().position
    onHotspotChange({ position, target })
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
          basePath={basePath}
          onReady={(v) => {
            viewerRef.current = v
            v.setFlyEnabled(true) // WASD/QE fly-cam, editor only
            v.setLookMode(lookMode)
            setReady(true)
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
        <div className="hp-start">
          <p className="hp-scope">
            <span className="hp-key hp-key-start">●</span> Story start
            <span className="muted"> — where the reader begins</span>
          </p>
          <div className="ed-chips">
            <button className="btn ed-chip" onClick={setStartToView} title="Capture the current view as the story's opening camera">
              🚩 Set start to this view
            </button>
            <button className="btn ed-chip" onClick={() => onStartChange(undefined)} disabled={!start}>
              Clear
            </button>
          </div>
          <div className="hp-readout">
            {start ? (
              <div>
                <span className="hp-key hp-key-start">●</span> start [{fmt(start.position)}]
              </div>
            ) : (
              <span className="muted">No start set — Mode A opens on default framing.</span>
            )}
          </div>
        </div>

        {!selected ? (
          <p className="muted">Select an item on the left to give it a waypoint.</p>
        ) : (
          <>
            <p className="hp-scope">
              Waypoint for <strong>{selected.title || selected.id}</strong>
            </p>
            <p className="ed-hint">
              Fly/orbit until the scene looks the way a reader should see it here, then:
            </p>
            <button className="btn btn-accent hp-primary" onClick={useCurrentView}>
              ◎ Set waypoint to this view
            </button>
            <p className="hp-finetune-label">Fine-tune</p>
            <div className="ed-chips">
              <button className="btn ed-chip" onClick={capturePosition} title="Move only the camera; keep the look-point">
                🎥 Move camera here
              </button>
              <button
                className={placing ? 'btn btn-accent ed-chip' : 'btn ed-chip'}
                onClick={() => setPlacing((p) => !p)}
                title="Click a spot on the model to aim the camera at it"
              >
                {placing ? '… click a point' : '📍 Aim look-point'}
              </button>
              <button className="btn ed-chip" onClick={clearHotspot} disabled={!hotspot}>
                Clear
              </button>
            </div>
            <div className="hp-readout">
              {hotspot ? (
                <>
                  <div>
                    <span className="hp-key hp-key-cam">●</span> camera [{fmt(hotspot.position)}]
                  </div>
                  <div>
                    <span className="hp-key hp-key-look">●</span> look-point [{fmt(hotspot.target)}]
                  </div>
                </>
              ) : (
                <span className="muted">No waypoint yet — this item uses default framing.</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
