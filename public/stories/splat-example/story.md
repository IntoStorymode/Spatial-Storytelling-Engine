---
title: "Splat Demo — Colour Sphere"
author: "Generated Sample"
location: "Procedurally generated"
date: "2026-06-13"
model: "assets/scene.splat"
---

## [item-01] A scene made of splats

type: text

This story is backed by a **Gaussian splat** instead of a GLB mesh. The model
you see is a sphere of 20,000 splats, generated with no downloads by
`scripts/gen-assets.mjs`. Everything else is identical to a mesh-backed story:
the page view embeds it inline, and the immersive view flies the camera to each
hotspot below.

Drag to orbit. Then switch to the immersive view to move through it.

hotspot:
  position: [2.4, 1.4, 2.4]
  target: [0, 0.8, 0]

---

## [item-02] The other side

type: text

Splat hotspots use the same world-space `position` + `target` as GLB scenes, so
the M6 editor's click-to-place will bind them the same way. Here the camera
swings around to face the sphere from the opposite side.

To use your own scan, replace `assets/scene.splat` with a `.ksplat` / `.splat` /
`.ply` (and update the `model:` line) — see this folder's README.

hotspot:
  position: [-2.2, 1.1, -2.0]
  target: [0, 0.8, 0]
