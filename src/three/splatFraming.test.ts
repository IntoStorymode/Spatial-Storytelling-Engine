import { describe, expect, it } from 'vitest'
import { median, sampleSplatCenters, samplingStride, splatFramingFromSamples } from './splatFraming'

/**
 * Characterisation tests: these pin the CURRENT framing behaviour so that
 * swapping the splat renderer (which changes only how centres are sampled)
 * cannot silently change how they are interpreted. A regression here means the
 * camera framing or the WASD movement speed has moved.
 */

describe('median', () => {
  it('returns the middle value for an odd count', () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  it('averages the two middle values for an even count', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('does not mutate the caller’s array', () => {
    const input = [3, 1, 2]
    median(input)
    expect(input).toEqual([3, 1, 2])
  })

  it('handles negatives', () => {
    expect(median([-5, -1, -3])).toBe(-3)
  })
})

describe('samplingStride', () => {
  it('is 1 when the scene is smaller than the cap', () => {
    expect(samplingStride(1000)).toBe(1)
    expect(samplingStride(30000)).toBe(1)
  })

  it('grows so the sample count stays near the cap', () => {
    expect(samplingStride(300000)).toBe(10)
    expect(samplingStride(60000)).toBe(2)
  })

  it('never returns 0 (which would loop forever)', () => {
    expect(samplingStride(0)).toBe(1)
  })
})

describe('splatFramingFromSamples', () => {
  it('returns null when there is nothing to measure', () => {
    expect(splatFramingFromSamples([], [], [])).toBeNull()
  })

  it('centres on the per-axis median', () => {
    const framing = splatFramingFromSamples([0, 1, 2], [10, 11, 12], [-2, -1, 0])!
    expect(framing.center).toEqual([1, 11, -1])
  })

  it('clamps degenerate (single-point) clouds away from zero', () => {
    // Every derived value — speed, distance — divides by these, so a zero
    // extent would produce NaN/Infinity downstream.
    const framing = splatFramingFromSamples([5], [5], [5])!
    expect(framing.diameter).toBeGreaterThan(0)
    expect(framing.core).toBeGreaterThan(0)
  })

  it('ignores a far-flung outlier — the whole point of the median approach', () => {
    // 200 splats in a tight unit cloud, plus one splat 10,000 units away.
    // A bounding box would balloon; the median/percentile must not.
    const xs: number[] = []
    const ys: number[] = []
    const zs: number[] = []
    for (let i = 0; i < 200; i++) {
      xs.push((i % 10) / 10)
      ys.push(((i / 10) | 0) / 10)
      zs.push(0)
    }
    xs.push(10000)
    ys.push(10000)
    zs.push(10000)

    const framing = splatFramingFromSamples(xs, ys, zs)!
    expect(framing.center[0]).toBeLessThan(2)
    expect(framing.center[1]).toBeLessThan(2)
    expect(framing.diameter).toBeLessThan(10)
    expect(framing.core).toBeLessThan(10)
  })

  it('keeps core tighter than diameter for a cloud with a sparse outer shell', () => {
    // This is the property that fixed WASD being far too fast: speed follows
    // `core` (median distance), framing follows `diameter` (90th percentile ×2),
    // so a sparse distant background cannot inflate movement speed.
    const xs: number[] = []
    const ys: number[] = []
    const zs: number[] = []
    for (let i = 0; i < 90; i++) {
      xs.push(Math.cos(i) * 1)
      ys.push(Math.sin(i) * 1)
      zs.push(0)
    }
    for (let i = 0; i < 10; i++) {
      xs.push(Math.cos(i) * 100)
      ys.push(Math.sin(i) * 100)
      zs.push(0)
    }

    const framing = splatFramingFromSamples(xs, ys, zs)!
    expect(framing.core).toBeLessThan(framing.diameter)
    expect(framing.core).toBeLessThan(5) // the dense core, not the shell
  })

  it('scales linearly with the cloud — 10× bigger scene, 10× the extents', () => {
    const xs = [0, 1, 2, 3, 4]
    const small = splatFramingFromSamples(xs, xs, xs)!
    const big = splatFramingFromSamples(
      xs.map((v) => v * 10),
      xs.map((v) => v * 10),
      xs.map((v) => v * 10),
    )!
    expect(big.diameter).toBeCloseTo(small.diameter * 10, 6)
    expect(big.core).toBeCloseTo(small.core * 10, 6)
  })
})

/**
 * Spark's getSplat() returns a MODULE-LEVEL singleton whose center vector is
 * overwritten on the next call — a deliberate no-allocation trade, but one the
 * type signature hides completely. Retaining the returned vector yields N
 * references to one object, all holding the last splat's position, and it fails
 * SILENTLY: no throw, just a collapsed extent and a camera framing nothing.
 *
 * This stub reproduces that exact behaviour. To be clear about what these tests
 * do and do not buy: they do NOT detect a missing copy, because sampleSplatCenters
 * returns plain numbers and so cannot alias in the first place — that guarantee is
 * structural, from the return type. What they pin is that the function stays
 * correct when fed a source with these reuse semantics, so a future refactor
 * toward returning vectors has to break a test to get there.
 */
function aliasingSource(centers: Array<[number, number, number]>) {
  const shared = { x: 0, y: 0, z: 0 } // ONE object, reused — exactly like Spark
  return {
    numSplats: centers.length,
    packedSplats: {
      getSplat(index: number) {
        const [x, y, z] = centers[index]
        shared.x = x
        shared.y = y
        shared.z = z
        return { center: shared }
      },
    },
  }
}

describe('sampleSplatCenters', () => {
  it('reads correct values from a source that reuses one object', () => {
    const src = aliasingSource([
      [0, 0, 0],
      [1, 2, 3],
      [4, 5, 6],
    ])
    const s = sampleSplatCenters(src)!
    // Without the copy every entry would read [4,5,6] — the last splat sampled.
    expect(s.xs).toEqual([0, 1, 4])
    expect(s.ys).toEqual([0, 2, 5])
    expect(s.zs).toEqual([0, 3, 6])
  })

  it('produces a real extent from a reusing source, not a degenerate point', () => {
    // The symptom aliasing would produce, pinned end to end: collapsed centres
    // mean diameter hits the 1e-3 floor and the camera frames nothing.
    const centers: Array<[number, number, number]> = []
    for (let i = 0; i < 100; i++) centers.push([i, i * 2, i * 3])
    const s = sampleSplatCenters(aliasingSource(centers))!
    const framing = splatFramingFromSamples(s.xs, s.ys, s.zs)!
    expect(framing.diameter).toBeGreaterThan(1)
    expect(new Set(s.xs).size).toBe(100)
  })

  it('applies the transform, which is the sole source of the world matrix', () => {
    const s = sampleSplatCenters(aliasingSource([[1, 1, 1]]), (x, y, z) => [x * 2, y + 10, -z])!
    expect(s.xs).toEqual([2])
    expect(s.ys).toEqual([11])
    expect(s.zs).toEqual([-1])
  })

  it('drops non-finite centres rather than poisoning the median', () => {
    const s = sampleSplatCenters(
      aliasingSource([
        [1, 1, 1],
        [NaN, 0, 0],
        [Infinity, 0, 0],
        [2, 2, 2],
      ]),
    )!
    expect(s.xs).toEqual([1, 2])
  })

  it('returns null when there is nothing to sample', () => {
    expect(sampleSplatCenters({ numSplats: 0 })).toBeNull()
    expect(sampleSplatCenters({ numSplats: 10 })).toBeNull() // no packedSplats yet
  })
})
