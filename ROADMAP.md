# Roadmap

What is being worked on next, roughly in order of priority. This is a direction, not a set of
commitments or dates.

Ideas and requests are welcome as [issues](https://github.com/IntoStorymode/Spatial-Storytelling-Engine/issues).

---

## Next

- **Migrate the VR viewer to the current splat renderer.** The main viewer moved to Spark; the
  WebXR viewer still uses the previous library, which is why both are still dependencies. Finishing
  this removes one, and gives VR support for the SOG format for free.
- **Verify VR against the current Three.js.** The engine moved to three 0.180 for the renderer
  migration; the VR path has not been re-tested in a headset since.
- **Exercise the remaining splat formats.** `.ply` splats and `.ksplat` are supported and mapped but
  no bundled story uses either, so nothing confirms those loader paths against the current renderer.

## Authoring

- **Warn about missing assets before export**, rather than at import time. A story that references a
  file the app never received currently exports quietly and fails for the reader.
- **Undo/redo** in the editor.
- **Multiple models in one story**, so a story can move between locations rather than being anchored
  to a single scan.
- **Point-cloud polish** — percentile-based framing for point clouds (splats already have it), a
  warning for very large clouds, and a per-file up-axis override for scans that are not Z-up.

## Reading

- **Accessibility audit.** Captions, transcripts, alt text, keyboard navigation and screen-reader
  behaviour across both modes. Currently unaudited, and the immersive mode in particular needs a
  considered non-visual story.
- **Mobile refinement** of the immersive view — the overlay is workable but was designed on desktop.
- **Transition polish** between sections and between the two modes.

## Platform

- **Deduplicate shared scans.** Today each exported story bundles its own copy of the model, so two
  stories about one building carry it twice. Splitting the story from its scan is the first real
  step from a single-author engine toward the shared-infrastructure idea in the
  [vision](./docs/VISION.md).
- **Story discovery** — a map or index browse mode, secondary to stories rather than replacing them.

Anything requiring accounts, server-side storage or moderation is out of scope for the engine by
design. Those belong to a platform layer built on top of it — see
[Vision → The engine and the platform](./docs/VISION.md#the-engine-and-the-platform).
