# Gaussian splats & 3D models

A story's 3D model can be a **mesh** or a **Gaussian splat** — the rest of the story
(`story.md`, items, hotspots, both viewing modes) is identical either way. Only the `model:`
line differs.

## Supported formats

| Kind | Extensions | Notes |
| --- | --- | --- |
| Mesh | `.glb`, `.gltf` | Standard glTF; Y-up by convention, loads as-is. |
| Gaussian splat | `.sog`, `.ply`, `.splat`, `.ksplat`, `.spz` | Auto-detected from the extension; the splat renderer is lazy-loaded so only splat stories pay for it. |
| Placeholder | `builtin:room` | Generated geometry — no asset needed, handy for drafting. |

Point the `model:` frontmatter line at your file (relative to the story folder):

```yaml
model: "assets/scene.sog"
```

The same hotspots drive the same camera animation in both Mode A and Mode B regardless of
format.

## Preparing a splat

Raw `.ply` splats straight out of training are large and often carry stray outlier points.
Before dropping one in:

1. **Clean & convert** with [SuperSplat](https://superspl.at/editor) (free, open source): crop
   the scene, delete stray splats, and export **`.sog`** — roughly 10–20× smaller than a raw
   `.ply`, so it loads far faster. `.ksplat`, `.splat` and `.spz` all still work if you already
   have them.
2. Drop the file into your story's `assets/` and update the `model:` line.
3. Frame it with the story start view and per-item waypoints (the editor's click-to-place is
   easiest).

A ready-to-use template lives in
[`public/stories/splat-example/`](../public/stories/splat-example/) — drop your file into its
`assets/`, and see that folder's README for the specifics.

## Orientation

Splats use different up-axis conventions depending on where they were trained, so a scan can
load **upside down**.

The loader corrects this automatically for **`.ply` and `.sog`** splats — `.ply` because it is the
INRIA Y-down / Z-forward convention, and `.sog` because SuperSplat (in practice the only producer of
bundled SOG) exports from those same sources. Both are flipped 180° upright; other formats are left
alone. But a **SuperSplat `.splat`/`.ksplat` repacked from an INRIA `.ply` inherits that flipped
orientation** and needs the same correction — so if yours loads upside down, override it:

- **In the editor:** set **Story details → Model orientation** to **Flip upright (180°)**.
- **By hand:** add `orientation: "flip"` to the frontmatter.

| `orientation` | Effect |
| --- | --- |
| *(absent)* | **Auto** — flip `.ply` and `.sog` splats, leave other formats as-is. |
| `flip` | Force the 180° upright correction (any format). |
| `none` | Disable the correction (e.g. an auto-flipped `.ply` that was already upright). |

The correction pivots on the model's own centre, so it stays framed correctly. Orientation
affects **splats only** — meshes are Y-up by spec. Loader behavior lives in
[`src/three/loadSplat.ts`](../src/three/loadSplat.ts).

## Hosting

Splats need **no special server configuration** — no cross-origin isolation, no COOP/COEP headers,
no secure context beyond ordinary HTTPS. The renderer sorts splats in WebAssembly without
`SharedArrayBuffer`, so an exported story runs on any plain static host.

It does need to be *served*, though: opening `index.html` straight off disk fails, because browsers
block the `fetch()` of story data on a `file://` URL. Any static host works, as does
`python3 -m http.server` locally.

---

## Related

- **Write the story** → [Authoring a story](./AUTHORING.md)
- **Publish it** → [Publishing & sharing](./PUBLISHING.md)
