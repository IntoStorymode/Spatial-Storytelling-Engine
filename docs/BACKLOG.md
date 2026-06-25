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
- **[P2] Loading & error states in the viewer**
  Model-loading progress (splats can be large), graceful fallback when a model or media file
  is missing, and surfacing parser `warnings[]` to the reader/author instead of silently
  dropping them.
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
- **[P2] Asset management for uploads**
  Today an uploaded model previews from a `blob:` URL and the author must manually place the
  file at the exported `assets/` path. Consider a "download story bundle" (zip of `story.md`
  + referenced assets) to remove that manual step.
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

- **[P3] Static hosting / publish flow**
  The prototype is local-first with no backend. A future step: a deploy path so a finished
  story can be shared as a URL (the COOP/COEP header requirement for splats needs handling).
- **[P3] Story registry / gallery** beyond the single `index.json` demo list.

---

## Deferred items carried from milestones

| Item | Origin | Priority |
| --- | --- | --- |
| Responsive Mode A/B mobile viewing | M7 (deferred) | P1 |
| Editor onboarding / tutorial | noted during M6 | P1 |
