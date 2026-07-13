# M10-VR — Standalone VR viewer tool for a single story (GLB-only spike)

> **Superseded in part — read [`vr-spike-findings.md`](./vr-spike-findings.md) first.**
> A spike has since been built and measured on a Quest 3. Its separate-entry architecture is
> **vindicated**; two of its premises are **not**:
> - "Gaussian splats in VR are experimental" — the library ships `WebXRMode.VR` and splats *do*
>   render in stereo. They're simply too slow (25–35 fps vs a 90 fps mesh). The GLB-only scope
>   survives, but for a different reason than this doc gives.
> - The waypoint model below (an inline hotspot per item) predates named waypoints and **will not
>   compile** — a section's `waypoint` is a *name*, resolved via `resolveWaypoint()` in
>   `src/parser/waypoints.ts`. Likewise "items" are now "sections".

## Context

The user wants VR as a **separate tool**, not a mode bolted into the main viewer. In VR the
page-view/immersive-view switch is meaningless, and (from the earlier feasibility research) VR
touches the render loop, camera ownership, and the whole DOM UI — so weaving it into the shared
`ThreeViewer`/`ViewerStage`/`ImmersiveView` would risk the main platform. Instead: a dedicated,
isolated VR viewer for **one GLB story**, that **does not change the main platform**.

**Hard requirement — the main platform is untouched.** No edits to `ThreeViewer.ts`,
`ViewerStage.tsx`, `ImmersiveView.tsx`, the store, the router (`main.tsx`/routes), or any existing
component. The existing SPA's bundle and behavior stay identical. The VR tool is a **new, second
build entry** that only *imports* framework-agnostic helpers.

**From the research:** entering VR (GLB in stereo) is standard (`renderer.xr.enabled` +
`setAnimationLoop`, HTTPS/localhost); the headset owns the camera so locomotion moves a **dolly
rig**; waypoints map to **teleport**; DOM UI is invisible in-headset so story text becomes an
**in-scene caption**; **Gaussian splats in VR are experimental → out of scope** (GLB/glTF only, no
COOP/COEP needed).

**Goal:** open a single GLB story in a dedicated page, Enter VR on the headset, walk it, teleport
between authored waypoints, see the item title as an in-scene caption — with zero footprint on the
main app.

## Architecture — a separate, isolated entry

- **New Vite entry** `vr.html` + `src/vr/` (its own module graph). Vite multi-page: add
  `build.rollupOptions.input = { main: 'index.html', vr: 'vr.html' }` in `vite.config.ts` — the
  **only** shared-file change, and purely additive (the `main` bundle is unaffected). Dev serves
  both; `base: './'` already makes it path-portable.
- **Vanilla TS, no React, no router** — the VR tool is single-purpose, so it avoids the app shell
  entirely (further isolation). It reuses only:
  - `src/parser/parseStory.ts` — parse `story.md` (import-only, unchanged).
  - `src/three/loadModel.ts` — load the GLB/`builtin:` model (import-only, unchanged; splats
    refused, see below).
  - `src/parser/types.ts` — `Story`/`Hotspot` types.
  - the same `public/stories/` data files and `stories/index.json` (relative fetch, per M9).
- **New WebXR renderer is purpose-built** (NOT the shared `ThreeViewer`) — it needs none of that
  class's camera-controls/first-person/wheel/touch/gizmo/splat machinery, so a small dedicated
  renderer is both simpler and guarantees isolation.

## Scope (in / out)

**In:** load one GLB story by slug; a minimal desktop landing (title + **Enter VR** + status,
model framed/slowly auto-rotating); in VR — GLB in stereo, dolly-rig locomotion, **teleport to the
active waypoint**, controller button/thumbstick = Next/Prev, one **in-scene caption** (current item
title, CJK-safe); clean enter/exit.

**Out:** splats in VR; media (image/video/audio) in-scene; a full 3D story UI (rich panel, nav bar,
progress); ray-teleport targeting, smooth-locomotion/snap-turn polish; ANY change to the main SPA;
a "publish VR bundle" export (future, could mirror `scripts/publish-site.mjs`).

## Implementation (all new files, except the one additive config line)

### 1. `vr.html` (new)
Minimal page: a mount `<div>`, a `<script type="module" src="/src/vr/main.ts">`, the same Google-
Fonts `<link>`s as `index.html` (optional). Reads which story to show from `?story=<slug>` (or
`#<slug>`).

### 2. `src/vr/main.ts` (new) — bootstrap + tiny DOM launcher
- Parse the slug from the URL; `fetch('stories/index.json')` → find entry → `fetch(entry.path)` →
  `parseStory(raw, basePath)` (reuse the M9 relative-path pattern).
