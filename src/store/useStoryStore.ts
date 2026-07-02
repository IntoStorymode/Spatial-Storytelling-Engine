import { create } from 'zustand'

export type ViewMode = 'page' | 'immersive'
export type NavMode = 'orbit' | 'firstPerson'

interface StoryUIState {
  /** Which presentation mode is showing. Default = page (Mode B). */
  mode: ViewMode
  /** Index of the active story item — shared by both modes so toggling preserves position. */
  activeIndex: number
  /** Whether the immersive auto-tour is running. */
  autoTour: boolean
  /** Number of items in the loaded story (set by the viewer; bounds navigation). */
  itemCount: number
  /**
   * Reader's current Mode A camera navigation. Seeded from the story's
   * `frontmatter.navigation` default on load, then toggleable live by the reader.
   */
  navMode: NavMode

  setMode: (mode: ViewMode) => void
  toggleMode: () => void
  setActiveIndex: (index: number) => void
  /** Advance/retreat one item, clamped (auto-tour wraps via `wrap`). */
  step: (delta: number, opts?: { wrap?: boolean }) => void
  setAutoTour: (on: boolean) => void
  toggleAutoTour: () => void
  setItemCount: (n: number) => void
  setNavMode: (mode: NavMode) => void
  toggleNavMode: () => void
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
  itemCount: 0,
  navMode: 'orbit',

  setMode: (mode) => set({ mode, autoTour: mode === 'page' ? false : get().autoTour }),
  toggleMode: () => get().setMode(get().mode === 'page' ? 'immersive' : 'page'),

  setActiveIndex: (index) => {
    const max = Math.max(0, get().itemCount - 1)
    set({ activeIndex: Math.min(Math.max(index, 0), max) })
  },

  step: (delta, opts) => {
    const { activeIndex, itemCount } = get()
    if (itemCount === 0) return
    let next = activeIndex + delta
    if (opts?.wrap) next = (next + itemCount) % itemCount
    else next = Math.min(Math.max(next, 0), itemCount - 1)
    set({ activeIndex: next })
  },

  setAutoTour: (on) => set({ autoTour: on }),
  toggleAutoTour: () => set({ autoTour: !get().autoTour }),
  setItemCount: (n) => set({ itemCount: n }),
  setNavMode: (mode) => set({ navMode: mode }),
  toggleNavMode: () => set({ navMode: get().navMode === 'orbit' ? 'firstPerson' : 'orbit' }),
  // NB: navMode is intentionally NOT reset here — it's seeded per-story from
  // `frontmatter.navigation` by ViewerStage. Resetting it would clobber that seed
  // (a parent route's reset() runs after the child ViewerStage seed effect).
  reset: () => set({ mode: 'page', activeIndex: 0, autoTour: false }),
}))
