import { describe, it, expect } from 'vitest'
import { importSite, findStoryDirs, isIgnorable, normalizePath, type Bundle } from './importSite'
import { uniqueSlug, toSlug, suggestSlug } from './slug'
import { collectAssets } from './collectAssets'
import { validateStory } from './validateStory'
import { serializeStory } from '../parser/serializeStory'

const enc = new TextEncoder()
const e = (path: string, body = 'x'): Bundle[number] => ({
  path,
  read: async () => enc.encode(body),
})

const MODERN = `---
title: "The Old Print Works"
author: "Demo Author"
location: "Cradley Heath"
date: "2026-06-01"
model: "assets/cube.gltf"
waypoints:
  - name: "entrance-hall"
    position: [0.5, 1.2, -2.1]
    target: [0, 1, 0]
---

## [item-01] The entrance hall

type: image
src: assets/entrance.svg
waypoint: entrance-hall

Body.

---

## [item-02] Narration

type: audio
src: assets/narration.wav

Body.
`

/** An export from before named waypoints: inline `start:` + per-section `hotspot:` cameras. */
const LEGACY = `---
title: "Old Story"
author: "A"
location: "L"
date: "2025-01-01"
model: "assets/scan.glb"
start:
  position: [1, 2, 3]
  target: [0, 0, 0]
---

## [item-01] First

type: text

Body.

hotspot:
  position: [4, 5, 6]
  target: [0, 1, 0]
`

/** The layout buildSite.ts really produces (verified against the committed demo-site.zip). */
function siteBundle(prefix = 'demo-site/'): Bundle {
  return [
    e('DEPLOY.md'),
    e(`${prefix}`), // zip directory entry
    e(`${prefix}.DS_Store`),
    e(`${prefix}index.html`),
    e(`${prefix}assets/index-dEVBebuN.js`),
    e(`${prefix}assets/index-C3VLUJva.css`),
    e(`${prefix}placeholder-missing.svg`),
    e(`${prefix}stories/index.json`, '{"stories":[]}'),
    e(`${prefix}stories/demo/story.md`, MODERN),
    e(`${prefix}stories/demo/assets/cube.gltf`),
    e(`${prefix}stories/demo/assets/entrance.svg`),
    e(`${prefix}stories/demo/assets/narration.wav`),
  ]
}

describe('importSite', () => {
  it('reads a story, its model and its media out of an exported site', async () => {
    const { stories, warnings } = await importSite(siteBundle())
    expect(warnings).toEqual([])
    expect(stories).toHaveLength(1)

    const s = stories[0]
    expect(s.slug).toBe('demo')
    expect(s.story.basePath).toBe('')
    expect(s.story.frontmatter.title).toBe('The Old Print Works')
    expect(s.model).toMatchObject({ path: 'assets/cube.gltf', format: 'gltf' })
    expect(s.model!.file).toBeInstanceOf(File)
    expect(Object.keys(s.media).sort()).toEqual(['assets/entrance.svg', 'assets/narration.wav'])
    expect(s.warnings).toEqual([])
  })

  it('never pulls the app shell into a story (it lives outside the story folder)', async () => {
    const [s] = (await importSite(siteBundle())).stories
    const names = Object.keys(s.media).join()
    expect(names).not.toMatch(/index\.html|index-.*\.js|placeholder-missing/)
  })

  it.each(['', 'demo-site/', 'Downloads/demo-site/'])(
    'finds the story regardless of how deep the pick was (%s)',
    async (prefix) => {
      const { stories } = await importSite(siteBundle(prefix))
      expect(stories).toHaveLength(1)
      expect(stories[0].slug).toBe('demo')
      expect(stories[0].model?.path).toBe('assets/cube.gltf')
    },
  )

  it('imports without stories/index.json (it may be stale — story.md is authoritative)', async () => {
    const bundle = siteBundle().filter((x) => !x.path.endsWith('index.json'))
    const { stories } = await importSite(bundle)
    expect(stories.map((s) => s.slug)).toEqual(['demo'])
  })

  it('upgrades a legacy export: inline start/hotspot cameras become named waypoints', async () => {
    const { stories } = await importSite([
      e('old-site/stories/old/story.md', LEGACY),
      e('old-site/stories/old/assets/scan.glb'),
    ])
    const { frontmatter: fm, sections } = stories[0].story

    expect(fm.waypoints?.map((w) => w.name)).toEqual(['start', 'item-01'])
    expect(fm.start).toBe('start')
    expect(sections[0].waypoint).toBe('item-01')
    expect(stories[0].model?.format).toBe('glb')

    // …and re-exporting writes the modern format, not the one it came in as.
    const out = serializeStory(stories[0].story)
    expect(out).toContain('waypoints:')
    expect(out).not.toContain('hotspot:')
  })

  it('warns about references whose bytes were never bundled (author typed the path)', async () => {
    const md = MODERN.replace('assets/cube.gltf', 'assets/typed.glb').replace(
      'assets/entrance.svg',
      'assets/typed.jpg',
    )
    const { stories } = await importSite([
      e('s/stories/demo/story.md', md),
      e('s/stories/demo/assets/narration.wav'),
    ])
    expect(stories[0].model).toBeNull()
    expect(stories[0].media['assets/typed.jpg']).toBeUndefined()
    expect(stories[0].warnings.join('\n')).toContain('assets/typed.glb')
    expect(stories[0].warnings.join('\n')).toContain('assets/typed.jpg')
  })

  it('treats a builtin: model as expected, not as a missing asset', async () => {
    const md = MODERN.replace('assets/cube.gltf', 'builtin:room')
    const { stories } = await importSite([
      e('s/stories/demo/story.md', md),
      e('s/stories/demo/assets/entrance.svg'),
      e('s/stories/demo/assets/narration.wav'),
    ])
    expect(stories[0].model).toBeNull()
    expect(stories[0].warnings).toEqual([])
  })

  it('ignores archive and OS cruft', async () => {
    const { stories } = await importSite([
      ...siteBundle(),
      e('__MACOSX/demo-site/stories/demo/assets/._entrance.svg'),
      e('demo-site/stories/demo/assets/._narration.wav'),
    ])
    for (const f of Object.values(stories[0].media)) expect(f.name).not.toMatch(/^\._/)
  })

  it('imports every story in a multi-story gallery export', async () => {
    const { stories } = await importSite([
      e('gallery-site/index.html'),
      e('gallery-site/stories/one/story.md', MODERN),
      e('gallery-site/stories/two/story.md', MODERN),
      e('gallery-site/stories/two/assets/cube.gltf'),
    ])
    expect(stories.map((s) => s.slug)).toEqual(['one', 'two'])
    expect(stories[0].model).toBeNull() // "one" shipped no assets
    expect(stories[1].model?.path).toBe('assets/cube.gltf')
  })

  it('never overwrites a slug already in the gallery', async () => {
    const { stories } = await importSite(siteBundle(), { takenSlugs: ['demo', 'demo-2'] })
    expect(stories[0].slug).toBe('demo-3')
  })

  it('re-exports the same asset set it came in with', async () => {
    const [s] = (await importSite(siteBundle())).stories
    const uploads = Object.fromEntries(Object.entries(s.media).map(([p, f]) => [p, { file: f }]))
    const out = collectAssets(s.story.frontmatter, s.story.sections, s.model, uploads)
    expect(out.map((a) => a.path)).toEqual([
      'assets/cube.gltf',
      'assets/entrance.svg',
      'assets/narration.wav',
    ])
  })

  it('warns rather than throws when the bundle holds no story', async () => {
    const { stories, warnings } = await importSite([e('notes.txt'), e('photo.jpg')])
    expect(stories).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('No story.md')
  })
})

