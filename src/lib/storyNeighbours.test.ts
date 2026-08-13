import { describe, expect, it } from 'vitest'
import { storyNeighbours } from './storyNeighbours'

const index = [
  { id: 'a', title: 'Alpha' },
  { id: 'b', title: 'Bravo' },
  { id: 'c', title: 'Charlie' },
]

describe('storyNeighbours', () => {
  it('gives both neighbours for a middle story', () => {
    expect(storyNeighbours(index, 'b')).toEqual({
      prev: { id: 'a', title: 'Alpha' },
      next: { id: 'c', title: 'Charlie' },
    })
  })

  it('has no previous at the first story, no next at the last (no wrap)', () => {
    expect(storyNeighbours(index, 'a').prev).toBeNull()
    expect(storyNeighbours(index, 'a').next).toEqual({ id: 'b', title: 'Bravo' })
    expect(storyNeighbours(index, 'c').next).toBeNull()
    expect(storyNeighbours(index, 'c').prev).toEqual({ id: 'b', title: 'Bravo' })
  })

  it('gives no neighbours for a single-entry index (kiosk export)', () => {
    expect(storyNeighbours([{ id: 'solo', title: 'Solo' }], 'solo')).toEqual({
      prev: null,
      next: null,
    })
  })

  it('gives no neighbours when the id is absent or undefined', () => {
    expect(storyNeighbours(index, 'missing')).toEqual({ prev: null, next: null })
    expect(storyNeighbours(index, undefined)).toEqual({ prev: null, next: null })
    expect(storyNeighbours([], 'a')).toEqual({ prev: null, next: null })
  })

  it('follows the index array order, not any sort', () => {
    // Deliberately non-alphabetical: "next" must be the array successor, so it
    // matches what the reader saw in the (unsorted) gallery.
    const unsorted = [
      { id: 'z', title: 'Zulu' },
      { id: 'm', title: 'Mike' },
      { id: 'a', title: 'Alpha' },
    ]
    expect(storyNeighbours(unsorted, 'z').next).toEqual({ id: 'm', title: 'Mike' })
    expect(storyNeighbours(unsorted, 'm').next).toEqual({ id: 'a', title: 'Alpha' })
  })
})
