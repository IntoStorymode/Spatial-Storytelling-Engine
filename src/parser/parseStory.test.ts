import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseStory } from './parseStory'
import { serializeStory } from './serializeStory'
import { resolveWaypoint } from './waypoints'

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

  it('captures ids, types, and waypoint refs in order', () => {
    const story = parseStory(raw, BASE)
    expect(story.items.map((i) => i.id)).toEqual(['item-01', 'item-02', 'item-03'])
    expect(story.items.map((i) => i.type)).toEqual(['text', 'image', 'audio'])
    expect(story.items.every((i) => i.waypoint)).toBe(true)
    expect(story.basePath).toBe(BASE)
  })

  it('defines named waypoints and resolves item references to cameras', () => {
    const story = parseStory(raw, BASE)
    const fm = story.frontmatter
    expect(fm.waypoints?.map((w) => w.name)).toEqual(['entrance-hall', 'composing-room', 'courtyard'])
    expect(fm.start).toBe('entrance-hall')
    // each item's ref resolves to a real waypoint camera
    for (const item of story.items) {
      expect(resolveWaypoint(fm, item.waypoint)).toBeDefined()
    }
    expect(resolveWaypoint(fm, story.items[0].waypoint)?.position).toEqual([0.5, 1.2, -2.1])
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

describe('story parser — named waypoints', () => {
  const md = [
    '---',
    'title: "x"',
    'model: "builtin:room"',
    'waypoints:',
    '  - name: "north"',
    '    position: [1, 2, 3]',
    '    target: [0, 0, 0]',
    '  - name: "south"',
    '    position: [4, 5, 6]',
    '    target: [0, 1, 0]',
    'start: north',
    '---',
    '',
    '## [a] A',
    'type: text',
    'waypoint: north',
    '',
    '---',
    '',
    '## [b] B',
    'type: text',
    'waypoint: north', // reused by another item
    '',
    '---',
    '',
    '## [c] C',
    'type: text', // no waypoint
  ].join('\n')

  it('parses the waypoint list and item references', () => {
    const story = parseStory(md, BASE)
    expect(story.warnings).toEqual([])
    expect(story.frontmatter.waypoints).toHaveLength(2)
    expect(story.items.map((i) => i.waypoint)).toEqual(['north', 'north', undefined])
  })

  it('lets several items share one waypoint (reuse)', () => {
    const story = parseStory(md, BASE)
    const a = resolveWaypoint(story.frontmatter, story.items[0].waypoint)
    const b = resolveWaypoint(story.frontmatter, story.items[1].waypoint)
    expect(a).toBeDefined()
    expect(a).toBe(b) // same underlying waypoint object
  })

  it('resolves start to its named waypoint', () => {
    const story = parseStory(md, BASE)
    expect(resolveWaypoint(story.frontmatter, story.frontmatter.start)?.position).toEqual([1, 2, 3])
  })

  it('round-trips the waypoint list + references', () => {
    const s1 = parseStory(md, BASE)
    const s2 = parseStory(serializeStory(s1), BASE)
    expect(s2.frontmatter).toEqual(s1.frontmatter)
    expect(s2.items).toEqual(s1.items)
    expect(s2.warnings).toEqual([])
  })

  it('warns on a dangling item reference', () => {
    const bad = '---\ntitle: "x"\n---\n\n## [a] A\ntype: text\nwaypoint: ghost\n'
    const story = parseStory(bad, BASE)
    expect(story.items[0].waypoint).toBe('ghost')
    expect(story.warnings.some((w) => w.includes('ghost'))).toBe(true)
  })

  it('warns on a duplicate waypoint name (keeps the first)', () => {
    const dup =
      '---\ntitle: "x"\nwaypoints:\n  - name: "n"\n    position: [1,2,3]\n    target: [0,0,0]\n  - name: "n"\n    position: [9,9,9]\n    target: [0,0,0]\n---\n\n## [a] A\ntype: text\n'
    const story = parseStory(dup, BASE)
    expect(story.frontmatter.waypoints).toHaveLength(1)
    expect(story.frontmatter.waypoints?.[0].position).toEqual([1, 2, 3])
    expect(story.warnings.some((w) => w.includes('duplicate'))).toBe(true)
  })

  it('warns on a malformed waypoint (wrong arity)', () => {
    const bad =
      '---\ntitle: "x"\nwaypoints:\n  - name: "n"\n    position: [1, 2]\n    target: [0, 0, 0]\n---\n\n## [a] A\ntype: text\n'
    const story = parseStory(bad, BASE)
    expect(story.frontmatter.waypoints).toBeUndefined()
    expect(story.warnings.some((w) => w.includes('position/target'))).toBe(true)
  })
})

describe('story parser — legacy inline cameras (back-compat)', () => {
  it('migrates an item hotspot into a synthesized named waypoint', () => {
    const legacy =
      '---\ntitle: "x"\n---\n\n## [a] A\n\ntype: text\n\nBody\n\nhotspot:\n  position: [1, 2, 3]\n  target: [4, 5, 6]\n'
    const story = parseStory(legacy, BASE)
    expect(story.warnings).toEqual([])
    expect(story.items[0].waypoint).toBe('a') // named after the item id
    expect(resolveWaypoint(story.frontmatter, 'a')?.position).toEqual([1, 2, 3])
  })

  it('migrates a legacy inline start camera into a "start" waypoint', () => {
    const legacy =
      '---\ntitle: "x"\nmodel: "builtin:room"\nstart:\n  position: [1, 2, 3]\n  target: [4, 5, 6]\n---\n\n## [a] A\ntype: text\n'
    const story = parseStory(legacy, BASE)
    expect(story.warnings).toEqual([])
    expect(story.frontmatter.start).toBe('start')
    expect(resolveWaypoint(story.frontmatter, 'start')?.target).toEqual([4, 5, 6])
  })

  it('serializes a migrated legacy file into the new format (no hotspot blocks)', () => {
    const legacy =
      '---\ntitle: "x"\n---\n\n## [a] A\n\ntype: text\n\nBody\n\nhotspot:\n  position: [1, 2, 3]\n  target: [4, 5, 6]\n'
    const out = serializeStory(parseStory(legacy, BASE))
    expect(out).toContain('waypoints:')
    expect(out).toContain('waypoint: a')
    expect(out).not.toContain('hotspot:')
    // and it re-parses cleanly + idempotently
    expect(parseStory(out, BASE).warnings).toEqual([])
  })

  it('flags a malformed legacy hotspot (wrong arity) as a warning', () => {
    const md =
      '---\ntitle: "x"\n---\n\n## [a] A\n\ntype: text\n\nBody\n\nhotspot:\n  position: [1, 2]\n  target: [0, 0, 0]\n'
    const story = parseStory(md, BASE)
    expect(story.items[0].waypoint).toBeUndefined()
    expect(story.warnings.some((w) => w.includes('position/target'))).toBe(true)
  })
})

describe('story parser — resilience', () => {
  it('warns instead of throwing on a block with no heading', () => {
    const story = parseStory('---\ntitle: "x"\n---\n\nnot an item block\n', BASE)
    expect(story.items).toHaveLength(0)
    expect(story.warnings.length).toBeGreaterThan(0)
  })

  it('parses an item with no waypoint', () => {
    const md = '---\ntitle: "x"\n---\n\n## [a] A\n\ntype: text\n\nHello world\n'
    const story = parseStory(md, BASE)
    expect(story.items).toHaveLength(1)
    expect(story.items[0].waypoint).toBeUndefined()
    expect(story.items[0].body).toBe('Hello world')
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
