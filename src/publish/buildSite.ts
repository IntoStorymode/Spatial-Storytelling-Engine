import JSZip from 'jszip'
import type { Story } from '../parser/types'
import { serializeStory } from '../parser/serializeStory'
import { deployMd, indexEntry, injectKiosk, siteDirName } from './siteTemplate.mjs'

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

interface BuildSiteOpts {
  /** One or more stories. One → opens straight into it (kiosk); many → opens on the gallery. */
  stories: ExportStory[]
  manifest: Manifest
}

/**
 * Assemble a complete, deploy-anywhere static site for one OR several stories,
 * entirely in the browser — the same shape `npm run publish:site` produces,
 * without a rebuild or a repo round-trip.
 *
 * The zip contains a site folder (the app shell + the stories' data + a `DEPLOY.md`).
 * A **single** story gets a kiosk redirect so the site opens straight into it
 * (folder `<slug>-site`); **multiple** stories get no redirect, so the site opens
 * on the gallery/Home listing them (folder `gallery-site`).
 *
 * Returns the blob plus the suggested download filename.
 */
export async function buildSiteZip({ stories, manifest }: BuildSiteOpts): Promise<{ blob: Blob; fileName: string }> {
  if (!stories.length) throw new Error('publish: no stories selected to export')
  const single = stories.length === 1
  const dirName = single ? siteDirName(stories[0].slug) : siteDirName('gallery')

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
  // Kiosk only for a single story; a gallery export should land on Home.
  site.file('index.html', single ? injectKiosk(html, stories[0].slug) : html)

  // 2. The registry: one entry per exported story.
  site.file(
    'stories/index.json',
    JSON.stringify({ stories: stories.map((s) => indexEntry(s.story.frontmatter, s.slug)) }, null, 2),
  )

  // 3. Each story's data: serialized story.md + its uploaded assets (deduped).
  for (const { slug, story, assets } of stories) {
    site.file(`stories/${slug}/story.md`, serializeStory(story))
    const seen = new Set<string>()
    for (const { path, file } of assets) {
      if (seen.has(path)) continue
      seen.add(path)
      site.file(`stories/${slug}/${path}`, file)
    }
  }

  // 4. Hosting instructions, alongside the site folder (not inside it).
  const title = single ? stories[0].story.frontmatter.title || stories[0].slug : `${stories.length} stories`
  zip.file('DEPLOY.md', deployMd({ title, siteDir: dirName }))

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, fileName: `${dirName}.zip` }
}
