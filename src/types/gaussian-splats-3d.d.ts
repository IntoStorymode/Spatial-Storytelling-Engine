// Minimal ambient types for @mkkellogg/gaussian-splats-3d (ships no .d.ts).
// Only the surface we use — the DropInViewer drop-in path — is declared.
declare module '@mkkellogg/gaussian-splats-3d' {
  import type { Box3, Group } from 'three'

  /** The instanced splat mesh the DropInViewer adds to itself once a scene loads. */
  interface SplatMesh extends Group {
    /** Axis-aligned bounds over all splat centres (applySceneTransforms = honour per-scene offsets). */
    computeBoundingBox(applySceneTransforms?: boolean): Box3
  }

  export interface DropInViewerOptions {
    /** GPU-accelerated splat sort (needs cross-origin isolation). */
    gpuAcceleratedSort?: boolean
    /** Use SharedArrayBuffer to share splat data with workers (needs COOP/COEP). */
    sharedMemoryForWorkers?: boolean
    dynamicScene?: boolean
    antialiased?: boolean
    progressiveLoad?: boolean
  }

  export interface AddSplatSceneOptions {
    showLoadingUI?: boolean
    progressiveLoad?: boolean
    splatAlphaRemovalThreshold?: number
    /** Explicit scene format; overrides path-extension inference (SceneFormat value). */
    format?: number
    position?: [number, number, number]
    rotation?: [number, number, number, number]
    scale?: [number, number, number]
  }

  /** A THREE.Group you add to your own scene; sorts itself via onBeforeRender. */
  export class DropInViewer extends Group {
    constructor(options?: DropInViewerOptions)
    /** Present after addSplatScene resolves; undefined before the first scene loads. */
    splatMesh?: SplatMesh
    addSplatScene(path: string, options?: AddSplatSceneOptions): Promise<void>
    addSplatScenes(scenes: Array<{ path: string } & AddSplatSceneOptions>): Promise<void>
    removeSplatScene(index: number): Promise<void>
    dispose(): Promise<void>
  }

  export class Viewer {
    constructor(options?: Record<string, unknown>)
  }

  export const SceneFormat: { Ply: number; Splat: number; KSplat: number; Spz: number }
}
