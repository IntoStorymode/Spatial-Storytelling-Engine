#!/usr/bin/env node
// Build a self-contained, deploy-anywhere static site for ONE story, or for a
// COLLECTION and the stories it lists.
//
//   npm run publish:site -- <slug>
//
// <slug> is a folder under public/stories/ (a story) or under public/collections/
// (a collection). The two namespaces are separate, so one bare argument is
// unambiguous; a story wins if somehow both exist.
//
// Produces <slug>-site.zip at the repo root containing:
//   <slug>-site/   the deployable site — opens straight into the story, or onto
//                  the collection's landing page
//   DEPLOY.md      how to put it on Netlify / Vercel / any static host
//
// For a collection the stories are written to stories/index.json in the
// collection's own `stories:` order, which is what makes previous/next inside a
// story follow the collection — see orderCollectionIds in siteTemplate.mjs.
//
// Why it just works at any URL path: the app uses hash routing (HashRouter) and
// fetches its story data with RELATIVE paths, and Vite builds assets with
// `base: './'`. So the same folder runs at a domain root or any subfolder
// (e.g. news.example.com/spatial/) — no server config, and no COOP/COEP headers
// (the splat renderer runs without SharedArrayBuffer). It does have to be
// SERVED, though: browsers block the story-data fetch on a file:// URL, which is
// why the generated DEPLOY.md says not to double-click index.html.
import {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  rmSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execSync } from 'node:child_process'
import JSZip from 'jszip'
import yaml from 'js-yaml'
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
} from '../src/publish/siteTemplate.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function fail(msg) {
  console.error(`\npublish-site: ${msg}\n`)
  process.exit(1)
}

// Advisory model-weight check. Mirror of src/lib/modelFormats.ts — that file is
// TS and this script is plain .mjs, so the thresholds are duplicated; keep them
// in sync. Non-fatal: an oversized/raw splat still publishes, it's just flagged.
const MESH_EXTS = ['glb', 'gltf']
const SPLAT_EXTS = ['ply', 'splat', 'ksplat', 'spz', 'sog']
const RAW_SPLAT_EXTS = ['splat', 'ply']
const MODEL_EXTS = [...MESH_EXTS, ...SPLAT_EXTS]
const MODEL_SIZE_WARN_BYTES = 40 * 1024 * 1024 // ~40 MB
function describeModelWeight(name, size) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (!MODEL_EXTS.includes(ext)) return null // only judge model files, not JS/CSS
  const mb = `${(size / (1024 * 1024)).toFixed(1)} MB`
  if (RAW_SPLAT_EXTS.includes(ext))
    return `${name} (${mb}) is a raw, uncompressed splat — re-export it as .sog in SuperSplat (typically 10–20× smaller) so it loads quickly.`
  if (size <= MODEL_SIZE_WARN_BYTES) return null
  if (MESH_EXTS.includes(ext))
    return `${name} (${mb}) is a large mesh — consider decimating or compressing it (Draco / meshopt).`
  return `${name} (${mb}) is over the ~40 MB budget for smooth loading — crop stray splats or reduce the splat count in SuperSplat.`
}

// ── 1. Resolve + validate the slug ───────────────────────────────────────────
// One bare positional, either a story slug or a collection slug — the two live in
// separate directories, so no flag is needed to tell them apart. A story is tried
// first so every pre-existing invocation behaves exactly as it did.
const slug = process.argv.slice(2).find((a) => !a.startsWith('-'))
if (!slug) {
  fail(
    'usage: npm run publish:site -- <slug>\n' +
      '  (a folder name under public/stories/, or under public/collections/)',
  )
}
const storyDir = join(ROOT, 'public', 'stories', slug)
const storyMd = join(storyDir, 'story.md')
const collectionDir = join(ROOT, 'public', 'collections', slug)
const collectionMd = join(collectionDir, 'collection.md')

