# Gaussian splats & 3D models

A story's 3D model can be a **mesh** or a **Gaussian splat** — the rest of the story
(`story.md`, items, hotspots, both viewing modes) is identical either way. Only the `model:`
line differs.

## Supported formats

| Kind | Extensions | Notes |
| --- | --- | --- |
| Mesh | `.glb`, `.gltf` | Standard glTF; Y-up by convention, loads as-is. |
| Gaussian splat | `.ply`, `.splat`, `.ksplat`, `.spz` | Auto-detected from the extension; the splat renderer is lazy-loaded so only splat stories pay for it. |
| Placeholder | `builtin:room` | Generated geometry — no asset needed, handy for drafting. |

Point the `model:` frontmatter line at your file (relative to the story folder):

```yaml
model: "assets/scene.ksplat"
```

The same hotspots drive the same camera animation in both Mode A and Mode B regardless of
format.

## Preparing a splat

Raw `.ply` splats straight out of training are large and often carry stray outlier points.
Before dropping one in:

1. **Clean & convert** with [SuperSplat](https://superspl.at/editor) (free, open source): crop
   the scene, delete stray splats, and export a compact **`.ksplat`** for faster loads.
2. Drop the file into your story's `assets/` and update the `model:` line.
3. Frame it with the story start view and per-item waypoints (the editor's click-to-place is
   easiest).

A ready-to-use template lives in
[`public/stories/splat-example/`](../public/stories/splat-example/) — drop your file into its
`assets/`, and see that folder's README for the specifics.

## Orientation

Splats use different up-axis conventions depending on where they were trained, so a scan can
load **upside down**.

The loader corrects this automatically for `.ply` splats (which use the INRIA Y-down / Z-forward
convention) by flipping them 180° upright, and leaves other formats alone. But a **SuperSplat
`.splat`/`.ksplat` repacked from an INRIA `.ply` inherits that flipped orientation** and needs
the same correction — so if yours loads upside down, override it:

- **In the editor:** set **Story details → Model orientation** to **Flip upright (180°)**.
- **By hand:** add `orientation: "flip"` to the frontmatter.

| `orientation` | Effect |
| --- | --- |
| *(absent)* | **Auto** — flip `.ply` splats, leave other formats as-is. |
| `flip` | Force the 180° upright correction (any format). |
| `none` | Disable the correction (e.g. an auto-flipped `.ply` that was already upright). |

The correction pivots on the model's own centre, so it stays framed correctly. Orientation
affects **splats only** — meshes are Y-up by spec. Loader behavior lives in
[`src/three/loadSplat.ts`](../src/three/loadSplat.ts).

## Cross-origin isolation (COOP/COEP)

Splat GPU-sorting can use `SharedArrayBuffer`, which browsers only allow under cross-origin
isolation — the headers `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`.

- **Dev & preview:** the Vite dev and preview servers already send these
  (see `vite.config.ts`), so GPU sorting is available locally.
- **Exported / hosted sites:** a static-host export runs **without** these headers by design, so
  it works on any plain static host — the splat sorter falls back to a slightly slower CPU sort.
  Nothing to configure. (If you *do* control the headers and want GPU sorting, send both.)

---

## Related

- **Write the story** → [Authoring a story](./AUTHORING.md)
- **Publish it** → [Publishing & sharing](./PUBLISHING.md)
