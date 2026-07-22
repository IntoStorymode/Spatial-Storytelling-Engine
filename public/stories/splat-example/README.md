# Splat demo / template

This story is a **working Gaussian-splat demo**. Its model,
`assets/scene.splat`, is generated with no downloads by
`scripts/gen-assets.mjs` (run automatically on `npm run dev` / `npm run build`)
— a 12,000-splat colour sphere. It's also the template for dropping in your own
scan.

## Use your own scan

1. **Replace the model** — drop your file into `assets/` and point the `model:`
   line in `story.md` at it. Supported: `.sog` / `.ksplat` / `.splat` / `.ply` /
   `.spz` (format auto-detected from the extension).

2. **(Recommended) Convert / clean** a raw `.ply` with
   [SuperSplat](https://superspl.at/editor) (free, open source) — crop the scene,
   drop stray splats, and export `.sog`, which is roughly 10–20× smaller than the
   raw `.ply` and loads much faster.

3. **Tune the hotspots** in `story.md` (`position` / `target`) to frame your
   scene — or use the in-app editor's click-to-place, which is far easier.

## Notes

- **Hosting:** splats need no special headers — no cross-origin isolation, no
  `SharedArrayBuffer`. The renderer sorts in WebAssembly, so an exported story
  runs on any plain static host.
- **Orientation:** splats are sometimes trained upside down. If yours loads
  inverted, set `orientation: "flip"` in `story.md` (or **Model orientation →
  Flip upright** in the editor). See
  [`docs/GAUSSIAN-SPLATS.md`](../../../docs/GAUSSIAN-SPLATS.md#orientation).
- The generated `scene.splat` is gitignored (rebuilt on demand), like the demo's
  other generated assets.
