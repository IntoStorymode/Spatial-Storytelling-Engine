import { describe, it, expect } from 'vitest'
import { parseCollection, serializeCollection } from './collection'

const BASE = '/collections/high-street/'

/** The format as documented, with every field present. */
const FULL = [
  '---',
  'type: collection',
  'title: "The High Street"',
  'subtitle: Cradley Heath, England',
  'cover: assets/cover.jpg',
  'stories:',
  '  - "cinema"',
  '  - "tak-shun-mall"',
  '---',
  '',
  'The high street closed in stages.',
  '',
  'The scans were gathered over two winters.',
  '',
].join('\n')

describe('parseCollection', () => {
  it('parses every frontmatter field', () => {
    const c = parseCollection(FULL, BASE)
    expect(c.title).toBe('The High Street')
    expect(c.subtitle).toBe('Cradley Heath, England')
    expect(c.cover).toBe('assets/cover.jpg')
    expect(c.stories).toEqual(['cinema', 'tak-shun-mall'])
    expect(c.basePath).toBe(BASE)
    expect(c.warnings).toEqual([])
  })

  it('keeps the prose body whole rather than splitting it into sections', () => {
    const c = parseCollection(FULL, BASE)
    expect(c.body).toBe(
      'The high street closed in stages.\n\nThe scans were gathered over two winters.',
    )
  })

  it('leaves a body containing a --- rule intact', () => {
    // A story would split here; a collection must not — its body is one piece.
    const md = '---\ntitle: "x"\nstories:\n  - "a"\n---\n\nBefore.\n\n---\n\nAfter.\n'
    const c = parseCollection(md, BASE)
    expect(c.body).toBe('Before.\n\n---\n\nAfter.')
  })

  it('omits absent optional fields rather than emptying them', () => {
    const md = '---\ntitle: "x"\nstories:\n  - "a"\n---\n\nBody\n'
    const c = parseCollection(md, BASE)
    expect(c.subtitle).toBeUndefined()
    expect(c.cover).toBeUndefined()
    expect(c.warnings).toEqual([])
  })

  it('round-trips through serializeCollection', () => {
    const c1 = parseCollection(FULL, BASE)
    const c2 = parseCollection(serializeCollection(c1), BASE)
    expect(c2).toEqual(c1)
    expect(c2.warnings).toEqual([])
  })

  it('round-trips a collection with only the required fields', () => {
    const c1 = parseCollection('---\ntitle: "x"\nstories:\n  - "a"\n---\n\nBody\n', BASE)
    const c2 = parseCollection(serializeCollection(c1), BASE)
    expect(c2).toEqual(c1)
    expect(c2.warnings).toEqual([])
  })

  it('drops non-string / empty story entries with a warning', () => {
    const md = '---\ntitle: "x"\nstories:\n  - "ok"\n  - ""\n  - 5\n---\n\nBody\n'
    const c = parseCollection(md, BASE)
    expect(c.stories).toEqual(['ok'])
    expect(c.warnings.some((w) => w.includes('stories'))).toBe(true)
  })

  it('ignores a stories value that is not a list', () => {
    const md = '---\ntitle: "x"\nstories: "not-a-list"\n---\n\nBody\n'
    const c = parseCollection(md, BASE)
    expect(c.stories).toEqual([])
    expect(c.warnings.some((w) => w.includes('stories'))).toBe(true)
  })

  it('warns when the type says something other than collection', () => {
    const md = '---\ntype: story\ntitle: "x"\nstories:\n  - "a"\n---\n\nBody\n'
    const c = parseCollection(md, BASE)
    expect(c.warnings.some((w) => w.includes('type'))).toBe(true)
    // …but still parses, like every other malformed field.
    expect(c.title).toBe('x')
  })

  it('accepts a missing type — the filename already says what this is', () => {
    const md = '---\ntitle: "x"\nstories:\n  - "a"\n---\n\nBody\n'
    expect(parseCollection(md, BASE).warnings).toEqual([])
  })

  it('warns on a missing title and on listing no stories', () => {
    const c = parseCollection('---\ntitle: ""\n---\n\nBody\n', BASE)
    expect(c.warnings.some((w) => w.includes('title'))).toBe(true)
    expect(c.warnings.some((w) => w.includes('stories'))).toBe(true)
  })

  it('warns when there is no frontmatter at all, without throwing', () => {
    const c = parseCollection('Just prose.\n', BASE)
    expect(c.warnings.some((w) => w.includes('frontmatter'))).toBe(true)
    expect(c.body).toBe('Just prose.')
  })

  it('normalizes CRLF line endings', () => {
    const c = parseCollection('---\r\ntitle: "x"\r\nstories:\r\n  - "a"\r\n---\r\n\r\nBody\r\n', BASE)
    expect(c.title).toBe('x')
    expect(c.stories).toEqual(['a'])
    expect(c.body).toBe('Body')
  })

  it('defaults basePath to empty, like parseStory', () => {
    expect(parseCollection(FULL).basePath).toBe('')
  })
})
