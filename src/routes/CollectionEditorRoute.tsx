import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Collection } from '../parser/types'
import type { Upload } from '../store/useDraftStore'
import { useGalleryStore } from '../store/useGalleryStore'
import { AccordionSection } from '../components/editor/AccordionSection'
import { CollectionStoryPicker } from '../components/editor/CollectionStoryPicker'
import { StoryStatus } from '../components/editor/StoryStatus'
import { CollectionView } from '../components/collection/CollectionView'
import { validateCollection } from '../publish/validateCollection'
import { collectCollectionAssets } from '../publish/collectAssets'
import { serializeCollection } from '../parser/collection'
import { triggerDownload } from '../publish/download'
import { moveInList } from '../lib/reorder'
import { toSlug, suggestSlug } from '../publish/slug'
import { useRailResize } from '../components/editor/useRailResize'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { Neighbour } from '../lib/storyNeighbours'

interface StoryIndexEntry {
  id: string
  title: string
}

function emptyCollection(): Collection {
  return { title: '', stories: [], body: '', basePath: '', warnings: [] }
}

/**
 * Collection editor — create or edit a collection.md end to end: title, subtitle,
 * cover image, background prose, and the ordered list of stories it introduces.
 *
 * Deliberately not the story editor with parts hidden. A collection has no model,
 * no sections and no waypoints, so there is no 3D stage, no waypoint library and
 * no mode toggle — roughly half of EditorRoute is inapplicable. What it does share
 * is reused: the accordion rail, the readiness pill, the export-name field, the
 * resizable split, and the confirm dialog.
 *
 * It also needs no /preview bridge. CollectionView is purely presentational, so the
 * live preview renders the draft directly in the right-hand pane — the landing page
 * as readers will see it, updating as you type.
 */
