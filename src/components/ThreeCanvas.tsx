import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { ThreeViewer } from '../three/ThreeViewer'

interface ThreeCanvasProps {
  /** Model source: a `.glb` path, story-relative asset, `builtin:room`, or a blob: URL. */
  model: string
  /** Base path for resolving story-relative model URLs. */
  basePath?: string
  /** Format hint (extension) for blob:/data: model URLs that carry no extension. */
  modelFormat?: string
  /** Override the automatic splat up-axis correction (`flip`/`none`); absent = auto. */
  modelOrientation?: 'flip' | 'none'
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
export function ThreeCanvas({
  model,
  basePath = '',
  modelFormat,
  modelOrientation,
  onReady,
  onError,
  style,
}: ThreeCanvasProps) {
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
    viewerRef.current
      ?.setModel(model, basePath, modelFormat, modelOrientation)
      .catch((e) => cbRef.current.onError?.(e))
  }, [model, basePath, modelFormat, modelOrientation])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }} />
}
