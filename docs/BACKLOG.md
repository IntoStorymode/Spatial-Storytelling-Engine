# Backlog

Proposed features and improvements beyond the M1–M7 prototype (all merged). Grouped by
theme and roughly ordered by priority within each. Nothing here is committed work — it's a
menu to pull from. See [`DEVLOG.md`](./DEVLOG.md) for what's already done.

Priority key: **P1** = next up / high value · **P2** = valuable, not urgent · **P3** =
nice-to-have / exploratory.

---

## Viewing experience

- **[P1] Responsive Mode A/B for mobile viewing** *(deferred from M7; in progress)*
  Demo target is "desktop authoring, desktop/mobile viewing." ✅ **Collapsible Mode A overlay**
  (tuck-to-left + top-anchor + `dvh` header clearance) landed so the overlay no longer covers
  the scene/header on phones. **Remaining:** touch nav in Mode A (swipe to advance — trial
  after feedback), thumb-target sizing, Mode B phone polish, canvas sizing on tablets. Editor
  stays desktop-only.
- **[P1] Reader navigation A/B — first-person vs orbit** *(done, in review)*
  ✅ Readers can switch orbit ⇄ first-person live (in-viewer toggle), seeded from an
  **author-set per-story default** (`navigation:` frontmatter → parser + serializer + editor
  dropdown). Waypoint fly-to reconciled via `flyToFirstPerson` (stands the eye at the waypoint,
  respecting the first-person clamp). First-person movement: **WASD/QE on desktop**, and on
  **touch** a gesture scheme (one-finger look, two-finger drag = strafe/rise, pinch = walk) with
  a one-time hint. **Remaining/future:** on-screen joystick alternative for touch; a formal
  metric-based A/B would need analytics (not in the local-first prototype).
- **[P2] Mode B wheel "scroll trap"** *(noted during the reader-nav review)*
  In Mode B, scrolling the wheel over the inline 3D model zooms it (`setWheelDolly(true)`,
  caption "scroll to zoom") instead of continuing the page scroll — the article scroll stalls
  over the figure. Options: disable wheel-zoom in Mode B (pinch/drag only), click-to-zoom
  opt-in, or leave as an intended feature. Deferred pending mobile feedback.
- **[P2] Loading & error states in the viewer** *(mostly done in M8)*
  ✅ Model loading indicator, ✅ graceful fallback when a model or media file is missing
  (placeholder/message), and ✅ a top-level error boundary all landed in M8. **Remaining:**
  surface parser `warnings[]` to the reader/author (still shown only in Mode B) instead of
  silently dropping them in Mode A.
- **[P2] Deep-linkable item / shareable view**
  URL reflects `?mode=` and the active item so a reader can link to a specific waypoint.
- **[P3] Transition polish**
  Per-waypoint easing/duration controls; optional crossfade of overlay content during the
  camera fly.

## Editor

- **[P1] Editor onboarding / tutorial** *(noted in memory; waypoint UI confused the user)*
  A first-run walkthrough or inline coach-marks explaining items vs waypoints, the start
  camera, and fly/orbit controls.
- **[P2] Reorder items by drag-and-drop** (currently up/down buttons only).
- **[P2] Inline validation in the editor**
  Flag missing model, items without waypoints, broken `src` paths before export.
- **[P2] Duplicate / templated item** to speed up building longer stories.
- **[P3] Undo/redo** for editor draft mutations.
- **[P3] Autosave draft to localStorage** so an accidental tab close doesn't lose work
  (complements the in-memory resume snapshot).

## Authoring & assets

- **[P2] Guided model import**
  In-app guidance (or a thin wrapper) around the SuperSplat clean/convert step, plus
  clearer messaging on splat formats and recommended `.ksplat` sizes.
- **[P2] Asset management for uploads** *(done in M8; export path superseded by M10)*
  ✅ Per-item media upload lets the author attach files in the editor. The M8 source
  "Download bundle" was **replaced in M10** by one-click **⛭ Download website**, which packages
  uploaded assets straight into a deployable site (see Platform / distribution below).
  **Remaining:** media referenced by a *typed* path (not uploaded) still isn't included — the
  author copies it in by hand.
