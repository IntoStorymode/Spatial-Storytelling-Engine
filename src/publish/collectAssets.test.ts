import { describe, it, expect } from 'vitest'
import { collectAssets } from './collectAssets'
import type { Frontmatter, StoryItem } from '../parser/types'

const fm = (model: string): Frontmatter => ({ title: 't', author: '', location: '', date: '', model })
const file = (name: string) => new File(['x'], name)

describe('collectAssets', () => {
  it('includes the uploaded model + uploaded media, skips typed-only src and text items', () => {
    const items: StoryItem[] = [
      { id: 'i1', title: 'a', type: 'image', src: 'assets/a.jpg', body: '' },
      { id: 'i2', title: 'b', type: 'image', src: 'assets/typed.jpg', body: '' }, // not uploaded
      { id: 'i3', title: 'c', type: 'text', body: '' },
    ]
    const out = collectAssets(fm('assets/scene.glb'), items, { file: file('scene.glb') }, {
      'assets/a.jpg': { file: file('a.jpg') },
    })
    expect(out.map((a) => a.path)).toEqual(['assets/scene.glb', 'assets/a.jpg'])
  })

  it('omits the model when it is not an upload (builtin/typed path)', () => {
    expect(collectAssets(fm('builtin:room'), [], null, {})).toEqual([])
  })
})
