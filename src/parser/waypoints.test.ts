import { describe, it, expect } from 'vitest'
import type { Waypoint } from './types'
import { resolveWaypoint, upsertWaypoint, pruneWaypoint } from './waypoints'

const wp = (name: string, p: number): Waypoint => ({ name, position: [p, p, p], target: [0, 0, 0] })

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
