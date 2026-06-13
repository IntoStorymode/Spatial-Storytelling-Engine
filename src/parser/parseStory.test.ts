import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseStory } from './parseStory'
import { serializeStory } from './serializeStory'

const BASE = '/stories/demo/'
const demoPath = join(process.cwd(), 'public/stories/demo/story.md')
const raw = readFileSync(demoPath, 'utf-8')

describe('story parser — demo story', () => {
  it('parses cleanly with no warnings', () => {
    const story = parseStory(raw, BASE)
    expect(story.warnings).toEqual([])
    expect(story.frontmatter.title).toBeTruthy()
    expect(story.frontmatter.model).toBeTruthy()
    expect(story.items).toHaveLength(3)
  })

  it('captures ids, types, and hotspots in order', () => {
    const story = parseStory(raw, BASE)
    expect(story.items.map((i) => i.id)).toEqual(['item-01', 'item-02', 'item-03'])
    expect(story.items.map((i) => i.type)).toEqual(['text', 'image', 'audio'])
    expect(story.items.every((i) => i.hotspot)).toBe(true)
    expect(story.basePath).toBe(BASE)
  })

  it('keeps src verbatim (not pre-resolved against basePath)', () => {
    const story = parseStory(raw, BASE)
    expect(story.items[1].src).toBe('assets/entrance.svg')
    expect(story.items[2].src).toBe('assets/narration.wav')
  })

  it('round-trips: parse → serialize → parse is idempotent', () => {
    const s1 = parseStory(raw, BASE)
    const s2 = parseStory(serializeStory(s1), BASE)
    expect(s2.frontmatter).toEqual(s1.frontmatter)
    expect(s2.items).toEqual(s1.items)
    expect(s2.warnings).toEqual([])
  })
})

describe('story parser — resilience', () => {
  it('warns instead of throwing on a block with no heading', () => {
    const story = parseStory('---\ntitle: "x"\n---\n\nnot an item block\n', BASE)
    expect(story.items).toHaveLength(0)
    expect(story.warnings.length).toBeGreaterThan(0)
  })

  it('parses an item with no hotspot', () => {
    const md = '---\ntitle: "x"\n---\n\n## [a] A\n\ntype: text\n\nHello world\n'
    const story = parseStory(md, BASE)
    expect(story.items).toHaveLength(1)
    expect(story.items[0].hotspot).toBeUndefined()
    expect(story.items[0].body).toBe('Hello world')
  })

  it('flags a malformed hotspot (wrong arity) as a warning', () => {
    const md =
      '---\ntitle: "x"\n---\n\n## [a] A\n\ntype: text\n\nBody\n\nhotspot:\n  position: [1, 2]\n  target: [0, 0, 0]\n'
    const story = parseStory(md, BASE)
    expect(story.items[0].hotspot).toBeUndefined()
    expect(story.warnings.some((w) => w.includes('position/target'))).toBe(true)
  })
})
