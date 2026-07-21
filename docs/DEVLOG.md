# Development Log

A milestone-by-milestone record of what was built and the key decisions behind it.
Newest entries at the top. See [`BACKLOG.md`](./BACKLOG.md) for what's next and
[`../PLAN.md`](../PLAN.md) for the original implementation plan.

**Current state (2026-07-21):** The project is **MIT licensed** and named the **Spatial Storytelling
Engine** (PR #34) — see the milestone below for why MIT rather than AGPL. M1–M12 complete and merged to `main` (a story published live to
Vercel), plus a run of follow-ups: a **WebXR VR viewer** that ships in every export (`vr.html`,
carried by `publishManifest`) — its UI promotion and splat-performance direction are the open calls,
not its availability — an **in-app guidance + copy overhaul**, an **optional section title**, a
**desktop splat-performance fix** (request the high-performance GPU), and a **round of misc viewer
fixes** (PR #33: page view opens at the first section's waypoint, first-person is the immersive
default, per-section media autoplay, and a WASD-feel fix — delta clamp + real smoothing + robust
model-scaled speed). A **mobile pass (collapsible Mode A overlay)** remains in review. The full authoring loop works end to end: create a story → import a
scan → add sections with waypoints (inline media upload) → preview Mode A/B → **💾 Save to gallery**
→ on Home, **select** stories and **Export** a deployable, host-anywhere static site (one → opens
into the story, several → opens on a gallery); an exported zip **re-imports** via **⬆ Import story**.
Author-facing how-to: [`PUBLISHING.md`](./PUBLISHING.md).

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

### MIT licence + rename to "Spatial Storytelling Engine" (PR #34)
The first non-code milestone: the project became legally usable and got its public name
(`chore/mit-license-and-rename`).

- **MIT, `Copyright (c) 2026 Into Storymode`.** Until this landed there was no `LICENSE` file and no
  `license` field in `package.json`, so the project was "all rights reserved" by default — nobody
  could legally use it. AGPL was the earlier instinct, to stop others commercialising the work, and
  was rejected for three reasons: the **code is not the moat** (the engine is built from open-source
  libraries and is realistically rebuildable); **monetisation is service-led**, which makes adoption
  the priority and makes AGPL a source of hesitation for exactly the institutional reviewers we want;
  and the real fear — a closed service **trapping authors' stories** — is a product/data-portability
  problem that AGPL cannot touch, since it compels publishing modified *source*, never data export.
  Lock-in is defended by architecture (`story.md` + plain assets) and brand, not by the licence field.
- **Contributions closed for now** (`CONTRIBUTING.md`): sole copyright holder, zero legal setup,
  reopenable later with a CLA. Issues and forks welcome.
- **Renamed to "Spatial Storytelling Engine"** — naming the core's actual role and separating the free
  core from the business (Into Storymode). 12 references across 7 files, plus the GitHub repo and
  remote (GitHub auto-redirects the old URL). The word never appeared in the in-app UI; the browser
  tab title was the sole user-visible occurrence — and it is load-bearing, because
  `src/publish/buildSite.ts` copies the built `index.html` verbatim into **every exported site**.
  Sites published before this still carry the old title until re-exported.
- **Third-party attribution** (`scripts/gen-notices.mjs` → `public/THIRD-PARTY-NOTICES.txt`, 28
  packages). Vite strips comments at build, so bundled MIT/ISC/Zlib notices must be reproduced
  separately. Writing into `public/` is the trick: Vite copies it into `dist/` and `publishManifest()`
  then lists it, so the notices reach published sites through **both** export paths — the in-browser
  editor export and the CLI export — with no change to either. No new dependencies; it reads
  `node_modules` directly. `jszip`'s dual licence elects MIT explicitly, `argparse`'s Python-2.0 (PSF)
  text is reproduced in full, and two fallbacks proved necessary in practice — `LICENSE.markdown`
  (jszip) and a README licence section (isarray ships no licence file at all).

No behavioural change — parser, serializer, store, router, viewer and `src/vr/*` untouched. 75 tests
pass, build clean, and an exported demo site was verified to carry both the notices and the new title.

