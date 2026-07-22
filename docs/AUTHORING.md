# Authoring a story

A story is a single Markdown file — `story.md` — plus its media files (a 3D model, images,
audio, video) in an `assets/` folder next to it. Nothing is locked in a database: a story is
plain files you can zip, move, and open anywhere.

There are two ways to write one:

- **[The in-app editor](#the-in-app-editor)** — the quickest path; no Markdown by hand.
- **[By hand](#authoring-by-hand)** — write `story.md` in your text editor and drop files in a
  folder.

Either way, the output is the same `story.md` + `assets/` bundle, and the
[format reference](#storymd-format-reference) below is the source of truth.

---

## The in-app editor

From the Home page click **+ New story**.

![The story editor — metadata form, 3D scene, and section list](./images/editor.png)

1. **Scene** — **Upload file…** your 3D scan. A [Scaniverse](https://scaniverse.com/) export
   works well: `.glb` for a mesh, or `.sog` / `.ply` / `.splat` / `.ksplat` / `.spz` for a
   Gaussian splat. See [Gaussian splats & 3D models](./GAUSSIAN-SPLATS.md) for preparing scans.
   No scan yet? Capture one on a phone with Scaniverse or Polycam.
2. **Story** — fill in the title, author, location, and date, then **add sections** — each section
   is a beat in the story: **text**, **image**, **audio**, or **video**. Add as many as you like and
   **Upload file…** any media inline. Reorder them with the up/down controls.
3. **Waypoints** — this is what makes it spatial. Frame the 3D scene and **＋ Add a waypoint** to
   save that view; then point each section at a waypoint (the picker in the section form). The camera
   flies there when that section is active in the immersive view. The **first section's waypoint is
   the opening view** — there's no separate "start" control.

   ![Placing a waypoint in the 3D scene](./images/waypoint.png)
4. **Preview** — hit **▶ Preview** to check both modes live: **Page view** (Mode B, the
   scrolling article) and **Immersive view** (Mode A, the full-screen scene).
5. **Reader navigation** (optional) — choose the immersive default: **First-person** (look around
   and walk with WASD, the default) or **Orbit** (circle the model). Readers can still switch live.
6. **Model orientation** (optional) — if a splat loads upside down, set this to **Flip upright**.
   See [orientation](./GAUSSIAN-SPLATS.md#orientation).
7. **Save & publish** — click **💾 Save to gallery**; the story appears on the Home page. From
   the gallery, select stories and **⬇ Export** a self-contained website. Full steps:
   [Publishing & sharing](./PUBLISHING.md).

> The editor keeps stories **in memory for the session** — the exported zip is your durable
> copy. Save often, and export before closing the tab.

---

## Authoring by hand

Prefer your own text editor? A story is just a folder under `public/stories/` — so this path
assumes you have cloned the repo and are running it locally (see the
[README quick start](../README.md#quick-start)). If you only want to write a story, the in-app
editor above needs no clone.

```
public/stories/my-story/
├─ story.md
└─ assets/
   ├─ scene.glb        # your 3D model
   ├─ photo.jpg        # any image / audio / video sections reference
   └─ narration.mp3
```

1. Create the folder and drop your model + media into `assets/`.
2. Write `story.md` following the [format reference](#storymd-format-reference).
3. Register it in `public/stories/index.json` so it shows on the Home page:
   ```json
   {
     "stories": [
       {
         "id": "my-story",
         "title": "My Story",
         "author": "You",
         "location": "Somewhere",
         "date": "2026-07-05",
         "path": "stories/my-story/story.md"
       }
     ]
   }
   ```
4. Run `npm run dev` and open the story from Home.

---

## `story.md` format reference

A story file is **YAML frontmatter** (between `---` lines) followed by a sequence of **section
blocks** separated by `---`.

### Frontmatter

```yaml
---
title: "The Old Print Works"
author: "Demo Author"
location: "Cradley Heath, England"
date: "2026-06-01"
model: "assets/scene.glb"     # or builtin:room for a placeholder
navigation: "firstPerson"     # optional — "firstPerson" (default) or "orbit"
orientation: "flip"           # optional — "flip" or "none" (see splats doc)
waypoints:                    # named camera views; sections reference them by name
  - name: "entrance-hall"
    position: [0.5, 1.2, -2.1]
    target: [0, 1, 0]
  - name: "composing-room"
    position: [2.1, 0.8, 1.4]
    target: [0, 0.5, 0]
start: entrance-hall          # optional — name of the opening view
---
```

| Field | Required | Notes |
| --- | --- | --- |
| `title` / `author` / `location` / `date` | yes | Shown on Home and in the story header. |
| `model` | yes | Path to the 3D model (relative to the story folder), or `builtin:room` for a generated placeholder. Formats: `.glb`/`.gltf` meshes, `.sog`/`.ply`/`.splat`/`.ksplat`/`.spz` splats. |
| `navigation` | no | Reader's default immersive camera: `firstPerson` or `orbit`. Absent = `firstPerson`. Either way the reader can switch live with the in-viewer toggle. |
| `orientation` | no | Splat up-axis override: `flip` (force upright) or `none` (no correction). Absent = auto. See [Gaussian splats](./GAUSSIAN-SPLATS.md#orientation). |
| `waypoints` | no | Named camera views (`name` + `position` + `target` in world coordinates). Sections reference them by `name`; several sections can share one. |
| `start` | no | **Name** of the waypoint used as the opening view. If absent, the first section's waypoint opens the story; if neither resolves, the camera is auto-framed from the model bounds. |

### Section blocks

Each section is a heading `## [id] Title`, then a `type:` line, optional `src:` / `caption:` and a
`waypoint:` (the name of the camera view the immersive mode flies to), and freeform body text.

```markdown
## [item-02] The composing room

type: image
src: assets/entrance.svg
caption: "The composing room, photographed in 1987."
waypoint: composing-room

Upstairs, the composing room is where type was set by hand, letter by letter.
```

| Part | Required | Notes |
| --- | --- | --- |
| `## [id] Title` | yes | A stable `id` (e.g. `item-02`) and a display title. The `id` is what is mandatory — a block without `## [id]` is skipped with a warning. The title may be left empty. |
| `type` | yes | `text`, `image`, `audio`, or `video`. |
| `src` | for media | Path to the asset, relative to the story folder (e.g. `assets/photo.jpg`). |
| `caption` | no | Caption shown under the media. |
| `waypoint` | no | Name of a frontmatter waypoint the immersive view flies to. Sections without one fall back to default framing. |
| `autoplay` | no | `true` or `false`, on `audio`/`video` sections only. Plays the clip as the reader arrives at the section in the immersive view. Absent = the reader presses play; page view never auto-plays. Browsers may still block audible autoplay until the reader has interacted with the page, so controls stay visible either way. |
| body | no | Freeform Markdown/plain text. |

Coordinates are Cartesian world-space `[x, y, z]`. Getting them right by hand is fiddly —
the editor's click-to-place is easier.

> **Older stories still load.** A legacy file that inlines a `hotspot:` on a section, or a
> `start:` camera as `position`/`target`, is migrated on load into a synthesized named waypoint
> (a legacy `start` camera becomes a waypoint named `start`) — so old and hand-authored stories keep
> working. Re-exporting writes them back in the current form.

> **Non-fatal warnings.** The parser never throws on a malformed field; it collects warnings
> (e.g. an unknown `navigation` value, a waypoint that doesn't resolve) and surfaces them rather
> than dropping the whole story. A story with warnings still loads.

The TypeScript source of truth for these shapes is
[`src/parser/types.ts`](../src/parser/types.ts).

---

## Next steps

- **Prepare a 3D scan / fix orientation** → [Gaussian splats & 3D models](./GAUSSIAN-SPLATS.md)
- **Publish as a website** → [Publishing & sharing](./PUBLISHING.md)
