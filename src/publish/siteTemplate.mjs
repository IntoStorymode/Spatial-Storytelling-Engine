// Shared "publish a single story as a website" helpers.
//
// This module is intentionally plain ESM with NO fs / DOM dependencies so it can
// be imported by BOTH the Vite-bundled browser code (src/publish/buildSite.ts,
// the editor's one-click "Download website") and the Node CLI
// (scripts/publish-site.mjs). Keeping the kiosk redirect, DEPLOY.md text, and the
// index-entry shape in one place means the two publish paths can never drift.

/** Folder name the deployable site lives under inside the zip. */
export function siteDirName(slug) {
  return `${slug}-site`
}

/**
 * The kiosk redirect: on first load (no hash yet) jump straight into the story.
 * Deep links (…/#/story/<slug>) and in-app nav are untouched.
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
 */
export function indexEntry(fm, slug) {
  return {
    id: slug,
    title: fm.title ?? slug,
    author: fm.author ?? '',
    location: fm.location ?? '',
    date: fm.date ?? '',
    path: `stories/${slug}/story.md`,
  }
}

/**
 * The DEPLOY.md that ships next to the site folder in the zip.
 * `siteDir` is the site folder name (`<slug>-site` for one story, `gallery-site`
 * for several); `title` is the story title, or e.g. "3 stories" for a gallery.
 */
export function deployMd({ title, siteDir }) {
  return `# Deploy "${title}"

This zip contains a complete, self-contained website:

    ${siteDir}/   ← the website (open index.html or deploy this folder)

No build step, no backend, no special server configuration, and no special
headers are required.

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
`
}