describe('import path helpers', () => {
  it('normalizes separators, doubled slashes and leading ./', () => {
    expect(normalizePath('.\\a\\\\b/c.md')).toBe('a/b/c.md')
    expect(normalizePath('/a/b.md')).toBe('a/b.md')
  })

  it('flags directory entries and cruft', () => {
    expect(isIgnorable('demo-site/stories/')).toBe(true)
    expect(isIgnorable('demo-site/.DS_Store')).toBe(true)
    expect(isIgnorable('__MACOSX/x.jpg')).toBe(true)
    expect(isIgnorable('../etc/passwd')).toBe(true)
    expect(isIgnorable('demo-site/stories/demo/story.md')).toBe(false)
  })

  it('scopes each story to its own folder', () => {
    expect(findStoryDirs(['a/stories/x/story.md', 'a/stories/x/assets/y.jpg'])).toEqual([
      { dir: 'a/stories/x/', name: 'x' },
    ])
  })
})

describe('uniqueSlug', () => {
  it('suffixes rather than collides', () => {
    expect(uniqueSlug('Demo', [])).toBe('demo')
    expect(uniqueSlug('demo', ['demo'])).toBe('demo-2')
    expect(uniqueSlug('demo', ['demo', 'demo-2'])).toBe('demo-3')
  })
})

describe('toSlug', () => {
  it('builds an ASCII folder name from a Latin title', () => {
    expect(toSlug('The Old Print Works')).toBe('the-old-print-works')
  })

  it('yields nothing for a title with no Latin letters, rather than a generic name', () => {
    // Every CJK title used to collapse to "story", so two of them silently collided.
    expect(toSlug('土瓜灣德順大廈')).toBe('')
    expect(toSlug('香港')).toBe('')
    expect(suggestSlug('2026-07-13')).toBe('story-2026-07-13')
  })
})

describe('validateStory', () => {
  const story = () => ({
    frontmatter: {
      title: '土瓜灣德順大廈',
      author: 'A',
      location: 'L',
      date: '2026-07-13',
      model: 'assets/scan.glb',
      waypoints: [{ name: 'w', position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number] }],
    },
    sections: [{ id: 'item-01', title: 'T', type: 'text' as const, body: '', waypoint: 'w' }],
    basePath: '',
    warnings: [],
  })

  it('blocks saving a story whose title gives no export name, and suggests one', () => {
    const issues = validateStory(story(), '')
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain('export name')
    expect(issues[0]).toContain('story-2026-07-13')
  })

  it('is satisfied once the author names the export', () => {
    expect(validateStory(story(), 'tokwawan-tak-shun')).toEqual([])
  })
})
