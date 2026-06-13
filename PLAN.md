# Spatial Storytelling Platform — Prototype Implementation Plan

## Context

This is a **greenfield build**. The repo currently contains only a `References/` folder
(a PDF one-pager and an HTML research deck). We are building a local-first web prototype
that demonstrates one core concept from the research:

> **The scan is shared infrastructure; the story is the act of authorship.**

Concretely: a single Markdown `story.md` file drives **two switchable presentation modes**
without reloading —

- **Mode B — Page view (default):** a scrolling long-form article; the 3D model is one
  inline element in the scroll. ("Narrative *around* the scan.")
- **Mode A — Immersive view:** a full-screen 3D scene where scrolling / Next-Prev animates
  the camera to each story item's bound hotspot and shows its content as an overlay.
  ("Narrative *inside* the scan.")

The prototype is a proof of concept for a presentation — no backend, auth, or deployment.
It must run out of the box with `npm run dev`, and a person with a Scaniverse export
(`.glb` or `.splat`/`.ply`) plus media files should be able to drop files into
`/stories/my-story/assets/`, write a `story.md`, and see both modes work from one file.

### Key decisions (confirmed with user)
1. **Framework:** React 18 + Vite 5 + TypeScript.
2. **3D engine:** **One unified Three.js viewer** for *both* GLB and Gaussian splats —
   **not** `<model-viewer>`. Hotspots are Cartesian (`position` + `target` world coords),
   which map directly to `camera-controls`' `setLookAt(...)`; model-viewer only exposes
   orbital camera coords and cannot render splats at all. Splats render via
   `@mkkellogg/gaussian-splats-3d`. **SuperSplat** (an editor *app*, not a library) is
   recommended in the README as the author's tool to clean/convert raw `.ply` → web
   `.ksplat`.
3. **Editor:** Full editor (screen 2) **including click-to-place hotspots** via raycasting.
4. **Demo asset:** Ships with a generated GLB / built-in primitive so it runs with zero
   binary downloads; the splat-loading code path is fully built and documented (drop in a
   `.splat`/`.ply` to see it work).

---

## Tech stack & dependencies

- `react`, `react-dom`, `react-router-dom`
- `zustand` — lightweight shared store (story, mode, activeIndex, viewer instance)
- `three` + `three/examples/jsm` loaders (`GLTFLoader`)
- `camera-controls` (yomotsu) — camera + the hotspot tween engine (`setLookAt`)
- `@mkkellogg/gaussian-splats-3d` — splat rendering (`DropInViewer`)
- `js-yaml` — parse/dump the YAML frontmatter and hotspot sub-blocks
- Dev: `vite`, `typescript`, `@types/*`
- **Not** using `gray-matter` (Buffer polyfill friction; body uses `---` separators) — a
  small hand-rolled splitter + `js-yaml` instead.

---

## Directory structure

