import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ThreeViewer, DebugStats } from '../../three/ThreeViewer'
import { debugTuning } from '../../three/debugTuning'

/**
 * TEMPORARY splat-performance diagnostic overlay (branch: diagnostic/splat-perf).
 * Mounted only when `?debug` is present. Shows FPS, frame time, the real GPU the
 * browser bound, pixel budget, splat count, cross-origin isolation, and which
 * experiment flags are active — so desktop-vs-iPad readings are directly
 * comparable. Remove this file (and its callers) once the cause is found.
 */
const panel: CSSProperties = {
  position: 'fixed',
  top: 8,
  left: 8,
  zIndex: 10000,
  padding: '8px 10px',
  background: 'rgba(0,0,0,0.78)',
  color: '#e8e6e2',
  font: '11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
  borderRadius: 6,
  maxWidth: 320,
  pointerEvents: 'none',
  whiteSpace: 'pre-wrap',
}

const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12 }
const dim: CSSProperties = { color: '#9a958c' }

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div style={row}>
      <span style={dim}>{k}</span>
      <span>{v}</span>
    </div>
  )
}

export function DebugHud({ viewer }: { viewer: ThreeViewer | null }) {
  const t = debugTuning()
  const [stats, setStats] = useState<DebugStats | null>(null)

  useEffect(() => {
    if (!viewer) return
    const id = window.setInterval(() => setStats(viewer.getStats()), 250)
    return () => window.clearInterval(id)
  }, [viewer])

  const isolated = typeof window !== 'undefined' && window.crossOriginIsolated === true
  const sab = typeof SharedArrayBuffer !== 'undefined'
  const flags = [
    t.spin && 'spin',
    t.dpr != null && `dpr=${t.dpr}`,
    t.alpha != null && `alpha=${t.alpha}`,
    `power=${t.highPower ? 'high' : 'default'}`,
    t.gpusort && (isolated ? 'gpusort✓' : 'gpusort✗(no-isolation)'),
  ].filter(Boolean)

  return (
    <div style={panel} role="status" aria-live="off">
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        splat-perf debug {stats ? `· ${stats.fps} fps` : ''}
      </div>
      {stats ? (
        <>
          <Line k="frame ms (avg / max)" v={`${stats.frameMsAvg} / ${stats.frameMsMax}`} />
          <Line k="splats" v={stats.splatCount.toLocaleString()} />
          <Line k="pixel ratio" v={String(stats.pixelRatio)} />
          <Line k="buffer" v={`${stats.bufferW}×${stats.bufferH}`} />
          <Line k="css size" v={`${stats.cssW}×${stats.cssH}`} />
          <Line k="devicePixelRatio" v={String(window.devicePixelRatio)} />
          <div style={{ ...dim, marginTop: 4 }}>GPU</div>
          <div>{stats.gpu}</div>
        </>
      ) : (
        <div style={dim}>waiting for viewer…</div>
      )}
      <div style={{ marginTop: 4 }}>
        <Line k="crossOriginIsolated" v={String(isolated)} />
        <Line k="SharedArrayBuffer" v={String(sab)} />
      </div>
      <div style={{ ...dim, marginTop: 4 }}>flags: {flags.length ? flags.join(' · ') : '(none — baseline)'}</div>
      {!t.spin && (
        <div style={{ color: '#d8b26a', marginTop: 4 }}>
          add &spin=1 for a comparable auto-orbit reading
        </div>
      )}
    </div>
  )
}
