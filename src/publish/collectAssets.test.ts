import { describe, it, expect } from 'vitest'
import { collectAssets, collectCollectionAssets } from './collectAssets'
import type { Frontmatter, Section } from '../parser/types'

const fm = (model: string): Frontmatter => ({ title: 't', author: '', location: '', date: '', model })
const file = (name: string) => new File(['x'], name)

describe('collectAssets', () => {
  it('includes the uploaded model + uploaded media, skips typed-only src and text sections', () => {
    const sections: Section[] = [
      { id: 'i1', title: 'a', type: 'image', src: 'assets/a.jpg', body: '' },
      { id: 'i2', title: 'b', type: 'image', src: 'assets/typed.jpg', body: '' }, // not uploaded
      { id: 'i3', title: 'c', type: 'text', body: '' },
    ]
    const out = collectAssets(fm('assets/scene.glb'), sections, { file: file('scene.glb') }, {
      'assets/a.jpg': { file: file('a.jpg') },
    })
    expect(out.map((a) => a.path)).toEqual(['assets/scene.glb', 'assets/a.jpg'])
  })

  it('omits the model when it is not an upload (builtin/typed path)', () => {
    expect(collectAssets(fm('builtin:room'), [], null, {})).toEqual([])
  })
})

describe('collectCollectionAssets', () => {
  it('includes an uploaded cover at its authored path', () => {
    const out = collectCollectionAssets({ cover: 'assets/cover.jpg' }, { file: file('cover.jpg') })
    expect(out.map((a) => a.path)).toEqual(['assets/cover.jpg'])
  })

  it('omits a typed-path cover, which the browser was never handed', () => {
    expect(collectCollectionAssets({ cover: 'assets/typed.jpg' }, null)).toEqual([])
  })

  it('returns nothing when the collection has no cover', () => {
    expect(collectCollectionAssets({}, { file: file('stray.jpg') })).toEqual([])
  })
})
