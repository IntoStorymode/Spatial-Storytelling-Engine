# Development Log

A milestone-by-milestone record of what was built and the key decisions behind it.
Newest entries at the top. See [`BACKLOG.md`](./BACKLOG.md) for what's next and
[`../PLAN.md`](../PLAN.md) for the original implementation plan.

**Current state (2026-06-25):** M1–M7 complete and merged to `main`. The full authoring
loop works end to end: create a story → import a model → set a start camera → add items
with waypoints → preview Mode A/B → export `story.md`.

---

## Core concept

A single Markdown `story.md` drives **two switchable presentation modes — without reloading**:

- **Mode B — Page view (default):** a scrolling long-form article; the 3D model is one
  inline element. *Narrative around the scan.*
- **Mode A — Immersive view:** a full-screen 3D scene where scroll / Next-Prev animates the
  camera to each item's bound waypoint and shows its content as an overlay.
  *Narrative inside the scan.*

> The scan is shared infrastructure; the story is the act of authorship.

Both modes read the **same** parsed story. No backend; all data and assets are local files
under `public/stories/`.

## Stack

React 18 · Vite 5 · TypeScript · react-router-dom · zustand · Three.js ·
`camera-controls` (yomotsu) for camera-to-waypoint tweening ·
`@mkkellogg/gaussian-splats-3d` for splat rendering (lazy-loaded) · `js-yaml`.

---

## Milestones

### M7 — Editor polish (merged, PR #7)
Closed the authoring loop and clarified the editor's vocabulary.
- **Story start camera:** optional `Frontmatter.start` (the opening Mode A view). Parser +
  serializer with round-trip idempotence and tests; editor "Story start" panel with a green
  start gizmo and "🚩 Set start to this view"; viewer flies to it on load.
- **In-editor A/B preview:** a `/preview` route renders the live draft in the real viewer
  (Mode A/B toggle, scroll, nav) without exporting. The draft — including an uploaded
  `blob:` model — survives the round trip via a resume snapshot in a zustand draft store.
- **Copy clarity — items vs waypoints:** an *item* is a story section; a *waypoint* is the
  3D camera view bound to it (internally still `hotspot` in the data model). Added hints and
  fixed inconsistent labels.
- **Deferred:** responsive Mode A/B for mobile viewing (its own future milestone). Editor
  stays desktop-only.

### M6 — Story editor (merged, PR #6)
Full create/edit experience with click-to-place waypoints.
- Metadata form, item CRUD/reorder, model upload (preview from a `blob:` URL, export an
  `assets/` path), `HotspotPlacer` embedding the live 3D scene, export via the serializer.
- **Editor camera:** WASD+QE fly-cam, first-person mouse-look walkthrough, orbit mode,
  in-scene waypoint gizmo (camera + look-point + view line).
- **Fixes along the way:** PLY upload from extensionless `blob:` URLs (thread the file
  extension → explicit splat `format`); PLY rendering upside-down (180° X flip for the
  COLMAP Y-down/Z-forward convention, pivoted on model center, scoped to `.ply`); robust
  splat framing (median center + 90th-percentile radius over sampled splat centers) to
  defeat outlier "floater" splats that ballooned the bounding box and flung the camera.

### M5 — Gaussian-splat support (merged, PR #5)
- Splat rendering via `DropInViewer` added to our own scene/camera; COOP/COEP headers for
  the splat workers; lazy-loaded so it only ships to splat-backed stories.
- Supports `.ply` / `.splat` / `.ksplat` / `.spz`. SuperSplat recommended in docs as the
  author's tool to clean/convert raw `.ply` → web `.ksplat`.

### M4 — Mode A immersive view (merged, PR #4)
- `activeIndex` store; Next/Prev, arrow keys, and wheel each advance exactly one item
  (locked during an in-flight transition so one gesture = one item).
- Per-waypoint `setLookAt` camera animation; `OverlayPanel`; `ProgressIndicator`.
- **Auto-tour:** a user-toggleable on/off control that auto-advances through every waypoint
  on a timer; any manual nav or mode toggle turns it off. Respects `prefers-reduced-motion`.
- **Persistent canvas:** one `ThreeViewer` is never torn down on mode toggle — A↔B only
  re-lays-out around the canvas, preserving the WebGL context, loaded model, and position.

### M3 — Mode B + Home + routing (merged, PR #3)
- Shared `ItemContent` renderers (text/image/audio/video) used by *both* modes.
- Page view with the canvas inline; Home reading `public/stories/index.json`; routing.

### M2 — ThreeViewer (merged, PR #2)
- Unified, framework-agnostic Three.js engine: one camera, one `camera-controls` instance,
  one RAF loop. `loadModel` dispatcher (GLB / builtin primitives). Proved the
  camera-to-waypoint `setLookAt` tween on a button.

### M1 — Data core (merged, PR #1)
- Vite/React/TS scaffold; `parseStory` / `serializeStory`; types; demo `story.md`.
- **Round-trip gate:** `parseStory(serializeStory(s))` deep-equals `s`, locked by tests
  before any UI was built on top.

---

## Key architectural decisions

- **One unified Three.js viewer** for both GLB and splats (not `<model-viewer>`): waypoints
  are Cartesian `position`+`target` world coords that map directly to `setLookAt`, and
  `<model-viewer>` cannot render splats.
- **Persistent canvas** so the A↔B toggle never reloads the model.
- **Single shared `ItemContent`** so both modes render media identically — one source of
  truth.
- **Round-trip idempotence** locked by tests so the parser/serializer stay inverse.
- **Local-first / no backend:** story data and assets are runtime files under
  `public/stories/`, `fetch()`ed (not imported) so authors drop files in without touching
  code.

## Conventions

- One PR per milestone, branched `feat/mN-*` off `main`; reviewed, merged, branch deleted,
  then `main` synced locally.
- Commit messages and PR bodies carry the standard Claude Code co-author / generation lines.
