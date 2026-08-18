import * as THREE from 'three'
import { debugTuning } from './debugTuning'
import { sampleSplatCenters, splatFramingFromSamples, type SplatCenterSource } from './splatFraming'

/**
 * Load a Gaussian-splat scene as a THREE.Object3D that plugs straight into our
 * existing scene + camera + RAF loop.
 *
 * Spark's `SplatMesh extends THREE.Object3D` and its `SparkRenderer` (a
 * THREE.Mesh) does the per-frame sort from `onBeforeRender`, so the normal
 * `renderer.render(scene, camera)` is enough — the same trick the previous
 * library's DropInViewer used, which is what made this swap a loader change
 * rather than an engine rewrite.
 *
 * The heavy Spark bundle is dynamically imported so it only loads for readers who
 * actually open a splat-backed story; it stays out of the initial bundle. That is
 * also why `ensureSparkRenderer` lives here rather than in ThreeViewer — touching
 * Spark from the viewer's constructor would pull it into the main chunk.
 *
 * Supported formats: .ply / .splat / .ksplat / .spz / .sog. Spark normally infers
 * the format from the URL's extension, but an uploaded `blob:`/`data:` URL carries
 * none — so callers pass `ext` and we map it to the explicit `fileType` option,
 * which the decoder honours over path-based inference.
 */

/** What a splat load needs from the viewer to wire Spark into its render loop. */
export interface SplatContext {
  scene: THREE.Scene
  renderer: THREE.WebGLRenderer
  /**
   * Called when Spark finishes an async sort (or LOD update) and the scene must
   * be redrawn. Our render loop is on-demand, so without this the frame that
   * triggered the sort would draw with the PREVIOUS depth ordering and then the
   * loop would idle, leaving the mis-sorted frame on screen.
   */
  onDirty: () => void
}

/**
 * `.sog` maps to PCSOGSZIP, never PCSOGS.
 *
 * PCSOGS is the multi-file directory form (meta.json + sibling WebP files, needing
 * an `extraFiles` map); PCSOGSZIP is the single bundled file, which is what a
 * SuperSplat export and every upload actually is. Spark's own path-based detection
 * agrees — its `getSplatFileTypeFromPath` maps the "sog" extension to PCSOGSZIP —
 * and the Rust decoder's `from_enum_str` rejects "pcsogs" outright, so getting this
 * wrong throws at runtime rather than degrading quietly.
 */
export const FILE_TYPE_BY_EXT: Record<string, string> = {
  ply: 'ply',
  splat: 'splat',
  ksplat: 'ksplat',
  spz: 'spz',
  sog: 'pcsogszip',
}

/**
 * One SparkRenderer per scene, created on first splat load and reused after.
 *
 * Deliberately explicit rather than relying on Spark's auto-injection: that runs
 * *during* a render, so the first frame after a load draws nothing. A WeakMap
 * keyed by scene means a discarded viewer's entry goes away with it.
 */
/**
 * Formats that carry the INRIA (Y-down / Z-forward, COLMAP) convention and so need
 * the 180° X correction by default.
 *
 * `.sog` is here because SuperSplat — the only practical producer of bundled SOG —
 * exports from INRIA-convention sources and preserves that orientation, exactly as
 * an INRIA `.ply` does. Verified against Spark's sutro sample, which loads inverted
 * without it. `.spz`/`.splat`/`.ksplat` stay out: they are typically already Y-up
 * from conversion, and our bundled stories confirm it.
 */
const AUTO_FLIP_EXTS = new Set(['ply', 'sog'])

const sparkByScene = new WeakMap<THREE.Scene, THREE.Object3D & { dispose?: () => void }>()

async function ensureSparkRenderer(ctx: SplatContext): Promise<void> {
  if (sparkByScene.has(ctx.scene)) return
  const { SparkRenderer } = await import('@sparkjsdev/spark')
  // DIAGNOSTIC: ?sortms=<n> floors the re-sort interval, decoupling sort rate from
  // frame rate. The previous library had no equivalent lever.
  const { sortMs } = debugTuning()
  const spark = new SparkRenderer({
    renderer: ctx.renderer,
    onDirty: ctx.onDirty,
    ...(sortMs != null ? { minSortIntervalMs: sortMs } : {}),
  })
  ctx.scene.add(spark)
  sparkByScene.set(ctx.scene, spark)
}

/** Tear down the scene's SparkRenderer. Called from ThreeViewer.dispose(). */
export function disposeSparkRenderer(scene: THREE.Scene): void {
  const spark = sparkByScene.get(scene)
  if (!spark) return
  scene.remove(spark)
  try {
    spark.dispose?.()
  } catch (e) {
    console.error('SparkRenderer dispose failed', e)
  }
  sparkByScene.delete(scene)
}

