# Backlog

Proposed features and improvements beyond the shipped milestones (M1–M12, all merged). Grouped
by theme and roughly ordered by priority within each. Nothing here is committed work — it's a
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

- **[mostly done, PR #30] Editor onboarding / tutorial** *(noted in memory; waypoint UI confused the user)*
  ✅ A session-scoped **Getting started** card (`GettingStarted.tsx`) now appears once on first
  entry to a new story, laying out the four accordion steps (Scene → Story → Waypoints → Publish).
  The copy overhaul also fixed stale in-app hints, named how to capture a scan at the upload step,
  and added a post-export "what next" banner (unzip → Netlify Drop → re-import). All guidance is
  inline `.ed-hint`/banner text — no external links, so it survives a deploy-anywhere export.
  **Remaining:** anchored coach-marks tying the card's steps to the live rail were deliberately
  skipped (the resizable/collapsible rail makes DOM-anchoring brittle); revisit only if the plain
  card proves insufficient.
- **[P2] Reorder sections by drag-and-drop** (currently up/down buttons only).
- **[done] Inline validation in the editor**
  ✅ `src/publish/validateStory.ts` is the single source of readiness truth: it flags a missing
  title, the placeholder `builtin:` scan, media sections with no `src`, a first section without a
  waypoint (the reader's opening view), and a title that yields no export name. Surfaced by the
  header **status pill** (`StoryStatus`) and a **hard gate** on Save to gallery; Preview is always
  allowed. **PR #29** removed the per-section-title requirement — a section title is optional and
  no longer blocks Save or export. **Remaining:** it doesn't yet check that a typed `src` path
  actually resolves — a broken path is only caught on import (see below).
- **[P2] Duplicate / templated section** to speed up building longer stories.
- **[P3] Undo/redo** for editor draft mutations.
- **[P3] Autosave draft to localStorage** so an accidental tab close doesn't lose work
  (complements the in-memory resume snapshot).

## Authoring & assets

- **[P2] Guided model import**
  In-app guidance (or a thin wrapper) around the SuperSplat clean/convert step, plus
  clearer messaging on splat formats and recommended `.ksplat` sizes.
- **[P2] Asset management for uploads** *(done in M8; export path superseded by M10 → M11)*
  ✅ Per-section media upload lets the author attach files in the editor. The M8 source
  "Download bundle" was replaced in M10 by an in-editor website export, then reframed in **M11**
  to **💾 Save to gallery → ⬇ Export** (uploaded assets are packaged into the deployable site on
  export; see Platform / distribution below). **Remaining:** media referenced by a *typed* path
  (not uploaded) still isn't bundled — the author copies it in by hand. **M12** made this
  visible rather than silent: importing a story names every referenced asset whose bytes weren't
  in the bundle, so you can re-upload it. Catching it *before* export (in `validateStory`) is
  still open.
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

- **[done in M12, PR #27] Import an exported story back into the editor**
  ✅ The publish pipeline was write-only — a story that left the app could never return, so an
  old export couldn't be re-edited or pick up newer features. **⬆ Import story** on Home now
  reads an exported site back in, as the `.zip` **or** as the unzipped folder (a native picker
  is *either* a file picker or a folder picker, so a drop zone is what unifies them). Both
  shapes reduce to one `Bundle` (path → lazy bytes) feeding `src/publish/importSite.ts`; reads
  are lazy, so only story.md and the assets a story references are ever decompressed. An
  imported story is just an `EditSnapshot` (`basePath: ''`, `assets/…` paths kept, Files behind
  blob URLs) saved to the gallery — so the editor, viewer, parser and exporter needed **no
  changes**. Old exports arrive **upgraded**: `parseStory` already migrates inline
  `hotspot:`/`start:` cameras into named waypoints. Also made the **slug the story's identity**
  (was recomputed from the title on every save, which forked a duplicate gallery card on re-save
  and leaked into the export folder name); it's now editable in the Publish step, and a title
  with no Latin letters is a readiness issue rather than a silent generic `story` slug.
  **Remaining / future:** loose single files (a bare `story.md` + a separately downloaded scan)
  aren't accepted — you need the whole exported folder/zip. Re-serialization is lossy by design
  (hand-authored comments and unmodelled frontmatter keys are dropped).
- **[done in M11] Save-to-gallery + multi-story website export**
  ✅ Reframed the M10 in-editor export into a gallery flow: **💾 Save to gallery** in the editor →
  on Home, **select** stories and **⬇ Export**. One story → kiosk site (`<slug>-site`); several →
  gallery-first site (`gallery-site`). `buildSiteZip` generalized to `stories[]` (kiosk injected
  only when one). Session-only, in-memory (`useGalleryStore`); the exported zip is the durable
  save — no browser DB. **Remaining / future:** exportable set is session-saved stories only
  (including the repo's registered stories in an export needs the fetch-+-parse-assets path);
  durable cross-session gallery + accounts deferred to the core-engine/SaaS split.
- **[done in M10, PR #16] One-click in-editor website export** *(superseded by M11's gallery flow)*
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
- **[P3] Story registry / gallery** beyond the single `index.json` demo list. *(M11 added a
  session gallery + multi-story "gallery-first" export; M12 made the exported zip re-importable,
  so the round-trip — not a browser DB — is how work survives a reload.)* **Remaining:** a
  durable/registered gallery and exporting the repo's own registered stories (not just
  session-saved ones).
- **[P2] Standalone VR viewer tool (WebXR)** *(spike built + measured — decision needed)*
  ✅ `vr.html` + `src/vr/` ships: a second Vite entry (vanilla TS, no new deps) with dolly-rig
  locomotion, teleport to a section's waypoint, controller nav (trigger/grip/**B-Y to exit**), and an
  in-headset HUD (caption, section image, fps, splat count). URL-tunable (`?story=`, `?scale=`,
  `?fov=`, `?alpha=`). It **publishes for free** — `publishManifest()` sweeps all of `dist/`, so
  `vr.html` is carried into every exported site with no change to `buildSite.ts`. The main platform is
  untouched.
  ⚠️ **Measured on a Quest 3: GLB runs at 90 fps; Gaussian splats manage only 25–35 fps** — and it's
  neither fill-rate nor splat count (both ruled out). The library force-disables its GPU sort in any XR
  session, and the CPU sort can't be escaped without `SharedArrayBuffer` → COOP/COEP → which would break
  deploy-anywhere. **Since the real scans are splats, a GLB-only VR tool demos almost none of the actual
  work — that tension is the open decision.** Full write-up: [`vr-spike-findings.md`](./vr-spike-findings.md).

---

## Deferred items carried from milestones

| Item | Origin | Priority |
| --- | --- | --- |
| Responsive Mode A/B mobile viewing | M7 (deferred) | P1 |
| Editor onboarding / tutorial | noted during M6 | mostly done (PR #30) |
