# VR spike — findings

**Question:** do Gaussian splats render acceptably in an `immersive-vr` session on a Meta Quest?

It matters because the real scans are splats. [`vr-tool-plan.md`](./vr-tool-plan.md) scoped splats
**out** of VR as "experimental" and proposed a GLB-only tool. That premise was worth re-testing: the
installed `@mkkellogg/gaussian-splats-3d@0.4.7` exports `WebXRMode.VR/AR` and ships its own VR/AR
buttons, so the library's own answer had changed since the plan was written.

Tested on a **Meta Quest 3**, browser, over HTTPS (a published static site — WebXR needs a secure
context, so `file://` and `http://<LAN-IP>` are both out). Code: `vr.html` + `src/vr/`.

---

## Answers

| # | Question | Answer |
|---|---|---|
| 1 | Do splats render in stereo at all? | **Yes.** `Greenwich.spz` renders correctly in VR on a Quest 3. |
| 2 | Framerate vs the 72–90 Hz target? | **No — 25–35 fps.** Comfortably below the comfort floor. |
| 3 | Per-eye sort artifacts? | **Not the problem.** See "what we ruled out". |
| 4 | Load time (13.4 MB)? | Acceptable, but the progress bar jumps 0% → done (`progressiveLoad: false` downloads the whole file, then decodes). |
| 5 | GLB control in the same harness? | **90 fps.** Locked to the display rate. |

**Verdict: splats in VR are not viable through this library, on this deployment model, today.**
Not for a comfortable experience. **GLB/mesh in VR is completely viable** — the mesh control hits the
display rate with room to spare.

---

## What we ruled out (this is the useful part)

The GLB control at **90 fps** goes through the *same* dolly rig, the same HUD overlay pass, the same
controller polling and the same XR session as the splat path. So none of the harness is to blame, and
neither is WebXR itself.

Then two hypotheses died in a row:

- **Not fill-rate.** Splats are blended, depth-test-free quads, so the obvious suspect was pixels —
  a headset shades two eyes at high resolution. Dropping `xr.setFramebufferScaleFactor` to 0.6
  (≈36% of the pixels) and setting `xr.setFoveation(1)` **barely moved the number**.
- **Not splat count.** Raising `splatAlphaRemovalThreshold` (1 → 20 → 50) drops splats at load. Even a
  large reduction left framerate **at 30–35 fps**.

A framerate that ignores *both* resolution and primitive count is not a rendering-cost problem. It is
a **fixed per-frame cost**, and the most likely candidate is the depth sort: the library **force-disables
its GPU sort whenever `webXRMode` is set** (`gaussian-splats-3d.module.js` ~line 12336), so the sort
runs on a CPU worker — and it re-sorts on almost every frame in VR, because it triggers on a view
change of `angleDiff <= 0.99` (~8°) and a human head never holds still. Worth noting the Quest also
quantises missed frames (90 → 45 → 30), which is consistent with landing flat at ~30 regardless of
what we changed.

**This was NOT run to ground.** Confirming the sort as the culprit (and whether the fixed cost is the
sort, the library's per-frame `update()`, or frame pacing) is open work.

## The trap to avoid

The obvious "fix" is `gpuAcceleratedSort: true`. Don't reach for it casually:

1. The library **refuses it in XR** — it forcibly sets it back to `false` when `webXRMode` is set.
2. It needs `SharedArrayBuffer` → **COOP/COEP headers** → which **breaks the deploy-anywhere promise**.
   Netlify Drop, GitHub Pages and a plain S3 bucket cannot set arbitrary headers. Publishing to any
   static host is a core property of this project (see [`PUBLISHING.md`](./PUBLISHING.md)); trading it
   for VR framerate is a bad deal.

So the CPU sort is not a starting point we can optimise past — it's the ceiling this architecture gives
us for free.

---

## What this changes

- **`vr-tool-plan.md`'s GLB-only scope is vindicated** — but for the *opposite reason* it gave. Splats
  aren't "experimental" in the library; they work, they're just too slow. The conclusion survives; the
  reasoning in that doc should be replaced with this one.
- **A GLB-only VR tool demos almost none of the current work**, because the real scans are splats. That
  tension is unresolved and is the thing to decide before building further.
- **Capture guidance is NOT the escape hatch.** "Just scan smaller" doesn't work — splat count wasn't
  the driver. A mesh export (`.glb`) from the same capture is what makes a scan VR-ready.

## Open questions, if this is picked up again

1. **Profile the frame.** Is the fixed cost the sort worker, the library's `update()`, or Quest frame
   pacing? A Quest OVR Metrics / Chrome remote-profile session would settle it.
2. **Sort less often.** In VR the sort fires on ~8° of head rotation. A larger threshold (sort on
   *position* change, tolerate stale ordering on rotation) may be nearly free visually and is the most
   promising cheap win. It needs a library patch or fork — not an option today.
3. **A different splat renderer.** Something with a GPU sort that doesn't need `SharedArrayBuffer`.
4. **Mesh-alongside-splat authoring** — ship a `.glb` next to the `.spz` so page/immersive get the splat
   and VR gets the mesh. Costs a second asset and a story-format field.

## What was built (kept, and worth keeping regardless)

The spike is a working, self-contained VR viewer — **not** throwaway, and it does not touch the main
platform.

- **`vr.html` + `src/vr/`** — a second Vite entry, vanilla TS. The only shared-file edit is
  `build.rollupOptions.input` in `vite.config.ts`.
- **It publishes for free.** `publishManifest()` sweeps all of `dist/`, and `buildSite.ts` re-zips
  whatever the manifest lists — so `vr.html` lands in **every exported site** with no change to the
  publish code. Verified in `dist/publish-manifest.json`.
- **Dolly-rig locomotion + teleport to a section's waypoint** (via `resolveWaypoint`), controller
  polling (trigger = next, grip/A = back, **B/Y = exit VR**), and an in-headset HUD with caption, the
  section's image, fps and splat count.
- **Both backends**: the splat library's self-driven `Viewer` (its only supported XR path — it owns the
  renderer and uses `setAnimationLoop`, which WebXR requires) and a plain three renderer for meshes.
- **Tunable from the URL** — `?scale=` (framebuffer), `?fov=` (foveation), `?alpha=` (splat count),
  `?story=` — so future experiments don't need a rebuild-and-redeploy per run.
- **No new dependencies.** Everything came from `three@0.169.0` and the splat library already installed.

### Two things worth stealing from this even if VR is shelved

- The HUD needs **its own render pass, after the splats**. The splat `ShaderMaterial` is
  `depthTest: false, depthWrite: false` and the library draws it last, so anything in the shared scene
  is painted over — no depth trick or `renderOrder` will save it.
- Use a **`local`** reference space, not `local-floor`. Then the head starts at the rig origin, so a
  waypoint's authored eye position *is* the dolly position — rather than that height stacked on top of
  the player's real standing height.
