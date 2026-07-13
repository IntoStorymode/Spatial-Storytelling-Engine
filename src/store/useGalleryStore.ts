import { create } from 'zustand'
import type { EditSnapshot } from './useDraftStore'

/**
 * A story saved to the in-session gallery. It IS an editor snapshot (so it can
 * be re-opened for editing verbatim, blob uploads included) plus a stable slug
 * and a save timestamp for ordering.
 */
export interface SavedStory extends EditSnapshot {
  /** `slug` (the gallery key) is inherited from EditSnapshot. */
  savedAt: number
}

interface GalleryState {
  stories: SavedStory[]
  /** Add or replace (upsert by slug) — re-saving an edited story updates it. */
  save: (entry: SavedStory) => void
  remove: (slug: string) => void
}

/**
 * The author's gallery of saved stories for THIS browser session. Deliberately
 * in-memory (no persist middleware): the durable artifact is the exported zip,
 * not an opaque browser store — a reload clears this. Durable persistence is a
 * later (core-engine / SaaS) concern.
 */
export const useGalleryStore = create<GalleryState>((set) => ({
  stories: [],
  save: (entry) =>
    set((s) => ({ stories: [...s.stories.filter((x) => x.slug !== entry.slug), entry] })),
  remove: (slug) => set((s) => ({ stories: s.stories.filter((x) => x.slug !== slug) })),
}))
