import { describe, it, expect, beforeEach } from 'vitest'
import { useStoryStore } from './useStoryStore'

describe('useStoryStore.arrive', () => {
  beforeEach(() =>
    useStoryStore.setState({
      mode: 'immersive',
      activeIndex: 3,
      autoTour: true,
      videoPlaying: true,
    }),
  )

  it('keeps the reader in immersive on travel (keepMode: true)', () => {
    // The whole point of the story-travel fix: an immersive reader who moves to
    // the next story stays immersive, not kicked back to the page view.
    useStoryStore.getState().arrive(true)
    const s = useStoryStore.getState()
    expect(s.mode).toBe('immersive')
    expect(s.activeIndex).toBe(0)
    expect(s.autoTour).toBe(false)
    expect(s.videoPlaying).toBe(false)
  })

  it('opens in page mode on a fresh entry (keepMode: false)', () => {
    useStoryStore.getState().arrive(false)
    const s = useStoryStore.getState()
    expect(s.mode).toBe('page')
    expect(s.activeIndex).toBe(0)
    expect(s.autoTour).toBe(false)
  })
})
