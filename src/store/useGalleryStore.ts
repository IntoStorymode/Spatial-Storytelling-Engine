import { create } from 'zustand'
import type { EditSnapshot, Upload } from './useDraftStore'
import type { Collection } from '../parser/types'

/**
 * A story saved to the in-session gallery. It IS an editor snapshot (so it can
 * be re-opened for editing verbatim, blob uploads included) plus a stable slug
 * and a save timestamp for ordering.
 */
export interface SavedStory extends EditSnapshot {
  /** `slug` (the gallery key) is inherited from EditSnapshot. */
  savedAt: number
}

/**
 * A collection saved to the in-session gallery.
 *
 * Deliberately NOT a SavedStory: that type extends EditSnapshot and is typed hard
 * to `fm: Frontmatter` / `sections: Section[]`, which a collection has neither of.
 * A discriminant there would force a narrowing branch through every existing
 * `s.fm` / `s.sections` read for no gain, so collections get their own shape and
 * their own array in the same store.
 */
export interface SavedCollection {
  /** Gallery key and export folder name, same role as a story's slug. */
  slug: string
  collection: Collection
  /** The cover image held in memory, when there is one. */
  cover: Upload | null
  savedAt: number
}

interface GalleryState {
  stories: SavedStory[]
  collections: SavedCollection[]
  /** Add or replace (upsert by slug) — re-saving an edited story updates it. */
  save: (entry: SavedStory) => void
  remove: (slug: string) => void
  /** Upsert by slug, like `save`. Collection slugs are their own namespace. */
  saveCollection: (entry: SavedCollection) => void
  removeCollection: (slug: string) => void
}

/**
 * The author's gallery of saved stories and collections for THIS browser session.
 * Deliberately in-memory (no persist middleware): the durable artifact is the
 * exported zip, not an opaque browser store — a reload clears this. Durable
 * persistence is a later (core-engine / SaaS) concern.
 *
 * Stories and collections are separate arrays but one store, because the export
 * flow needs both together and they are one gallery to the author. Their slugs
 * are separate namespaces, matching the separate `public/stories/` and
 * `public/collections/` directories on disk.
 */
export const useGalleryStore = create<GalleryState>((set) => ({
  stories: [],
  collections: [],
  save: (entry) =>
    set((s) => ({ stories: [...s.stories.filter((x) => x.slug !== entry.slug), entry] })),
  remove: (slug) => set((s) => ({ stories: s.stories.filter((x) => x.slug !== slug) })),
  saveCollection: (entry) =>
    set((s) => ({ collections: [...s.collections.filter((x) => x.slug !== entry.slug), entry] })),
  removeCollection: (slug) =>
    set((s) => ({ collections: s.collections.filter((x) => x.slug !== slug) })),
}))
