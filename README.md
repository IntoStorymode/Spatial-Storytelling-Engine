# Spatial Storytelling Platform — Prototype

A local-first web prototype that demonstrates one core concept: **a single Markdown
`story.md` file drives two switchable presentation modes — without reloading.**

> The scan is shared infrastructure; the story is the act of authorship.

- **Mode B — Page view (default):** a scrolling long-form article; the 3D model is one
  inline element in the scroll. *Narrative around the scan.*
- **Mode A — Immersive view:** a full-screen 3D scene where scrolling / Next-Prev animates
  the camera to each story item's bound hotspot and shows its content as an overlay.
  *Narrative inside the scan.*

Both modes read the **same** parsed story file. A toggle switches between them live.

## Status

**Prototype complete — M1–M7 merged** (see [`PLAN.md`](./PLAN.md) and the
[development log](./docs/DEVLOG.md)).
Done: M1 data core · M2 3D engine · M3 page view + home + routing · M4 immersive
view + auto-tour · M5 Gaussian-splat support · M6 story editor · M7 editor polish
(start camera, in-editor A/B preview). Next steps are tracked in the
[backlog](./docs/BACKLOG.md).

## Getting started

**Prerequisites**

- **Node.js 18 or newer** (Vite 5 and Vitest require it; the app will not start on Node 16
  or earlier). Check with `node -v`. If you use `nvm`, run `nvm use 20` (or any ≥18) first.
- **npm** (ships with Node).

**Run it**

```bash
git clone https://github.com/WWStoryMode/Spatial-Storytelling-Platform
cd Spatial-Storytelling-Platform
npm install
npm run dev      # → http://localhost:5173
```

Then open http://localhost:5173/ — the Home page lists the bundled demo stories. Click
**+ New story** to open the editor.

Other scripts: `npm run build` (type-check + production bundle), `npm run preview` (serve
the built bundle), `npm run test` (Vitest), `npm run publish:site -- <slug>` (export one
story as a deploy-anywhere static site — see [Publish as a website](#publish-as-a-website)).

## Stack

- **React + Vite + TypeScript**
- **One unified Three.js viewer** for both GLB meshes and Gaussian splats
  (`.ply` / `.splat` / `.ksplat` / `.spz`), using
  [`camera-controls`](https://github.com/yomotsu/camera-controls) for
  hotspot-to-hotspot camera animation and
  [`@mkkellogg/gaussian-splats-3d`](https://github.com/mkkellogg/GaussianSplats3D)
  for splat rendering (lazy-loaded, so it only ships to splat-backed stories).
- No backend — all story data and assets are local files under `/public/stories`.

## Story format

A single Markdown file with YAML frontmatter and a sequence of `## [item-id] Title` blocks,
each with a `type` (text / image / audio / video), optional `src`/`caption`, body text, and a
`hotspot:` block (`position` + `target` in 3D space). See `PLAN.md` for the full spec.

## Bring your own scan

The quickest path is the **in-app editor** (`+ New story` on the Home page):

1. Fill in the metadata and **Upload file…** your [Scaniverse](https://scaniverse.com/)
   export (`.glb` or `.splat`/`.ply`).
2. Add items (text / image / audio / video); **Upload file…** any media inline.
3. Set the **story start** view and each item's **waypoint** in the 3D scene, and use
   **▶ Preview** to check Mode A / B live.
4. Click **⛭ Download website** — you get a `<slug>-site.zip`: a complete, self-contained
   static site for your story. Unzip it and drop the `<slug>-site/` folder on any static host
   (Netlify, Vercel, S3, …) — it opens straight into the story. No repo edits, no CLI.
   (The button assembles the site in your browser, so it works from the built or hosted
   editor; under `npm run dev` use `npm run publish:site` — see below.)

Prefer to author by hand? You can also drop files into `/public/stories/my-story/assets/`,
write a `story.md` by the format below, add an `index.json` entry, and `npm run dev`.

> **Tip:** to clean, crop, and web-optimize a raw `.ply` splat (e.g. `.ply` → `.ksplat`),
> use [SuperSplat](https://superspl.at/editor) (open source, free) before dropping it in.

## Publish as a website

A published story is a **self-contained static site** that opens straight into that story —
ready to drop on any host. Two ways to produce the same `<slug>-site.zip`:

- **⛭ Download website** in the editor — one click, no terminal. Assembled in the browser, so
  it works from the built or hosted editor (disabled under `npm run dev`).
- **`npm run publish:site -- <slug>`** — for stories in the repo, or when authoring under
  `npm run dev`:

```
npm run publish:site -- <slug>
```

This builds the app, trims it to that one story, and writes **`<slug>-site.zip`** containing
the deployable `<slug>-site/` folder plus a `DEPLOY.md`. Deploy it by dragging the folder
onto [netlify.com/drop](https://app.netlify.com/drop), running `npx vercel deploy` inside it,
or uploading it to any static host (S3, Cloudflare Pages, GitHub Pages, nginx, …).

The same folder works at a **domain root or any subfolder** (e.g.
`example.com/news/spatial/`) with no server config and no special headers — the app uses
hash-based routing and relative paths. Two notes: access subfolder deploys **with a trailing
slash**, and the page loads web fonts from Google Fonts (graceful fallback offline). The
generated zip is git-ignored, so published sites never get committed.

📖 **Full step-by-step** — exporting and hosting on Netlify, Vercel, and other platforms,
plus troubleshooting: see [`docs/PUBLISHING.md`](./docs/PUBLISHING.md).

## Gaussian splats

A splat-backed story is identical to a GLB one — only the `model:` line differs
(`model: assets/scene.ksplat`). The loader auto-detects `.ply` / `.splat` /
`.ksplat` / `.spz`, and the same hotspots drive the same camera animation in both
modes.

A ready-to-use template lives in
[`public/stories/splat-example/`](./public/stories/splat-example/) — drop your
file into its `assets/`, add the story to `public/stories/index.json`, and open
it. Full steps are in that folder's README.

**Cross-origin isolation:** splat GPU-sorting uses `SharedArrayBuffer`, which
needs `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`. The Vite dev **and** preview servers
already send these (`vite.config.ts`); replicate them wherever you host, or the
viewer falls back to a slower CPU sort.

## License

TBD — the project intent is open source (see `References/`).