- **[P3] Multiple models / model switching within one story** (exploratory).
- **[P3] Point-cloud PLY polish** *(after the point-cloud support fix)* — robust percentile framing
  for point clouds (mirror `robustSplatFraming`) if stray outliers balloon the AABB; a soft
  large-cloud performance/point-count warning; and a per-file orientation override for the rare
  point cloud that isn't Z-up (the loader assumes Z-up → Y-up).

## Robustness & quality

- **[P1] Test coverage beyond the parser**
  Component/integration tests for mode toggle (no reload), Mode A nav (one gesture = one
  item), and the editor → preview resume round trip.
- **[P2] Performance pass on large splats**
  Profile load + sort cost; consider progressive loading UI and a splat-count budget warning.
- **[P2] GPU-accelerated splat sort A/B** *(after the on-demand-render idle fix)* — on-demand
  rendering quiets the *idle* splat load; this targets the *active-navigation* cost. Try
  `gpuAcceleratedSort: true` in `loadSplat.ts` (moves the per-frame depth sort off the CPU worker)
  and confirm it still renders on the Vercel deploy without COOP/COEP isolation headers.
- **[P3] `renderer.forceContextLoss()` on dispose** *(hygiene)* — `ThreeViewer.dispose()` calls
  `renderer.dispose()` but not `forceContextLoss()`, so a WebGL context lingers until GC. Low risk
  today (single long-lived viewer), but worth adding if repeated story-to-story navigation ever
  bumps Chrome's ~16-context cap.
- **[P3] Accessibility audit**
  Keyboard reachability of all editor/viewer controls, focus management on mode toggle,
  reduced-motion coverage end to end.

## Platform / distribution (post-prototype)

- **[done in M10, PR #16] One-click in-editor website export**
  ✅ **⛭ Download website** in the editor produces the same deployable `<slug>-site.zip` as
  `publish:site`, assembled **in the browser** — no repo drop, no `index.json` merge, no CLI,
  no per-story rebuild. A build-time `dist/publish-manifest.json` lists the app shell;
  `src/publish/buildSite.ts` re-zips it with the current story, and `src/publish/siteTemplate.mjs`
  is shared with the CLI so the two paths can't drift. Disabled under `npm run dev` (no build →
  no shell), where `publish:site` stays the terminal path. Author guide:
  [`PUBLISHING.md`](./PUBLISHING.md). **Remaining / future:** same single-story "kiosk" scope and
  typed-path-media caveat as M9 below; app-version skew between a cached shell and a newer story
  is possible (the manifest's `appVersion` enables a future warning).
- **[done in M9, PR #10] Deploy-anywhere static-site export**
  ✅ `npm run publish:site -- <slug>` exports a story as a **self-contained website**
  (`<slug>-site.zip` = a deployable folder + `DEPLOY.md`) that runs on any static host — a
  domain root, a subfolder (e.g. `news.com/spatial/`), or `file://` — with no backend, no
  server config, and no COOP/COEP headers. Achieved by making the app path-agnostic
  (`HashRouter` + relative story-data paths) so the same build resolves wherever it's served.
  Author guide: [`PUBLISHING.md`](./PUBLISHING.md). **Remaining / future:** a multi-story
  gallery site export (this is single-story "kiosk" only — see below); optional custom-domain
  guidance; the M8 "typed-path media not bundled" caveat still applies to the source story.
- **[P3] Story registry / gallery** beyond the single `index.json` demo list — including a
  *whole-gallery* static-site export (M9 ships single-story only).
- **[P2] Standalone VR viewer tool (WebXR, GLB-only)** *(plan ready)* — a separate Vite entry (`vr.html` + `src/vr/`) that opens one GLB story in VR (dolly-rig locomotion, teleport-to-waypoint, in-scene caption), fully isolated from the main platform (import-only reuse of `parseStory`/`loadModel`); splats-in-VR and full 3D UI deferred. Full plan: [`vr-tool-plan.md`](./vr-tool-plan.md).

---

## Deferred items carried from milestones

| Item | Origin | Priority |
| --- | --- | --- |
| Responsive Mode A/B mobile viewing | M7 (deferred) | P1 |
| Editor onboarding / tutorial | noted during M6 | P1 |
