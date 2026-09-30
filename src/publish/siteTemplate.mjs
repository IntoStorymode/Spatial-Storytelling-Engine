// Shared "publish a single story as a website" helpers.
//
// This module is intentionally plain ESM with NO fs / DOM dependencies so it can
// be imported by BOTH the Vite-bundled browser code (src/publish/buildSite.ts,
// the editor's export flow) and the Node CLI
// (scripts/publish-site.mjs). Keeping the kiosk redirect, DEPLOY.md text, and the
// index-entry shape in one place means the two publish paths can never drift.

/** Folder name the deployable site lives under inside the zip. */
export function siteDirName(slug) {
  return `${slug}-site`
}

/**
 * The kiosk redirect: on first load (no hash yet) jump straight into the story.
 * Deep links (…/#/story/<slug>) and in-app nav are untouched.
 *
 * Single-story exports only. A COLLECTION export needs no redirect: its root
 * renders the landing page directly, because Home resolves to the collection on
 * a published site whose index names one (see HomeRoute). That keeps the reader's
 * URL a clean `/` instead of `/#/collection/<slug>`, with no redirect flash and
 * no duplicate story listing sitting behind the front door.
 */
export function kioskScript(slug) {
  return `<script>if(!location.hash){history.replaceState(null,'','#/story/${slug}')}</script>`
}

/**
 * Inject the kiosk redirect into the built index.html, just before the app's
 * module script. Byte-identical to the original inline logic so the CLI and the
 * browser produce the same index.html.
 */
export function injectKiosk(html, slug) {
  const kiosk = kioskScript(slug)
  if (html.includes('<script type="module"')) {
    return html.replace('<script type="module"', `${kiosk}\n    <script type="module"`)
  }
  return html.replace('</head>', `  ${kiosk}\n  </head>`) // fallback
}

/**
 * Mark the built index.html as a *published* (exported/hosted) site by setting a
 * global before the app's module loads. The app reads `window.__SSP_PUBLISHED__`
 * to switch to read-only mode (no editor: hides Edit/Remove/New-story, guards the
 * /edit and /preview routes). Applied to EVERY export — single and gallery — so a
 * hosted site never exposes authoring controls, while the authoring app (dev,
 * preview, or a plain deploy of the editor) carries no marker.
 */
export function injectPublishedMarker(html) {
  const marker = `<script>window.__SSP_PUBLISHED__=true</script>`
  if (html.includes('<script type="module"')) {
    return html.replace('<script type="module"', `${marker}\n    <script type="module"`)
  }
  return html.replace('</head>', `  ${marker}\n  </head>`) // fallback
}

/**
 * The registry entry for one story, matching public/stories/index.json's shape.
 * `fm` is the story frontmatter ({ title, author, location, date, ... }).
 *
 * `modelBytes` (optional) is the model file's size on disk. It lets the viewer
 * show a real download percentage even when the host serves the model compressed
 * without a `Content-Length` (e.g. Vercel Brotli-encoding a .sog): the browser
 * decompresses transparently, so the bytes read climb toward this uncompressed
 * size. Omitted for `builtin:` models or when the size is unknown.
 */
export function indexEntry(fm, slug, modelBytes) {
  return {
    id: slug,
    title: fm.title ?? slug,
    author: fm.author ?? '',
    location: fm.location ?? '',
    date: fm.date ?? '',
    path: `stories/${slug}/story.md`,
    ...(typeof modelBytes === 'number' && modelBytes > 0 ? { modelBytes } : {}),
  }
}

/**
 * The registry entry for a collection — the optional `collections` sibling key
 * in stories/index.json. Enough to list and link a collection on Home without
 * fetching its collection.md; the file itself stays authoritative for the prose,
 * exactly as story.md is authoritative over a story's index entry.
 *
 * `coverPath` is the cover as authored (e.g. `assets/cover.jpg`); it is stored
 * prefixed with the collection's directory so it resolves from the site root.
 */
