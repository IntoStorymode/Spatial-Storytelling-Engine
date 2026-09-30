import { describe, it, expect } from 'vitest'
import {
  collectionIndexEntry,
  collectionWarnings,
  indexEntry,
  injectPublishedMarker,
  injectKiosk,
  kioskScript,
  orderCollectionIds,
  storiesIndexJson,
} from './siteTemplate.mjs'

const MARKER = `<script>window.__SSP_PUBLISHED__=true</script>`

describe('injectPublishedMarker', () => {
  it('inserts the marker just before the app module script', () => {
    const html = `<head></head><body><script type="module" src="/assets/index.js"></script></body>`
    const out = injectPublishedMarker(html)
    expect(out).toContain(MARKER)
    // marker runs before the module entry, so the global is set before React mounts
    expect(out.indexOf(MARKER)).toBeLessThan(out.indexOf('<script type="module"'))
  })

  it('falls back to before </head> when there is no module script', () => {
    const out = injectPublishedMarker(`<head><title>x</title></head><body></body>`)
    expect(out).toContain(MARKER)
    expect(out.indexOf(MARKER)).toBeLessThan(out.indexOf('</head>'))
  })

  it('coexists with the kiosk redirect (single-story export)', () => {
    const html = `<head></head><script type="module" src="/assets/index.js"></script>`
    const out = injectPublishedMarker(injectKiosk(html, 'my-story'))
    expect(out).toContain(MARKER)
    expect(out).toContain(`#/story/my-story`)
  })
})

describe('kioskScript', () => {
  // Pinned literally: a story export's index.html must not change byte-for-byte
  // now that the function takes a second argument.
  it('emits the unchanged story redirect when no kind is given', () => {
    expect(kioskScript('my-story')).toBe(
      `<script>if(!location.hash){history.replaceState(null,'','#/story/my-story')}</script>`,
    )
  })

  it('targets the collection landing page for a collection export', () => {
    expect(kioskScript('my-site', 'collection')).toBe(
      `<script>if(!location.hash){history.replaceState(null,'','#/collection/my-site')}</script>`,
    )
  })

  it('treats an unrecognised kind as a story rather than emitting a broken route', () => {
    // @ts-expect-error — deliberately wrong, to pin the fallback
    expect(kioskScript('x', 'nonsense')).toContain('#/story/x')
  })

  it('only fires when there is no hash, so deep links survive', () => {
    expect(kioskScript('x', 'collection')).toContain('if(!location.hash)')
  })
})

describe('injectKiosk with a kind', () => {
  it('still precedes the app module script', () => {
    const html = `<head></head><script type="module" src="/assets/index.js"></script>`
    const out = injectKiosk(html, 'my-site', 'collection')
    expect(out.indexOf('#/collection/my-site')).toBeLessThan(out.indexOf('<script type="module"'))
  })
})

describe('orderCollectionIds', () => {
  it('keeps the author’s order, filtered to what exists', () => {
    const out = orderCollectionIds(['c', 'a', 'b'], ['a', 'b', 'c'])
    expect(out.ordered).toEqual(['c', 'a', 'b'])
    expect(out.missing).toEqual([])
    expect(out.extra).toEqual([])
  })

  it('reports ids the export does not carry, without dropping the rest', () => {
    const out = orderCollectionIds(['a', 'ghost', 'b'], ['a', 'b'])
    expect(out.ordered).toEqual(['a', 'b'])
    expect(out.missing).toEqual(['ghost'])
  })

  it('reports available stories the collection does not list', () => {
    expect(orderCollectionIds(['a'], ['a', 'spare']).extra).toEqual(['spare'])
  })

  it('de-duplicates, keeping the first mention', () => {
    expect(orderCollectionIds(['a', 'b', 'a'], ['a', 'b']).ordered).toEqual(['a', 'b'])
  })

  it('counts a duplicate of a missing id only once', () => {
    expect(orderCollectionIds(['ghost', 'ghost'], []).missing).toEqual(['ghost'])
  })

  it.each([undefined, []])('handles an empty or absent list (%s)', (ids) => {
    const out = orderCollectionIds(ids, ['a'])
    expect(out.ordered).toEqual([])
    expect(out.extra).toEqual(['a'])
  })
})

describe('collectionWarnings', () => {
  it('names each missing story and how to fix it', () => {
    const [w] = collectionWarnings(['ghost'])
    expect(w).toContain('ghost')
    expect(w).toContain('stories:')
  })

  it.each([undefined, []])('says nothing when nothing is missing (%s)', (missing) => {
    expect(collectionWarnings(missing)).toEqual([])
  })
})

describe('collectionIndexEntry', () => {
  it('builds the entry, prefixing the cover with the collection directory', () => {
    const out = collectionIndexEntry(
      { title: 'The High Street', subtitle: 'Somewhere' },
      'high-street',
      'assets/cover.jpg',
    )
    expect(out).toEqual({
      id: 'high-street',
      title: 'The High Street',
      subtitle: 'Somewhere',
      path: 'collections/high-street/collection.md',
      cover: 'collections/high-street/assets/cover.jpg',
    })
  })

  it('omits subtitle and cover when absent, rather than emitting empty strings', () => {
    expect(collectionIndexEntry({ title: 'T' }, 'c')).toEqual({
      id: 'c',
      title: 'T',
      path: 'collections/c/collection.md',
    })
  })

  it('falls back to the slug when there is no title', () => {
    expect(collectionIndexEntry({ title: '' }, 'c').title).toBe('c')
  })
})

describe('storiesIndexJson', () => {
  const entries = [indexEntry({ title: 'A' }, 'a')]

  it('omits the collections key entirely for a story-only export', () => {
    const out = storiesIndexJson(entries)
    expect('collections' in out).toBe(false)
    // Backward compatibility: byte-identical to what earlier versions wrote.
    expect(JSON.stringify(out)).toBe(JSON.stringify({ stories: entries }))
  })

  it.each([undefined, []])('also omits it for an empty collections value (%s)', (c) => {
    expect('collections' in storiesIndexJson(entries, c)).toBe(false)
  })

  it('adds collections as a sibling of stories, never inside it', () => {
    const c = [collectionIndexEntry({ title: 'C' }, 'c')]
    const out = storiesIndexJson(entries, c)
    expect(out.stories).toEqual(entries)
    expect(out.collections).toEqual(c)
    // The compatibility guarantee: an older reader does `.stories ?? []` and so
    // never sees the collection — it must not be spliced into the array.
    expect(out.stories.map((s) => s.id)).not.toContain('c')
  })
})
