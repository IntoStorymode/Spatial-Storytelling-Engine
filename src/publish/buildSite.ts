import JSZip from 'jszip'
import type { Collection, Story } from '../parser/types'
import { serializeStory } from '../parser/serializeStory'
import { serializeCollection } from '../parser/collection'
import { describeModelWeight } from '../lib/modelFormats'
import {
  collectionIndexEntry,
  collectionWarnings,
  deployMd,
  indexEntry,
  injectKiosk,
  injectPublishedMarker,
  orderCollectionIds,
  siteDirName,
  storiesIndexJson,
} from './siteTemplate.mjs'

/** The app-shell file list emitted at build time (see the vite publish-manifest plugin). */
export interface Manifest {
  appVersion?: string
  files: string[]
}

/**
 * Fetch the built app's shell manifest. Returns `null` when it isn't there —
 * which is exactly the `npm run dev` case (no build → no dist → no manifest),
 * the signal the editor uses to disable in-app website export and fall back.
 *
 * Resolves relative to the document base, like the app's other data fetches
 * (`fetch('stories/index.json')`), so it works at a domain root or any subfolder.
 */
export async function fetchManifest(): Promise<Manifest | null> {
  try {
    const res = await fetch('publish-manifest.json')
    if (!res.ok) return null
    const json = (await res.json()) as Manifest
    return Array.isArray(json.files) ? json : null
  } catch {
    return null
  }
}

/** One story to include in an export: its slug, parsed story, and uploaded assets. */
export interface ExportStory {
  slug: string
  story: Story
  assets: { path: string; file: File }[]
}

/** A collection to export as the site's landing page, with its uploaded cover. */
export interface ExportCollection {
  slug: string
  collection: Collection
  assets: { path: string; file: File }[]
}

interface BuildSiteOpts {
  /** One or more stories. One → opens straight into it (kiosk); many → opens on the gallery. */
  stories: ExportStory[]
  /**
   * When given, the site's root is this collection's landing page and the
   * stories are ordered by its `stories:` list.
   */
  collection?: ExportCollection
  manifest: Manifest
}

/**
 * Assemble a complete, deploy-anywhere static site for one OR several stories,
 * entirely in the browser — the same shape `npm run publish:site` produces,
 * without a rebuild or a repo round-trip.
 *
 * The zip contains a site folder (the app shell + the stories' data + a `DEPLOY.md`).
 * The root's landing page depends on what was selected:
 * - a **collection** → its landing page (folder `<collection-slug>-site`), with the
 *   stories written to the index in the collection's own order, which is what makes
 *   previous/next inside a story follow the collection.
 * - a **single** story → a kiosk redirect straight into it (folder `<slug>-site`).
 * - **several** loose stories → no redirect, so the site opens on the gallery/Home
 *   listing them (folder `gallery-site`).
 *
 * Returns the blob plus the suggested download filename.
 */
export async function buildSiteZip({ stories, collection, manifest }: BuildSiteOpts): Promise<{ blob: Blob; fileName: string; warnings: string[] }> {
  if (!stories.length) throw new Error('publish: no stories selected to export')

  // A collection's `stories:` list is the export's order. Reordering here is the
  // whole mechanism: storyNeighbours walks the index array, so an index written in
  // collection order gives collection previous/next with no route state at all.
  let ordered = stories
  let missing: string[] = []
  if (collection) {
    const res = orderCollectionIds(
      collection.collection.stories,
      stories.map((s) => s.slug),
    )
    missing = res.missing
    const bySlug = new Map(stories.map((s) => [s.slug, s]))
    ordered = res.ordered.map((slug) => bySlug.get(slug)!)
    if (!ordered.length) {
      throw new Error('publish: none of this collection’s stories are available to export')
    }
  }

  const single = !collection && ordered.length === 1
  const dirName = collection
    ? siteDirName(collection.slug)
    : single
      ? siteDirName(ordered[0].slug)
      : siteDirName('gallery')

  // Advisory backstop: flag any raw/oversized model heading into the bundle, so
  // an author who imported a heavy scan (bypassing the editor's upload warning)
  // still hears about it. Non-blocking — the export proceeds regardless.
  const warnings: string[] = [...collectionWarnings(missing)]
  for (const { story, assets } of ordered) {
    const model = assets.find((a) => a.path === story.frontmatter.model)
    const warn = model && describeModelWeight(model.file.name, model.file.size)
    if (warn) warnings.push(warn)
  }

  const zip = new JSZip()
  const site = zip.folder(dirName)!

  // 1. The generic app shell, fetched from the running (built) app. index.html
  //    is special-cased: fetch as text so the kiosk redirect can be injected;
  //    everything else is fetched as bytes (hashed JS/CSS chunks may be binary).
  for (const rel of manifest.files) {
    if (rel === 'index.html') continue
    const res = await fetch(rel)
    if (!res.ok) throw new Error(`publish: could not fetch app-shell file "${rel}" (${res.status})`)
    site.file(rel, await res.arrayBuffer())
  }
  const htmlRes = await fetch('index.html')
  if (!htmlRes.ok) throw new Error(`publish: could not fetch index.html (${htmlRes.status})`)
  const html = await htmlRes.text()
  // Kiosk only for a single story. A collection export needs none: its root
  // renders the landing page directly (Home resolves to the collection on a
  // published site), so the reader's URL stays a clean `/`. A gallery export
  // gets none either, so it lands on Home. The published marker goes on every
  // export so the hosted site is read-only.
  const kiosk = single ? injectKiosk(html, ordered[0].slug) : html
  site.file('index.html', injectPublishedMarker(kiosk))

  // 2. The registry: one entry per exported story, in export order (which is the
  //    collection's order when there is one). Stamp the model's byte size so the
  //    viewer can show a real download % even on hosts that compress the model
  //    without a Content-Length (see indexEntry). The `collections` key is
  //    omitted entirely without a collection, so a story-only export is
  //    byte-identical to what earlier engine versions wrote.
  const entries = ordered.map((s) => {
    const model = s.assets.find((a) => a.path === s.story.frontmatter.model)
    return indexEntry(s.story.frontmatter, s.slug, model?.file.size)
  })
  const collectionEntries = collection
    ? [collectionIndexEntry(collection.collection, collection.slug, collection.collection.cover)]
    : undefined
  site.file('stories/index.json', JSON.stringify(storiesIndexJson(entries, collectionEntries), null, 2))

  // 3. Each story's data: serialized story.md + its uploaded assets (deduped).
  for (const { slug, story, assets } of ordered) {
    site.file(`stories/${slug}/story.md`, serializeStory(story))
    const seen = new Set<string>()
    for (const { path, file } of assets) {
      if (seen.has(path)) continue
      seen.add(path)
      site.file(`stories/${slug}/${path}`, file)
    }
  }

  // 3b. The collection's own data, in its own namespace. NOT the site root: an
  //     `assets/` there would collide with the app shell's hashed bundle.
  if (collection) {
    site.file(`collections/${collection.slug}/collection.md`, serializeCollection(collection.collection))
    const seen = new Set<string>()
    for (const { path, file } of collection.assets) {
      if (seen.has(path)) continue
      seen.add(path)
      site.file(`collections/${collection.slug}/${path}`, file)
    }
  }

  // 4. Hosting instructions, alongside the site folder (not inside it).
  const title = collection
    ? collection.collection.title || collection.slug
    : single
      ? ordered[0].story.frontmatter.title || ordered[0].slug
      : `${ordered.length} stories`
  zip.file('DEPLOY.md', deployMd({ title, siteDir: dirName }))

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, fileName: `${dirName}.zip`, warnings }
}
