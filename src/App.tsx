import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { parseStory } from './parser/parseStory'
import type { Story } from './parser/types'
import { ThreeCanvas } from './components/ThreeCanvas'
import type { ThreeViewer } from './three/ThreeViewer'

const BASE = '/stories/demo/'

/**
 * M2 harness: proves the ThreeViewer engine — model loading (builtin room +
 * generated GLB cube) and the `flyTo` / setLookAt camera tween between the demo
 * story's hotspots. The real Home / Mode A / Mode B UI arrives in M3–M4.
 */
export default function App() {
  const [story, setStory] = useState<Story | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState('builtin:room')
  const [active, setActive] = useState<number | null>(null)
  const viewerRef = useRef<ThreeViewer | null>(null)

  useEffect(() => {
    fetch(`${BASE}story.md`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load story.md (HTTP ${r.status})`)
        return r.text()
      })
      .then((raw) => setStory(parseStory(raw, BASE)))
      .catch((e) => setError(String(e)))
  }, [])

  function flyTo(index: number) {
    const hotspot = story?.items[index]?.hotspot
    if (!hotspot || !viewerRef.current) return
    setActive(index)
    viewerRef.current.flyTo(hotspot.position, hotspot.target, true)
  }

  return (
    <div style={S.app}>
      <aside style={S.panel}>
        <p style={S.eyebrow}>M2 — ThreeViewer harness</p>
        <h1 style={S.h1}>{story?.frontmatter.title ?? 'Loading…'}</h1>
        {error && <pre style={S.error}>{error}</pre>}

        <div style={S.section}>
          <div style={S.label}>Model</div>
          <div style={S.row}>
            {['builtin:room', 'assets/cube.gltf'].map((m) => (
              <button
                key={m}
                onClick={() => setModel(m)}
                style={model === m ? S.btnActive : S.btn}
              >
                {m === 'builtin:room' ? 'Built-in room' : 'glTF cube'}
              </button>
            ))}
          </div>
        </div>

        <div style={S.section}>
          <div style={S.label}>Fly to hotspot (camera tween)</div>
          {story?.items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => flyTo(i)}
              disabled={!item.hotspot}
              style={active === i ? S.btnActive : S.btnWide}
            >
              {i + 1}. {item.title}
            </button>
          ))}
          <button onClick={() => viewerRef.current?.frameObject(viewerRef.current.scene, true)} style={S.btnWide}>
            ↺ Frame whole scene
          </button>
        </div>

        <p style={S.hint}>
          Drag to orbit · scroll to zoom · click a hotspot to watch the camera
          animate to its position &amp; target.
        </p>
      </aside>

      <main style={S.viewer}>
        <ThreeCanvas
          model={model}
          basePath={BASE}
          onReady={(v) => (viewerRef.current = v)}
          onError={(e) => setError(String(e))}
        />
      </main>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  app: { display: 'flex', height: '100vh', width: '100vw', background: '#171614', color: '#ede8df', fontFamily: 'Inter, system-ui, sans-serif' },
  panel: { width: 320, flexShrink: 0, padding: '24px 22px', borderRight: '1px solid #2e2b27', overflowY: 'auto' },
  viewer: { flex: 1, position: 'relative' },
  eyebrow: { fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#c17a3a', marginBottom: 8 },
  h1: { fontSize: 22, fontWeight: 600, marginBottom: 20, lineHeight: 1.2 },
  section: { marginBottom: 24 },
  label: { fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a9289', marginBottom: 10 },
  row: { display: 'flex', gap: 8 },
  btn: { flex: 1, padding: '8px 10px', background: '#1f1d1a', color: '#9a9289', border: '1px solid #2e2b27', borderRadius: 4, cursor: 'pointer', fontSize: 13 },
  btnActive: { flex: 1, padding: '8px 10px', background: '#7a4e22', color: '#ede8df', border: '1px solid #c17a3a', borderRadius: 4, cursor: 'pointer', fontSize: 13 },
  btnWide: { display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6, background: '#1f1d1a', color: '#ede8df', border: '1px solid #2e2b27', borderRadius: 4, cursor: 'pointer', fontSize: 13 },
  hint: { fontSize: 12, color: '#9a9289', lineHeight: 1.6, marginTop: 8 },
  error: { color: 'tomato', whiteSpace: 'pre-wrap', fontSize: 12 },
}