export function collectionIndexEntry(collection, slug, coverPath) {
  return {
    id: slug,
    title: collection.title || slug,
    ...(collection.subtitle ? { subtitle: collection.subtitle } : {}),
    path: `collections/${slug}/collection.md`,
    ...(coverPath ? { cover: `collections/${slug}/${coverPath}` } : {}),
  }
}

/**
 * Order a collection's story ids against the ids actually available to an
 * export, and report the mismatches.
 *
 * `ordered` is the author's own order, filtered to what exists and de-duplicated
 * — this is what the exported stories/index.json is written in, which is what
 * makes previous/next inside a story follow the collection with no extra
 * machinery (storyNeighbours already walks index order).
 *
 * `missing` is ids the collection lists that the export does not carry; the
 * caller turns those into an advisory warning. `extra` is available stories the
 * collection does not list, which a collection export simply leaves out.
 */
export function orderCollectionIds(ids, availableIds) {
  const available = new Set(availableIds)
  const ordered = []
  const missing = []
  const seen = new Set()
  for (const id of ids ?? []) {
    if (seen.has(id)) continue
    seen.add(id)
    if (available.has(id)) ordered.push(id)
    else missing.push(id)
  }
  const extra = [...available].filter((id) => !seen.has(id))
  return { ordered, missing, extra }
}

/**
 * One advisory string per story a collection references but the export does not
 * carry. Shared so the CLI and the browser word it identically.
 */
export function collectionWarnings(missing) {
  return (missing ?? []).map(
    (id) =>
      `This collection lists a story "${id}" that isn't in the export, so it won't appear on the landing page. Add it, or remove it from the collection's stories: list.`,
  )
}

/**
 * The whole stories/index.json object. `collections` is omitted entirely when
 * there is no collection, so a story-only export is byte-identical to what
 * earlier engine versions wrote — and it is a top-level SIBLING of `stories`,
 * never an element of it: every index reader in the app does `.stories ?? []`,
 * so a sibling key is invisible to an older engine, whereas an array member
 * would be rendered as a story, spliced into previous/next, and could be picked
 * as the VR viewer's default.
 */
export function storiesIndexJson(entries, collections) {
  return {
    stories: entries,
    ...(collections && collections.length ? { collections } : {}),
  }
}

/**
 * The DEPLOY.md that ships next to the site folder in the zip.
 * `siteDir` is the site folder name (`<slug>-site` for one story or a
 * collection, `gallery-site` for several loose stories); `title` is the story or
 * collection title, or e.g. "3 stories" for a gallery.
 */
export function deployMd({ title, siteDir }) {
  return `# Deploy "${title}"

This zip contains a complete, self-contained website:

    ${siteDir}/   ← the website — deploy this folder, or serve it locally

Serve it over http(s) — don't just double-click index.html. The page fetches
its story data and assets, which browsers block on a file:// URL, so a bare
file open shows a blank or broken page. No build step, no backend, and no
special server configuration are required.

(To preview locally without deploying: from inside ${siteDir}/ run
"python3 -m http.server" and open http://localhost:8000 .)

## Netlify (easiest — drag & drop)

1. Go to https://app.netlify.com/drop
2. Drag the **${siteDir}** folder onto the page.
3. You get a live URL. (Optional: add a custom domain in Netlify.)

## Vercel

    cd ${siteDir}
    npx vercel deploy --prod        # or drag the folder in the Vercel dashboard

## Any static host (S3, Cloudflare Pages, GitHub Pages, nginx, …)

Upload the **contents of ${siteDir}/** to any location — a domain root OR a
subfolder (e.g. https://example.com/news/spatial/). The same files work at any
path because the app uses relative URLs and hash routing.

### Two things to know
- **Use a trailing slash** when the site lives in a subfolder
  (e.g. .../news/spatial/ , not .../news/spatial). Most hosts add it for you.
- The page loads web fonts from Google Fonts (needs internet); if offline, it
  falls back to system fonts gracefully.

## Keep editing later

This zip is also your source. Reopen it in the editor with **⬆ Import story**
(drop this zip, or the ${siteDir} folder) to make changes and re-export — it
comes back with its scan, upgraded to the current story format.
`
}
