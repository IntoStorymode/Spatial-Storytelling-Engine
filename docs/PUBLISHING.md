# Publishing & sharing a story

There are **two ways** to share a story, for two different audiences:

| You want to… | Use | Audience |
| --- | --- | --- |
| Let a teammate who **runs this repo** open your story | **Download bundle** (in the editor) | Internal reviewers running `npm run dev` |
| Put a story **online as its own website** (a shareable URL) | **`npm run publish:site`** | Anyone — no repo, no setup |

Both are local-first: no backend, no account, no upload to us. You stay in control of the files.

---

## A. Download bundle — share within the repo

Best when reviewers already clone and run the project (see the [README](../README.md)).

1. In the editor (`+ New story`), build your story and click **⭳ Download bundle**.
2. You get `<slug>.zip` containing `story.md`, your uploaded assets under `assets/`, an
   `index-entry.json`, and a `PUBLISH.txt`.
3. Unzip the `<slug>/` folder into `public/stories/`, then merge the object from
   `index-entry.json` into `public/stories/index.json`'s `stories` array.
4. `npm run dev` → the story appears on Home and at `#/story/<slug>`.

That's it for in-repo sharing. The rest of this guide is about **independent hosting**.

---

## B. Publish as a website — host a story anywhere

This exports a story as a **complete, self-contained website**: one folder you can drop on
any static host. It opens straight into the story (a "kiosk"), needs no backend, no build
step on the host, and no special server configuration.

### Step 1 — Make sure the story lives in the repo

The exporter publishes a story that already exists under `public/stories/<slug>/`
(`story.md` + its `assets/`). If you authored in the editor, first do
[section A](#a-download-bundle--share-within-the-repo) steps 1–3 to drop it in. (If the
story isn't there yet, `publish:site` will tell you and stop.)

> `<slug>` is the folder name under `public/stories/` — e.g. `tak-shun-mall`.

### Step 2 — Export the site

From the project root (Node 18+; see the README for the nvm note):

```bash
npm run publish:site -- <slug>
```

This builds the app, trims it to just that one story, and writes **`<slug>-site.zip`** to the
project root. Unzip it and you get:

```
<slug>-site/     ← the website (this is what you deploy)
DEPLOY.md        ← a short copy of these hosting steps
```

> The zip is git-ignored (`*-site.zip`), so exported sites never get committed.

### Step 3 — Put it online

Pick any host. The same folder works on all of them.

#### Netlify — easiest, drag & drop (no account-side config)

1. Unzip `<slug>-site.zip`.
2. Go to **<https://app.netlify.com/drop>**.
3. Drag the **`<slug>-site`** folder onto the page.
4. Netlify gives you a live URL immediately (e.g. `https://calm-otter-1234.netlify.app`).
   Optionally rename the site or attach a custom domain in **Site settings → Domain**.

#### Vercel — CLI

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

#### Cloudflare Pages / Surge / Render / any static host

Upload the **contents of `<slug>-site/`** as a static site. For example, with
[Surge](https://surge.sh): `cd <slug>-site && npx surge`.

#### GitHub Pages, S3, nginx, or your own site's subfolder

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
  (`assets/scene.ksplat` etc.) must have been present under `public/stories/<slug>/assets/`
  at export time. Re-export after confirming it's there. Large splats can take a few seconds;
  a loading indicator shows while it streams.
- **Fonts look different offline** → the page pulls web fonts from Google Fonts and falls
  back to system fonts without a connection. Cosmetic only.
- **URLs have a `#`** (e.g. `…/#/story/<slug>`) → expected. Hash routing is what lets the
  same files run at any path with no server config.

---

## How it works (for the curious)

- **Hash routing** (`HashRouter`): the browser only ever loads `index.html`; the route lives
  after the `#`. So there's no server-side SPA-fallback to configure, and the document's base
  URL is stable wherever the folder sits.
- **Relative data paths**: the app fetches `stories/index.json` (not `/stories/…`) and asset
  paths resolve against the page, so everything works at a root or a subfolder.
- **No COOP/COEP headers**: the Gaussian-splat renderer runs without `SharedArrayBuffer`
  (`sharedMemoryForWorkers: false`), so plain static hosts work — no cross-origin isolation
  setup.
- **Kiosk redirect**: `publish:site` injects a tiny script so visiting the deployed root
  jumps straight to `#/story/<slug>`.

See [`DEVLOG.md`](./DEVLOG.md) → *M9* for the full rationale.
