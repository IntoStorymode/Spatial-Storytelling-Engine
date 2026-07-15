import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGalleryStore, type SavedStory } from '../store/useGalleryStore'
import { useDraftStore } from '../store/useDraftStore'
import { buildSiteZip, fetchManifest, type ExportStory, type Manifest } from '../publish/buildSite'
import { collectAssets } from '../publish/collectAssets'
import { triggerDownload } from '../publish/download'
import { isPublishedSite } from '../publish/published'
import { importSite, type Bundle } from '../publish/importSite'
import { toSavedStory } from '../publish/importSnapshot'
import { ImportDialog } from '../components/ImportDialog'

interface StoryIndexEntry {
  id: string
  title: string
  author: string
  location: string
  date: string
  path: string
}

/** What an import produced, so its warnings are shown rather than swallowed. */
interface ImportReport {
  imported: { slug: string; title: string; warnings: string[] }[]
  error: string | null
}

/**
 * Home (screen 1) — the gallery. Lists the stories you've saved this session
 * (with select + export to a deployable website) plus the repo's example
 * stories. No backend: the example registry is a static JSON file.
 */
export function HomeRoute() {
  const navigate = useNavigate()
  const [stories, setStories] = useState<StoryIndexEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // On a published (exported/hosted) site the app is read-only: no editor, no
  // saving/exporting. Hide every authoring entry point below.
  const published = isPublishedSite()

  const saved = useGalleryStore((s) => s.stories)
  const removeSaved = useGalleryStore((s) => s.remove)

  // Importing an exported story back in (a .zip, or the same site as a folder).
  const [picking, setPicking] = useState(false)
  const [importing, setImporting] = useState(false)
  const [report, setReport] = useState<ImportReport | null>(null)

  // Export needs the built app shell: undefined = checking, null = dev (no build), else ready.
  const [manifest, setManifest] = useState<Manifest | null | undefined>(undefined)
  const [building, setBuilding] = useState(false)
  // Set after a successful export, so a "what next" banner can name the file and
  // point at deploy + re-import — the loop the app was otherwise silent about.
  const [exported, setExported] = useState<{ fileName: string } | null>(null)

  // Which saved stories are selected for export. New saves default to selected;
  // explicit toggles are preserved; removed stories drop out.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const prevSlugs = useRef<Set<string>>(new Set())

  useEffect(() => {
    fetch('stories/index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load story index (HTTP ${r.status})`)
        return r.json()
      })
      .then((data) => setStories(data.stories ?? []))
      .catch((e) => setError(String(e)))
    fetchManifest().then(setManifest)
  }, [])

  useEffect(() => {
    const slugs = new Set(saved.map((s) => s.slug))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const slug of slugs) if (!prevSlugs.current.has(slug)) next.add(slug) // new → selected
      for (const slug of [...next]) if (!slugs.has(slug)) next.delete(slug) // gone → drop
      return next
    })
    prevSlugs.current = slugs
  }, [saved])

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(slug) ? next.delete(slug) : next.add(slug)
      return next
    })
  }

  function editSaved(s: SavedStory) {
    useDraftStore.getState().stashResume(s) // s IS an EditSnapshot (+ slug/savedAt)
    navigate(`/edit/${s.slug}`)
  }

  /**
   * Read an exported story back into the gallery. Its story.md is re-parsed by the
   * current parser (so an old export arrives upgraded — inline hotspots become named
   * waypoints) and its assets come back as Files, exactly as if they'd been uploaded.
   * From there it's an ordinary saved story: Edit, Preview, re-export.
   */
  async function runImport(bundle: Bundle) {
    setImporting(true)
    setReport(null)
    try {
      const gallery = useGalleryStore.getState()
      const result = await importSite(bundle, { takenSlugs: gallery.stories.map((s) => s.slug) })
      if (!result.stories.length) {
        setReport({ imported: [], error: result.warnings[0] ?? 'Nothing to import.' })
        return
      }
      const now = Date.now()
      for (const story of result.stories) gallery.save(toSavedStory(story, now))
      setReport({
        imported: result.stories.map((s) => ({
          slug: s.slug,
          title: s.story.frontmatter.title || 'Untitled story',
          warnings: s.warnings,
        })),
        error: null,
      })
    } catch (e) {
      setReport({ imported: [], error: `Could not read that story: ${String(e)}` })
    } finally {
      setImporting(false)
    }
  }

  const importedSlugs = new Set(report?.imported.map((i) => i.slug))
  const justImported = saved.filter((s) => importedSlugs.has(s.slug))

  const selectedCount = saved.filter((s) => selected.has(s.slug)).length
  const canExport = !!manifest && selectedCount > 0

  async function exportSelected() {
    if (!manifest) return
    const chosen = saved.filter((s) => selected.has(s.slug))
    if (!chosen.length) return
    setBuilding(true)
    try {
      const exportStories: ExportStory[] = chosen.map((s) => ({
        slug: s.slug,
        story: { frontmatter: s.fm, sections: s.sections, basePath: s.basePath, warnings: [] },
        assets: collectAssets(s.fm, s.sections, s.uploaded, s.mediaUploads),
      }))
      const { blob, fileName } = await buildSiteZip({ stories: exportStories, manifest })
      triggerDownload(blob, fileName)
      setExported({ fileName })
    } finally {
      setBuilding(false)
    }
  }

  const exportTitle = canExport
    ? 'Export the selected stories as a deployable website (one → opens into it; several → opens on the gallery)'
    : manifest === null
      ? 'Export needs the built app — run npm run preview, or use the hosted editor'
      : 'Select at least one story to export'

  return (
    <main className="home">
      <header className="home-head">
        <p className="eyebrow">Spatial Storytelling</p>
        <h1 className="home-title">Every place holds a story.<br />Step inside and tell it.</h1>
        <p className="home-sub">
          Bring a 3D scan of a real place to life. Your audience can move through the space
          themselves, or follow it as a guided, illustrated read — the same story, two ways to
          experience it. Choose one below to begin.
        </p>
        {!published && (
          <div className="home-actions">
            <Link to="/edit/new" className="btn btn-accent home-new">
              + New story
            </Link>
            <button
              className="btn"
              onClick={() => setPicking(true)}
              title="Open a story you exported earlier — it comes back with its scan, upgraded to the current format"
            >
              ⬆ Import story
            </button>
          </div>
        )}
      </header>

      {picking && (
        <ImportDialog
          busy={importing}
          onCancel={() => setPicking(false)}
          onBundle={(bundle) => {
            setPicking(false)
            void runImport(bundle)
          }}
        />
      )}

      {report && (
        <section className={report.error ? 'home-import is-error' : 'home-import'}>
          <button className="home-import-x" onClick={() => setReport(null)} aria-label="Dismiss">
            ×
          </button>
          {report.error ? (
            <p>{report.error}</p>
          ) : (
            <>
              <p>
                Imported {report.imported.length}{' '}
                {report.imported.length === 1 ? 'story' : 'stories'}:{' '}
                <strong>{report.imported.map((i) => i.title).join(', ')}</strong>. Imported stories
                are upgraded to the current story format.
              </p>
              {report.imported
                .filter((i) => i.warnings.length > 0)
                .map((i) => (
                  <details key={i.slug}>
                    <summary>
                      {i.title} — {i.warnings.length} warning
                      {i.warnings.length === 1 ? '' : 's'}
                    </summary>
                    <ul>
                      {i.warnings.map((w, n) => (
                        <li key={n}>{w}</li>
                      ))}
                    </ul>
                  </details>
                ))}
              {justImported.length === 1 && (
                <button className="btn btn-accent" onClick={() => editSaved(justImported[0])}>
                  Open in editor →
                </button>
              )}
            </>
          )}
        </section>
      )}

      {exported && (
        <section className="home-import">
          <button className="home-import-x" onClick={() => setExported(null)} aria-label="Dismiss">
            ×
          </button>
          <p>
            Downloaded <strong>{exported.fileName}</strong>. Unzip it, then drag the folder onto{' '}
            <strong>Netlify Drop</strong> (app.netlify.com/drop) to get a live URL — the full steps
            are in the <code>DEPLOY.md</code> inside the zip. Keep the zip: you can reopen it here any
            time with <strong>⬆ Import story</strong>.
          </p>
        </section>
      )}

      {!published && saved.length > 0 && (
        <section className="gallery-mine">
          <div className="gallery-mine-head">
            <h2 className="home-h2">
              Your stories <span className="muted">· this session</span>
            </h2>
            <button
              className="btn btn-accent"
              onClick={exportSelected}
              disabled={!canExport || building}
              title={exportTitle}
            >
              {building ? '… building site' : `⬇ Export selected (${selectedCount})`}
            </button>
          </div>
          <p className="home-note">
            Saved stories live here for this session only — <strong>export to keep them</strong>.
            Pick one → the site opens straight into it; pick several → it opens on a gallery.
            {manifest === null && (
              <>
                {' '}Export is disabled under <code>npm run dev</code>; use{' '}
                <code>npm run preview</code> or the hosted editor.
              </>
            )}
          </p>
          <div className="story-grid">
            {saved.map((s) => (
              <div key={s.slug} className={selected.has(s.slug) ? 'story-card is-selected' : 'story-card'}>
                <label className="gallery-pick">
                  <input
                    type="checkbox"
                    checked={selected.has(s.slug)}
                    onChange={() => toggle(s.slug)}
                  />
                  <span className="eyebrow">Draft</span>
                </label>
                <h2>{s.fm.title || 'Untitled story'}</h2>
                <div className="meta">
                  {s.fm.author || <span className="muted">No author</span>}
                  <br />
                  {s.fm.location} · {s.fm.date}
                </div>
                <div className="story-card-actions">
                  <button className="cta" onClick={() => editSaved(s)}>
                    Edit
                  </button>
                  <button className="cta cta-muted" onClick={() => removeSaved(s.slug)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {saved.length > 0 && <h2 className="home-h2 home-examples-h">Example stories</h2>}

      {error && <p className="state">{error}</p>}
      {!error && !stories && <p className="state">Loading stories…</p>}
      {stories && stories.length === 0 && (
        <p className="state">No stories yet. Add one to public/stories/index.json.</p>
      )}

      {stories && stories.length > 0 && (
        <div className="story-grid">
          {stories.map((s) => (
            <div key={s.id} className="story-card">
              <p className="eyebrow">Story</p>
              <h2>{s.title}</h2>
              <div className="meta">
                {s.author}
                <br />
                {s.location} · {s.date}
              </div>
              <div className="story-card-actions">
                <Link to={`/story/${s.id}`} className="cta">
                  Read →
                </Link>
                {!published && (
                  <Link to={`/edit/${s.id}`} className="cta cta-muted">
                    Edit
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
