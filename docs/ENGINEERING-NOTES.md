# Engineering notes

Findings from building the engine that are worth writing down — mostly because they cost real time
to discover and are not obvious from any library's documentation. Organised by topic rather than
chronology.

If you are looking for how to *use* the engine, see [Authoring a story](./AUTHORING.md). If you want
to work on it, see [Development](./DEVELOPMENT.md).

---

## Architecture

**One Three.js viewer for both meshes and splats**, rather than `<model-viewer>` for meshes and
something else for splats. Waypoints are Cartesian `position` + `target` world coordinates that map
directly onto `camera-controls`' `setLookAt`, and `<model-viewer>` cannot render splats at all. One
viewer means one camera model, one set of controls, and identical waypoint behaviour regardless of
what the story's model happens to be.

**The canvas persists across the page/immersive toggle.** Switching modes never reloads the model —
it is the same scene, the same camera, the same WebGL context. This is why the toggle is instant on
a 26 MB splat.

**Story data is fetched, not imported.** Assets live under `public/stories/` and are read at runtime
with `fetch()`. An author drops a folder in and it works; nothing is compiled in, and no build step
stands between writing a story and viewing it.

**Hash routing, deliberately.** The published site uses `HashRouter` and relative data paths, so one
build runs at a domain root, any subfolder, or a colleague's `python3 -m http.server` with no server
configuration. The alternative — `BrowserRouter` plus per-host SPA-fallback rules and a build-time
base path — would force whoever deploys the site to know their exact subfolder and rebuild for it.
The cost is cosmetic `#` URLs. This is why story-data fetches are relative *app-wide*, not just in
the export path.

One caveat that surprises people: the exported site must be **served**, not opened off disk.
Browsers block `fetch()` on `file://`, so double-clicking `index.html` produces a blank page. The
generated `DEPLOY.md` says so.

## Choosing a splat renderer

