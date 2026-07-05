import * as THREE from 'three'
import CameraControls from 'camera-controls'
import { loadModel } from './loadModel'

// camera-controls needs a (subset of) THREE injected once at module load.
CameraControls.install({ THREE })

export interface ThreeViewerOptions {
  /** Scene background color (defaults to the app's dark base). */
  background?: number
}

/** Fly-cam keys: WASD pan/forward, Q/E down/up, Shift to boost. */
const FLY_MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'])

/**
 * On-demand rendering: how many frames to keep drawing after the last change.
 * A short tail (rather than a single frame) matters for Gaussian splats — their
 * depth sort runs in a worker and only shows up on the *next* render, so we must
 * keep rendering briefly after motion stops or the settled view can show sort
 * artifacts. ~1s at 60fps is generous; a truly idle scene still stops after it.
 */
const RENDER_TAIL_FRAMES = 60

type GizmoSlot = 'item' | 'start'
type GizmoSpot = { position: [number, number, number]; target: [number, number, number] }
interface Gizmo {
  cam: THREE.Sprite
  look: THREE.Sprite
  line: THREE.Line
}

/** A camera-facing marker sprite at a world position. */
function makeMarker(map: THREE.Texture, pos: [number, number, number], scale: number): THREE.Sprite {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, depthWrite: false }))
  sprite.position.set(pos[0], pos[1], pos[2])
  sprite.scale.setScalar(scale)
  sprite.renderOrder = 999
  return sprite
}

