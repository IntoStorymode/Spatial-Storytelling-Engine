import { describe, expect, it } from 'vitest'
import {
  MESH_EXTS,
  MODEL_ACCEPT,
  MODEL_EXTS,
  MODEL_SIZE_WARN_BYTES,
  SPLAT_EXTS,
  describeModelWeight,
  isMeshExt,
  isSplatExt,
} from './modelFormats'

const MB = 1024 * 1024

/**
 * These exist because the list DID drift: `.sog` shipped in the loader (PR #37)
 * but not in the editor's upload `accept` filter, so the engine could render a
 * format the author could not choose. The bug was invisible — no error, the file
 * simply wasn't selectable in the picker.
 */
describe('model formats', () => {
  it('includes .sog — the regression that prompted this module', () => {
    expect(isSplatExt('sog')).toBe(true)
    expect(MODEL_ACCEPT).toContain('.sog')
  })

  it('builds the accept attribute from the same list the loader dispatches on', () => {
    // If these ever disagree, a file is either offered and unloadable, or
    // loadable and unofferable.
    expect(MODEL_ACCEPT.split(',')).toEqual(MODEL_EXTS.map((e) => `.${e}`))
  })

  it('keeps mesh and splat formats disjoint', () => {
    // An extension in both sets would make loadModel's dispatch order silently
    // decide the loader.
    for (const e of MESH_EXTS) expect(isSplatExt(e)).toBe(false)
    for (const e of SPLAT_EXTS) expect(isMeshExt(e)).toBe(false)
  })

  it('matches extensions case-insensitively', () => {
    // Uploads routinely arrive as Scan.GLB or SCENE.PLY.
    expect(isMeshExt('GLB')).toBe(true)
    expect(isSplatExt('SOG')).toBe(true)
    expect(isSplatExt('Spz')).toBe(true)
  })

  it('rejects unknown extensions', () => {
    expect(isMeshExt('obj')).toBe(false)
    expect(isSplatExt('zip')).toBe(false) // a bundled SOG is .sog, never .zip
  })
})

/**
 * The guardrail behind the editor upload warning + the two export backstops.
 * The 91 MB raw `.splat` that shipped in hyde-vale-fountain is exactly what this
 * catches — a format problem, flagged regardless of how "big" 91 MB feels.
 */
describe('describeModelWeight', () => {
  it('flags a raw .splat at ANY size — the format is the problem, not the byte count', () => {
    expect(describeModelWeight('scene.splat', 5 * MB)).toMatch(/raw, uncompressed splat/)
    // The real regression: 91.5 MB raw splat.
    expect(describeModelWeight('Blackheath - SHD 1.splat', 91.5 * MB)).toMatch(/\.sog/)
  })

  it('flags a raw .ply the same way (INRIA dump or point cloud — still uncompressed)', () => {
    expect(describeModelWeight('train.ply', 1 * MB)).toMatch(/raw, uncompressed/)
  })

  it('passes a compressed splat that is under budget', () => {
    expect(describeModelWeight('greenwich.spz', 14 * MB)).toBeNull()
    expect(describeModelWeight('sutro.sog', 28 * MB)).toBeNull()
    expect(describeModelWeight('scene.ksplat', 10 * MB)).toBeNull()
  })

  it('flags a compressed splat only once it exceeds the budget', () => {
    expect(describeModelWeight('huge.sog', MODEL_SIZE_WARN_BYTES - 1)).toBeNull()
    expect(describeModelWeight('huge.sog', MODEL_SIZE_WARN_BYTES + 1)).toMatch(/budget/)
  })

  it('gives meshes their own advice, and only when oversized', () => {
    expect(describeModelWeight('mall.glb', 20 * MB)).toBeNull()
    expect(describeModelWeight('mall.glb', 57 * MB)).toMatch(/mesh/)
  })

  it('matches the extension case-insensitively', () => {
    expect(describeModelWeight('SCAN.SPLAT', 3 * MB)).toMatch(/raw, uncompressed/)
  })
})
