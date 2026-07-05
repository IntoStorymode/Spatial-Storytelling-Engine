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

describe('story parser — start view', () => {
  const withStart =
    '---\ntitle: "x"\nmodel: "builtin:room"\nstart:\n  position: [1, 2, 3]\n  target: [4, 5, 6]\n---\n\n## [a] A\n\ntype: text\n\nBody\n'

  it('parses a frontmatter start camera', () => {
    const story = parseStory(withStart, BASE)
    expect(story.warnings).toEqual([])
    expect(story.frontmatter.start).toEqual({ position: [1, 2, 3], target: [4, 5, 6] })
  })

  it('omits start when absent', () => {
    const story = parseStory('---\ntitle: "x"\n---\n\n## [a] A\n\ntype: text\n\nBody\n', BASE)
    expect(story.frontmatter.start).toBeUndefined()
  })

  it('round-trips a story with a start camera', () => {
    const s1 = parseStory(withStart, BASE)
    const s2 = parseStory(serializeStory(s1), BASE)
    expect(s2.frontmatter).toEqual(s1.frontmatter)
    expect(s2.warnings).toEqual([])
  })

  it('warns on a malformed start camera', () => {
    const md = '---\ntitle: "x"\nstart:\n  position: [1, 2]\n  target: [4, 5, 6]\n---\n\n## [a] A\n\ntype: text\n\nBody\n'
    const story = parseStory(md, BASE)
    expect(story.frontmatter.start).toBeUndefined()
    expect(story.warnings.some((w) => w.includes('start'))).toBe(true)
  })
})

describe('story parser — reader navigation', () => {
  const withNav =
    '---\ntitle: "x"\nmodel: "builtin:room"\nnavigation: "firstPerson"\n---\n\n## [a] A\n\ntype: text\n\nBody\n'

  it('parses a firstPerson navigation default', () => {
    const story = parseStory(withNav, BASE)
    expect(story.warnings).toEqual([])
    expect(story.frontmatter.navigation).toBe('firstPerson')
  })

  it('omits navigation when absent (defaults to orbit at read time)', () => {
    const story = parseStory('---\ntitle: "x"\n---\n\n## [a] A\n\ntype: text\n\nBody\n', BASE)
    expect(story.frontmatter.navigation).toBeUndefined()
  })

  it('round-trips a story with a navigation default', () => {
    const s1 = parseStory(withNav, BASE)
    const s2 = parseStory(serializeStory(s1), BASE)
    expect(s2.frontmatter).toEqual(s1.frontmatter)
    expect(s2.warnings).toEqual([])
  })

  it('warns on an unknown navigation value', () => {
    const md = '---\ntitle: "x"\nnavigation: "flythrough"\n---\n\n## [a] A\n\ntype: text\n\nBody\n'
    const story = parseStory(md, BASE)
    expect(story.frontmatter.navigation).toBeUndefined()
    expect(story.warnings.some((w) => w.includes('navigation'))).toBe(true)
  })
})

describe('story parser — model orientation override', () => {
  const withFlip =
    '---\ntitle: "x"\nmodel: "assets/scene.splat"\norientation: "flip"\n---\n\n## [a] A\n\ntype: text\n\nBody\n'

  it('parses a flip orientation override', () => {
    const story = parseStory(withFlip, BASE)
    expect(story.warnings).toEqual([])
    expect(story.frontmatter.orientation).toBe('flip')
  })

  it('parses a none orientation override', () => {
    const md = '---\ntitle: "x"\norientation: "none"\n---\n\n## [a] A\n\ntype: text\n\nBody\n'
    expect(parseStory(md, BASE).frontmatter.orientation).toBe('none')
  })

  it('omits orientation when absent (auto correction at load time)', () => {
    const story = parseStory('---\ntitle: "x"\n---\n\n## [a] A\n\ntype: text\n\nBody\n', BASE)
    expect(story.frontmatter.orientation).toBeUndefined()
  })

  it('round-trips a story with an orientation override', () => {
    const s1 = parseStory(withFlip, BASE)
    const s2 = parseStory(serializeStory(s1), BASE)
    expect(s2.frontmatter).toEqual(s1.frontmatter)
    expect(s2.warnings).toEqual([])
  })

  it('warns on an unknown orientation value', () => {
    const md = '---\ntitle: "x"\norientation: "sideways"\n---\n\n## [a] A\n\ntype: text\n\nBody\n'
    const story = parseStory(md, BASE)
    expect(story.frontmatter.orientation).toBeUndefined()
    expect(story.warnings.some((w) => w.includes('orientation'))).toBe(true)
  })
})