### Misc viewer fixes — opening view, first-person default, per-section autoplay, WASD feel (PR #33)
Four small reader/editor fixes bundled together (`fix/misc-viewer-features`):

- **Page view opens at the first section's starting point.** Mode B applied only the story-level
  `start` and otherwise sat on the default bounding-box framing — which for a Gaussian splat is the
  whole point cloud seen from far off. The opening camera now resolves to the **first section's
  waypoint**, falling back to `start`, then framing (`ViewerStage.tsx`). Existing stories set
  `start` == section 1, so no visible regression; splat stories now land where the story begins.
- **Immersive default navigation is first-person, not orbit.** Rather than let the editor selector
  and reader behaviour drift, this flips the read-time meaning of an **absent `navigation:`** field
  from orbit → first-person everywhere it's read (reader seed, store initial, editor selector default
  + option order, type doc). The parser still leaves an absent field unserialized.
- **Per-section media autoplay (immersive only).** Moved autoplay from a story-wide scene option to a
  per-section `autoplay` field so each clip opts in independently — parsed/serialized/round-tripped
  (`META_RE` widened to allow the key, or the line would fall into the body). Threaded through
  `SectionContent` to the audio/video blocks, which `play()` on mount and swallow the browser
  autoplay-policy rejection (controls stay). Editor exposes it as a per-section checkbox on
  audio/video sections; page view never auto-plays.
- **WASD feel — "sometimes unresponsive / sometimes too big a step."** The intermittency was the
  tell. In `ThreeViewer`: **clamp the per-frame motion delta** (`MAX_STEP_DELTA = 1/20 s`) so a frame
  hitch (splat-sort spike, GC) can't turn one long frame into a 10–20× jump — the stall *and* the
  lurch after it; replace the **deprecated no-op `dampingFactor`** (camera-controls 2.10.1 only
  `console.warn`s it) with real `smoothTime` / `draggingSmoothTime`; and scale fly + touch-walk speed
  to a **robust median-based extent** (`core`) instead of the 90th-percentile diameter a sparse
  distant background can inflate. Meshes unchanged.

Deferred to [`BACKLOG.md`](./BACKLOG.md): a **live reader speed control** and an author **`moveSpeed`**
frontmatter option. Per-section autoplay coverage added to the parser tests; 75 pass, build clean.

### VR HUD — richer performance metrics (in review)
The in-headset HUD (`VRStoryViewer.ts`) is the VR viewer's tuning instrument, but it only showed
fps + splat count. Extended it with the readings the desktop splat-choppiness fix taught us to
watch: **frame-time avg/max in ms** (the max is the jank tell — fps alone hides stutter, an even
30 fps reads smooth while a jittery 60 does not), the **eye-buffer resolution** (the XR
framebuffer while in-session, else the canvas buffer — so you can see what `scale`/`fov` actually
produced), and the **GPU** the browser bound (`WEBGL_debug_renderer_info`). Frame-time is a rolling
~90-frame window folded into `VRStats` on each 1 s tick; the HUD canvas grew 256 → 384 px (plane
aspect kept) to fit. The same avg/max ms is added to the flat landing-page readout (`main.ts`) so
it's legible on a desk before entering VR. No new deps; the main app is untouched.

### Splat choppiness on desktop — GPU-selection fix (in review)
Fix: a splat story that was **smooth on iPad Chrome was choppy on desktop Chrome, from the first
camera move** — counterintuitive, since the desktop has more GPU headroom. We built a temporary,
flag-gated diagnostic harness (`src/three/debugTuning.ts` + `DebugHud.tsx`, all behind `?debug`) to
**measure instead of guess**: a live HUD (FPS, frame time, drawing-buffer size, the real GPU the
browser bound via `WEBGL_debug_renderer_info`, `crossOriginIsolated`) plus URL toggles to isolate
each hypothesis — `?spin` (auto-orbit for a comparable path), `?dpr=<n>` (force pixel ratio →
fill-rate), `?alpha=<n>` (drop splats → sort/geometry), `?highpower=0` (browser-default GPU), and
`?gpusort=1` (GPU sort).

