import { describe, it, expect } from 'vitest'
import { validateCollection } from './validateCollection'
import type { Collection } from '../parser/types'

const make = (p: Partial<Collection> = {}): Collection => ({
  title: 'The High Street',
  stories: ['a'],
  body: 'Background prose.',
  basePath: '',
  warnings: [],
  ...p,
})

const AVAILABLE = ['a', 'b']

describe('validateCollection', () => {
  it('passes a complete collection', () => {
    expect(validateCollection(make(), 'high-street', AVAILABLE)).toEqual([])
  })

  it('blocks a missing title', () => {
    const out = validateCollection(make({ title: '   ' }), 'x', AVAILABLE)
    expect(out.some((i) => i.includes('title'))).toBe(true)
  })

  it('blocks a missing export name and suggests one', () => {
    const out = validateCollection(make(), '', AVAILABLE)
    expect(out.some((i) => i.includes('export name'))).toBe(true)
  })

  it('blocks a collection with no stories', () => {
    const out = validateCollection(make({ stories: [] }), 'x', AVAILABLE)
    expect(out.some((i) => i.includes('at least one story'))).toBe(true)
  })

  it('blocks a story that is not available, naming it', () => {
    const out = validateCollection(make({ stories: ['a', 'ghost'] }), 'x', AVAILABLE)
    expect(out.some((i) => i.includes('ghost'))).toBe(true)
    // …and not the one that is available.
    expect(out.some((i) => i.includes('"a"'))).toBe(false)
  })

  it('names every unavailable story, not just the first', () => {
    const out = validateCollection(make({ stories: ['x1', 'x2'] }), 'x', AVAILABLE)
    expect(out.filter((i) => i.includes("isn't in your gallery"))).toHaveLength(2)
  })

  it('blocks an empty body — the landing page is mostly prose', () => {
    const out = validateCollection(make({ body: '  \n ' }), 'x', AVAILABLE)
    expect(out.some((i) => i.includes('background text'))).toBe(true)
  })

  it('treats an absent availability list as nothing being available', () => {
    const out = validateCollection(make(), 'x')
    expect(out.some((i) => i.includes('"a"'))).toBe(true)
  })

  it('does not require a cover — it is optional by design', () => {
    expect(validateCollection(make({ cover: undefined }), 'x', AVAILABLE)).toEqual([])
  })

  it('reports several problems at once rather than stopping at the first', () => {
    const out = validateCollection(make({ title: '', body: '', stories: [] }), '', AVAILABLE)
    expect(out.length).toBeGreaterThanOrEqual(4)
  })
})
