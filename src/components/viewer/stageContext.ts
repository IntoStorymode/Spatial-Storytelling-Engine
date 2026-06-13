import { createContext, useContext } from 'react'
import type { ThreeViewer } from '../../three/ThreeViewer'

export interface StageHandle {
  /** The single persistent host element holding the WebGL canvas. */
  hostEl: HTMLDivElement
  /** The live viewer (null until the engine has mounted). */
  viewer: ThreeViewer | null
}

export const StageContext = createContext<StageHandle | null>(null)

export function useStage(): StageHandle {
  const ctx = useContext(StageContext)
  if (!ctx) throw new Error('useStage must be used inside <ViewerStage>')
  return ctx
}
