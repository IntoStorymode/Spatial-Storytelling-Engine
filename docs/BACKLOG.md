# Backlog

Proposed features and improvements beyond the M1–M7 prototype (all merged). Grouped by
theme and roughly ordered by priority within each. Nothing here is committed work — it's a
menu to pull from. See [`DEVLOG.md`](./DEVLOG.md) for what's already done.

Priority key: **P1** = next up / high value · **P2** = valuable, not urgent · **P3** =
nice-to-have / exploratory.

---

## Viewing experience

- **[P1] Responsive Mode A/B for mobile viewing** *(deferred from M7)*
  Demo target is "desktop authoring, desktop/mobile viewing." The viewer needs a mobile
  pass: touch nav in Mode A (swipe/tap to advance `activeIndex`), responsive overlay and
  nav-control layout, correct canvas sizing. Editor stays desktop-only.
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
- **[P2] Asset management for uploads** *(done in M8)*
  ✅ Per-item media upload + a **Download bundle** (zip of `story.md` + uploaded assets in the
  `assets/` layout + an `index-entry.json` + `PUBLISH.txt`) removed the manual copy step for
  uploaded files. **Remaining:** media referenced by a *typed* path (not uploaded) still
  isn't bundled — the author copies it in by hand.
- **[P3] Multiple models / model switching within one story** (exploratory).

## Robustness & quality

- **[P1] Test coverage beyond the parser**
  Component/integration tests for mode toggle (no reload), Mode A nav (one gesture = one
  item), and the editor → preview resume round trip.
- **[P2] Performance pass on large splats**
  Profile load + sort cost; consider progressive loading UI and a splat-count budget warning.
- **[P3] Accessibility audit**
  Keyboard reachability of all editor/viewer controls, focus management on mode toggle,
  reduced-motion coverage end to end.

## Platform / distribution (post-prototype)

- **[P1] M9 — Deploy-anywhere static-site export (planned, implementing next)**
  Extend "Download bundle" into a **complete static site** an author can drop on
  Netlify/Vercel — *and* that an experienced user can deploy into their own site's
  **subfolder** (e.g. `news.com/spatial/`) without rebuilding for that path.
  - **Key finding:** splats already render without COOP/COEP (`loadSplat.ts` uses
    `sharedMemoryForWorkers: false`), so no isolation headers / service worker are needed.
    The only blocker to "deploy anywhere" is that story data is fetched **root-absolute**
    (`fetch('/stories/index.json')`, index entries `path: "/stories/<slug>/story.md"`).
  - **Approach (Option B): hash routing + relative data paths.** With `HashRouter` the
    document is always `index.html`, so relative paths resolve at root, any subpath, or
    `file://` with **zero server config** (no `_redirects`/`404.html`/`vercel.json`).
    Trade-off: URLs gain a `#`. Subpath deploys must be accessed with a trailing slash.
  - **Part A (shared app change, reverify carefully):** `BrowserRouter`→`HashRouter`
    (`main.tsx`); the 3 `/stories/index.json` fetches → relative (`HomeRoute`, `ViewerRoute`,
    `EditorRoute`); committed `public/stories/index.json` entry `path`s → relative;
    `ExportBar.tsx:77` export path → relative. `parseStory.test.ts` is routing-independent
    and stays green. `vite.config` `base: './'` already correct — keep.
  - **Part B:** `scripts/publish-site.mjs` + `npm run publish:site -- <slug>` — build → prune
    `dist/stories/` to the one story + one-entry `index.json` → inject a kiosk redirect into
    `dist/index.html` (`#/story/<slug>`) → write `DEPLOY.md` → zip `dist/` → `<slug>-site.zip`.
    Add `/*-site.zip` to `.gitignore`.
  - **PR shape:** Part A + B + README "Publish as a website" in `feat/m9-static-site`;
    DEVLOG/BACKLOG in a follow-up docs PR (M8 pattern).
  - **Verify:** test + build clean; reverify existing stories (GLB + splat, both modes,
    editor preview) under hash routing; prove a throwaway story (uncommitted) deploys and
    renders at both a root and a subpath served folder.
- **[P3] Story registry / gallery** beyond the single `index.json` demo list.

---

## Deferred items carried from milestones

| Item | Origin | Priority |
| --- | --- | --- |
| Responsive Mode A/B mobile viewing | M7 (deferred) | P1 |
| Editor onboarding / tutorial | noted during M6 | P1 |
