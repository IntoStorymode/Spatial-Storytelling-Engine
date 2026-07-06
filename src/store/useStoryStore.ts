import { create } from 'zustand'

export type ViewMode = 'page' | 'immersive'
export type NavMode = 'orbit' | 'firstPerson'

interface StoryUIState {
  /** Which presentation mode is showing. Default = page (Mode B). */
  mode: ViewMode
  /** Index of the active story section — shared by both modes so toggling preserves position. */
  activeIndex: number
  /** Whether the immersive auto-tour is running. */
  autoTour: boolean
  /** Number of sections in the loaded story (set by the viewer; bounds navigation). */
  sectionCount: number
  /**
   * Reader's current Mode A camera navigation. Seeded from the story's
   * `frontmatter.navigation` default on load, then toggleable live by the reader.
   */
  navMode: NavMode
  /**
   * True while an overlay video is playing. Pauses the auto-tour (so a video
   * isn't flown away mid-play) and lets the viewer quiesce its render loop so the
   * decoder/compositor aren't starved by the per-frame splat sort.
   */
  videoPlaying: boolean

  setMode: (mode: ViewMode) => void
  toggleMode: () => void
  setActiveIndex: (index: number) => void
  /** Advance/retreat one section, clamped (auto-tour wraps via `wrap`). */
  step: (delta: number, opts?: { wrap?: boolean }) => void
  setAutoTour: (on: boolean) => void
  toggleAutoTour: () => void
  setSectionCount: (n: number) => void
  setNavMode: (mode: NavMode) => void
  toggleNavMode: () => void
  setVideoPlaying: (playing: boolean) => void
  /** Reset UI state when a new story loads. */
  reset: () => void
}

/**
 * Global UI state for the viewer. The persistent ThreeViewer reacts to
 * `activeIndex`/`mode` changes; the nav controls and overlay write to them.
 * Keeping this in one store is what lets Mode A and Mode B stay in sync and
 * survive toggling without reloading the model.
 */
export const useStoryStore = create<StoryUIState>((set, get) => ({
  mode: 'page',
  activeIndex: 0,
  autoTour: false,
  sectionCount: 0,
  navMode: 'orbit',
  videoPlaying: false,

  setMode: (mode) => set({ mode, autoTour: mode === 'page' ? false : get().autoTour }),
  toggleMode: () => get().setMode(get().mode === 'page' ? 'immersive' : 'page'),

  setActiveIndex: (index) => {
    const max = Math.max(0, get().sectionCount - 1)
    // Leaving the section unmounts its video without a reliable pause event, so
    // clear the flag here to release the auto-tour / render-loop hold.
    set({ activeIndex: Math.min(Math.max(index, 0), max), videoPlaying: false })
  },

  step: (delta, opts) => {
    const { activeIndex, sectionCount } = get()
    if (sectionCount === 0) return
    let next = activeIndex + delta
    if (opts?.wrap) next = (next + sectionCount) % sectionCount
    else next = Math.min(Math.max(next, 0), sectionCount - 1)
    set({ activeIndex: next, videoPlaying: false })
  },

  setAutoTour: (on) => set({ autoTour: on }),
  toggleAutoTour: () => set({ autoTour: !get().autoTour }),
  setSectionCount: (n) => set({ sectionCount: n }),
  setNavMode: (mode) => set({ navMode: mode }),
  toggleNavMode: () => set({ navMode: get().navMode === 'orbit' ? 'firstPerson' : 'orbit' }),
  setVideoPlaying: (playing) => set({ videoPlaying: playing }),
  // NB: navMode is intentionally NOT reset here — it's seeded per-story from
  // `frontmatter.navigation` by ViewerStage. Resetting it would clobber that seed
  // (a parent route's reset() runs after the child ViewerStage seed effect).
  reset: () => set({ mode: 'page', activeIndex: 0, autoTour: false, videoPlaying: false }),
}))