```
Spatial-Storytelling-Platform/
├─ index.html
├─ package.json                    # scripts incl. predev gen:assets
├─ vite.config.ts                  # COOP/COEP headers, base: './'
├─ tsconfig.json
├─ README.md                       # "drop your Scaniverse export + write story.md"; SuperSplat note
├─ scripts/
│  └─ gen-assets.mjs               # builds demo cube.glb + silent narration.wav (no downloads)
├─ public/
│  └─ stories/
│     ├─ index.json                # registry of stories for Home (no backend)
│     └─ demo/
│        ├─ story.md
│        └─ assets/
│           ├─ cube.glb            # generated; or story uses model: builtin:room
│           ├─ entrance.svg        # placeholder image (text-based, no binary)
│           └─ narration.wav       # generated silent placeholder audio
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                      # router
│  ├─ routes/
│  │  ├─ HomeRoute.tsx
│  │  ├─ EditorRoute.tsx
│  │  └─ ViewerRoute.tsx
│  ├─ store/
│  │  └─ useStoryStore.ts          # zustand: story, mode, activeIndex, viewer
│  ├─ parser/
│  │  ├─ types.ts                  # Story, StoryItem, Hotspot, Frontmatter
│  │  ├─ parseStory.ts             # md → Story
│  │  └─ serializeStory.ts         # Story → md (inverse of parser)
│  ├─ three/
│  │  ├─ ThreeViewer.ts            # framework-agnostic engine class
│  │  ├─ loadModel.ts              # extension dispatcher (glb / splat / builtin:)
│  │  ├─ primitives.ts             # builtin room/cube geometry
│  │  └─ raycast.ts                # screen point → world point (mesh + splat fallback)
│  ├─ components/
│  │  ├─ ThreeCanvas.tsx           # React wrapper mounting ThreeViewer (persistent)
│  │  ├─ ModeToggle.tsx
│  │  ├─ content/
│  │  │  ├─ ItemContent.tsx        # dispatch by item.type — SHARED by Mode A & B
│  │  │  ├─ TextBlock.tsx
│  │  │  ├─ ImageBlock.tsx
│  │  │  ├─ AudioBlock.tsx
│  │  │  └─ VideoBlock.tsx
│  │  ├─ viewer/
│  │  │  ├─ PageView.tsx           # Mode B
│  │  │  ├─ ImmersiveView.tsx      # Mode A
│  │  │  ├─ OverlayPanel.tsx       # Mode A content overlay
│  │  │  ├─ NavControls.tsx        # Prev/Next + wheel/key handlers
│  │  │  └─ ProgressIndicator.tsx
│  │  └─ editor/
│  │     ├─ StoryMetaForm.tsx
│  │     ├─ ItemList.tsx           # ordered add/remove/reorder/select
│  │     ├─ ItemForm.tsx           # type selector + conditional content input
│  │     ├─ ModelUpload.tsx
│  │     ├─ HotspotPlacer.tsx      # click-to-place in 3D
│  │     └─ ExportBar.tsx          # serialize → download story.md
│  └─ styles/
│     └─ theme.css                 # palette + fonts from reference deck
```

### Styling (from the reference deck)
Dark base `#171614`, panel `#1F1D1A`, accent `#C17A3A`, text `#EDE8DF`; fonts Playfair
Display (display), Inter (body), IBM Plex Mono (labels/eyebrows). UI must not compete with
the 3D content.

---

## Data model & parser

`parser/types.ts`:
```ts
type ItemType = 'text' | 'image' | 'audio' | 'video'
interface Hotspot { position:[number,number,number]; target:[number,number,number] }
interface StoryItem { id:string; title:string; type:ItemType; src?:string; caption?:string; body:string; hotspot?:Hotspot }
interface Frontmatter { title:string; author:string; location:string; date:string; model:string }
interface Story { frontmatter:Frontmatter; items:StoryItem[]; basePath:string; warnings:string[] }
```

`parseStory(raw, basePath)` — forward-scanning, line-oriented:
1. **Frontmatter:** file starts with `---`; take to the next `---` line; `js-yaml.load` → `Frontmatter`. Remainder is the body.
2. **Item split:** split body on `/^---\s*$/m` into chunks.
3. **Per chunk:** first line `/^##\s*\[([^\]]+)\]\s*(.*)$/` → `id`, `title`; collect leading
   `key: value` metadata (`type`, `src`, `caption`); accumulate freeform `body` until a
   `hotspot:` line; `js-yaml.load` the indented hotspot block → `{position, target}` (coerce
   to 3-number tuples).
4. **Validate** softly — collect issues into `warnings[]` rather than throwing (prototype
   resilience). Resolve `src`/`model` relative to `basePath`.

`serializeStory(story)` is the exact inverse, emitting `position`/`target` as inline flow
arrays (`[x, y, z]`, ~4 decimals) to match the spec example. **Round-trip gate:**
`parse(serialize(story))` deep-equals `story` (modulo whitespace) — lock with a test before
building UI on top.

---

## State / data flow & routing

Routes (`react-router-dom`):
- `/` → `HomeRoute` (reads `public/stories/index.json`)
- `/story/:id` → `ViewerRoute` (fetch + parse `story.md`, render Mode A/B)
- `/edit/new` and `/edit/:id` → `EditorRoute`

`useStoryStore` (zustand): `{ story, mode:'page'|'immersive', activeIndex, viewer, setStory, setMode, setActiveIndex }`. Default `mode = 'page'` (Mode B).

