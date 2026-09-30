import { describe, it, expect } from 'vitest'
import { readCollectionEntries, collectionPathFor, hostCollectionEntry } from './collectionIndex'

describe('readCollectionEntries', () => {
  it('reads well-formed entries', () => {
    const json = {
      stories: [{ id: 'a' }],
      collections: [
        { id: 'high-street', title: 'The High Street', path: 'collections/high-street/collection.md' },
      ],
    }
    expect(readCollectionEntries(json)).toEqual([
      { id: 'high-street', title: 'The High Street', path: 'collections/high-street/collection.md' },
    ])
  })

  it('keeps the optional cover and subtitle when present', () => {
    const json = {
      collections: [
        {
          id: 'c',
          title: 'C',
          path: 'collections/c/collection.md',
          cover: 'collections/c/assets/cover.jpg',
          subtitle: 'Somewhere',
        },
      ],
    }
    expect(readCollectionEntries(json)[0]).toMatchObject({
      cover: 'collections/c/assets/cover.jpg',
      subtitle: 'Somewhere',
    })
  })

  it('returns [] for an index with no collections key — the backward-compatible case', () => {
    expect(readCollectionEntries({ stories: [{ id: 'a' }] })).toEqual([])
  })

  it('returns [] for a non-array collections value', () => {
    expect(readCollectionEntries({ collections: 'nope' })).toEqual([])
  })

  it.each([null, undefined, 'string', 42, []])('returns [] for a non-object json (%s)', (json) => {
    expect(readCollectionEntries(json)).toEqual([])
  })

  it('skips entries missing an id or a path', () => {
    const json = {
      collections: [
        { title: 'no id', path: 'x' },
        { id: 'no-path', title: 'y' },
        { id: 'ok', title: 'z', path: 'collections/ok/collection.md' },
      ],
    }
    expect(readCollectionEntries(json).map((c) => c.id)).toEqual(['ok'])
  })

  it('skips non-object entries without dropping the good ones', () => {
    const json = { collections: [null, 5, 'x', { id: 'ok', path: 'p' }] }
    expect(readCollectionEntries(json).map((c) => c.id)).toEqual(['ok'])
  })

  it('drops duplicate ids, keeping the first', () => {
    const json = {
      collections: [
        { id: 'c', title: 'First', path: 'p1' },
        { id: 'c', title: 'Second', path: 'p2' },
      ],
    }
    const out = readCollectionEntries(json)
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('First')
  })

  it('falls back to the id when the title is missing or blank', () => {
    const json = { collections: [{ id: 'c', title: '   ', path: 'p' }] }
    expect(readCollectionEntries(json)[0].title).toBe('c')
  })

  it('ignores unknown keys on an entry', () => {
    const json = { collections: [{ id: 'c', path: 'p', futureField: true }] }
    expect(readCollectionEntries(json)[0]).toEqual({ id: 'c', title: 'c', path: 'p' })
  })
})

describe('collectionPathFor', () => {
  it('builds the conventional path', () => {
    expect(collectionPathFor('high-street')).toBe('collections/high-street/collection.md')
  })
})

describe('hostCollectionEntry', () => {
  const withCollection = {
    stories: [{ id: 'a' }],
    collections: [{ id: 'c', title: 'C', path: 'collections/c/collection.md' }],
  }

  it('names the collection a published export is hosted as', () => {
    expect(hostCollectionEntry(withCollection, true)?.id).toBe('c')
  })

  it('is null in the authoring app, where Home is the author’s own gallery', () => {
    expect(hostCollectionEntry(withCollection, false)).toBeNull()
  })

  it('is null for a published story-only export', () => {
    expect(hostCollectionEntry({ stories: [{ id: 'a' }] }, true)).toBeNull()
  })

  it('takes the first entry — one collection per export', () => {
    const two = { collections: [{ id: 'first', path: 'p1' }, { id: 'second', path: 'p2' }] }
    expect(hostCollectionEntry(two, true)?.id).toBe('first')
  })

  it.each([null, undefined, {}, 'nonsense'])('is null for a junk index (%s)', (json) => {
    expect(hostCollectionEntry(json, true)).toBeNull()
  })
})