Measured on the real 13 MB Greenwich `.spz`, desktop Chrome vs iPad Chrome:

| Flag | Desktop | iPad | Read |
| --- | --- | --- | --- |
| baseline | 70–80 fps, **choppy** | 30–35 fps, smooth | highest fps was the *worst* experience |
| `highpower` (dedicated GPU) | 16–17 fps, **smooth** | 30–35, smooth | lower fps, but smooth |
| `dpr=1` / `dpr=0.5` | ~16 fps, unchanged | smooth | **not** fill-rate — fewer pixels didn't help |
| `alpha=5` / `alpha=20` | choppy (high fps) | smooth | **not** splat count |
| `gpusort=1` | **black screen** | — | broken path; also needs COOP/COEP |

**Analysis.** The choppy case had the *highest* average FPS — the signature of a **frame-pacing**
problem, not a throughput one. On a dual-GPU laptop, `powerPreference: 'default'` bound WebGL to the
**integrated** GPU while the display is driven by the other GPU, so every frame was **copied across
the GPU boundary** before presentation. The RAF loop isn't blocked by that copy, so the counter
free-ran to 70–80 while presented frames arrived at irregular intervals → visible stutter. The iPad
(single GPU, one presentation path) was always evenly paced → always smooth. Average FPS ≠
smoothness here; **frame-time consistency** is what the eye reads.

**Fix (one line, deploy-anywhere safe):** create the `WebGLRenderer` with
`powerPreference: 'high-performance'` (`ThreeViewer.ts`), aligning rendering with the display GPU.
It's a WebGL context attribute — **no COOP/COEP, no secure context, no `vercel.json`** — so it works
on any static host and every exported kiosk. A no-op on single-GPU machines and the iPad; the only
cost is marginally more battery on laptops, expected for a 3D viewer. `?highpower=0` reverts to the
old path to reproduce the bug.

**Left to backlog:** the ~16 fps ceiling on the dedicated GPU was **unchanged by `dpr`** — a fixed
per-frame cost, i.e. the **CPU depth sort** (the exact finding of the VR spike). Lifting it needs the
GPU sort, which requires `SharedArrayBuffer` → COOP/COEP → and breaks deploy-anywhere (and
black-screened here). That stays the open "[P2] GPU-accelerated splat sort" item; 16 fps *evenly
paced* already reads as smooth. The diagnostic harness is kept (behind `?debug`) for future perf work.

### On-demand rendering — idle CPU/heat fix (in review)
Fix: readers reported published splat stories **lagging after 1–2 minutes** with the **fan spinning
up**; GLB stories stayed cool. Task Manager ruled out a memory leak (flat, modest memory) — the
cause was `ThreeViewer.animate()` rendering **every frame at 60fps unconditionally**, which on splat
stories drives the `gaussian-splats-3d` **per-frame CPU depth-sort worker** even while the reader is
stationary → sustained load → thermal throttling. Now the RAF loop renders **on demand**: it still
calls `controls.update()` every frame (cheap; damping must keep processing) but only draws when
`controls.update()` reports a change or an `invalidate()` fires (input, model load, gizmo/scene
edit, resize), keeping a short `RENDER_TAIL_FRAMES` tail so a splat's async sort settles before
rendering stops. Idle splat scenes now fall to ~zero CPU/GPU and the fan quiets; active navigation
renders every frame as before. Contained to `ThreeViewer.ts`; no public API or component changes.

### Point-cloud & mesh PLY support (in review)
Fix: an uploaded Scaniverse `.ply` rendered blank/monotone and unnavigable. The app force-routed
**every** `.ply` to the Gaussian-splat loader, but that file is a plain colored point cloud
(`x,y,z` + `red/green/blue`, no `opacity`/`scale`/`rot`) — so the splat library culled all 677k
points to nothing. Now `loadModel` **sniffs the PLY header** (`plyIsSplat`, a bounded/cancelled
stream read) and routes non-splat PLYs to a new `loadPly`: three's `PLYLoader` → colored
`THREE.Points` (or a vertex-colored `THREE.Mesh` when the PLY has faces), with sRGB→linear vertex
color, a Z-up→Y-up rotation (scan convention), and a bounds-scaled point size. The splat path
(`.ply` splats via `f_dc`/`scale`/`rot` markers, plus `.splat`/`.ksplat`/`.spz`) and GLB are
unchanged; framing reuses the existing AABB path since point clouds aren't marked `isSplat`.