**Toggle without reload (critical):** `ViewerRoute` parses once and mounts **one**
persistent `<ThreeCanvas>` whose `ThreeViewer` loads the model **once**. `mode` only
re-lays-out *around* the persistent canvas (inline block in Mode B vs `fixed; inset:0` in
Mode A) — the WebGL context and loaded model are never torn down; `ThreeViewer.resize()` on
layout change. `activeIndex` is shared: Mode A's Next/Prev/scroll set it; Mode B uses an
`IntersectionObserver` to update it as items scroll into view, so toggling A↔B preserves
position.

---

## 3D viewer (`three/ThreeViewer.ts`)

- One `THREE.PerspectiveCamera`, one `camera-controls` instance, one RAF loop
  (`controls.update(delta)`, render, splat sort each frame).
- `loadModel(url)` dispatcher: `.glb/.gltf → GLTFLoader`; `.ply/.splat/.ksplat/.spz →
  GaussianSplats3D.DropInViewer` added to *our* scene with *our* camera
  (`gpuAcceleratedSort:true`, `showLoadingUI:false`); `builtin:room|cube → primitives.ts`.
- After load, frame an initial camera from the model bounding sphere (fallback when a
  hotspot is missing).

### Mode A camera animation
On `activeIndex` change:
```ts
const h = items[activeIndex].hotspot ?? fallbackFraming
viewer.controls.setLookAt(...h.position, ...h.target, true /* animate */)
```
`camera-controls` interpolates position + target together with damped easing. Driving
`activeIndex`: Next/Prev buttons and Arrow keys; scroll wheel accumulates `deltaY` past a
threshold = one item, **locked during an in-flight transition** so one gesture = one item;
`preventDefault` wheel inside the immersive container. `prefers-reduced-motion` →
`setLookAt(..., false)` to snap.

---

## Editor (screen 2) — full, with click-to-place

- `StoryMetaForm` — title/author/location/date/model.
- `ModelUpload` — `<input type=file>`; store as object URL in memory, pass to `ThreeViewer`;
  on export the author keeps the file in their `assets/` (documented).
- `ItemList` + `ItemForm` — ordered CRUD/reorder; type selector with conditional content
  input (textarea for text; file/url + caption for image/audio/video).
- `HotspotPlacer` — embeds `ThreeCanvas` in editor mode. Two affordances:
  - **Set target:** click in scene → `raycaster.setFromCamera(ndc, camera)`. GLB:
    `intersectObjects(gltf.scene.children, true).point`. Splat: nearest splat-center hit;
    **fallback** = intersect an invisible ground `THREE.Plane` / fixed distance along ray so
    placement never blocks. Place a `THREE.Sprite` marker for feedback.
  - **Capture camera position:** use the current camera world position as `hotspot.position`.
  - Bind both to the selected `StoryItem`.
- `ExportBar` — `serializeStory` → `Blob` download named `story.md`; enhancement: File System
  Access API (`showSaveFilePicker`) where supported.

---

## Viewer screens (3 & 4) & Home (1)

- **Home (`HomeRoute`):** `StoryCard` per `index.json` entry (title/author/location/date,
  thumbnail), per-card mode toggle (passes `?mode=` to the viewer), `NewStoryButton` →
  `/edit/new`.
- **Mode B (`PageView`):** long-form column (~680px), header, `story.items` rendered
  top-to-bottom via the shared `ItemContent`; the `<ThreeCanvas>` appears inline as one
  block; top-right `ModeToggle`.
- **Mode A (`ImmersiveView`):** full-screen canvas background; `OverlayPanel` renders the
  active item via the **same** `ItemContent`; `NavControls` (Prev/Next + wheel/keys);
  `ProgressIndicator` (`activeIndex+1 / n`); `ModeToggle` back to page.
- `content/ItemContent.tsx` + `TextBlock/ImageBlock/AudioBlock/VideoBlock` are the single
  shared source of truth for rendering each media type in both modes.

---

## Demo assets — zero external downloads

`scripts/gen-assets.mjs` (run via `npm run gen:assets`, wired into `predev`/`prebuild`):
- **GLB cube/room:** Three `GLTFExporter` (Node) on a box/grouped-planes "room" →
  `public/stories/demo/assets/cube.glb`. Fallback: `loadModel` supports `builtin:room` so the
  demo renders even with no GLB present; demo `story.md` may ship `model: builtin:room`.
