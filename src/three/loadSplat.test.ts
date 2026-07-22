import { describe, expect, it } from 'vitest'
import { FILE_TYPE_BY_EXT } from './loadSplat'

/**
 * The extension → Spark `SplatFileType` map. These strings are passed straight to
 * a Rust decoder whose `from_enum_str` rejects anything it doesn't recognise, so a
 * typo here is a runtime throw on a reader's machine, not a compile error.
 */
describe('FILE_TYPE_BY_EXT', () => {
  it('maps .sog to PCSOGSZIP, never PCSOGS', () => {
    // The single most error-prone entry. PCSOGS is the multi-file directory form
    // (meta.json + sibling WebPs, needing an extraFiles map); a bundled .sog —
    // what SuperSplat exports and what every upload is — is PCSOGSZIP. Spark's
    // own path detection agrees, and "pcsogs" is rejected outright by the decoder.
    expect(FILE_TYPE_BY_EXT.sog).toBe('pcsogszip')
    expect(FILE_TYPE_BY_EXT.sog).not.toBe('pcsogs')
  })

  it('covers every extension loadModel routes to the splat loader', () => {
    // Must stay in step with SPLAT_EXTS in loadModel.ts: an extension that routes
    // here without a mapping loads with no explicit fileType, which is fine for a
    // normal URL but fails for an extension-less blob: upload.
    expect(Object.keys(FILE_TYPE_BY_EXT).sort()).toEqual(['ksplat', 'ply', 'sog', 'splat', 'spz'])
  })

  it('uses Spark’s own lowercase enum values', () => {
    expect(FILE_TYPE_BY_EXT.ply).toBe('ply')
    expect(FILE_TYPE_BY_EXT.spz).toBe('spz')
    expect(FILE_TYPE_BY_EXT.splat).toBe('splat')
    expect(FILE_TYPE_BY_EXT.ksplat).toBe('ksplat')
    for (const v of Object.values(FILE_TYPE_BY_EXT)) expect(v).toBe(v.toLowerCase())
  })
})
