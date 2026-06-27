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
// `base: './'`. So the same folder runs at a domain root, any subfolder
// (e.g. news.example.com/spatial/), or even file:// — no server config, and no
// COOP/COEP headers (the splat renderer runs without SharedArrayBuffer).
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

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function fail(msg) {
  console.error(`\npublish-site: ${msg}\n`)
  process.exit(1)
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
      `  Publish the story into public/stories/${slug}/ first (story.md + its assets/),\n` +
      `  then re-run. Tip: the editor's "Download bundle" zip unzips into exactly that shape.`,
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
  return {
    id: slug,
    title: fm.title ?? slug,
    author: fm.author ?? '',
    location: fm.location ?? '',
    date: fm.date ?? '',
    path: `stories/${slug}/story.md`,
  }
}
const entry = entryFromIndex() ?? entryFromFrontmatter()
entry.path = `stories/${slug}/story.md` // ensure relative, regardless of source

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

// ── 5. Kiosk entry: open the deployed root straight into the story ───────────
// Inject a tiny redirect before the app bundle. It only fires when there's no
// hash yet, so deep links (…/#/story/<slug>) and in-app nav are untouched.
const indexPath = join(dist, 'index.html')
let html = readFileSync(indexPath, 'utf8')
const kiosk = `<script>if(!location.hash){history.replaceState(null,'','#/story/${slug}')}</script>`
if (html.includes('<script type="module"')) {
  html = html.replace('<script type="module"', `${kiosk}\n    <script type="module"`)
} else {
  html = html.replace('</head>', `  ${kiosk}\n  </head>`) // fallback
}
writeFileSync(indexPath, html)

// ── 6. DEPLOY.md (lives next to the folder in the zip, not inside the site) ───
const deployMd = `# Deploy "${entry.title}"

This zip contains a complete, self-contained website for one story:

    ${slug}-site/   ← the website (open index.html or deploy this folder)

It opens straight into the story. No build step, no backend, no special server
configuration, and no special headers are required.

## Netlify (easiest — drag & drop)

1. Go to https://app.netlify.com/drop
2. Drag the **${slug}-site** folder onto the page.
3. You get a live URL. (Optional: add a custom domain in Netlify.)

## Vercel

    cd ${slug}-site
    npx vercel deploy --prod        # or drag the folder in the Vercel dashboard

## Any static host (S3, Cloudflare Pages, GitHub Pages, nginx, …)

Upload the **contents of ${slug}-site/** to any location — a domain root OR a
subfolder (e.g. https://example.com/news/spatial/). The same files work at any
path because the app uses relative URLs and hash routing.

### Two things to know
- **Use a trailing slash** when the site lives in a subfolder
  (e.g. .../news/spatial/ , not .../news/spatial). Most hosts add it for you.
- The page loads web fonts from Google Fonts (needs internet); if offline, it
  falls back to system fonts gracefully.
`

// ── 7. Zip <slug>-site/ (the site) + DEPLOY.md ───────────────────────────────
const zip = new JSZip()
zip.file('DEPLOY.md', deployMd)
const siteRoot = `${slug}-site`
function addDir(absDir, zipPrefix) {
  for (const name of readdirSync(absDir)) {
    const abs = join(absDir, name)
    const zpath = `${zipPrefix}/${name}`
    if (statSync(abs).isDirectory()) addDir(abs, zpath)
    else zip.file(zpath, readFileSync(abs))
  }
}
addDir(dist, siteRoot)

const outPath = join(ROOT, `${slug}-site.zip`)
const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
writeFileSync(outPath, buf)

const mb = (buf.length / (1024 * 1024)).toFixed(2)
console.log(`\npublish-site: wrote ${slug}-site.zip (${mb} MB)`)
console.log(`  → unzip and follow DEPLOY.md, or drag the ${slug}-site folder to netlify.com/drop`)