- If `frontmatter.model` is a splat (`.ply/.splat/.ksplat/.spz`), show "VR supports GLB stories
  only" and stop (splats are out of scope).
- Render a small DOM launcher (title/author + **Enter VR** button + load/status text) — this DOM is
  only for the flat desktop landing; it's irrelevant inside the headset.
- Instantiate `VRStoryViewer`, load the model, wire Enter VR + Next/Prev status.

### 3. `src/vr/VRStoryViewer.ts` (new) — the WebXR renderer
- Scene + `PerspectiveCamera` inside a **`dolly` `THREE.Group`** (added to the scene); `WebGLRenderer`
  with `xr.enabled = true`; `renderer.setAnimationLoop(...)` from the start (this loop is entirely
  the tool's own — no relation to the main app's RAF loop).
- `await loadModel(frontmatter.model, basePath)` → add to scene; frame it; place the dolly at
  `frontmatter.start` (or item 0's hotspot).
- `enterVR()`: `navigator.xr.requestSession('immersive-vr', {optionalFeatures:['local-floor']})` →
  `xr.setReferenceSpaceType('local')` → `xr.setSession(session)`. `isVRSupported()` via
  `navigator.xr?.isSessionSupported('immersive-vr')` gates the button.
- **Teleport:** `goTo(index)` sets `dolly.position` to the waypoint eye and yaws it toward the
  target (pitch left to the head). Next/Prev change the index and teleport.
- **Controller nav:** in the animation loop read `session.inputSources[*].gamepad`, edge-detect a
  button / thumbstick-x → Next/Prev (one press = one step).
- **Caption:** a canvas-textured plane (system font → CJK like the tokwawan title) parented to the
  dolly ~1.5 m ahead at head height, billboarded to `renderer.xr.getCamera()`; redrawn on index
  change.
- Desktop (no session): frame the model with a gentle auto-rotate so the landing isn't blank; no
  camera-controls needed.

### 4. Docs (new/edit, non-code)
Short `docs/` note (or README section) on the VR tool: what it is, that it's GLB-only and separate
from the main app, and how to open/test it. DEVLOG "VR tool spike" entry + BACKLOG follow-ups.

## Isolation guarantee (what is and isn't touched)
- **Unchanged:** `src/three/ThreeViewer.ts`, `src/components/**` (all viewer/editor UI),
  `src/store/**`, `src/routes/**`, `src/main.tsx`, `index.html`. The main SPA builds and behaves
  identically.
- **Import-only reuse (no edits):** `src/parser/parseStory.ts`, `src/three/loadModel.ts`,
  `src/parser/types.ts`.
- **Only shared edit:** `vite.config.ts` — add the second rollup input (additive; does not alter
  the `main` bundle). Note: `scripts/publish-site.mjs` (M9) is unaffected — it prunes `dist/stories`,
  not html; `vr.html` is just an extra top-level file and can be excluded from a published
  single-story site later if desired.

## Verification
- **Main-platform regression = none by construction**, but still: `npm run build` (both entries
  compile), `npm run test` (parser green), and a quick `npm run dev` smoke of the existing app at
  `/` to confirm it's unchanged.
- **Serve a secure context to the Quest:** `adb reverse tcp:5173 tcp:5173` → open
  `http://localhost:5173/vr.html?story=demo` in the Quest browser (localhost = secure context, no
  cert). Fallback: Vite HTTPS + LAN URL (accept self-signed). WebXR won't start over plain
  `http://<LAN-IP>`.
- **In headset** (GLB story, e.g. `demo` or the tokwawan GLB): Enter VR → model in stereo, stable;
  controller advances waypoints and the view **teleports** to each eye pose; caption shows the item
  title (incl. CJK) facing you; exit returns to the flat landing.
- **Splat story** (`vr.html?story=splat-example`) shows the "GLB only" message and no Enter-VR.

## Risks / follow-ups
- Reference space `local` keeps the head near the authored eye; revisit `local-floor` if height
  feels off. Comfort (snap-turn, ray teleport) deferred.
- Follow-ups (BACKLOG): in-scene rich UI (troika-three-text / three-mesh-ui), media in VR, the
  splat-in-VR R&D (per-eye sort, COOP/COEP + GPU sort), and optionally a "publish VR bundle" export
  mirroring `publish:site`.

## Delivery
One PR `feat/m10-vr-tool` off `main` (repo convention: Claude Code co-author / generation lines);
DEVLOG + BACKLOG notes. No test-story data committed (standing constraint — the uncommitted tokwawan
story + `index.json` edit stay local).
