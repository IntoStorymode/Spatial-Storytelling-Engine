// Minimal ambient types for @mkkellogg/gaussian-splats-3d (ships no .d.ts).
// Two surfaces are declared: the DropInViewer drop-in path used by the main
// viewer, and the self-driven Viewer used by the VR entry (the library's only
// *supported* WebXR path — it owns its renderer and animation loop, which is
// exactly what an XR session requires).
declare module '@mkkellogg/gaussian-splats-3d' {
  import type { Box3, Camera, Group, Scene, WebGLRenderer } from 'three'

  /** The instanced splat mesh the DropInViewer adds to itself once a scene loads. */
  interface SplatMesh extends Group {
    /** Axis-aligned bounds over all splat centres (applySceneTransforms = honour per-scene offsets). */
    computeBoundingBox(applySceneTransforms?: boolean): Box3
    /** How many splats are in the loaded scene — the headline cost driver in VR. */
    getSplatCount(): number
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

  /** Which XR session the viewer should offer. Setting VR/AR forces gpuAcceleratedSort off. */
  export const WebXRMode: { None: 0; VR: 1; AR: 2 }

  export interface ViewerOptions extends DropInViewerOptions {
    /** Where the viewer appends its canvas AND its VR/AR button. Defaults to a div on <body>. */
    rootElement?: HTMLElement
    /** Supply our own scene so we can own the graph (e.g. a camera dolly for locomotion). */
    threeScene?: Scene
    /** Supply our own camera — required for a dolly rig, since XR poses it via camera.parent. */
    camera?: Camera
    renderer?: WebGLRenderer
    /** VR/AR. The viewer then drives frames with setAnimationLoop (XR requires it). */
    webXRMode?: number
    webXRSessionInit?: XRSessionInit
    /** The library's OrbitControls — off when we drive the camera ourselves. */
    useBuiltInControls?: boolean
    selfDrivenMode?: boolean
    /** Applied to `camera` on init when webXRMode is set — so keep the camera local to its dolly. */
    initialCameraPosition?: [number, number, number]
    initialCameraLookAt?: [number, number, number]
    cameraUp?: [number, number, number]
  }

  /** Self-driven viewer: owns its renderer + animation loop. The library's supported XR path. */
  export class Viewer {
    constructor(options?: ViewerOptions)
    /** Present once a scene has loaded — the splat mesh, rendered as its own pass. */
    splatMesh?: SplatMesh
    renderer: WebGLRenderer
    threeScene: Scene
    addSplatScene(path: string, options?: AddSplatSceneOptions): Promise<void>
    /** Begins the loop — setAnimationLoop when webXRMode is set, else requestAnimationFrame. */
    start(): void
    stop(): void
    dispose(): Promise<void>
    /**
     * One frame's draw. A writable property, not a prototype method — so a caller can wrap
     * it to add a pass of its own. We do: the splat material is depthTest/depthWrite false
     * and is drawn last, so a HUD has to be rendered AFTER this or it gets painted over.
     */
    render: () => void
  }

  export const SceneFormat: { Ply: number; Splat: number; KSplat: number; Spz: number }
}