The engine originally rendered splats with `@mkkellogg/gaussian-splats-3d` and now uses
[Spark](https://github.com/sparkjsdev/spark). The evaluation produced a test worth reusing.

**Ask whether the library can render into a `WebGLRenderer` you already own.** This single question
separates libraries that drop into an existing scene from ones that demand to *be* the application.

PlayCanvas — the obvious candidate, given it authors the SOG format — fails it. Every documented
path constructs a `pc.Application(canvas)` that owns the canvas, the graphics device and the
`requestAnimationFrame` loop, with no supported API for rendering into an externally-managed
renderer. Adopting it would have meant rewriting the viewer, the loaders, the primitives and the VR
viewer: roughly 1,780 lines, none of it covered by tests.

Spark passes it. `SplatMesh extends THREE.Object3D`, and `SparkRenderer` does its sorting from
`onBeforeRender` — so an ordinary `renderer.render(scene, camera)` is sufficient. That is
architecturally the same trick the previous library's `DropInViewer` used, which is precisely why
swapping one for the other was a loader change rather than an engine rewrite.

The general lesson: **a library that inherits from the host framework's base types can be adopted
incrementally; one that owns the frame loop cannot.**

## Splat format traps

**`.sog` maps to `PCSOGSZIP`, never `PCSOGS`.** `PCSOGS` is the multi-file directory form —
`meta.json` plus sibling WebP textures, requiring an `extraFiles` map. `PCSOGSZIP` is the single
bundled file, which is what SuperSplat exports and what every upload actually is. The decoder
rejects the string `pcsogs` outright, so getting this wrong throws at runtime rather than degrading
quietly. There is a test pinning the mapping.

**`.ply` is two different file formats sharing one extension.** A Gaussian-splat PLY (with
`f_dc`/`scale`/`rot` properties) and an ordinary photogrammetry point cloud (`x,y,z` +
`red/green/blue`) are both `.ply`. Routing every `.ply` to the splat loader means a 677k-point
Scaniverse scan gets every point culled — the splat loader drops anything without an `opacity`
attribute — and renders as nothing at all. The engine sniffs the PLY header with a bounded,
cancelled stream read, and routes non-splat PLYs to a separate point-cloud loader.

**Orientation is not automatic.** Splats trained in the INRIA convention (Y-down / Z-forward) load
upside down in a Y-up world. The engine auto-corrects `.ply` and `.sog` — the latter because
SuperSplat, in practice the only producer of bundled SOG, exports from those same sources. Other
formats are usually already Y-up from conversion and are left alone. The correction pivots on the
model's own centre so framing is preserved.

## An API hazard invisible to its own type signature

Spark's `packedSplats.getSplat(i)` returns `{ center, scales, quaternion, opacity, color }`, with
`center` typed as `THREE.Vector3`. It does **not** allocate. Internally:

```js
const packedFields = { center: packedCenter, ... }   // module scope
function unpackSplat(...) { const result = packedFields; /* mutate and return */ }
```

Every call returns *the same object*, with its vectors overwritten in place. This is a deliberate
and defensible trade — allocating a `Vector3` per call across millions of splats would grind the GC
— but nothing in the type advertises it.

So this reads as correct and is catastrophically wrong:

```ts
xs.push(packed.getSplat(i).center)   // N references to ONE vector
```

Every entry ends up holding the last splat's position. The failure is **silent**: no exception, just
a cloud that collapses to a point, an extent that hits its floor, and a camera framing nothing.

The engine's response was structural rather than documentary. A single function,
`sampleSplatCenters()` in `src/three/splatFraming.ts`, is the only place in the codebase that calls
`getSplat` — and it returns **plain number arrays**. There is nothing to retain and nothing to
alias, so the bug is unreachable through the API by construction.

The transferable principle: **when an API's hazard is invisible to the type system, remove the
ability to express it rather than documenting it.** A comment is a rule somebody has to remember; a
return type is a rule the compiler enforces. (A test asserting "the copy still happens" was written,
then mutation-tested, and found not to catch the bug at all — the guarantee comes from the return
type, and no test can substitute for it.)

## Frame pacing is not frame rate

A splat story was smooth on an iPad and choppy on a desktop with far more GPU headroom. Measured on
the same 13 MB `.spz`:

| Configuration | Desktop | iPad | Reading |
| --- | --- | --- | --- |
| baseline | 70–80 fps, **choppy** | 30–35 fps, smooth | the highest frame rate was the worst experience |
| high-performance GPU | 16–17 fps, **smooth** | 30–35, smooth | lower rate, but smooth |
| forced pixel ratio 1 / 0.5 | ~16 fps, unchanged | smooth | **not** fill-rate — fewer pixels did not help |
| aggressive splat culling | choppy, still high fps | smooth | **not** splat count |

The choppy case had the *highest* average frame rate, which is the signature of a **pacing** problem
rather than a throughput one. On a dual-GPU laptop, `powerPreference: 'default'` bound WebGL to the
integrated GPU while the display was driven by the other one, so every frame was copied across the
GPU boundary before presentation. The RAF loop is not blocked by that copy, so the counter free-ran
while presented frames arrived at irregular intervals. The iPad, with a single GPU and one
presentation path, was always evenly paced and therefore always smooth.

The fix is one line — create the renderer with `powerPreference: 'high-performance'` — and it is a
WebGL context attribute, so it needs no headers, no secure context and no host configuration.

**Average FPS is not smoothness. Frame-time consistency is what the eye reads.** An evenly paced 16
fps looked better than a jittery 75.

*(The ~16 fps ceiling that remained was the CPU depth sort, and it was later removed by the renderer
migration: the same scene now runs at 35 fps.)*

## Rendering on demand

Readers reported published splat stories lagging after a minute or two, with the fan spinning up;
mesh stories stayed cool. It was not a leak — memory was flat. The render loop was drawing every
frame at 60fps unconditionally, which on a splat story drives the depth sort continuously even while
the reader is standing still, producing sustained load and thermal throttling.

The loop now renders **on demand**: `controls.update()` still runs every frame, because damping has
to keep processing, but a draw only happens when the controls report a change or something calls
`invalidate()`. Idle scenes fall to near-zero CPU.

The subtlety is that a splat's depth sort is **asynchronous** — a worker round-trip — so the frame
that triggers a re-sort draws with the *previous* ordering. Stopping the loop immediately would
leave a mis-sorted frame on screen. The renderer's `onDirty` callback drives `invalidate()`, so the
sort completing is itself what schedules the redraw. Before that callback existed, the engine kept a
fixed 60-frame tail after every change and hoped it was long enough.

## Third-party licence notices under Vite

Vite strips comments at build time, so the MIT/ISC/Zlib notices bundled dependencies carry in their
source do not survive into the output. They have to be reproduced separately.

`scripts/gen-notices.mjs` walks the production dependency tree and writes
`public/THIRD-PARTY-NOTICES.txt`. Writing into `public/` is the trick: Vite copies that directory
into `dist/` verbatim, and the publish manifest then lists it — so the notices reach published sites
through **both** export paths, the in-browser one and the CLI one, with no change to either.

Two edge cases proved necessary in practice, and are likely to bite anyone doing the same:

- Not every package ships a file called `LICENSE`. `jszip` ships `LICENSE.markdown`; `isarray` ships
  no licence file at all and states its terms under a README heading. The reader falls back to
  scanning the README, requiring a reasonable length so a one-line "MIT" pointer is not mistaken for
  licence text.
- Dual-licensed packages need an explicit election. `jszip` is "MIT OR GPL-3.0-or-later"; this
  project elects MIT and says so in the output. `argparse`'s Python-2.0 text is reproduced in full.

## Measuring before optimising

Two cases where the obvious optimisation turned out to be worth nothing:

**Antialiasing on splat scenes.** Spark recommends `antialias: false`, and the reasoning is sound —
WebGL MSAA does nothing for Gaussians, which are already soft-edged. Measured, it made **no
difference to frame rate**: the scene is not fill-rate bound. Since the renderer is constructed
before the story's format is known, and meshes genuinely benefit, antialiasing stays on. The `?aa=0`
flag remains for re-measuring on other hardware.

**Format routing for antialiasing.** The natural follow-up — pick the setting per story, since the
component knows the format before the renderer exists — was dropped for the same reason. It would
have added an editor edge case (the viewer is constructed once and reused across model swaps) to buy
a measured zero.

Both are recorded in code comments with their dates and numbers, so the ideas are not re-litigated
without a fresh measurement.

---

## Related

- **[Development](./DEVELOPMENT.md)** — setup, scripts, and the debug flags referenced above
- **[Gaussian splats & 3D models](./GAUSSIAN-SPLATS.md)** — the author-facing version of the format
  and orientation material
- **[Publishing & sharing](./PUBLISHING.md)** — how export and hosting work