/** Don't hijack WASD while the author is typing in a form field. */
function isTextEntry(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable === true
  )
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
  private renderTail = 0 // frames left to render; 0 = idle (on-demand rendering)
  private renderPaused = false // hold the idle render tail (e.g. while a video plays)
  private currentModel: THREE.Object3D | null = null
  private readonly gizmos: Record<GizmoSlot, Gizmo | null> = { item: null, start: null }
  private disposed = false

  // ── Fly-cam + look mode (editor) ──────────────────────────────────────────
  private flyEnabled = false
  private flyBoost = false
  private flySpeed = 2 // world units/sec; rescaled to the model in frameObject
  private readonly heldKeys = new Set<string>()
  private lookMode: 'orbit' | 'firstPerson' = 'orbit'
  private fpsPivot = 0.05 // tiny orbit radius that makes left-drag a look-in-place
  private captureDist = 2 // how far ahead a captured first-person look-point sits
  // Two-finger walk (touch, first-person): centroid + spread of the last frame,
  // plus pixel deltas accumulated between frames and applied in the RAF loop.
  private twoFingerPrev: { cx: number; cy: number; dist: number } | null = null
  private readonly moveAccum = { truck: 0, elevate: 0, forward: 0 }

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

    this.invalidate() // draw the first frame(s)
    this.animate()
  }

  /**
   * Mark the scene dirty so the RAF loop renders for the next tail of frames.
   * Called on every change the loop can't otherwise detect (input, scene edits,
   * resize, model load). On-demand rendering: between changes we stop rendering
   * entirely — which also stops the splat sort worker — so an idle scene costs
   * ~zero CPU/GPU instead of pinning a core at 60fps and cooking the fan.
   */
  private invalidate(): void {
    this.renderTail = RENDER_TAIL_FRAMES
  }

  private animate = (): void => {
    if (this.disposed) return
    this.rafId = requestAnimationFrame(this.animate)
    const delta = this.clock.getDelta()
    // These self-invalidate when they actually move the camera.
    this.applyFlyMovement(delta)
    this.applyMoveAccum()
    // Damping/inertia tail and any programmatic camera change land here.
    const cameraMoved = this.controls.update(delta)
    if (cameraMoved) this.invalidate()
    // While a video plays we hold the idle render tail (and its per-frame splat
    // sort) so the decoder/compositor aren't starved. Genuine interaction — held
    // fly keys or the camera actually moving this frame — still renders, so a
    // settled-but-paused scene never freezes under the reader's hands.
    const interacting = this.heldKeys.size > 0 || cameraMoved
    if (this.renderTail > 0 && (!this.renderPaused || interacting)) {
      this.renderTail--
      this.renderer.render(this.scene, this.camera)
    }
  }

  /**
   * Hold or release the idle render tail. Set true while an overlay video plays
   * so the settled scene stops re-rendering (and re-sorting splats); interaction
   * overrides it per-frame in `animate`, and releasing invalidates to catch up.
   */
  setRenderPaused(paused: boolean): void {
    this.renderPaused = paused
    if (!paused) this.invalidate()
  }

  /**
   * Apply held WASD/QE movement once per frame so flight is smooth and
   * frame-rate independent. forward/truck/elevate move the camera AND its look
   * target together, so it reads as a true fly-through (not an orbit pivot).
   */
  private applyFlyMovement(delta: number): void {
    if (!this.flyEnabled || this.heldKeys.size === 0) return
    const k = this.heldKeys
    const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0)
    const right = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0)
    const up = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0)
    if (!fwd && !right && !up) return
    this.invalidate()
    const step = this.flySpeed * delta * (this.flyBoost ? 3 : 1)
    if (fwd) this.controls.forward(fwd * step, false)
    if (right) this.controls.truck(right * step, 0, false)
    if (up) this.controls.elevate(up * step, false)
  }

  /** Replace the current model. Frames the camera to fit it. */
  async setModel(
    url: string,
    basePath = '',
    formatHint?: string,
    orientation?: 'flip' | 'none',
  ): Promise<THREE.Object3D> {
    if (this.currentModel) {
      this.scene.remove(this.currentModel)
      disposeObject(this.currentModel)
      this.currentModel = null
    }
    const obj = await loadModel(url, basePath, formatHint, orientation)
    if (this.disposed) {
      disposeObject(obj)
      return obj
    }
    this.scene.add(obj)
    this.currentModel = obj
    this.frameObject(obj, false)
    this.invalidate() // ensure the loaded model (and a splat's first sort) draws
    return obj
  }

  /**
   * Centre + diameter of a loaded model, used to frame the camera. A splat's
   * extent can't be read with Box3.setFromObject (its mesh is instanced quads,
   * not the splat centres). And a plain AABB over splat centres is wrecked by the
   * stray outlier splats real scans carry — the box balloons, the camera is
   * flung far outside, and the view goes black. So for splats we sample the
   * centres in world space and take a robust median/percentile. Returns null when
   * there's nothing measurable (camera keeps its current framing).
   */
  private modelFraming(obj: THREE.Object3D): { center: THREE.Vector3; diameter: number } | null {
    const splatMesh = obj.userData?.isSplat ? (obj as unknown as { splatMesh?: SplatMeshLike }).splatMesh : undefined
    if (splatMesh) {
      const robust = robustSplatFraming(splatMesh, obj)
      if (robust) return robust
    }
    const box = new THREE.Box3().setFromObject(obj)
    if (box.isEmpty()) return null
    const size = box.getSize(new THREE.Vector3())
    return { center: box.getCenter(new THREE.Vector3()), diameter: Math.max(size.x, size.y, size.z) || 1 }
  }

  /** Default framing from a model's bounds (fallback when an item has no hotspot). */
  frameObject(obj: THREE.Object3D, animate = true): void {
    const framing = this.modelFraming(obj)
    if (!framing) return
    this.invalidate()
    const { center, diameter } = framing
    this.flySpeed = diameter * 0.6 // a held key crosses the model in ~1.5s
    this.fpsPivot = Math.min(Math.max(diameter * 0.01, 0.02), 0.5)
    this.captureDist = Math.max(diameter * 0.5, 0.5)

    if (this.lookMode === 'firstPerson') {
      // Start as an eye near the edge of the scene, looking in toward the centre.
      const eye = new THREE.Vector3(center.x, center.y + diameter * 0.1, center.z + diameter * 0.6)
      this.placeFirstPerson(eye, center, animate)
      return
    }
    const dist = diameter * 1.4
    this.controls.minDistance = 0
    this.controls.maxDistance = Infinity
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
   * Switch the editor camera between orbit (circle a pivot — good for inspecting
   * an object) and first-person (look in place + WASD walk — good for moving
   * through a room-scale scan). First-person works by pinning the orbit pivot a
   * hair in front of the camera so a left-drag turns the head instead of circling
   * the model.
   */
  setLookMode(mode: 'orbit' | 'firstPerson'): void {
    if (this.lookMode === mode) return
    this.invalidate()
    this.lookMode = mode
    if (mode === 'firstPerson') {
      const p = this.camera.position.clone()
      const fwd = this.controls.getTarget(new THREE.Vector3()).sub(p)
      if (fwd.lengthSq() < 1e-8) this.camera.getWorldDirection(fwd)
      this.placeFirstPerson(p, p.clone().add(fwd), false)
    } else {
      // Switching to orbit: keep the current eye + view direction instead of
      // re-framing the whole model, which would discard the view the author just
      // composed. Put the orbit pivot a sensible distance ahead so a drag orbits
      // the scene rather than spinning around a point on the lens.
      this.controls.mouseButtons.wheel = CameraControls.ACTION.DOLLY
      this.controls.minDistance = 0
      this.controls.maxDistance = Infinity
      const p = this.camera.position.clone()
      const fwd = this.controls.getTarget(new THREE.Vector3()).sub(p)
      if (fwd.lengthSq() < 1e-8) this.camera.getWorldDirection(fwd)
      fwd.normalize()
      const pivot = p.clone().addScaledVector(fwd, this.captureDist)
      void this.controls.setLookAt(p.x, p.y, p.z, pivot.x, pivot.y, pivot.z, false)
    }
  }

  /** Position a first-person eye at `from` looking toward `lookAt`, pivot pinned. */
  private placeFirstPerson(from: THREE.Vector3, lookAt: THREE.Vector3, animate: boolean): void {
    this.invalidate()
    const fwd = lookAt.clone().sub(from)
    if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, -1)
    fwd.normalize()
    const d = this.fpsPivot
    this.controls.minDistance = d
    this.controls.maxDistance = d
    this.controls.mouseButtons.wheel = CameraControls.ACTION.NONE // WASD moves instead of wheel-dolly
    const t = from.clone().addScaledVector(fwd, d)
    void this.controls.setLookAt(from.x, from.y, from.z, t.x, t.y, t.z, animate)
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
    this.invalidate()
    return this.controls.setLookAt(
      position[0], position[1], position[2],
      target[0], target[1], target[2],
      animate,
    ) as unknown as Promise<void>
  }

  /**
   * Reader first-person waypoint: stand the eye AT `position` looking toward
   * `target`, keeping the first-person pivot clamp. `flyTo` alone can't do this —
   * with `minDistance == maxDistance == fpsPivot` set, its raw `setLookAt` would
   * be pulled back to the pivot. This is the counterpart to `flyTo` for Mode A
   * when the reader is navigating in first-person.
   */
  flyToFirstPerson(
    position: [number, number, number],
    target: [number, number, number],
    animate = true,
  ): void {
    this.placeFirstPerson(
      new THREE.Vector3(position[0], position[1], position[2]),
      new THREE.Vector3(target[0], target[1], target[2]),
      animate,
    )
  }

  /**
   * Editor "Go to": fly the camera to a previously saved view (start or a
   * waypoint). Drops into orbit and lifts the first-person distance clamp so the
   * eye actually lands on the saved position instead of being pulled to the pivot.
   */
  flyToView(
    position: [number, number, number],
    target: [number, number, number],
    animate = true,
  ): Promise<void> {
    this.lookMode = 'orbit'
    this.controls.minDistance = 0
    this.controls.maxDistance = Infinity
    this.controls.mouseButtons.wheel = CameraControls.ACTION.DOLLY
    return this.flyTo(position, target, animate)
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

  // ── Editor support (M6) ─────────────────────────────────────────────────

  /** Current camera position + look-at target — used to capture a hotspot. */
  getView(): { position: [number, number, number]; target: [number, number, number] } {
    const p = this.camera.position
    const t = this.controls.getTarget(new THREE.Vector3())
    // In first-person the orbit target sits a hair in front of the camera, which
    // is no use as a hotspot look-point. Project it out to a sensible distance so
    // Mode A reproduces the same eye + view direction.
    if (this.lookMode === 'firstPerson') {
      const fwd = t.clone().sub(p)
      if (fwd.lengthSq() < 1e-8) this.camera.getWorldDirection(fwd)
      fwd.normalize()
      const far = p.clone().addScaledVector(fwd, this.captureDist)
      return { position: [p.x, p.y, p.z], target: [far.x, far.y, far.z] }
    }
    return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] }
  }

  /**
   * Convert a normalized device coordinate (−1..1) into a world point for
   * click-to-place. Hits the loaded mesh first; for splats (or a miss) falls
   * back to a horizontal plane through the look target, then a fixed distance.
   */
  raycastToWorld(ndcX: number, ndcY: number): [number, number, number] {
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)

    if (this.currentModel && !this.currentModel.userData?.isSplat) {
      const hits = ray.intersectObject(this.currentModel, true)
      if (hits.length) {
        const p = hits[0].point
        return [p.x, p.y, p.z]
      }
    }

    const target = this.controls.getTarget(new THREE.Vector3())
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -target.y)
    const hit = new THREE.Vector3()
    if (ray.ray.intersectPlane(plane, hit)) return [hit.x, hit.y, hit.z]

    const fallback = ray.ray.at(5, new THREE.Vector3())
    return [fallback.x, fallback.y, fallback.z]
  }

  /** Enable/disable orbit controls (off while placing a hotspot by click). */
  setControlsEnabled(enabled: boolean): void {
    this.controls.enabled = enabled
  }

  /**
   * Turn movement on (first-person) or off. On desktop this arms the WASD/QE
   * fly-cam; on touch it arms two-finger walk (drag = strafe/rise, pinch =
   * forward/back) by taking over the two-finger gesture from camera-controls.
   * One-finger drag stays as look-around either way.
   */
  setFlyEnabled(enabled: boolean): void {
    if (this.flyEnabled === enabled) return
    this.flyEnabled = enabled
    const el = this.renderer.domElement
    if (enabled) {
      window.addEventListener('keydown', this.onKeyDown)
      window.addEventListener('keyup', this.onKeyUp)
      window.addEventListener('blur', this.onWindowBlur)
      el.addEventListener('touchstart', this.onTouchStart, { passive: false })
      el.addEventListener('touchmove', this.onTouchMove, { passive: false })
      el.addEventListener('touchend', this.onTouchEnd)
      el.addEventListener('touchcancel', this.onTouchEnd)
      el.addEventListener('wheel', this.onFlyWheel, { passive: false })
      // We drive two-finger movement ourselves; stop camera-controls dolly/truck.
      this.controls.touches.two = CameraControls.ACTION.NONE
    } else {
      window.removeEventListener('keydown', this.onKeyDown)
      window.removeEventListener('keyup', this.onKeyUp)
      window.removeEventListener('blur', this.onWindowBlur)
      el.removeEventListener('touchstart', this.onTouchStart)
      el.removeEventListener('touchmove', this.onTouchMove)
      el.removeEventListener('touchend', this.onTouchEnd)
      el.removeEventListener('touchcancel', this.onTouchEnd)
      el.removeEventListener('wheel', this.onFlyWheel)
      this.controls.touches.two = CameraControls.ACTION.TOUCH_DOLLY_TRUCK // restore pinch-zoom for orbit
      this.heldKeys.clear()
      this.flyBoost = false
      this.twoFingerPrev = null
      this.moveAccum.truck = this.moveAccum.elevate = this.moveAccum.forward = 0
    }
  }

  /** Centroid + finger spread of a two-touch gesture, in client pixels. */
  private static readTwoTouch(e: TouchEvent): { cx: number; cy: number; dist: number } {
    const a = e.touches[0]
    const b = e.touches[1]
    return {
      cx: (a.clientX + b.clientX) / 2,
      cy: (a.clientY + b.clientY) / 2,
      dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
    }
  }

  private readonly onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 2) this.twoFingerPrev = ThreeViewer.readTwoTouch(e)
  }

  // Two-finger walk: drag the centroid to strafe (X) / rise-fall (Y), change the
  // finger spread (pinch) to move forward/back. We only accumulate the pixel
  // deltas here (dominant gesture wins, so a pinch stays pure forward and a drag
  // stays pure strafe — no veer); the RAF loop applies them once per frame.
  private readonly onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length !== 2 || !this.twoFingerPrev) return
    e.preventDefault() // keep the page from scrolling/zooming under the gesture
    const now = ThreeViewer.readTwoTouch(e)
    const prev = this.twoFingerPrev
    const dx = now.cx - prev.cx
    const dy = now.cy - prev.cy
    const dSpread = now.dist - prev.dist
    // Dominant gesture: pinch (spread) vs drag (centroid) — never both at once.
    if (Math.abs(dSpread) > Math.hypot(dx, dy)) {
      this.moveAccum.forward += dSpread
    } else {
      this.moveAccum.truck += dx
      this.moveAccum.elevate += -dy
    }
    this.twoFingerPrev = now
    this.invalidate()
  }

  private readonly onTouchEnd = (e: TouchEvent): void => {
    this.twoFingerPrev = e.touches.length === 2 ? ThreeViewer.readTwoTouch(e) : null
  }

  // First-person wheel over the canvas = walk forward/back (like W/S). Dolly is
  // clamped out in first-person, so we translate wheel delta into forward motion
  // (scroll up = forward), accumulated and applied smoothly in the RAF loop.
  private readonly onFlyWheel = (e: WheelEvent): void => {
    e.preventDefault()
    this.moveAccum.forward += -e.deltaY * 0.3 // scaled to the model in applyMoveAccum
    this.invalidate()
  }

  /**
   * Apply accumulated two-finger movement once per frame. Batching in the RAF
   * loop (rather than per touch event) decouples motion from irregular touch
   * event timing, so slow drags/pinches stay smooth instead of stepping.
   * forward/truck/elevate move the camera AND its pinned target together, so the
   * first-person distance clamp is honored.
   */
  private applyMoveAccum(): void {
    const a = this.moveAccum
    if (!a.truck && !a.elevate && !a.forward) return
    this.invalidate()
    const k = this.captureDist / 200 // pixels → world units, scaled to the model
    if (a.truck) this.controls.truck(a.truck * k, 0, false) // drag right → strafe right
    if (a.elevate) this.controls.elevate(a.elevate * k, false) // drag up → move up
    if (a.forward) this.controls.forward(a.forward * k, false) // spread → forward
    a.truck = a.elevate = a.forward = 0
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isTextEntry(document.activeElement)) return
    this.flyBoost = e.shiftKey
    if (FLY_MOVE_KEYS.has(e.code)) {
      this.heldKeys.add(e.code)
      e.preventDefault()
      this.invalidate()
    }
  }

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.flyBoost = e.shiftKey
    this.heldKeys.delete(e.code)
  }

  // Losing window focus mid-press would otherwise strand a key as "held".
  private readonly onWindowBlur = (): void => {
    this.heldKeys.clear()
    this.flyBoost = false
  }

  /**
   * Draw the selected item's waypoint gizmo: a teal ring at the camera position,
   * a copper disc at the look target, and a faint line between them. Pass null to
   * clear.
   */
  setHotspotGizmo(hotspot: GizmoSpot | null): void {
    this.drawGizmo('item', hotspot, { cam: 0x5fb0a7, look: 0xc17a3a })
  }

  /**
   * Draw the story's start-camera gizmo, in green, so the author can always see
   * where the reader begins — shown alongside the selected item's waypoint.
   */
  setStartGizmo(hotspot: GizmoSpot | null): void {
    this.drawGizmo('start', hotspot, { cam: 0x6cc070, look: 0x6cc070 })
  }

  private drawGizmo(slot: GizmoSlot, hotspot: GizmoSpot | null, colors: { cam: number; look: number }): void {
    this.invalidate() // sprites added/removed → redraw
    const g = this.gizmos[slot]
    if (g) {
      this.scene.remove(g.cam, g.look, g.line)
      g.cam.material.map?.dispose()
      g.cam.material.dispose()
      g.look.material.map?.dispose()
      g.look.material.dispose()
      g.line.geometry.dispose()
      ;(g.line.material as THREE.Material).dispose()
      this.gizmos[slot] = null
    }
    if (!hotspot) return

    const cam = makeMarker(discTexture(colors.cam, true), hotspot.position, 0.22)
    const look = makeMarker(discTexture(colors.look, false), hotspot.target, 0.18)
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...hotspot.position),
        new THREE.Vector3(...hotspot.target),
      ]),
      new THREE.LineBasicMaterial({ color: colors.cam, transparent: true, opacity: 0.6, depthTest: false }),
    )
    line.renderOrder = 998
    this.scene.add(cam, look, line)
    this.gizmos[slot] = { cam, look, line }
  }

  resize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.invalidate()
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.setFlyEnabled(false)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.setHotspotGizmo(null)
    this.setStartGizmo(null)
    if (this.currentModel) disposeObject(this.currentModel)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

