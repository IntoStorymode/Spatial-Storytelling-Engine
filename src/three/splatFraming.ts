/**
 * Robust framing maths for splat scenes — deliberately free of Three.js and of
 * any splat-library API, so it can be unit-tested and so swapping the renderer
 * only changes who *samples* the centres, never how they are interpreted.
 *
 * Why medians and percentiles rather than a bounding box: real scans carry stray
 * far-flung splats. An axis-aligned box over the centres balloons to enclose
 * them, the camera is flung far outside the scene, and the view goes black.
 * A per-axis median for the centre and distance percentiles for the radii shrug
 * those outliers off.
 */

/** Centre + extents, in the same space as the samples handed in. */
export interface SplatFraming {
  center: [number, number, number]
  /** 90th-percentile radius ×2 — roomy enough to FRAME the whole scene. */
  diameter: number
  /** Median distance — the walkable core, used for movement SPEED. */
  core: number
}

export function median(values: number[]): number {
  const a = values.slice().sort((x, y) => x - y)
  const m = a.length >> 1
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

/**
 * Reduce sampled splat centres to a centre and two radii.
 *
 * Returns two radii because they answer different questions. `diameter` (90th
 * percentile) frames the camera and wants to include most of the scene. `core`
 * (median) sets movement speed and must ignore the outer half entirely — a scan
 * with a sparse distant background inflates the 90th percentile, which made
 * WASD/touch far too fast in some scenes.
 *
 * The three arrays are parallel; index `i` is one sample. Returns null when
 * there is nothing measurable, so callers can keep their current framing.
 */
export function splatFramingFromSamples(
  xs: number[],
  ys: number[],
  zs: number[],
): SplatFraming | null {
  if (!xs.length) return null

  const cx = median(xs)
  const cy = median(ys)
  const cz = median(zs)

  const dists = xs.map((x, i) => Math.hypot(x - cx, ys[i] - cy, zs[i] - cz))
  dists.sort((a, b) => a - b)
  const r90 = dists[Math.floor(dists.length * 0.9)] || dists[dists.length - 1] || 1
  const r50 = dists[Math.floor(dists.length * 0.5)] || r90

  // Clamped away from zero: a single-point or degenerate cloud would otherwise
  // yield a zero extent, and every speed/distance derived from it divides by it.
  return {
    center: [cx, cy, cz],
    diameter: Math.max(r90 * 2, 1e-3),
    core: Math.max(r50, 1e-3),
  }
}

/**
 * How many splats to skip so a scene of `total` yields at most `cap` samples.
 * Sampling (rather than reading every splat) keeps framing cheap on scenes with
 * millions of splats; the percentiles are stable long before then.
 */
export function samplingStride(total: number, cap = 30000): number {
  return Math.max(1, Math.floor(total / cap))
}

/** The slice of Spark's SplatMesh we read centres from. */
export interface SplatCenterSource {
  numSplats: number
  packedSplats?: { getSplat(index: number): { center: { x: number; y: number; z: number } } }
}

/**
 * Sample splat centres into plain arrays. **This is the only place in the app
 * that may call `getSplat`.**
 *
 * Spark's `getSplat()` does not allocate: `unpackSplat` returns a MODULE-LEVEL
 * singleton whose `center` vector is overwritten on the very next call. That is a
 * deliberate trade (a per-call Vector3 across millions of splats would grind the
 * GC), but the type signature — `center: THREE.Vector3` — advertises none of it,
 * so `arr.push(getSplat(i).center)` reads as correct and yields N references to
 * one vector, all holding the last splat's position.
 *
 * The failure is SILENT: no throw, just a degenerate cloud, a collapsed extent
 * and a camera framing nothing.
 *
 * The defence is structural, not a rule to remember: this function returns plain
 * NUMBER arrays, never vectors. There is nothing for a caller to retain and no
 * object to alias, so the bug is unreachable through this API by construction —
 * which is why every splat centre read in the app goes through here. Note a test
 * cannot enforce this; the guarantee comes from the return type. If you ever
 * change it to hand back vectors, you reintroduce the hazard for every caller.
 *
 * `transform` maps a centre from the mesh's own space into world space. Spark
 * centres are always local and it has no `applySceneTransform` equivalent, so
 * for anything that must honour the model's rotation/offset (e.g. the upright
 * flip) this callback is the sole source of the world transform. It is a
 * callback rather than a THREE.Matrix4 so this module stays Three-free.
 */
export function sampleSplatCenters(
  src: SplatCenterSource,
  transform?: (x: number, y: number, z: number) => readonly [number, number, number],
): { xs: number[]; ys: number[]; zs: number[] } | null {
  const packed = src.packedSplats
  const total = src.numSplats
  if (!packed || !total) return null

  const stride = samplingStride(total)
  const xs: number[] = []
  const ys: number[] = []
  const zs: number[] = []
  for (let i = 0; i < total; i += stride) {
    const c = packed.getSplat(i).center
    // Read the fields out NOW — `c` is about to be overwritten.
    const [x, y, z] = transform ? transform(c.x, c.y, c.z) : [c.x, c.y, c.z]
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
    xs.push(x)
    ys.push(y)
    zs.push(z)
  }
  return { xs, ys, zs }
}
