import { describe, it, expect } from 'vitest'
import { moveInList } from './reorder'

describe('moveInList', () => {
  it('moves an item up', () => {
    expect(moveInList(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
  })

  it('moves an item down', () => {
    expect(moveInList(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
  })

  it('is a no-op at the top', () => {
    expect(moveInList(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })

  it('is a no-op at the bottom', () => {
    expect(moveInList(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })

  it('is a no-op for an index outside the list', () => {
    expect(moveInList(['a'], 5, -1)).toEqual(['a'])
    expect(moveInList(['a'], -1, 1)).toEqual(['a'])
  })

  it('does not mutate the input', () => {
    const input = ['a', 'b', 'c']
    moveInList(input, 0, 1)
    expect(input).toEqual(['a', 'b', 'c'])
  })

  it('returns the same array reference on a no-op, a new one on a move', () => {
    const input = ['a', 'b']
    expect(moveInList(input, 0, -1)).toBe(input)
    expect(moveInList(input, 0, 1)).not.toBe(input)
  })

  it('handles a single-item and an empty list', () => {
    expect(moveInList(['only'], 0, 1)).toEqual(['only'])
    expect(moveInList([], 0, 1)).toEqual([])
  })
})