### Reader navigation — first-person vs orbit A/B (in review)
Exposed the engine's first-person camera (previously editor-only) to readers, with an
author-set default and a live reader override.
- **Data model:** optional `navigation: orbit | firstPerson` frontmatter field (parser +
  serializer, round-trip-safe; absent = orbit, so existing stories are byte-identical). Set via
  a new "Reader navigation" dropdown in the editor's Story details.
- **Store + viewer:** `navMode` is seeded per-story from the default by `ViewerStage` (single
  source of truth — `reset()` deliberately doesn't touch it, which fixed a preview clobber where
  a parent route's `reset()` ran after the child seed), then toggled live via `NavModeToggle` in
  the immersive topbar.
- **Waypoint reconciliation:** `ThreeViewer.flyToFirstPerson` stands the eye *at* a waypoint in
  first-person, reusing `placeFirstPerson` so the fixed distance clamp is honored (a plain
  `flyTo` would be pulled back to the pivot).
- **Touch movement:** first-person walk with no keyboard — one-finger drag looks, **two-finger
  drag** strafes/rises, **pinch** walks forward/back. Deltas are accumulated and applied once per
  RAF frame (smooth on slow gestures) with a dominant-gesture split (pinch stays pure-forward, no
  veer). A one-time `TouchWalkHint` explains it on touch devices.
- **Wheel unified with Mode B:** dropped the old Mode-A "wheel steps items" behavior (confusing).
  Now, in both modes, the wheel over the model **zooms** (orbit) or **walks forward/back** like
  W/S (first-person), and the wheel over the overlay panel **scrolls the panel** (`overscroll-behavior:
  contain`). Item navigation is arrows + Prev/Next.
- **Mobile topbar:** a long "First-person" label was wrapping the bar and overlapping the panel;
  fixed by hiding the ambiguous back link on phones, keeping the toggles on one no-wrap line, and
  offsetting the top-anchored panel by the *measured* topbar height (`--immersive-topbar-h` via
  ResizeObserver) so it can never overlap again.
- **Verified:** tsc + vitest (15/15, +4 parser tests) + build clean; desktop + iPhone checks for
  the toggle, waypoint placement, touch walk feel, and the mobile layout. Known: Mode B wheel
  scroll-trap logged to BACKLOG; touch first-person is look + gesture-move (no on-screen joystick).

### Mobile — Collapsible Mode A overlay (in review)
First mobile fix after the first story went live on Vercel. On phones the immersive overlay
(text + media) covered the whole scene and could ride up over the header, blocking orbit and
the ← All stories / page-view controls. Added a **collapse/expand** control that tucks the
panel off to the left (with a left-edge reopen tab) so the reader can orbit the 3D and reach
the header unobstructed.
- **`OverlayPanel` restructured:** a stable wrapper holds the `collapsed` state + a top-left
  Hide button and a *keyed* inner content block (so the per-item fade still replays); the panel
  is a flex column so Hide stays pinned while content scrolls. Local state only — no store,
  routing, 3D, or story-format change, so it's fully reversible.
- **Header/panel never overlap:** panel height capped against `100dvh` (visible viewport, with
  a `vh` fallback) so it can't ride up into the header on iOS Safari; on phones (`≤640px`) the
  panel anchors to the **top** with a constant gap below the header instead of the desktop
  bottom-alignment.
- **Repo hygiene:** `.gitignore` now whitelists story content — only `demo` + `splat-example`
  (+ `index.json`) are tracked; any other/test story folder is ignored so it can't be pushed.
- **Verified:** tsc + vitest (11/11) + build clean; checked on desktop and a real iPhone
  (collapse/reopen, header reachable, no overlap). *Next: reader first-person navigation A/B.*

### M11 — Save-to-gallery + multi-story website export
Reframed M10's in-editor "Download website" (which conflated authoring with publishing and only
made single-story sites) into a gallery workflow: the editor's finishing action is now **💾 Save
to gallery**, and **Home is the gallery** where the author **selects** stories and **exports**.
- **Selection drives the landing page:** export **one** story → the site kiosk-redirects straight
  into it (folder `<slug>-site`); export **multiple** → no redirect, the site opens on the gallery
  listing them (folder `gallery-site`). `src/publish/buildSite.ts`'s `buildSiteZip` was generalized
  to take `stories[]` and inject the kiosk only when `length === 1`; the registry `index.json` now
  carries one entry per exported story.
