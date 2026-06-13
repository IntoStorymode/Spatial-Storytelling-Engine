import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { ThreeViewer } from '../three/ThreeViewer'

interface ThreeCanvasProps {
  /** Model source: a `.glb` path, story-relative asset, or `builtin:room`. */
  model: string
  /** Base path for resolving story-relative model URLs. */
  basePath?: string
  /** Called once with the live viewer instance after it mounts. */
  onReady?: (viewer: ThreeViewer) => void
  /** Called if a model fails to load. */
  onError?: (err: unknown) => void
  style?: CSSProperties
}

/**
 * React wrapper that owns a single persistent ThreeViewer. The viewer (and its
 * WebGL context + loaded model) survives Mode A / Mode B layout changes — only
 * the surrounding DOM re-lays-out, never this canvas.
 */
export function ThreeCanvas({ model, basePath = '', onReady, onError, style }: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<ThreeViewer | null>(null)
  // Keep latest callbacks without re-running the create-once effect.
  const cbRef = useRef({ onReady, onError })
  cbRef.current = { onReady, onError }

  useEffect(() => {
    if (!containerRef.current) return
    const viewer = new ThreeViewer(containerRef.current)
    viewerRef.current = viewer
    cbRef.current.onReady?.(viewer)
    return () => {
      viewer.dispose()
      viewerRef.current = null
    }
  }, [])

  useEffect(() => {
    viewerRef.current?.setModel(model, basePath).catch((e) => cbRef.current.onError?.(e))
  }, [model, basePath])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }} />
}