const isStory = existsSync(storyMd)
const isCollection = existsSync(collectionMd)
if (!isStory && !isCollection) {
  fail(
    `no story at public/stories/${slug}/story.md, and no collection at\n` +
      `  public/collections/${slug}/collection.md.\n` +
      `  Put the story under public/stories/${slug}/ first (story.md + its assets/),\n` +
      `  then re-run. Tip: authoring in the editor? Click "⛭ Download website" instead —\n` +
      `  it produces the deployable ${slug}-site.zip directly, no repo drop needed.`,
  )
}
if (isStory && isCollection) {
  console.warn(
    `\npublish-site: heads up — "${slug}" is both a story and a collection.\n` +
      `  Publishing the STORY. Rename one of them if you meant the collection.`,
  )
}

/** Read a .md file's YAML frontmatter as a plain object. */
function frontmatterOf(absPath) {
  const m = readFileSync(absPath, 'utf8').match(/^---\n([\s\S]*?)\n---/)
  return m ? (yaml.load(m[1]) ?? {}) : {}
}

// ── 2. Find (or synthesise) each story's index entry ─────────────────────────
// Prefer the committed index.json entry; fall back to the story.md frontmatter
// so a not-yet-registered story can still be published. Takes a slug because a
// collection export builds one of these per story it lists.
function entryFromIndex(forSlug) {
  const idxPath = join(ROOT, 'public', 'stories', 'index.json')
  if (!existsSync(idxPath)) return null
  const stories = JSON.parse(readFileSync(idxPath, 'utf8')).stories ?? []
  return stories.find((s) => s.id === forSlug) ?? null
}

function entryFor(forSlug) {
  const dir = join(ROOT, 'public', 'stories', forSlug)
  const md = join(dir, 'story.md')
  const entry = entryFromIndex(forSlug) ?? indexEntry(frontmatterOf(md), forSlug)
  entry.path = `stories/${forSlug}/story.md` // ensure relative, regardless of source

  // Stamp the model's byte size (the committed index entry may not carry it) so
  // the viewer can show a real download % even on hosts that serve the model
  // compressed without a Content-Length — see indexEntry in siteTemplate.mjs.
  try {
    const model = String(frontmatterOf(md).model ?? '')
    if (model && !model.startsWith('builtin:')) {
      const modelPath = join(dir, model)
      if (existsSync(modelPath)) entry.modelBytes = statSync(modelPath).size
    }
  } catch {
    /* leave modelBytes off — it's an optional optimisation */
  }
  return entry
}

// What this run publishes: a story, or a collection plus the stories it lists.
// `storySlugs` is the set pruned to and written to the index, in order.
let collectionFm = null
let storySlugs = []
let entry = null // the story entry, for a story export
let missingStories = [] // stories a collection lists that the repo doesn't have
if (isStory) {
  entry = entryFor(slug)
  storySlugs = [slug]
} else {
  collectionFm = frontmatterOf(collectionMd)
  const listed = Array.isArray(collectionFm.stories)
    ? collectionFm.stories.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
    : []
  // Only stories that actually exist in the repo can ship.
  const present = listed.filter((s) => existsSync(join(ROOT, 'public', 'stories', s, 'story.md')))
  const { ordered, missing } = orderCollectionIds(listed, present)
  if (!ordered.length) {
    fail(
      `collection "${slug}" lists no stories that exist under public/stories/.\n` +
        `  Listed: ${listed.length ? listed.join(', ') : '(none)'}\n` +
        `  Add the stories, or fix the collection's stories: list.`,
    )
  }
  storySlugs = ordered
  missingStories = missing
}

// ── 3. Build the app (gen-assets + tsc + vite) ───────────────────────────────
const label = isStory ? entry.title : collectionFm.title || slug
console.log(`publish-site: building "${label}" (${slug})…`)
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' })

const dist = join(ROOT, 'dist')
if (!existsSync(join(dist, 'index.html'))) fail('build did not produce dist/index.html')

