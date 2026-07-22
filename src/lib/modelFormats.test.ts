import { describe, expect, it } from 'vitest'
import { MESH_EXTS, MODEL_ACCEPT, MODEL_EXTS, SPLAT_EXTS, isMeshExt, isSplatExt } from './modelFormats'

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
