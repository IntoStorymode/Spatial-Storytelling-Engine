import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import JSZip from 'jszip'
import { buildSiteZip, type ExportStory, type ExportCollection } from './buildSite'
import type { Collection, Story } from '../parser/types'

/**
 * buildSiteZip is the in-browser twin of scripts/publish-site.mjs. It fetches the
 * built app shell, so these tests stub `fetch` with a two-file shell.
 *
 * The CLI half is exercised by actually running `npm run publish:site`; this half
 * has no such path (it needs a browser), so the collection branch is covered here
 * to keep the two from drifting.
 *
 * Two environment notes, which are why this file did not exist before:
 * - `fetch` is stubbed (there is no running app to fetch a shell from).
 * - **JSZip cannot read a `File`/`Blob` under Node** — it reads them through
 *   `FileReader`, which Node has no equivalent of, so `generateAsync` throws.
 *   Browsers have it, which is how asset bundling has always worked in
 *   production. So asset entries here carry a `Uint8Array` cast to `File`: that
 *   still exercises the path-prefixing and dedup logic, which is the part worth
 *   pinning, without needing a DOM.
 */

/** A stand-in for an uploaded File that JSZip can actually read under Node. */
function fakeUpload(name: string): File {
  const u = new Uint8Array([1, 2, 3]) as unknown as File
  Object.defineProperty(u, 'name', { value: name })
  return u
}

const SHELL = {
  'index.html': '<head></head><script type="module" src="/assets/main.js"></script>',
  'assets/main.js': 'console.log(1)',
}

const manifest = { files: ['index.html', 'assets/main.js'] }

beforeEach(() => {
  vi.stubGlobal('fetch', async (url: string) => {
    const body = SHELL[url as keyof typeof SHELL]
    if (body === undefined) return { ok: false, status: 404 } as Response
    return {
      ok: true,
      status: 200,
      text: async () => body,
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    } as unknown as Response
  })
})

afterEach(() => vi.unstubAllGlobals())

const story = (slug: string, title: string): ExportStory => ({
  slug,
  story: {
    frontmatter: { title, author: 'A', location: 'L', date: '2026-01-01', model: 'builtin:room' },
    sections: [{ id: 'item-01', title: 'S', type: 'text', body: 'Body', waypoint: undefined }],
    basePath: '',
    warnings: [],
  } as Story,
  assets: [],
})

const collection = (stories: string[], cover?: string): ExportCollection => ({
  slug: 'my-site',
  collection: {
    title: 'My Site',
    subtitle: 'Somewhere',
    ...(cover ? { cover } : {}),
    stories,
    body: 'Background prose.',
    basePath: '',
    warnings: [],
  } as Collection,
  assets: cover ? [{ path: cover, file: fakeUpload('cover.jpg') }] : [],
})

/** The zip's file list and a reader for one entry's text. */
async function read(blob: Blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort()
  return { names, text: (n: string) => zip.files[n].async('string') }
}

describe('buildSiteZip — stories only (unchanged behaviour)', () => {
  it('gives a single story a kiosk redirect and a <slug>-site folder', async () => {
    const out = await buildSiteZip({ stories: [story('a', 'A')], manifest })
    expect(out.fileName).toBe('a-site.zip')
    const { names, text } = await read(out.blob)
    expect(names).toContain('a-site/index.html')
    expect(await text('a-site/index.html')).toContain('#/story/a')
  })

  it('gives several stories no redirect and a gallery-site folder', async () => {
    const out = await buildSiteZip({ stories: [story('a', 'A'), story('b', 'B')], manifest })
    expect(out.fileName).toBe('gallery-site.zip')
    const { text } = await read(out.blob)
    expect(await text('gallery-site/index.html')).not.toContain('replaceState')
  })

  it('writes an index.json with no collections key', async () => {
    const out = await buildSiteZip({ stories: [story('a', 'A')], manifest })
    const { text } = await read(out.blob)
    const idx = JSON.parse(await text('a-site/stories/index.json'))
    expect('collections' in idx).toBe(false)
    expect(idx.stories.map((s: { id: string }) => s.id)).toEqual(['a'])
  })

  it('throws when nothing was selected', async () => {
    await expect(buildSiteZip({ stories: [], manifest })).rejects.toThrow('no stories selected')
  })
})

