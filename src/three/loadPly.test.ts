import { describe, expect, it } from 'vitest'
import { headerLooksLikeSplat } from './loadPly'

/**
 * Two very different files share the `.ply` extension: a Gaussian-splat PLY and
 * an ordinary point cloud / mesh. This sniff is what routes them apart — get it
 * wrong and a point cloud is culled to nothing by the splat loader, or a splat
 * renders as flat grey dots.
 */
describe('headerLooksLikeSplat', () => {
  it('detects an INRIA V1 splat by its spherical-harmonics colour', () => {
    expect(headerLooksLikeSplat('property float f_dc_0\nproperty float f_dc_1')).toBe(true)
  })

  it('detects a splat by scale + rotation together', () => {
    expect(headerLooksLikeSplat('property float scale_0\nproperty float rot_0')).toBe(true)
  })

  it('does NOT treat scale alone as a splat', () => {
    // A plain mesh may carry a scale property without being a splat.
    expect(headerLooksLikeSplat('property float scale_0')).toBe(false)
  })

  it('detects the PlayCanvas compressed format', () => {
    expect(headerLooksLikeSplat('element chunk 128')).toBe(true)
    expect(headerLooksLikeSplat('property uint packed_position')).toBe(true)
  })

  it('detects INRIA V2 by its codebook', () => {
    expect(headerLooksLikeSplat('property float codebook_centers')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(headerLooksLikeSplat('PROPERTY FLOAT F_DC_0')).toBe(true)
  })

  it('rejects an ordinary point cloud', () => {
    const header = [
      'ply',
      'format binary_little_endian 1.0',
      'element vertex 1000',
      'property float x',
      'property float y',
      'property float z',
      'property uchar red',
      'property uchar green',
      'property uchar blue',
    ].join('\n')
    expect(headerLooksLikeSplat(header)).toBe(false)
  })

  it('rejects an empty header', () => {
    expect(headerLooksLikeSplat('')).toBe(false)
  })
})
