import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import type { Story, Waypoint } from '../parser/types'
import { resolveWaypoint } from '../parser/waypoints'
import { loadModel } from '../three/loadModel'
import { resolveUrl } from '../lib/resolveUrl'

const SPLAT_EXTS = new Set(['ply', 'splat', 'ksplat', 'spz'])
const SCENE_FORMAT_BY_EXT: Record<string, 'Ply' | 'Splat' | 'KSplat' | 'Spz'> = {
  ply: 'Ply',
  splat: 'Splat',
  ksplat: 'KSplat',
  spz: 'Spz',
}

/** Standard WebXR gamepad mapping (xr-standard): trigger, grip, then the face buttons. */
const BTN_TRIGGER = 0
const BTN_GRIP = 1
const BTN_A_X = 4
const BTN_B_Y = 5

/** Reported back to the landing page so the spike's questions get answered with numbers. */
export interface VRStats {
  fps: number
  /**
   * Rolling frame-time in ms (avg + worst over ~the last 90 frames). fps alone hides
   * stutter — an even 30fps reads smooth while a jittery 60 does not — so the max is the
   * honest jank signal. (Lesson from the desktop splat-choppiness fix.)
   */
  frameMsAvg: number
  frameMsMax: number
  /** Wall-clock ms from "start loading the model" to "first frame rendered". */
  loadMs: number
  backend: 'splat' | 'mesh'
  /** The headline cost driver for a splat scene. */
  splats: number
}

/**
 * The two levers that actually move framerate for splats in XR, exposed so they can be
 * A/B'd inside the headset instead of via a rebuild-and-redeploy cycle.
 *
 * Splats are fragment-bound: every splat is a blended, depth-test-free quad, so cost
 * scales with the pixels shaded, and a Quest renders two eyes at high resolution. Both
 * knobs attack pixels rather than splats.
 *
 * - `scale`  — XR framebuffer scale. 0.8 renders ~64% of the pixels. Must be set before
 *              the session starts.
 * - `fov`    — foveation (0..1). 1 shades the periphery at much lower resolution; the
 *              headset's lenses blur it anyway, so it's near-free quality-wise.
 *
 * Note `sphericalHarmonicsDegree` is NOT a lever: the library already defaults it to 0.
 */
export interface VRTuning {
  scale: number
  fov: number
  /**
   * `splatAlphaRemovalThreshold` — splats fainter than this are dropped AT LOAD (default 1).
   * The one knob that changes how many splats exist, and therefore how much the per-frame
   * CPU sort has to chew. Raise it to trade faint detail for framerate.
   */
  alpha: number
}

/**
 * A story in a WebXR session — the VR spike.
 *
 * Two backends, one scene graph. For a Gaussian splat we hand the work to the splat
 * library's SELF-DRIVEN `Viewer`, its only supported XR path: it owns the renderer and
 * drives frames with `setAnimationLoop` (WebXR will not run on requestAnimationFrame),
 * and it sorts once per frame against the head camera. For a mesh we drive a plain
 * renderer ourselves, as a control: if splats stutter we need to know whether XR itself
 * is fine.
 *
 * Locomotion is a dolly rig — in XR the runtime owns the camera every frame, so you
 * never move the camera, you move the group it sits in. We use a `local` reference space
 * (not `local-floor`) so the head starts at the rig's origin: a waypoint's eye position
 * then IS the dolly position, and the author's captured eye height carries over instead
 * of being stacked on top of the player's real standing height.
 *
 * The HUD gets its OWN render pass, after the splats. It has to: the splat material is
 * `depthTest: false, depthWrite: false` and the library draws it after our scene, so
 * anything we put in that scene is painted over unconditionally, however near the eye it
 * sits and whatever its renderOrder.
 */