- **Session-only, in-memory** (new `src/store/useGalleryStore.ts`, no persist). The **exported zip
  is the durable "save"** — deliberately *no* IndexedDB/backend, keeping the founding "a story is
  plain files you can zip" principle intact (a browser DB would trap stories in an opaque store).
  A reload clears the gallery; durable storage + accounts are deferred to the core-engine/SaaS split.
- **Reuse:** saved stories are stored as the editor's existing `EditSnapshot` (`useDraftStore`), so
  **Edit** re-opens one verbatim (blob uploads intact) via a new `stashResume`; asset derivation was
  extracted to `src/publish/collectAssets.ts`, shared by the editor and the export.
- **Verified:** tsc + vitest (19/19, incl. new gallery-store + collectAssets tests) + build clean;
  headless E2E (system Chrome) drove the full flow — author A & B → Save → export A-only boots into
  `#/story/story-a`, export A+B boots on the gallery with both listed → Edit round-trip restores
  title + uploaded model → dev-mode Export disabled. Screenshots captured.

### M10 — One-click in-editor website export
Removed the manual publish round-trip. The M9 flow was: editor **Download bundle** (source zip)
→ hand-copy into `public/stories/` → hand-merge `index.json` → `npm run publish:site` (rebuild)
→ deploy. Now the editor's **⛭ Download website** button produces the deployable
`<slug>-site.zip` **directly, in the browser** — no repo drop, no CLI, no per-story rebuild.
- **Key insight:** a published site = a *generic app shell* (identical per app version) + one
  story's data + a kiosk redirect. The shell already ships with any built/hosted editor, so the
  browser can re-zip it with the current story. `npm run build` emits `publish-manifest.json`
  (all of `dist/` except `stories/**` and itself, via an inline Vite `closeBundle` plugin);
  `src/publish/buildSite.ts` fetches that list, injects the kiosk redirect into `index.html`,
  adds a one-entry `stories/index.json` + `story.md` + uploaded assets, and downloads the zip.
- **DRY:** kiosk / `DEPLOY.md` / index-entry logic moved to `src/publish/siteTemplate.mjs`,
  shared by the browser assembler **and** `scripts/publish-site.mjs`, so the two paths can't
  drift. The CLI now stays the terminal/`npm run dev` path (browser export needs a build).
- **Dev fallback:** under `npm run dev` there's no build → no manifest → the button disables
  itself with a hint pointing to `npm run preview` / the CLI. The old source-bundle download was
  removed (its only purpose was feeding the manual round-trip).
- **Verified:** tsc + vitest (15/15) + build clean; `publish-manifest.json` excludes
  `stories/**`; both the CLI and a faithful replay of the browser assembly produce byte-shape-
  equal sites that boot headless straight into `#/story/demo` and render the story.