export function CollectionEditorRoute() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id

  const rail = useRailResize()

  const savedCollections = useGalleryStore((s) => s.collections)
  const savedStories = useGalleryStore((s) => s.stories)
  const saveCollection = useGalleryStore((s) => s.saveCollection)

  // Seed once: an existing gallery collection, or a blank one. Collections live in
  // the session gallery, so there is nothing to fetch and no resume bridge needed.
  const initRef = useRef<{ collection: Collection; slug: string; cover: Upload | null } | null>(null)
  if (!initRef.current) {
    const existing = id ? savedCollections.find((c) => c.slug === id) : undefined
    initRef.current = existing
      ? { collection: existing.collection, slug: existing.slug, cover: existing.cover }
      : { collection: emptyCollection(), slug: id ?? '', cover: null }
  }
  const init = initRef.current

  const [collection, setCollection] = useState<Collection>(init.collection)
  const [slug, setSlug] = useState(init.slug)
  const [cover, setCover] = useState<Upload | null>(init.cover)
  const [openSteps, setOpenSteps] = useState({ about: true, stories: true, publish: true })
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [dirty, setDirty] = useState(false)
  const coverInput = useRef<HTMLInputElement>(null)

  const patch = (p: Partial<Collection>) => {
    setCollection((c) => ({ ...c, ...p }))
    setDirty(true)
  }
  const toggleStep = (k: keyof typeof openSteps) => setOpenSteps((s) => ({ ...s, [k]: !s[k] }))

  // Candidate stories: the session gallery first (those are the ones that ship with
  // an export), then this deployment's examples.
  const [indexStories, setIndexStories] = useState<StoryIndexEntry[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('stories/index.json')
      .then((r) => (r.ok ? r.json() : { stories: [] }))
      .then((d) => !cancelled && setIndexStories((d.stories ?? []) as StoryIndexEntry[]))
      .catch(() => {
        /* examples are a convenience; the gallery alone is a valid source */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const candidates = [
    ...savedStories.map((s) => ({
      id: s.slug,
      title: s.fm.title || s.slug,
      source: 'gallery' as const,
    })),
    ...indexStories
      .filter((s) => !savedStories.some((g) => g.slug === s.id))
      .map((s) => ({ id: s.id, title: s.title, source: 'index' as const })),
  ]

  /** The picked stories as the landing page will show them. */
  const previewStories: Neighbour[] = collection.stories.map((sid) => {
    const found = candidates.find((c) => c.id === sid)
    return { id: sid, title: found?.title ?? sid }
  })

  function onCoverUpload(file: File) {
    const url = URL.createObjectURL(file)
    // Replacing a cover revokes the previous blob at the point of replacement,
    // matching the story editor; blob URLs otherwise live for the tab session.
    if (cover) URL.revokeObjectURL(cover.url)
    setCover({ url, file })
    patch({ cover: `assets/${file.name}` })
  }

  function clearCover() {
    if (cover) URL.revokeObjectURL(cover.url)
    setCover(null)
    setCollection((c) => {
      const { cover: _drop, ...rest } = c
      return rest as Collection
    })
    setDirty(true)
  }

  const exportSlug = toSlug(slug) || toSlug(collection.title)
  const slugHint = toSlug(collection.title) || suggestSlug(new Date().toISOString().slice(0, 10))
  const issues = validateCollection(collection, exportSlug, candidates.map((c) => c.id))

  function saveToGallery() {
    if (issues.length > 0) return
    saveCollection({ slug: exportSlug, collection, cover, savedAt: Date.now() })
    setSlug(exportSlug) // pin it, so a later title edit can't fork a second card
    setDirty(false)
    navigate('/')
  }

  function leaveToHome() {
    if (dirty) setConfirmLeave(true)
    else navigate('/')
  }

  const bundleAssets = collectCollectionAssets(collection, cover)

  return (
    <div className="editor">
      <div className="editor-topbar">
        <button type="button" className="back" onClick={leaveToHome}>
          ← All stories
        </button>
        <p className="eyebrow">{isNew ? 'New collection' : `Editing ${id}`}</p>
        <div className="editor-topbar-actions">
          <button
            className="btn"
            onClick={() =>
              triggerDownload(
                new Blob([serializeCollection(collection)], { type: 'text/markdown' }),
                'collection.md',
              )
            }
            title="Download the raw collection.md"
          >
            ⬇ collection.md
          </button>
          <button
            className="btn btn-accent"
            onClick={saveToGallery}
            disabled={issues.length > 0}
            title={
              issues.length > 0
                ? 'Resolve the items in the status checklist before saving'
                : 'Add this collection to your gallery — then export it as a website from there'
            }
          >
            💾 Save to gallery
          </button>
          <StoryStatus issues={issues} />
        </div>
      </div>

      <div
        className={
          'editor-body' +
          (rail.collapsed ? ' is-collapsed' : '') +
          (rail.dragging ? ' is-dragging' : '')
        }
      >
        <aside className="editor-forms" style={rail.railStyle}>
          <AccordionSection
            step={1}
            title="About"
            open={openSteps.about}
            onToggle={() => toggleStep('about')}
          >
            <div className="ed-fields">
              <label className="ed-field">
                <span>Title</span>
                <input
                  value={collection.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="The High Street"
                />
              </label>
              <label className="ed-field">
                <span>Subtitle</span>
                <input
                  value={collection.subtitle ?? ''}
                  onChange={(e) => patch({ subtitle: e.target.value || undefined })}
                  placeholder="Cradley Heath, England"
                />
                <p className="ed-hint">
                  Optional, and never interpreted — a town, a family, a decade, a theme. Whatever
                  binds these stories together.
                </p>
              </label>
              <label className="ed-field">
                <span>Background text</span>
                <textarea
                  rows={12}
                  value={collection.body}
                  onChange={(e) => patch({ body: e.target.value })}
                  placeholder={
                    'The site, its history, how the scans and accounts were gathered, who contributed.'
                  }
                />
                <p className="ed-hint">
                  Blank lines separate paragraphs. Markdown isn't interpreted — <code>**bold**</code>{' '}
                  and <code>[links]()</code> render as typed.
                </p>
              </label>
              <div className="ed-field">
                <span>Cover image</span>
                <div className="ed-row">
                  <button type="button" className="btn" onClick={() => coverInput.current?.click()}>
                    Upload file…
                  </button>
                  {cover && (
                    <button type="button" className="btn ed-chip" onClick={clearCover}>
                      Remove
                    </button>
                  )}
                  <input
                    ref={coverInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) onCoverUpload(f)
                      e.target.value = ''
                    }}
                  />
                </div>
                <p className="ed-hint">
                  {collection.cover ? (
                    <>
                      Ships as <code>{collection.cover}</code>.
                    </>
                  ) : (
                    'Optional. A still image — a live scan would make the landing page as heavy as a story.'
                  )}
                </p>
              </div>
            </div>
          </AccordionSection>

          <AccordionSection
            step={2}
            title="Stories"
            open={openSteps.stories}
            onToggle={() => toggleStep('stories')}
            badge={collection.stories.length || undefined}
          >
            <CollectionStoryPicker
              picked={collection.stories}
              candidates={candidates}
              onAdd={(sid) => patch({ stories: [...collection.stories, sid] })}
              onRemove={(sid) => patch({ stories: collection.stories.filter((x) => x !== sid) })}
              onMove={(i, dir) => patch({ stories: moveInList(collection.stories, i, dir) })}
            />
          </AccordionSection>

          <AccordionSection
            step={3}
            title="Publish"
            open={openSteps.publish}
            onToggle={() => toggleStep('publish')}
          >
            <div className="ed-fields">
              <label className="ed-field">
                <span>Export name</span>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value)
                    setDirty(true)
                  }}
                  placeholder={slugHint}
                />
                {exportSlug ? (
                  <p className="ed-hint">
                    The collection's folder name — it exports as <code>{exportSlug}-site</code>.
                    Taken from the title unless you set it here.
                  </p>
                ) : (
                  <p className="ed-hint">
                    Needed: the title has no Latin letters to build a folder name from. Try{' '}
                    <code>{slugHint}</code>.
                  </p>
                )}
              </label>
            </div>
            <p className="ed-hint">
              Use <strong>Save to gallery</strong> above, then <strong>⬇ Export</strong> the
              collection from Home — the site opens on this landing page.
              {bundleAssets.length > 0 && <> Its cover ships with it.</>}
            </p>
          </AccordionSection>
        </aside>

        <div
          className="editor-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the editing panel"
          {...rail.resizerHandlers}
        >
          <button
            type="button"
            className="rail-toggle"
            onPointerDown={(e) => e.stopPropagation()} // don't start a drag
            onClick={rail.toggleCollapsed}
            title="Hide the editing panel"
            aria-label="Hide the editing panel"
          >
            ‹
          </button>
        </div>

        {rail.collapsed && (
          <button
            type="button"
            className="rail-toggle rail-show"
            onClick={rail.toggleCollapsed}
            title="Show the editing panel"
            aria-label="Show the editing panel"
          >
            ›
          </button>
        )}

        {/* Live preview: the landing page exactly as a reader meets it. No fetch and
            no 3D context, so it can render the draft straight from state. Story links
            are inert here — the stories may exist only in the gallery. */}
        <main className="editor-stage coll-preview">
          <CollectionView
            collection={collection}
            stories={previewStories}
            coverUrl={cover?.url ?? null}
            hideBack
            storyLinks={false}
          />
        </main>
      </div>

      {confirmLeave && (
        <ConfirmDialog
          title="Discard this collection?"
          message={
            "This collection hasn't been saved to your gallery — the text, the story order and any " +
            'uploaded cover live only in this browser session.'
          }
          confirmLabel="Leave & discard"
          cancelLabel="Keep editing"
          danger
          onConfirm={() => navigate('/')}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </div>
  )
}