export class VRStoryViewer {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.05, 500)
  /** The rig. Teleporting moves this; the headset poses the camera inside it. */
  private readonly dolly = new THREE.Group()

  /** Drawn in a separate pass so the splats can't cover it (see the class note). */
  private readonly hudScene = new THREE.Scene()
  private readonly hud: THREE.Mesh
  private readonly hudCanvas = document.createElement('canvas')
  private readonly hudOffset = new THREE.Matrix4().makeTranslation(0, -0.22, -1)

  /** The active section's image, floated above the caption. Hidden for text sections. */
  private readonly plate: THREE.Mesh
  private readonly plateOffset = new THREE.Matrix4().makeTranslation(0, 0.16, -1.1)
  private readonly textures = new Map<string, THREE.Texture>()

  private renderer!: THREE.WebGLRenderer
  private splatViewer?: import('@mkkellogg/gaussian-splats-3d').Viewer
  private running = false

  private index = 0
  private frames = 0
  private lastFpsAt = 0
  private lastFrameAt = 0
  /** Rolling per-frame ms window; avg/max are folded into stats on each 1s tick. */
  private readonly frameMsWindow: number[] = []
  private startedAt = 0
  /** The GPU the browser bound (WEBGL_debug_renderer_info), captured once after load. */
  private gpu = ''
  private readonly pressed = new Set<string>()
  private stats: VRStats = { fps: 0, frameMsAvg: 0, frameMsMax: 0, loadMs: 0, backend: 'mesh', splats: 0 }

  constructor(
    private readonly container: HTMLElement,
    private readonly story: Story,
    private readonly tuning: VRTuning,
    private readonly onStats: (s: VRStats) => void,
  ) {
    this.dolly.add(this.camera)
    this.scene.add(this.dolly)

    // The caption + FPS readout. This is the spike's instrument: framerate has to be
    // legible INSIDE the headset, because it's the one number nobody can read from a desk.
    this.hudCanvas.width = 1024
    this.hudCanvas.height = 384 // taller than the original 256 to fit the perf readout
    this.hud = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.195), // 0.52 × (384/1024) — keep the canvas aspect
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(this.hudCanvas),
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    )
    // We drive its world matrix from the head pose each frame, so keep three's
    // automatic updates out of the way entirely.
    this.hud.matrixAutoUpdate = false
    this.hud.matrixWorldAutoUpdate = false
    this.hudScene.add(this.hud)

    // The section's image, in the same overlay pass — a story is pictures as well as
    // prose, and in VR there's nowhere else to put them.
    this.plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.48),
      new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }),
    )
    this.plate.matrixAutoUpdate = false
    this.plate.matrixWorldAutoUpdate = false
    this.plate.visible = false
    this.hudScene.add(this.plate)
  }

  async load(): Promise<void> {
    this.startedAt = performance.now()
    const { model, orientation } = this.story.frontmatter
    const ext = model.split('.').pop()?.toLowerCase() ?? ''

    if (SPLAT_EXTS.has(ext)) await this.loadSplat(model, ext, orientation)
    else await this.loadMesh(model, orientation)

    // The splat library resizes its own renderer, but never touches the aspect of a
    // camera we supplied.
    this.onResize()
    this.captureGpuInfo() // renderer exists now (set by whichever backend loaded)
    window.addEventListener('resize', this.onResize)

    if (navigator.xr) {
      this.renderer.xr.enabled = true
      // 'local', not 'local-floor': the head starts at the rig origin, so a waypoint's
      // captured eye position lands the viewer exactly where the author stood — rather
      // than that height stacked on top of the player's real standing height.
      this.renderer.xr.setReferenceSpaceType('local')
      // Both must be set BEFORE a session begins. These are the framerate levers.
      this.renderer.xr.setFramebufferScaleFactor(this.tuning.scale)
      this.renderer.xr.setFoveation(this.tuning.fov)
    }

    this.goTo(0)
    this.stats.loadMs = Math.round(performance.now() - this.startedAt)
    this.onStats({ ...this.stats })
  }

  /** Splat path — the library's supported XR configuration. */
  private async loadSplat(model: string, ext: string, orientation?: 'flip' | 'none'): Promise<void> {
    const GaussianSplats3D = await import('@mkkellogg/gaussian-splats-3d')
    const formatKey = SCENE_FORMAT_BY_EXT[ext]

    const viewer = new GaussianSplats3D.Viewer({
      rootElement: this.container, // the library appends BOTH its canvas and its VR button here
      threeScene: this.scene, // our graph — so the dolly is ours to move
      camera: this.camera, // external camera: XR poses it through camera.parent (the dolly)
      webXRMode: GaussianSplats3D.WebXRMode.VR,
      useBuiltInControls: false, // we drive the rig; its OrbitControls would fight us
      sharedMemoryForWorkers: false, // no SharedArrayBuffer → no COOP/COEP → deploy-anywhere holds
      gpuAcceleratedSort: false, // the library forces this off in XR anyway; be explicit
      // setupWebXR() copies these onto the camera at init. Keep the camera at its dolly's
      // origin: the rig carries the world position, not the camera.
      initialCameraPosition: [0, 0, 0],
      initialCameraLookAt: [0, 0, -1],
    })

    await viewer.addSplatScene(resolveUrl(model, this.story.basePath), {
      showLoadingUI: true,
      progressiveLoad: false,
      splatAlphaRemovalThreshold: this.tuning.alpha,
      ...(formatKey ? { format: GaussianSplats3D.SceneFormat[formatKey] } : {}),
    })

    this.splatViewer = viewer
    this.renderer = viewer.renderer
    this.stats.backend = 'splat'
    this.stats.splats = viewer.splatMesh?.getSplatCount() ?? 0

    if (viewer.splatMesh && (orientation ?? (ext === 'ply' ? 'flip' : 'none')) === 'flip') {
      // Same up-axis correction as the main viewer (src/three/loadSplat.ts).
      const centre = viewer.splatMesh.computeBoundingBox(true).getCenter(new THREE.Vector3())
      viewer.splatMesh.rotation.x = Math.PI
      viewer.splatMesh.position.set(0, 2 * centre.y, 2 * centre.z)
    }

    // The library owns the loop, so we borrow its render step rather than replacing it:
    // draw exactly what it drew, then put the HUD on top and read the controllers.
    const libRender = viewer.render.bind(viewer)
    viewer.render = () => {
      libRender()
      this.afterFrame()
    }

    this.running = true
    viewer.start() // → setAnimationLoop, because webXRMode is set
  }

  /** Mesh path — the CONTROL. Plain three, our own loop, so we can isolate blame. */
  private async loadMesh(model: string, orientation?: 'flip' | 'none'): Promise<void> {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.container.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(0x171614)
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2))
    this.scene.add(await loadModel(model, this.story.basePath, undefined, orientation))
    this.stats.backend = 'mesh'

    if (navigator.xr) this.container.appendChild(VRButton.createButton(this.renderer))

    this.running = true
    // XR requires setAnimationLoop; it works fine outside a session too.
    this.renderer.setAnimationLoop(() => {
      if (!this.running) return
      this.renderer.render(this.scene, this.camera)
      this.afterFrame()
    })
  }

  /** Per-frame tail, shared by both backends: HUD pass, controller polling, FPS. */
  private afterFrame(): void {
    // The head pose lands in camera.matrixWorld during the render above (three writes it
    // back from the XR pose). Hang the HUD off it directly — it lives in its own scene,
    // so nothing else will recompute this matrix.
    this.hud.matrixWorld.multiplyMatrices(this.camera.matrixWorld, this.hudOffset)
    this.plate.matrixWorld.multiplyMatrices(this.camera.matrixWorld, this.plateOffset)

    const saved = this.renderer.autoClear
    this.renderer.autoClear = false // never wipe the frame we're drawing on top of
    this.renderer.render(this.hudScene, this.camera)
    this.renderer.autoClear = saved

    this.pollInput()
    this.countFrame()
  }

  /**
   * Controller input, polled rather than event-driven. Polling is what lets us bind an
   * EXIT — a `selectstart` listener can't see the face buttons, and without an in-headset
   * way out, leaving the session means taking the headset off.
   */
  private pollInput(): void {
    const session = this.renderer.xr.getSession()
    if (!session) return

    for (const source of session.inputSources) {
      const pad = source.gamepad
      if (!pad) continue
      const hand = source.handedness

      if (this.edge(pad, BTN_TRIGGER, `${hand}-trigger`)) this.step(1)
      if (this.edge(pad, BTN_GRIP, `${hand}-grip`)) this.step(-1)
      if (this.edge(pad, BTN_A_X, `${hand}-a`)) this.step(-1)
      if (this.edge(pad, BTN_B_Y, `${hand}-b`)) void session.end() // the way out
    }
  }

  /** True on the frame a button goes down — so one press is one step, not sixty. */
  private edge(pad: Gamepad, i: number, key: string): boolean {
    const down = pad.buttons[i]?.pressed ?? false
    const was = this.pressed.has(key)
    if (down) this.pressed.add(key)
    else this.pressed.delete(key)
    return down && !was
  }

  step(delta: number): void {
    const n = this.story.sections.length
    if (n) this.goTo((this.index + delta + n) % n)
  }

  /** Teleport the rig to a section's waypoint. Never touches the camera — XR owns that. */
  goTo(index: number): void {
    this.index = index
    const section = this.story.sections[index]
    this.showImage(section?.type === 'image' ? section.src : undefined)
    this.drawHud()

    const wp = this.waypointFor(section?.waypoint)
    if (!wp) return

    this.dolly.position.set(...wp.position)

    // Face the rig at the waypoint's look-point; the player's own head yaw adds on top.
    const dx = wp.target[0] - wp.position[0]
    const dz = wp.target[2] - wp.position[2]
    if (dx || dz) this.dolly.rotation.y = Math.atan2(-dx, -dz)
  }

  /** Put the section's photo on the floating plate, sized to its real aspect ratio. */
  private showImage(src: string | undefined): void {
    const mat = this.plate.material as THREE.MeshBasicMaterial
    if (!src) {
      this.plate.visible = false
      return
    }
    const cached = this.textures.get(src)
    if (cached) {
      mat.map = cached
      mat.needsUpdate = true
      this.plate.visible = true
      return
    }
    new THREE.TextureLoader().load(resolveUrl(src, this.story.basePath), (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      this.textures.set(src, tex)
      // Only apply if we're still on the section that asked for it.
      if (this.story.sections[this.index]?.src !== src) return
      const aspect = tex.image.width / tex.image.height || 1.5
      this.plate.geometry.dispose()
      this.plate.geometry = new THREE.PlaneGeometry(0.72, 0.72 / aspect)
      mat.map = tex
      mat.needsUpdate = true
      this.plate.visible = true
    })
  }

  private waypointFor(name: string | undefined): Waypoint | undefined {
    const fm = this.story.frontmatter
    return resolveWaypoint(fm, name) ?? resolveWaypoint(fm, fm.start)
  }

  private countFrame(): void {
    const now = performance.now()
    this.frames++
    // Per-frame delta → rolling window. The worst value in the window is the jank signal.
    if (this.lastFrameAt) {
      this.frameMsWindow.push(now - this.lastFrameAt)
      if (this.frameMsWindow.length > 90) this.frameMsWindow.shift()
    }
    this.lastFrameAt = now
    if (!this.lastFpsAt) this.lastFpsAt = now
    if (now - this.lastFpsAt >= 1000) {
      this.stats.fps = Math.round((this.frames * 1000) / (now - this.lastFpsAt))
      const win = this.frameMsWindow
      if (win.length) {
        this.stats.frameMsAvg = Math.round((win.reduce((a, b) => a + b, 0) / win.length) * 10) / 10
        this.stats.frameMsMax = Math.round(Math.max(...win) * 10) / 10
      }
      this.frames = 0
      this.lastFpsAt = now
      this.drawHud()
      this.onStats({ ...this.stats })
    }
  }

  private drawHud(): void {
    const ctx = this.hudCanvas.getContext('2d')
    if (!ctx) return
    const { width: w, height: h } = this.hudCanvas
    const section = this.story.sections[this.index]

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(10,10,10,0.85)'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#e8e4dc'
    // A CJK-capable stack — one of the real scans is titled in Traditional Chinese.
    ctx.font = '500 44px "Inter", "PingFang TC", "Noto Sans CJK TC", system-ui, sans-serif'
    ctx.fillText(this.fit(ctx, section?.title || 'Untitled', w - 64), 32, 84)

    ctx.fillStyle = '#c9a227'
    ctx.font = '400 34px "IBM Plex Mono", ui-monospace, monospace'
    const splats = this.stats.splats ? `${(this.stats.splats / 1e6).toFixed(2)}M splats` : 'mesh'
    // avg/max frame ms sits next to fps: the max is the jank tell that fps alone hides.
    const frame = this.stats.frameMsAvg ? `${this.stats.frameMsAvg}/${this.stats.frameMsMax} ms` : '— ms'
    ctx.fillText(
      `${this.index + 1}/${this.story.sections.length}   ${this.stats.fps} fps   ${frame}   ${splats}`,
      32,
      140,
    )

    ctx.fillStyle = '#8a8378'
    ctx.font = '400 26px "IBM Plex Mono", ui-monospace, monospace'
    // Eye-buffer resolution (what scale/foveation actually produced) + the bound GPU.
    ctx.fillText(this.fit(ctx, `eye ${this.bufferSize()}   ·   ${this.gpu || 'gpu ?'}`, w - 64), 32, 196)
    // Show the tuning in-headset, so an A/B can't be confused about which run it's in.
    ctx.fillText(`scale ${this.tuning.scale} · fov ${this.tuning.fov} · alpha ${this.tuning.alpha}`, 32, 248)

    ctx.font = '400 24px "IBM Plex Mono", ui-monospace, monospace'
    ctx.fillText('trigger next · grip back · B/Y exit', 32, 300)

    const map = (this.hud.material as THREE.MeshBasicMaterial).map
    if (map) map.needsUpdate = true
  }

  /** Combined eye-buffer size — the XR framebuffer while in-session, else the canvas buffer. */
  private bufferSize(): string {
    const layer = this.renderer.xr.getSession()?.renderState.baseLayer
    if (layer?.framebufferWidth) return `${layer.framebufferWidth}×${layer.framebufferHeight}`
    const gl = this.renderer.getContext()
    return `${gl.drawingBufferWidth}×${gl.drawingBufferHeight}`
  }

  /** Read the GPU the browser bound (integrated vs discrete, or software). */
  private captureGpuInfo(): void {
    try {
      const gl = this.renderer.getContext()
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) this.gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
    } catch {
      /* the extension can be blocked for privacy; leave '' */
    }
  }

  private fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
    if (ctx.measureText(text).width <= max) return text
    let out = text
    while (out.length > 1 && ctx.measureText(out + '…').width > max) out = out.slice(0, -1)
    return out + '…'
  }

  private onResize = (): void => {
    const { clientWidth: w, clientHeight: h } = this.container
    if (!w || !h) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  async dispose(): Promise<void> {
    this.running = false
    window.removeEventListener('resize', this.onResize)
    this.renderer?.setAnimationLoop(null)
    if (this.splatViewer) await this.splatViewer.dispose()
    else this.renderer?.dispose()
  }
}