- **Image:** hand-written `entrance.svg` (pure text, no binary).
- **Audio:** minimal valid silent WAV (44-byte header + zero samples) written in code.

Demo `story.md`: item-01 text + hotspot, item-02 image (`assets/entrance.svg`) + hotspot,
item-03 audio (`assets/narration.wav`) + hotspot — three hotspots framing three sides of the
room.

---

## Build / run

`package.json` scripts:
```
"gen:assets": "node scripts/gen-assets.mjs",
"predev":   "node scripts/gen-assets.mjs",
"dev":      "vite",
"build":    "tsc -b && vite build",
"preview":  "vite preview"
```

- Serve all story data under `public/stories/...` (verbatim, no hashing); app `fetch()`es
  `story.md` / `index.json` and loaders fetch `.glb`/`.splat` as `arrayBuffer`. Do **not**
  `import` these — keep them runtime assets so users drop files in without touching code.
- **COOP/COEP for splats** (GaussianSplats3D workers / `SharedArrayBuffer` GPU sort) in
  `vite.config.ts` `server.headers` (mirror in `preview`):
  `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`.
- `base: './'` so the splat lib worker paths resolve. `.splat`/`.ksplat` served as
  `application/octet-stream` is fine (read as `arrayBuffer`).

---

## Implementation order (milestones)

Front-loads the two things the spec calls central (parser/data model + Mode A camera
animation) and defers the riskiest feature (editor splat raycast) until the viewer is proven.

- **M1 — Data core (no 3D):** `types.ts`, `parseStory`, `serializeStory`, demo `story.md`,
  round-trip test.
- **M2 — ThreeViewer (GLB + builtin):** engine + `camera-controls` + `loadModel` + `gen-assets`; prove `setLookAt` tween on a button.
- **M3 — Mode B + Home + routing:** shared `ItemContent` renderers, inline canvas, `index.json`.
- **M4 — Mode A:** `activeIndex` store, Next/Prev/wheel/keys, per-hotspot `setLookAt`,
  `OverlayPanel`, `ProgressIndicator`, toggle preserving position. **Auto-tour:** a
  user-toggleable on/off control that auto-advances `activeIndex` through every hotspot on
  a timer (reusing the same `flyTo` + in-flight transition lock); any manual nav (Next/Prev/
  wheel/key) or mode toggle turns it off. Respects `prefers-reduced-motion`.
- **M5 — Splat support:** `DropInViewer` path + COOP/COEP; document dropping in a real
  `.ksplat`/`.splat` (and SuperSplat for converting).
- **M6 — Editor:** meta form, item CRUD/reorder, model upload, `HotspotPlacer` (raycast +
  capture-view), export via serializer; close the create→view loop.
- **M7 — Polish:** reference palette/fonts, reduced-motion, mobile layout, loading states,
  parser-warning surfacing, README walkthrough.

---

## Verification

1. **Round-trip test (M1):** `parseStory(serializeStory(story))` deep-equals `story`
   (modulo whitespace) for the demo story.
2. **Out-of-the-box run:** fresh clone → `npm install` → `npm run dev` → Home lists the demo
   story → open it → Mode B scrolls with the model inline and all three items render
   (text / image+caption / audio player).
3. **Mode toggle:** flip B→A→B; the 3D model never reloads (no flash), and scroll/active
   position is preserved across toggles.
4. **Mode A navigation:** Next/Prev, arrow keys, and scroll wheel each advance exactly one
   item; the camera smoothly animates to each item's hotspot `position`/`target`; progress
   indicator updates.
5. **Splat path:** drop a `.splat`/`.ply`/`.ksplat` into an `assets/` folder, point a
   story's `model:` at it → it renders in both modes and camera animation behaves identically
   to GLB. (Reduced-motion snaps instead of animating.)
6. **Editor end-to-end:** `/edit/new` → set metadata, upload a model, add 3 items, click in
   the 3D viewer to place + bind a hotspot per item, export `story.md` → drop the file into a
   `/stories/<slug>/` folder → open it in the viewer and confirm both modes work from the
   exported file.