### M9 — Deploy-anywhere static-site export (PR #10)
Turned the M8 "Download bundle" (which targets *running the repo*) into a **self-contained
website for one story** that an author can deploy to any static host — a domain root, a
subfolder (e.g. `news.example.com/spatial/`), or even `file://` — with no backend and no
server config. New guide: [`PUBLISHING.md`](./PUBLISHING.md).
- **App made path-agnostic:** `BrowserRouter` → `HashRouter`, and story-data loading made
  relative — the three `fetch('/stories/index.json')` sites and the `index.json` entry
  `path`s (incl. the editor's exported entry) dropped their leading `/`. Combined with Vite's
  existing `base: './'`, the same build now resolves its data and assets relative to wherever
  the folder is served. Trade-off: URLs gain a `#`; subfolder deploys need a trailing slash.
- **No special headers required:** confirmed the splat renderer already runs with
  `sharedMemoryForWorkers: false` (`loadSplat.ts`), so splats work without COOP/COEP isolation
  — no `_headers`/service-worker needed. Hash routing also removes the SPA-fallback need
  (no `_redirects` / `404.html` / `vercel.json` rewrites).
- **`scripts/publish-site.mjs` + `npm run publish:site -- <slug>`:** builds the app, prunes
  `dist/stories` to the one story plus a one-entry `index.json`, injects a kiosk redirect
  (`#/story/<slug>`) so the deployed root opens straight into the story, and zips a deployable
  `<slug>-site/` folder beside a `DEPLOY.md`. `*-site.zip` is git-ignored so published sites
  are never committed.
- **Verified:** tsc + vitest (11/11) + build clean; existing demo/splat stories re-checked in
  the browser under hash routing; published demo and splat sites served by a headerless static
  server at both a domain root and a `/news/spatial/` subpath (kiosk entry + splat render + all
  data paths confirmed; the old root-absolute path 404s at the subpath, proving the fix).

### M8 — Share-readiness (merged, PR #8)
Closed the gaps surfaced by a live walk-through of the create-story flow so the prototype
can be shared with **internal desktop reviewers**. Sharing stays local-first (no backend);
publishing is improved with a zip bundle rather than a hosted service.
- **Editor camera trust:** the First-person→Orbit toggle no longer re-frames the whole model
  (it keeps the composed eye + view direction); new **Go to start** / **Go to waypoint**
  buttons fly the camera back to a saved view (`ThreeViewer.flyToView`, which lifts the
  first-person distance clamp so the eye lands accurately).
- **Mode A start-view fix:** Mode A now opens on the story `start` view; an item's waypoint
  takes over only on the first navigation. Before this, item 1's waypoint silently overrode
  `start` on load — so the M7 start camera was effectively dead whenever item 1 had a
  waypoint.
- **Local-first publishing:** per-item **media upload** (image/audio/video — blob preview
  that survives the `/preview` round-trip via the draft store) and a one-click **Download
  bundle** — a `<slug>.zip` of `story.md` + uploaded assets in the `assets/` layout +
  `index-entry.json` + `PUBLISH.txt`. Unzip into `public/stories/`, merge the entry, done.
  Adds `jszip`.
- **Robustness:** missing-media fallbacks (an "Image unavailable" placeholder for images, a
  message for audio/video), a model loading indicator, a top-level error boundary, and Mode A
  overlay text bounded to the panel width.
- **README:** Node 18+ prerequisite, clone-and-run quickstart, and the bundle publish flow.
- **Deferred:** full editor onboarding/tutorial, validation-chip styling, pre-export
  file-existence validation, and responsive Mode A/B for mobile (still its own milestone).

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
- **Publishing stays browser-side (M8):** the editor can't write to `public/stories/` (the
  browser sandbox forbids it), so instead of a server it exports a **zip bundle** the author
  drops in. A true one-click "Publish" / hosted share service would need a backend — a
  deliberate future departure, not part of the prototype.
- **Hash routing for portable static hosting (M9):** the published site uses `HashRouter`
  and relative data paths so one build runs at any URL path with zero server config —
  preferred over `BrowserRouter` + per-host SPA-fallback rules and a build-time base path,
  which would force the deployer to know (and rebuild for) their exact subfolder. The cost is
  cosmetic `#` URLs. This is why story-data fetches are relative app-wide, not just in export.

## Conventions

- One PR per milestone, branched `feat/mN-*` off `main`; reviewed, merged, branch deleted,
  then `main` synced locally.
- Commit messages and PR bodies carry the standard Claude Code co-author / generation lines.
