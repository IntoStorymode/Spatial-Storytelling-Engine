import * as THREE from 'three'
import CameraControls from 'camera-controls'
import { loadModel } from './loadModel'

// camera-controls needs a (subset of) THREE injected once at module load.
CameraControls.install({ THREE })

export interface ThreeViewerOptions {
  /** Scene background color (defaults to the app's dark base). */
  background?: number
}

/**
 * Framework-agnostic 3D engine: one scene, one perspective camera, one
 * camera-controls instance, one RAF loop. The same instance is reused across
 * Mode A / Mode B so the model is never reloaded on toggle.
 *
 * The Mode A camera-to-hotspot animation is `flyTo()` — a single
 * `controls.setLookAt(...)` that interpolates camera position AND look-at
 * target together with damped easing.
 */
export class ThreeViewer {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly controls: CameraControls

  private readonly container: HTMLElement
  private readonly clock = new THREE.Clock()
  private readonly resizeObserver: ResizeObserver
  private rafId = 0
  private currentModel: THREE.Object3D | null = null
  private disposed = false

  constructor(container: HTMLElement, opts: ThreeViewerOptions = {}) {
    this.container = container
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(opts.background ?? 0x171614)

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 1000)
    this.camera.position.set(4, 3, 6)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    container.appendChild(this.renderer.domElement)

    this.controls = new CameraControls(this.camera, this.renderer.domElement)
    this.controls.dampingFactor = 0.06
    this.controls.draggingDampingFactor = 0.12

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2620, 1.1))
    const key = new THREE.DirectionalLight(0xffffff, 1.3)
    key.position.set(5, 10, 7)
    this.scene.add(key)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)

    this.animate()
  }

  private animate = (): void => {
    if (this.disposed) return
    this.rafId = requestAnimationFrame(this.animate)
    const delta = this.clock.getDelta()
    this.controls.update(delta)
    this.renderer.render(this.scene, this.camera)
  }

  /** Replace the current model. Frames the camera to fit it. */
  async setModel(url: string, basePath = ''): Promise<THREE.Object3D> {
    if (this.currentModel) {
      this.scene.remove(this.currentModel)
      disposeObject(this.currentModel)
      this.currentModel = null
    }
    const obj = await loadModel(url, basePath)
    if (this.disposed) {
      disposeObject(obj)
      return obj
    }
    this.scene.add(obj)
    this.currentModel = obj
    this.frameObject(obj, false)
    return obj
  }

  /** Default framing from a model's bounding box (fallback when no hotspot). */
  frameObject(obj: THREE.Object3D, animate = true): void {
    const box = new THREE.Box3().setFromObject(obj)
    if (box.isEmpty()) return
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const dist = (Math.max(size.x, size.y, size.z) || 1) * 1.8
    this.controls.setLookAt(
      center.x + dist,
      center.y + dist * 0.5,
      center.z + dist,
      center.x,
      center.y,
      center.z,
      animate,
    )
  }

  /**
   * Animate the camera to a hotspot — position is where the camera goes,
   * target is what it looks at. This is the heart of Mode A.
   */
  flyTo(
    position: [number, number, number],
    target: [number, number, number],
    animate = true,
  ): Promise<void> {
    return this.controls.setLookAt(
      position[0], position[1], position[2],
      target[0], target[1], target[2],
      animate,
    ) as unknown as Promise<void>
  }

  /**
   * Enable/disable wheel-to-dolly. Mode A turns this OFF so the scroll wheel
   * can drive item navigation instead of zooming the camera.
   */
  setWheelDolly(enabled: boolean): void {
    this.controls.mouseButtons.wheel = enabled
      ? CameraControls.ACTION.DOLLY
      : CameraControls.ACTION.NONE
  }

  resize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    if (this.currentModel) disposeObject(this.currentModel)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

/** Recursively dispose geometries and materials to avoid GPU memory leaks. */
function disposeObject(obj: THREE.Object3D): void {
  // Splat viewers own web workers + GPU buffers — let them tear themselves down
  // via their own dispose() rather than walking geometries/materials.
  const disposable = obj as THREE.Object3D & { dispose?: () => unknown }
  if (obj.userData?.isSplat && typeof disposable.dispose === 'function') {
    try {
      void disposable.dispose()
    } catch (e) {
      console.error('splat dispose failed', e)
    }
    return
  }
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const material = mesh.material
    if (Array.isArray(material)) material.forEach((m) => m.dispose())
    else if (material) material.dispose()
  })
}
