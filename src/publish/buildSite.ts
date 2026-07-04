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

interface BuildSiteOpts {
  story: Story
  /** Uploaded files to include, at their export paths (e.g. `assets/scene.glb`). */
  assets: { path: string; file: File }[]
  slug: string
  manifest: Manifest
}

/**
 * Assemble a complete, deploy-anywhere static site for ONE story, entirely in
 * the browser — the same `<slug>-site.zip` that `npm run publish:site` produces,
 * without a rebuild or a repo round-trip.
 *
 * The zip contains a `<slug>-site/` folder (the deployable website: the running
 * app's shell + this story's data + a kiosk redirect) plus a `DEPLOY.md`.
 */
export async function buildSiteZip({ story, assets, slug, manifest }: BuildSiteOpts): Promise<Blob> {
  const zip = new JSZip()
  const site = zip.folder(siteDirName(slug))!

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
  site.file('index.html', injectKiosk(await htmlRes.text(), slug))

  // 2. This story's data: a one-entry index + the serialized story.md.
  site.file(
    'stories/index.json',
    JSON.stringify({ stories: [indexEntry(story.frontmatter, slug)] }, null, 2),
  )
  site.file(`stories/${slug}/story.md`, serializeStory(story))

  // 3. Uploaded assets (deduped by export path), under the story's assets/.
  const seen = new Set<string>()
  for (const { path, file } of assets) {
    if (seen.has(path)) continue
    seen.add(path)
    site.file(`stories/${slug}/${path}`, file)
  }

  // 4. Hosting instructions, alongside the site folder (not inside it).
  zip.file('DEPLOY.md', deployMd({ title: story.frontmatter.title || slug, slug }))

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}