describe('buildSiteZip — collection export', () => {
  it('names the zip after the collection', async () => {
    const out = await buildSiteZip({
      stories: [story('a', 'A'), story('b', 'B')],
      collection: collection(['a', 'b']),
      manifest,
    })
    expect(out.fileName).toBe('my-site-site.zip')
  })

  it('injects NO redirect — the root renders the landing page directly', async () => {
    // Home resolves to the collection on a published site, so the reader's URL
    // stays a clean `/` with no redirect flash and no duplicate story listing
    // behind the front door.
    const out = await buildSiteZip({
      stories: [story('a', 'A')],
      collection: collection(['a']),
      manifest,
    })
    const { text } = await read(out.blob)
    const html = await text('my-site-site/index.html')
    expect(html).not.toContain('replaceState')
    expect(html).not.toContain('#/collection/')
    // …but it is still marked published, so the hosted site is read-only.
    expect(html).toContain('window.__SSP_PUBLISHED__=true')
  })

  it('writes the collection.md in its own directory, not the site root', async () => {
    const out = await buildSiteZip({
      stories: [story('a', 'A')],
      collection: collection(['a']),
      manifest,
    })
    const { names, text } = await read(out.blob)
    expect(names).toContain('my-site-site/collections/my-site/collection.md')
    const md = await text('my-site-site/collections/my-site/collection.md')
    expect(md).toContain('type: collection')
    expect(md).toContain('Background prose.')
  })

  it('bundles an uploaded cover under the collection directory', async () => {
    const out = await buildSiteZip({
      stories: [story('a', 'A')],
      collection: collection(['a'], 'assets/cover.jpg'),
      manifest,
    })
    const { names } = await read(out.blob)
    expect(names).toContain('my-site-site/collections/my-site/assets/cover.jpg')
  })

  it('writes the index in the collection’s order, not the order given', async () => {
    // This ordering IS the prev/next mechanism: storyNeighbours walks index order.
    const out = await buildSiteZip({
      stories: [story('a', 'A'), story('b', 'B'), story('c', 'C')],
      collection: collection(['c', 'a', 'b']),
      manifest,
    })
    const { text } = await read(out.blob)
    const idx = JSON.parse(await text('my-site-site/stories/index.json'))
    expect(idx.stories.map((s: { id: string }) => s.id)).toEqual(['c', 'a', 'b'])
  })

  it('adds the collection as a sibling key, never into the stories array', async () => {
    const out = await buildSiteZip({
      stories: [story('a', 'A')],
      collection: collection(['a']),
      manifest,
    })
    const { text } = await read(out.blob)
    const idx = JSON.parse(await text('my-site-site/stories/index.json'))
    expect(idx.collections).toEqual([
      {
        id: 'my-site',
        title: 'My Site',
        subtitle: 'Somewhere',
        path: 'collections/my-site/collection.md',
      },
    ])
    expect(idx.stories.map((s: { id: string }) => s.id)).not.toContain('my-site')
  })

  it('drops a story the collection lists but the export lacks, and warns', async () => {
    const out = await buildSiteZip({
      stories: [story('a', 'A')],
      collection: collection(['a', 'ghost']),
      manifest,
    })
    const { text } = await read(out.blob)
    const idx = JSON.parse(await text('my-site-site/stories/index.json'))
    expect(idx.stories.map((s: { id: string }) => s.id)).toEqual(['a'])
    expect(out.warnings.some((w) => w.includes('ghost'))).toBe(true)
  })

  it('leaves out a selected story the collection does not list', async () => {
    const out = await buildSiteZip({
      stories: [story('a', 'A'), story('spare', 'Spare')],
      collection: collection(['a']),
      manifest,
    })
    const { names, text } = await read(out.blob)
    const idx = JSON.parse(await text('my-site-site/stories/index.json'))
    expect(idx.stories.map((s: { id: string }) => s.id)).toEqual(['a'])
    expect(names).not.toContain('my-site-site/stories/spare/story.md')
  })

  it('throws rather than shipping an empty collection', async () => {
    await expect(
      buildSiteZip({ stories: [story('a', 'A')], collection: collection(['ghost']), manifest }),
    ).rejects.toThrow(/none of this collection/i)
  })

  it('titles DEPLOY.md after the collection', async () => {
    const out = await buildSiteZip({
      stories: [story('a', 'A')],
      collection: collection(['a']),
      manifest,
    })
    const { text } = await read(out.blob)
    expect(await text('DEPLOY.md')).toContain('My Site')
  })
})
