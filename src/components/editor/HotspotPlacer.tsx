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
}: Props) {
  const viewerRef = useRef<ThreeViewer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hotspot = selected?.hotspot
  const targetKey = hotspot ? hotspot.target.join(',') : null

  // Keep the marker in sync with the selected item's hotspot target.
  useEffect(() => {
    const v = viewerRef.current
    if (!v || !ready) return
    v.setMarker(hotspot ? hotspot.target : null)
  }, [ready, targetKey, selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    viewerRef.current?.setMarker(null)
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
            setReady(true)
          }}
          onError={(err) => setError(String(err))}
        />
        {error && <div className="hp-error">{error}</div>}
      </div>

      <div className="hp-tools">
        {!selected ? (
          <p className="muted">Select an item to bind a hotspot.</p>
        ) : (
          <>
            <p className="ed-hint">
              Orbit to frame this item in the scene, then capture the view — or place a
              target by clicking a point on the model.
            </p>
            <div className="ed-chips">
              <button className="btn btn-accent ed-chip" onClick={useCurrentView}>
                ◎ Use current view
              </button>
              <button className="btn ed-chip" onClick={capturePosition}>
                🎥 Capture position
              </button>
              <button
                className={placing ? 'btn btn-accent ed-chip' : 'btn ed-chip'}
                onClick={() => setPlacing((p) => !p)}
              >
                {placing ? '… click the scene' : '📍 Place target'}
              </button>
              <button className="btn ed-chip" onClick={clearHotspot} disabled={!hotspot}>
                Clear
              </button>
            </div>
            <div className="hp-readout">
              {hotspot ? (
                <>
                  <div>
                    <span className="muted">position</span> [{fmt(hotspot.position)}]
                  </div>
                  <div>
                    <span className="muted">target</span> [{fmt(hotspot.target)}]
                  </div>
                </>
              ) : (
                <span className="muted">No hotspot bound — this item uses default framing.</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
