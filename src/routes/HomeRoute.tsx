import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGalleryStore, type SavedStory } from '../store/useGalleryStore'
import { useDraftStore } from '../store/useDraftStore'
import { buildSiteZip, fetchManifest, type ExportStory, type Manifest } from '../publish/buildSite'
import { collectAssets } from '../publish/collectAssets'
import { triggerDownload } from '../publish/download'

interface StoryIndexEntry {
  id: string
  title: string
  author: string
  location: string
  date: string
  path: string
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

  const saved = useGalleryStore((s) => s.stories)
  const removeSaved = useGalleryStore((s) => s.remove)

  // Export needs the built app shell: undefined = checking, null = dev (no build), else ready.
  const [manifest, setManifest] = useState<Manifest | null | undefined>(undefined)
  const [building, setBuilding] = useState(false)

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
        story: { frontmatter: s.fm, items: s.items, basePath: s.basePath, warnings: [] },
        assets: collectAssets(s.fm, s.items, s.uploaded, s.mediaUploads),
      }))
      const { blob, fileName } = await buildSiteZip({ stories: exportStories, manifest })
      triggerDownload(blob, fileName)
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
        <h1 className="home-title">A scan is shared infrastructure.<br />A story is an act of authorship.</h1>
        <p className="home-sub">
          One Markdown file drives two ways to read the same place — a long-form page with
          the model inline, or an immersive scene you move through. Pick a story to begin.
        </p>
        <Link to="/edit/new" className="btn btn-accent home-new">
          + New story
        </Link>
      </header>

      {saved.length > 0 && (
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
                <Link to={`/edit/${s.id}`} className="cta cta-muted">
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
