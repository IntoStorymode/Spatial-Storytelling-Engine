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

**Building, milestone by milestone** (see [`PLAN.md`](./PLAN.md)).
Done: M1 data core · M2 3D engine · M3 page view + home + routing · M4 immersive
view + auto-tour · **M5 Gaussian-splat support**. Next: M6 editor · M7 polish.

```bash
npm install
npm run dev      # → http://localhost:5173
```

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

Once built, a person with a [Scaniverse](https://scaniverse.com/) export (`.glb` or
`.splat`/`.ply`) and a few media files will be able to:

1. Drop their files into `/public/stories/my-story/assets/`
2. Write a `story.md` following the format
3. `npm run dev`
4. Switch between Mode B and Mode A — both work from the same file

> **Tip:** to clean, crop, and web-optimize a raw `.ply` splat (e.g. `.ply` → `.ksplat`),
> use [SuperSplat](https://superspl.at/editor) (open source, free) before dropping it in.

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
