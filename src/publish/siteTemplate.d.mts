// Type declarations for the plain-ESM siteTemplate.mjs so it can be imported
// from TypeScript (buildSite.ts) as well as from the Node CLI.
import type { Collection, Frontmatter } from '../parser/types'

/** Which route a kiosk export opens on. Defaults to 'story' everywhere. */
export type KioskKind = 'story' | 'collection'

export function siteDirName(slug: string): string
export function kioskScript(slug: string, kind?: KioskKind): string
export function injectKiosk(html: string, slug: string, kind?: KioskKind): string
export function injectPublishedMarker(html: string): string

export interface IndexEntry {
  id: string
  title: string
  author: string
  location: string
  date: string
  path: string
  /** Model file size on disk; a fallback total for the viewer's download %. */
  modelBytes?: number
}
export function indexEntry(fm: Partial<Frontmatter>, slug: string, modelBytes?: number): IndexEntry

/** A collection's entry in the optional `collections` key. */
export interface CollectionEntry {
  id: string
  title: string
  subtitle?: string
  path: string
  /** Cover image, prefixed with the collection's directory so it resolves from the site root. */
  cover?: string
}
export function collectionIndexEntry(
  collection: Pick<Collection, 'title' | 'subtitle'>,
  slug: string,
  coverPath?: string,
): CollectionEntry

export function orderCollectionIds(
  ids: string[] | undefined,
  availableIds: Iterable<string>,
): { ordered: string[]; missing: string[]; extra: string[] }

export function collectionWarnings(missing: string[] | undefined): string[]

export function storiesIndexJson(
  entries: IndexEntry[],
  collections?: CollectionEntry[],
): { stories: IndexEntry[]; collections?: CollectionEntry[] }

export function deployMd(opts: { title: string; siteDir: string }): string