export async function loadSplat(
  resolvedUrl: string,
  ext?: string,
  orientation?: 'flip' | 'none',
  ctx?: SplatContext,
  onProgress?: (loaded: number, total: number) => void,
): Promise<THREE.Object3D> {
  const { SplatMesh } = await import('@sparkjsdev/spark')
  if (ctx) await ensureSparkRenderer(ctx)

  const normExt = ext?.toLowerCase()
  const fileType = normExt ? FILE_TYPE_BY_EXT[normExt] : undefined

  // `fileType` is mandatory for .splat/.ksplat/.sog loaded from a blob: URL —
  // those have no magic bytes AND no extension to sniff. It is merely belt-and-
  // braces for .ply/.spz. Note we do NOT pass `fileName` as a second detection
  // chance: when `url` is set Spark forwards `pathName: resolvedURL || fileName`,
  // so the blob URL shadows it and it is never consulted.
  //
  // `onProgress` reports the DOWNLOAD (fetch) bytes — meaningful for a hosted
  // story over the network; a local file downloads near-instantly and the wait
  // is the decode, which the loader does not report.
  const mesh = new SplatMesh({
    url: resolvedUrl,
    ...(fileType !== undefined ? { fileType: fileType as never } : {}),
    ...(onProgress
      ? { onProgress: (e: ProgressEvent) => onProgress(e.loaded, e.lengthComputable ? e.total : 0) }
      : {}),
  })
  await mesh.initialized

  const obj = mesh as unknown as THREE.Object3D
  obj.name = 'splat-model'
  obj.userData.isSplat = true // signals ThreeViewer to dispose via the mesh's own dispose()
  // Splat bounds can confuse frustum culling; never cull the scene wholesale.
  obj.frustumCulled = false
  obj.traverse((child) => {
    child.frustumCulled = false
  })

  // INRIA-format .ply splats use a Y-down / Z-forward (COLMAP) convention, so
  // they land upside-down in Three.js's Y-up world. Correct with a 180° rotation
  // about X — a true rotation (det +1, no mirroring), pivoted on the model's own
  // centre so its world position is preserved. Spark applies no auto-correction
  // of its own (its hello-world example flips INRIA plys by hand the same way),
  // so this is not a double rotation.
  //
  // The default is auto (see AUTO_FLIP_EXTS): flip the formats that carry the
  // INRIA convention, leave the rest alone (they're usually already Y-up from
  // conversion). A SuperSplat `.splat`/`.ksplat` repacked from an INRIA `.ply`
  // inherits the same flipped orientation, so authors can override via frontmatter
  // `orientation:` — `flip` forces the correction on any format, `none` disables
  // it. See loadModel's formatHint for how uploads carry their extension.
  const shouldFlip = orientation ?? (AUTO_FLIP_EXTS.has(normExt ?? '') ? 'flip' : 'none')
  if (shouldFlip === 'flip') {
    orientPlyUpright(mesh)
  }

  return obj
}

/**
 * Flip an INRIA .ply splat 180° about X around its own centre (Y-up correction).
 *
 * Unlike the previous library there is no wrapper Group — the SplatMesh *is* the
 * object — so the pivot arithmetic applies to it directly. The centre comes from
 * our own outlier-proof sample rather than a bounding box, because a handful of
 * stray splats would drag a bbox centre (and therefore the flipped position) well
 * away from the actual scene.
 */
function orientPlyUpright(
  mesh: SplatCenterSource & { rotation: THREE.Euler; position: THREE.Vector3 },
): void {
  const center = localSplatCenter(mesh)
  if (!center) return

  // Rotate child point p to world = C + R·(p − C), with R = 180° about X mapping
  // (x,y,z) → (x,−y,−z). That expands to world = R·p + (0, 2·Cy, 2·Cz), so:
  mesh.rotation.x = Math.PI
  mesh.position.set(0, 2 * center[1], 2 * center[2])
}

/** Median splat centre in the mesh's own (unrotated) space. */
function localSplatCenter(mesh: SplatCenterSource): [number, number, number] | null {
  // Reads via sampleSplatCenters, the single sanctioned getSplat call site — it
  // snapshots each centre before Spark's reused singleton is overwritten.
  const samples = sampleSplatCenters(mesh)
  if (!samples) return null
  return splatFramingFromSamples(samples.xs, samples.ys, samples.zs)?.center ?? null
}
