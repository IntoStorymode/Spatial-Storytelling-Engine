import { describe, it, expect } from 'vitest'
import type { Section, Waypoint } from './types'
import {
  resolveWaypoint,
  upsertWaypoint,
  pruneWaypoint,
  countUsage,
  renameWaypoint,
  deleteWaypoint,
  nextWaypointName,
} from './waypoints'

const wp = (name: string, p: number): Waypoint => ({ name, position: [p, p, p], target: [0, 0, 0] })
const sec = (id: string, waypoint?: string): Section => ({ id, title: id, type: 'text', body: '', waypoint })

describe('resolveWaypoint', () => {
  const fm = { waypoints: [wp('a', 1), wp('b', 2)] }

  it('resolves a name to its waypoint', () => {
    expect(resolveWaypoint(fm, 'b')?.position).toEqual([2, 2, 2])
  })

  it('returns undefined for an unknown name, undefined name, or empty list', () => {
    expect(resolveWaypoint(fm, 'ghost')).toBeUndefined()
    expect(resolveWaypoint(fm, undefined)).toBeUndefined()
    expect(resolveWaypoint({ waypoints: undefined }, 'a')).toBeUndefined()
  })
})

describe('upsertWaypoint', () => {
  it('appends a new named waypoint', () => {
    const next = upsertWaypoint([wp('a', 1)], 'b', { position: [2, 2, 2], target: [0, 0, 0] })
    expect(next.map((w) => w.name)).toEqual(['a', 'b'])
  })

  it('replaces an existing name in place (no duplicate)', () => {
    const next = upsertWaypoint([wp('a', 1)], 'a', { position: [9, 9, 9], target: [1, 1, 1] })
    expect(next).toHaveLength(1)
    expect(next[0]).toEqual({ name: 'a', position: [9, 9, 9], target: [1, 1, 1] })
  })

  it('starts from an empty list when waypoints is undefined', () => {
    expect(upsertWaypoint(undefined, 'a', { position: [1, 1, 1], target: [0, 0, 0] })).toHaveLength(1)
  })
})

describe('pruneWaypoint', () => {
  it('drops an unreferenced waypoint', () => {
    expect(pruneWaypoint([wp('a', 1), wp('b', 2)], 'a', false)?.map((w) => w.name)).toEqual(['b'])
  })

  it('keeps a still-referenced waypoint', () => {
    expect(pruneWaypoint([wp('a', 1)], 'a', true)?.map((w) => w.name)).toEqual(['a'])
  })

  it('returns undefined when the list empties', () => {
    expect(pruneWaypoint([wp('a', 1)], 'a', false)).toBeUndefined()
  })
})

describe('countUsage', () => {
  it('counts sections referencing a waypoint', () => {
    const sections = [sec('s1', 'a'), sec('s2', 'a'), sec('s3', 'b'), sec('s4')]
    expect(countUsage(sections, 'a')).toBe(2)
    expect(countUsage(sections, 'b')).toBe(1)
    expect(countUsage(sections, 'ghost')).toBe(0)
  })
})

describe('renameWaypoint', () => {
  it('renames the waypoint and rewrites every section reference', () => {
    const waypoints = [wp('a', 1), wp('b', 2)]
    const sections = [sec('s1', 'a'), sec('s2', 'a'), sec('s3', 'b')]
    const out = renameWaypoint(waypoints, sections, 'a', 'entrance')
    expect(out.waypoints.map((w) => w.name)).toEqual(['entrance', 'b'])
    expect(out.sections.map((s) => s.waypoint)).toEqual(['entrance', 'entrance', 'b'])
  })
})

describe('deleteWaypoint', () => {
  it('removes the waypoint and unsets referencing sections', () => {
    const waypoints = [wp('a', 1), wp('b', 2)]
    const sections = [sec('s1', 'a'), sec('s2', 'b'), sec('s3', 'a')]
    const out = deleteWaypoint(waypoints, sections, 'a')
    expect(out.waypoints?.map((w) => w.name)).toEqual(['b'])
    expect(out.sections.map((s) => s.waypoint)).toEqual([undefined, 'b', undefined])
  })

  it('returns undefined waypoints when the last one is deleted', () => {
    const out = deleteWaypoint([wp('a', 1)], [sec('s1', 'a')], 'a')
    expect(out.waypoints).toBeUndefined()
    expect(out.sections[0].waypoint).toBeUndefined()
  })
})

describe('nextWaypointName', () => {
  it('picks the first free view-N name', () => {
    expect(nextWaypointName(undefined)).toBe('view-1')
    expect(nextWaypointName([wp('view-1', 1)])).toBe('view-2')
    // skips a taken slot at the natural index
    expect(nextWaypointName([wp('x', 1), wp('view-2', 2)])).toBe('view-3')
  })
})