// ── 4. Prune dist to just what this site ships + rewrite index.json ──────────
// Vite copies ALL of public/ into dist/, and step 6 zips all of dist/ — so both
// content directories must be pruned or an export ships the whole repo's content.
// The browser path has no dist/ and instead writes only what it was handed
// (see buildSite.ts), which is why this asymmetry lives here alone.
const keepStories = new Set(storySlugs)
const distStories = join(dist, 'stories')
for (const name of readdirSync(distStories)) {
  if (keepStories.has(name)) continue
  rmSync(join(distStories, name), { recursive: true, force: true })
}

const distCollections = join(dist, 'collections')
if (existsSync(distCollections)) {
  if (isStory) {
    // A story export carries no collection at all.
    rmSync(distCollections, { recursive: true, force: true })
  } else {
    for (const name of readdirSync(distCollections)) {
      if (name === slug) continue
      rmSync(join(distCollections, name), { recursive: true, force: true })
    }
  }
}

// The index is written in storySlugs order — for a collection that is the
// author's own `stories:` order, which is what makes previous/next inside a
// story follow the collection (storyNeighbours walks the index array).
const entries = isStory ? [entry] : storySlugs.map(entryFor)
const collectionEntries = isStory
  ? undefined
  : [collectionIndexEntry(collectionFm, slug, collectionFm.cover)]
writeFileSync(
  join(distStories, 'index.json'),
  JSON.stringify(storiesIndexJson(entries, collectionEntries), null, 2),
)

// ── 5. Kiosk entry + published marker ────────────────────────────────────────
// Inject a tiny redirect before the app bundle (fires only when there's no hash
// yet, so deep links …/#/story/<slug> and in-app nav are untouched), plus the
// published marker so the hosted site is read-only (no editor).
const indexPath = join(dist, 'index.html')
writeFileSync(
  indexPath,
  injectPublishedMarker(
    injectKiosk(readFileSync(indexPath, 'utf8'), slug, isStory ? 'story' : 'collection'),
  ),
)

// ── 6. Zip <slug>-site/ (the site) + DEPLOY.md ───────────────────────────────
// DEPLOY.md lives next to the folder in the zip, not inside the site.
const zip = new JSZip()
const siteRoot = siteDirName(slug)
zip.file('DEPLOY.md', deployMd({ title: label, siteDir: siteRoot }))
const modelWarnings = [...collectionWarnings(missingStories)]
function addDir(absDir, zipPrefix) {
  for (const name of readdirSync(absDir)) {
    // The build's app-shell manifest is only consumed by the editor's in-app
    // export; a published site doesn't need it, so keep it out (matches the
    // client-side path, which never zips it).
    if (absDir === dist && name === 'publish-manifest.json') continue
    const abs = join(absDir, name)
    const zpath = `${zipPrefix}/${name}`
    const st = statSync(abs)
    if (st.isDirectory()) addDir(abs, zpath)
    else {
      const warn = describeModelWeight(name, st.size)
      if (warn) modelWarnings.push(warn)
      zip.file(zpath, readFileSync(abs))
    }
  }
}
addDir(dist, siteRoot)

const outPath = join(ROOT, `${slug}-site.zip`)
const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
writeFileSync(outPath, buf)

const mb = (buf.length / (1024 * 1024)).toFixed(2)
console.log(`\npublish-site: wrote ${slug}-site.zip (${mb} MB)`)
if (!isStory) {
  console.log(
    `  collection landing page + ${storySlugs.length} ` +
      `${storySlugs.length === 1 ? 'story' : 'stories'}: ${storySlugs.join(', ')}`,
  )
}
console.log(`  → unzip and follow DEPLOY.md, or drag the ${slug}-site folder to netlify.com/drop`)

for (const warn of modelWarnings) console.warn(`\npublish-site: heads up — ${warn}`)
