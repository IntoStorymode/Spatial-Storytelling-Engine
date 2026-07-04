# Publishing & sharing a story

A published story is a **complete, self-contained website**: one folder you can drop on any
static host. It opens straight into the story (a "kiosk"), needs no backend, no build step on
the host, and no special server configuration. Everything is local-first: no account, no
upload to us — you stay in control of the files.

There are two ways to produce that website, for two situations:

| You are… | Use | Needs a terminal? |
| --- | --- | --- |
| Authoring in the editor (built or hosted app) | **⛭ Download website** (one click) | No |
| Working in the repo / running `npm run dev` | **`npm run publish:site -- <slug>`** | Yes |

Both produce the same deployable `<slug>-site.zip`. Pick whichever matches how you're working.

---

## A. Download website — one click, no terminal (recommended)

In the editor, build your story and click **⛭ Download website**. You get **`<slug>-site.zip`**:

```
<slug>-site/     ← the website (this is what you deploy)
DEPLOY.md        ← a short copy of the hosting steps below
```

Unzip it and [put it online](#putting-it-online). That's the whole flow — no copying files
into the repo, no editing `index.json`, no separate build step.

The button assembles the site **in your browser** from the running app plus your story, so it
only needs the built app. It works from a **hosted deployment of the editor** or from a local
production preview (`npm run build && npm run preview`). It is **disabled under `npm run dev`**
(there's no built app to package yet) — in that case use [option B](#b-publish-from-the-repo).

> **Tip — host the editor once.** Deploy this whole app as a static site (it's the same kind
> of static bundle a published story is). Authors then open that live editor, write a story,
> and click **⛭ Download website** — no repo, no Node, no CLI.

> Uploaded media/models are packaged automatically under `assets/`. Media referenced by a
> **typed path** (not uploaded through the editor) is *not* included — upload it in the editor
> so it ships with the site.

---

## B. Publish from the repo — `npm run publish:site`

For stories that live in the repo (`public/stories/<slug>/`: a `story.md` + its `assets/`),
or when you're authoring under `npm run dev`. From the project root (Node 18+):

```bash
npm run publish:site -- <slug>
```

> `<slug>` is the folder name under `public/stories/` — e.g. `tak-shun-mall`.

This builds the app, trims it to just that one story, injects the kiosk redirect, and writes
the same **`<slug>-site.zip`** (the deployable `<slug>-site/` folder + `DEPLOY.md`) to the
project root. The story doesn't need to be registered in `index.json` first — the script reads
its `story.md` frontmatter if there's no index entry. The zip is git-ignored (`*-site.zip`), so
exported sites never get committed.

---

## Putting it online

Pick any host. The same folder works on all of them.

### Netlify — easiest, drag & drop (no account-side config)

1. Unzip `<slug>-site.zip`.
2. Go to **<https://app.netlify.com/drop>**.
3. Drag the **`<slug>-site`** folder onto the page.
4. Netlify gives you a live URL immediately (e.g. `https://calm-otter-1234.netlify.app`).
   Optionally rename the site or attach a custom domain in **Site settings → Domain**.

### Vercel — CLI

1. Unzip the file, then from inside the site folder:
   ```bash
   cd <slug>-site
   npx vercel deploy --prod
   ```
2. The first run opens a browser to log in, then asks a few setup questions (scope, project
   name) — accept the defaults; when asked for the directory to deploy, use the current one
   (`./`). It prints a production URL when done.
3. Re-deploy later by re-running the same command (or drag the folder into the Vercel
   dashboard via **Add New → Project**).

### Cloudflare Pages / Surge / Render / any static host

Upload the **contents of `<slug>-site/`** as a static site. For example, with
[Surge](https://surge.sh): `cd <slug>-site && npx surge`.

### GitHub Pages, S3, nginx, or your own site's subfolder

Copy the **contents of `<slug>-site/`** to any path — including a **subfolder** of an
existing site (e.g. `https://example.com/news/spatial/`). No rebuild needed: the site uses
relative paths and hash-based routing, so it resolves wherever it lives.
- **GitHub Pages:** commit the folder's contents to your Pages branch/dir; the project-site
  subpath (`username.github.io/repo/`) works as-is.
- **nginx / Apache / S3:** just serve the files statically. No rewrite rules required.

---

## Hosting checklist & troubleshooting

- **Use a trailing slash on subfolders.** Open `…/news/spatial/`, **not** `…/news/spatial`.
  Most hosts add it automatically; if the page is blank on a subfolder, check this first.
- **Blank page or 404s for `stories/index.json` / `story.md` / `assets/…`** → almost always
  the trailing-slash issue above, or the folder contents weren't uploaded at the path you're
  visiting. The data is fetched *relative* to the page URL.
- **Splat doesn't render** → splats need no special headers here, but the model file
  (`assets/scene.ksplat` etc.) must have been uploaded through the editor (or present under
  `public/stories/<slug>/assets/` at CLI-export time). Re-export after confirming it's there.
  Large splats can take a few seconds; a loading indicator shows while it streams.
- **Fonts look different offline** → the page pulls web fonts from Google Fonts and falls
  back to system fonts without a connection. Cosmetic only.
- **URLs have a `#`** (e.g. `…/#/story/<slug>`) → expected. Hash routing is what lets the
  same files run at any path with no server config.
- **Very large scans** → **⛭ Download website** zips in the browser, so a multi-hundred-MB
  splat can be memory-heavy; if it struggles, use the CLI ([option B](#b-publish-from-the-repo)).

---

## How it works (for the curious)

- **One shared shape**: a published site = the generic app shell (identical for every story of
  an app version) + one story's data + a kiosk redirect + `DEPLOY.md`. **⛭ Download website**
  fetches the running app's shell (listed in `publish-manifest.json`, emitted at build time)
  and re-zips it with your story — no rebuild. `publish:site` does the same assembly from a
  fresh build. Both share `src/publish/siteTemplate.mjs`, so they can't drift.
- **Hash routing** (`HashRouter`): the browser only ever loads `index.html`; the route lives
  after the `#`. So there's no server-side SPA-fallback to configure, and the document's base
  URL is stable wherever the folder sits.
- **Relative data paths**: the app fetches `stories/index.json` (not `/stories/…`) and asset
  paths resolve against the page, so everything works at a root or a subfolder.
- **No COOP/COEP headers**: the Gaussian-splat renderer runs without `SharedArrayBuffer`
  (`sharedMemoryForWorkers: false`), so plain static hosts work — no cross-origin isolation
  setup.
- **Kiosk redirect**: a tiny injected script sends the deployed root straight to
  `#/story/<slug>`.

See [`DEVLOG.md`](./DEVLOG.md) → *M9* for the full rationale.
