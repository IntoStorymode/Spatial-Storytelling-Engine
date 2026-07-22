# Development

How to run, test and work on the engine itself. If you want to *write a story* rather than change
the software, [Authoring a story](./AUTHORING.md) is the page you want — and the in-app editor needs
no clone at all.

---

## Setup

**Prerequisites:** Node.js 20+ and npm. (With `nvm`: `nvm use 20`.)

Node 20 is a real floor for the test suite, not a rounded-up recommendation: the tests use the
`File` global, which Node only exposes from version 20. The app still *builds* on 18, but 14 tests
fail there.

```bash
git clone https://github.com/IntoStorymode/Spatial-Storytelling-Engine
cd Spatial-Storytelling-Engine
npm install
npm run dev        # → http://localhost:5173
```

There is no backend, no database and no environment configuration. If `npm run dev` starts, you have
a working setup.

**If port 5173 is busy**, Vite picks the next free port and prints it — read the terminal rather
than assuming the URL.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload. |
| `npm run build` | Type-check (`tsc --noEmit`) then production bundle. Both must pass. |
| `npm run preview` | Serve the built `dist/` — the closest thing to production. |
| `npm run test` | Run the test suite once (Vitest). |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run publish:site -- <slug>` | Export one story as a deploy-anywhere site zip. See [Publishing](./PUBLISHING.md). |
| `npm run gen:assets` | Regenerate the demo assets. |
| `npm run gen:notices` | Regenerate `public/THIRD-PARTY-NOTICES.txt` from the dependency tree. |

The last two run automatically via `predev` and `prebuild`, which is why the demo splat and the
notices file appear on a fresh clone without being committed. Both are generated, both are
gitignored, and neither needs running by hand unless you are changing the scripts themselves.

## Where things live

```
src/
├─ parser/      story.md ⇄ Story object. parseStory / serializeStory are inverse,
│               and a round-trip test keeps them that way.
├─ three/       the 3D layer. ThreeViewer.ts owns scene/camera/render loop;
│               loadModel.ts dispatches by format; loadSplat.ts and loadPly.ts
│               are the loaders; splatFraming.ts is the framing maths.
├─ publish/     export and import. buildSite.ts (in-browser) and
│               scripts/publish-site.mjs (CLI) share siteTemplate.mjs so the two
│               export paths cannot drift.
├─ components/  React UI — viewer chrome, editor forms, content blocks.
├─ routes/      Home, viewer, editor.
├─ store/       zustand stores (draft, gallery, reader state).
├─ lib/         framework-free helpers. modelFormats.ts is the single source of
│               truth for which file extensions the engine accepts.
└─ vr/          the WebXR viewer — a separate Vite entry, see below.
```

**Two things are deliberately dependency-free** so that UI code can import them without pulling in
Three.js: `src/lib/modelFormats.ts` and `src/lib/resolveUrl.ts`. If you find yourself importing from
`src/three/` inside a form component, that is the smell they exist to prevent.

## Tests

```bash
npm run test
```

Coverage is concentrated where a silent regression would be expensive rather than spread evenly: the
story parser and serializer (including round-trip idempotence), the publish/import pipeline, the
splat framing maths, and format dispatch. The 3D rendering itself is not unit-tested — it is
verified by loading real stories in a browser.

Vitest runs in the `node` environment. There are no component tests yet; adding them means switching
to `jsdom` in `vite.config.ts`.

## Debug flags

Append to the URL, in either the query string or after the hash — `/?debug&spin=1#/story/x` and
`/#/story/x?debug&spin=1` both work.

| Flag | Effect |
| --- | --- |
| `?debug` | Show the diagnostic HUD: fps, frame time, buffer size, splat count, the GPU the browser actually bound. |
| `?spin=1` | Continuous render plus a slow auto-orbit — gives a comparable, repeatable path for measuring frame rate across devices. |
| `?dpr=<n>` | Force an exact pixel ratio. Isolates fill-rate. |
| `?highpower=0` | Revert to the browser's default GPU choice instead of `high-performance`. Reproduces the frame-pacing bug described in the [engineering notes](./ENGINEERING-NOTES.md#frame-pacing-is-not-frame-rate). |
| `?sortms=<n>` | Floor on the splat re-sort interval, decoupling sort rate from frame rate. |
| `?aa=0` | Turn WebGL antialiasing off. |

`?spin=1` matters more than it looks: comparing frame rates between two machines is meaningless
unless the camera is doing the same thing on both.

## The VR viewer

`vr.html` is a **second Vite entry**, not a route in the app — WebXR needs `setAnimationLoop` and
owns the camera, neither of which the shared viewer can give it. It is swept into every exported
site automatically, so a published story carries its VR view with it.

Open it at `/vr.html?story=<slug>`. Tuning parameters: `?scale=` (framebuffer scale), `?fov=`
(foveation), `?alpha=` (drop faint splats at load).

**WebXR requires a secure context** — HTTPS or `localhost`. A headset browser pointed at
`http://<your-LAN-IP>` will silently fall back to a flat preview rather than entering VR. On a
Quest, tunnel over USB instead:

```bash
adb reverse tcp:4173 tcp:4173
# then open http://localhost:4173/vr.html?story=<slug> in the Quest browser
```

The VR viewer still uses the previous splat renderer while its migration is pending — see the
[roadmap](../ROADMAP.md).

## Working with local scans

Story folders are gitignored apart from the two bundled demos, so scans stay out of the repository.
`public/stories/index.json` is tracked and lists only those demos, which means a locally-added story
will not appear on the Home page until it is registered — and because Vite copies `public/` over
`dist/` on every build, hand-editing the built copy does not survive.

Add local stories under `public/stories/<slug>/`, and register them in the built index after
building rather than committing an entry that points at a folder nobody else has.

## Conventions

- TypeScript strict; `npm run build` runs `tsc --noEmit` and must pass.
- Match the surrounding code — comment density in this codebase is higher than typical, and
  comments explain *why* rather than *what*.
- Prefer making a hazard unrepresentable over documenting it. See the `getSplat` case in the
  [engineering notes](./ENGINEERING-NOTES.md).

Pull requests are not currently accepted — see [CONTRIBUTING.md](../CONTRIBUTING.md) for why, and
for what is welcome instead.