/** The slice of the splat mesh API we read for framing. */
interface SplatMeshLike {
  getSplatCount(): number
  getSplatCenter(globalIndex: number, out: THREE.Vector3, applySceneTransform?: boolean): void
}

/**
 * Robust centre + diameter for a splat scene. Samples up to ~30k splat centres,
 * transforms them into world space (so any model rotation/offset — e.g. the .ply
 * upright flip — is honoured), then uses the per-axis median for the centre and
 * the 90th-percentile distance for the radius. Median + percentile shrug off the
 * stray far-flung splats that would otherwise blow up an axis-aligned box.
 */
function robustSplatFraming(
  splatMesh: SplatMeshLike,
  obj: THREE.Object3D,
): { center: THREE.Vector3; diameter: number } | null {
  const total = splatMesh.getSplatCount()
  if (!total) return null
  obj.updateWorldMatrix(true, false)
  const toWorld = obj.matrixWorld
  const stride = Math.max(1, Math.floor(total / 30000))

  const xs: number[] = []
  const ys: number[] = []
  const zs: number[] = []
  const c = new THREE.Vector3()
  for (let i = 0; i < total; i += stride) {
    splatMesh.getSplatCenter(i, c, true)
    c.applyMatrix4(toWorld)
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.z)) continue
    xs.push(c.x)
    ys.push(c.y)
    zs.push(c.z)
  }
  if (!xs.length) return null

  const center = new THREE.Vector3(median(xs), median(ys), median(zs))
  const dists = xs.map((x, i) => Math.hypot(x - center.x, ys[i] - center.y, zs[i] - center.z))
  dists.sort((a, b) => a - b)
  const r90 = dists[Math.floor(dists.length * 0.9)] || dists[dists.length - 1] || 1
  return { center, diameter: Math.max(r90 * 2, 1e-3) }
}

function median(values: number[]): number {
  const a = values.slice().sort((x, y) => x - y)
  const m = a.length >> 1
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

/** A soft round marker texture: a filled disc, or a ring with a centre dot. */
function discTexture(hex: number, ring: boolean): THREE.Texture {
  const s = 64
  const cvs = document.createElement('canvas')
  cvs.width = cvs.height = s
  const ctx = cvs.getContext('2d')!
  const col = '#' + hex.toString(16).padStart(6, '0')
  const c = s / 2
  ctx.lineWidth = 7
  ctx.strokeStyle = 'rgba(0,0,0,0.55)' // dark halo for contrast on bright scenes
  ctx.fillStyle = col
  if (ring) {
    ctx.beginPath()
    ctx.arc(c, c, c - 9, 0, Math.PI * 2)
    ctx.strokeStyle = col
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(c, c, 7, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(c, c, c - 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(cvs)
  tex.needsUpdate = true
  return tex
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
