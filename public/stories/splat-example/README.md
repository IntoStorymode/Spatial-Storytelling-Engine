# Splat demo / template

This story is a **working Gaussian-splat demo**. Its model,
`assets/scene.splat`, is generated with no downloads by
`scripts/gen-assets.mjs` (run automatically on `npm run dev` / `npm run build`)
— a 12,000-splat colour sphere. It's also the template for dropping in your own
scan.

## Use your own scan

1. **Replace the model** — drop your file into `assets/` and point the `model:`
   line in `story.md` at it. Supported: `.ksplat` / `.splat` / `.ply` / `.spz`
   (format auto-detected from the extension).

2. **(Recommended) Convert / clean** a raw `.ply` to a compact web `.ksplat`
   with [SuperSplat](https://superspl.at/editor) (free, open source) — crop the
   scene, drop stray splats, and export `.ksplat` for faster loads.

3. **Tune the hotspots** in `story.md` (`position` / `target`) to frame your
   scene. The M6 editor will let you click-to-place these instead.

## Notes

- **Cross-origin isolation:** the dev/preview server already sends the COOP/COEP
  headers the splat sorter needs for GPU sorting + `SharedArrayBuffer`. If you
  deploy elsewhere, send the same headers or the viewer falls back to a slower
  CPU sort.
- **Orientation:** splat scenes from training are sometimes rotated/inverted. If
  yours loads sideways, adjust the hotspots, or we can add a model-rotation
  option to the loader.
- The generated `scene.splat` is gitignored (rebuilt on demand), like the demo's
  other generated assets.
