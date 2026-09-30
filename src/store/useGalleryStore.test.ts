import { describe, it, expect, beforeEach } from 'vitest'
import { useGalleryStore, type SavedCollection, type SavedStory } from './useGalleryStore'
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

const makeCollection = (slug: string, savedAt = 1): SavedCollection => ({
  slug,
  collection: { title: slug, stories: [], body: '', basePath: '', warnings: [] },
  cover: null,
  savedAt,
})

describe('useGalleryStore', () => {
  beforeEach(() => useGalleryStore.setState({ stories: [], collections: [] }))

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

describe('useGalleryStore — collections', () => {
  beforeEach(() => useGalleryStore.setState({ stories: [], collections: [] }))

  it('saves collections in order and upserts by slug, like stories', () => {
    const g = useGalleryStore.getState()
    g.saveCollection(makeCollection('a', 1))
    g.saveCollection(makeCollection('b', 2))
    expect(useGalleryStore.getState().collections.map((c) => c.slug)).toEqual(['a', 'b'])

    g.saveCollection(makeCollection('a', 3))
    const cs = useGalleryStore.getState().collections
    expect(cs.map((c) => c.slug)).toEqual(['b', 'a'])
    expect(cs.find((c) => c.slug === 'a')!.savedAt).toBe(3)
  })

  it('removes a collection by slug', () => {
    const g = useGalleryStore.getState()
    g.saveCollection(makeCollection('a'))
    g.saveCollection(makeCollection('b'))
    g.removeCollection('a')
    expect(useGalleryStore.getState().collections.map((c) => c.slug)).toEqual(['b'])
  })

  it('keeps the two namespaces separate — a story and a collection may share a slug', () => {
    const g = useGalleryStore.getState()
    g.save(make('shared'))
    g.saveCollection(makeCollection('shared'))
    expect(useGalleryStore.getState().stories.map((s) => s.slug)).toEqual(['shared'])
    expect(useGalleryStore.getState().collections.map((c) => c.slug)).toEqual(['shared'])

    // …and removing one leaves the other alone.
    g.removeCollection('shared')
    expect(useGalleryStore.getState().stories).toHaveLength(1)
    expect(useGalleryStore.getState().collections).toHaveLength(0)
  })

  it('story operations never touch collections', () => {
    const g = useGalleryStore.getState()
    g.saveCollection(makeCollection('c'))
    g.save(make('s'))
    g.remove('s')
    expect(useGalleryStore.getState().collections.map((c) => c.slug)).toEqual(['c'])
  })
})
