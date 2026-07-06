import { describe, it, expect, beforeEach } from 'vitest'
import { useGalleryStore, type SavedStory } from './useGalleryStore'
import type { Frontmatter } from '../parser/types'

const baseFm: Frontmatter = { title: 'T', author: '', location: '', date: '', model: 'builtin:room' }
const make = (slug: string, savedAt = 1): SavedStory => ({
  slug,
  key: slug,
  fm: { ...baseFm, title: slug },
  sections: [],
  basePath: '',
  uploaded: null,
  mediaUploads: {},
  savedAt,
})

describe('useGalleryStore', () => {
  beforeEach(() => useGalleryStore.setState({ stories: [] }))

  it('saves stories in order and upserts by slug (re-save moves to end + updates)', () => {
    const g = useGalleryStore.getState()
    g.save(make('a', 1))
    g.save(make('b', 2))
    expect(useGalleryStore.getState().stories.map((s) => s.slug)).toEqual(['a', 'b'])

    g.save(make('a', 3))
    const st = useGalleryStore.getState().stories
    expect(st.map((s) => s.slug)).toEqual(['b', 'a'])
    expect(st.find((s) => s.slug === 'a')!.savedAt).toBe(3)
  })

  it('removes by slug', () => {
    const g = useGalleryStore.getState()
    g.save(make('a'))
    g.save(make('b'))
    g.remove('a')
    expect(useGalleryStore.getState().stories.map((s) => s.slug)).toEqual(['b'])
  })
})
