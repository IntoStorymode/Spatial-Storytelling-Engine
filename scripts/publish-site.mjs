#!/usr/bin/env node
// Build a self-contained, deploy-anywhere static site for ONE story.
//
//   npm run publish:site -- <slug>
//
// Produces <slug>-site.zip at the repo root containing:
//   <slug>-site/   the deployable site — open it straight into the story
//   DEPLOY.md      how to put it on Netlify / Vercel / any static host
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
  deployMd,
  indexEntry,
  injectKiosk,
  injectPublishedMarker,
  siteDirName,
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
const slug = process.argv.slice(2).find((a) => !a.startsWith('-'))
if (!slug) {
  fail('usage: npm run publish:site -- <slug>   (the folder name under public/stories/)')
}
const storyDir = join(ROOT, 'public', 'stories', slug)
const storyMd = join(storyDir, 'story.md')
if (!existsSync(storyMd)) {
  fail(
    `no story at public/stories/${slug}/story.md.\n` +
      `  Put the story under public/stories/${slug}/ first (story.md + its assets/),\n` +
      `  then re-run. Tip: authoring in the editor? Click "⛭ Download website" instead —\n` +
      `  it produces the deployable ${slug}-site.zip directly, no repo drop needed.`,
  )
}

// ── 2. Find (or synthesise) this story's index entry ─────────────────────────
// Prefer the committed index.json entry; fall back to the story.md frontmatter
// so a not-yet-registered story can still be published.
function entryFromIndex() {
  const idxPath = join(ROOT, 'public', 'stories', 'index.json')
  if (!existsSync(idxPath)) return null
  const stories = JSON.parse(readFileSync(idxPath, 'utf8')).stories ?? []
  return stories.find((s) => s.id === slug) ?? null
}
function entryFromFrontmatter() {
  const raw = readFileSync(storyMd, 'utf8')
  const m = raw.match(/^---\n([\s\S]*?)\n---/)
  const fm = m ? yaml.load(m[1]) ?? {} : {}
  return indexEntry(fm, slug)
}
const entry = entryFromIndex() ?? entryFromFrontmatter()
entry.path = `stories/${slug}/story.md` // ensure relative, regardless of source

// Stamp the model's byte size (the committed index entry may not carry it) so the
// viewer can show a real download % even on hosts that serve the model compressed
// without a Content-Length — see indexEntry in src/publish/siteTemplate.mjs.
try {
  const m = readFileSync(storyMd, 'utf8').match(/^---\n([\s\S]*?)\n---/)
  const model = String((m ? (yaml.load(m[1]) ?? {}) : {}).model ?? '')
  if (model && !model.startsWith('builtin:')) {
    const modelPath = join(storyDir, model)
    if (existsSync(modelPath)) entry.modelBytes = statSync(modelPath).size
  }
} catch {
  /* leave modelBytes off — it's an optional optimisation */
}

// ── 3. Build the app (gen-assets + tsc + vite) ───────────────────────────────
console.log(`publish-site: building "${entry.title}" (${slug})…`)
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' })

const dist = join(ROOT, 'dist')
if (!existsSync(join(dist, 'index.html'))) fail('build did not produce dist/index.html')

// ── 4. Prune dist/stories to just this story + a one-entry index.json ─────────
const distStories = join(dist, 'stories')
for (const name of readdirSync(distStories)) {
  if (name === slug) continue
  rmSync(join(distStories, name), { recursive: true, force: true })
}
writeFileSync(join(distStories, 'index.json'), JSON.stringify({ stories: [entry] }, null, 2))

// ── 5. Kiosk entry + published marker ────────────────────────────────────────
// Inject a tiny redirect before the app bundle (fires only when there's no hash
// yet, so deep links …/#/story/<slug> and in-app nav are untouched), plus the
// published marker so the hosted site is read-only (no editor).
const indexPath = join(dist, 'index.html')
writeFileSync(indexPath, injectPublishedMarker(injectKiosk(readFileSync(indexPath, 'utf8'), slug)))

// ── 6. Zip <slug>-site/ (the site) + DEPLOY.md ───────────────────────────────
// DEPLOY.md lives next to the folder in the zip, not inside the site.
const zip = new JSZip()
const siteRoot = siteDirName(slug)
zip.file('DEPLOY.md', deployMd({ title: entry.title, siteDir: siteRoot }))
const modelWarnings = []
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
console.log(`  → unzip and follow DEPLOY.md, or drag the ${slug}-site folder to netlify.com/drop`)

for (const warn of modelWarnings) console.warn(`\npublish-site: heads up — ${warn}`)
