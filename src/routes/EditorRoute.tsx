import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { parseStory } from '../parser/parseStory'
import type { Frontmatter, Hotspot, SectionType, Story, Section } from '../parser/types'
import { useDraftStore } from '../store/useDraftStore'
import type { Upload } from '../store/useDraftStore'
import { useGalleryStore } from '../store/useGalleryStore'
import { upsertWaypoint, renameWaypoint, deleteWaypoint, nextWaypointName, countUsage } from '../parser/waypoints'
import { collectAssets } from '../publish/collectAssets'
import { slugify } from '../publish/slug'
import type { ThreeViewer } from '../three/ThreeViewer'
import { SceneForm } from '../components/editor/SceneForm'
import { StoryDetailsForm } from '../components/editor/StoryDetailsForm'
import { SectionList } from '../components/editor/SectionList'
import { SectionForm } from '../components/editor/SectionForm'
import { AccordionSection } from '../components/editor/AccordionSection'
import { HotspotPlacer } from '../components/editor/HotspotPlacer'
import { ExportBar } from '../components/editor/ExportBar'
import { StoryStatus } from '../components/editor/StoryStatus'
import { validateStory } from '../publish/validateStory'
import { useRailResize } from '../components/editor/useRailResize'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface IndexEntry {
  id: string
  path: string
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function emptyFrontmatter(): Frontmatter {
  return { title: '', author: '', location: '', date: todayISO(), model: 'builtin:room' }
}

function newSection(sections: Section[]): Section {
  const ids = new Set(sections.map((i) => i.id))
  let n = sections.length + 1
  let id = `item-${String(n).padStart(2, '0')}`
  while (ids.has(id)) id = `item-${String(++n).padStart(2, '0')}`
  return { id, title: '', type: 'text', body: '' }
}

/**
 * Editor (screen 2) — create or edit a story.md end to end: metadata, an ordered
 * list of sections with per-type content, click-to-place hotspots in the 3D scene,
 * and export back to a story.md via the serializer. Draft lives in local state;
 * nothing is written until the author exports.
 */
export function EditorRoute() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const routeKey = id ?? 'new'

  // Draggable / collapsible split between the forms rail and the 3D stage.
  const rail = useRailResize()

  // Restore the in-progress draft if we're returning from /preview (else seed a
  // fresh draft). Computed once per mount; peekResume is a pure read.
  const initRef = useRef<{
    fm: Frontmatter
    sections: Section[]
    basePath: string
    uploaded: (Upload & { format: string }) | null
    mediaUploads: Record<string, Upload>
    resumed: boolean
  } | null>(null)
  if (!initRef.current) {
    const snap = useDraftStore.getState().peekResume(routeKey)
    initRef.current = snap
      ? { fm: snap.fm, sections: snap.sections, basePath: snap.basePath, uploaded: snap.uploaded, mediaUploads: snap.mediaUploads, resumed: true }
      : { fm: emptyFrontmatter(), sections: [newSection([])], basePath: '', uploaded: null, mediaUploads: {}, resumed: false }
  }
  const init = initRef.current

  const [fm, setFm] = useState<Frontmatter>(init.fm)
  const [sections, setSections] = useState<Section[]>(init.sections)
  const [selectedId, setSelectedId] = useState<string | null>(init.sections[0]?.id ?? null)
  const [basePath, setBasePath] = useState(init.basePath)
  // An uploaded model previews from a blob URL while exporting an assets/ path.
  const [uploaded, setUploaded] = useState<(Upload & { format: string }) | null>(init.uploaded)
  // Uploaded media, keyed by the assets/ path it will export to.
  const [mediaUploads, setMediaUploads] = useState<Record<string, Upload>>(init.mediaUploads)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Waypoint-library state: which named waypoint is being edited on the canvas,
  // and a pending delete (confirmed via a dialog that shows its usage).
  const [activeWaypoint, setActiveWaypoint] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  // Walk-through vs orbit in the editor canvas — owned here so the rail's "go to"
  // (which flies the camera in orbit) and the canvas toggle stay in sync.
  const [lookMode, setLookMode] = useState<'orbit' | 'firstPerson'>('firstPerson')
  // Rail accordion: each step collapses independently; all open by default.
  const [openSteps, setOpenSteps] = useState({ scene: true, story: true, waypoints: true, publish: true })
  const toggleStep = (k: keyof typeof openSteps) => setOpenSteps((s) => ({ ...s, [k]: !s[k] }))
  // The live viewer, so the section form's "new from current view" can capture.
  const viewerRef = useRef<ThreeViewer | null>(null)

  // Consume the resume snapshot once so a later fresh open starts clean.
  useEffect(() => {
    if (init.resumed) useDraftStore.getState().clearResume()
  }, [init.resumed])

  // Load an existing story for editing (skip if we restored a draft).
  useEffect(() => {
    if (isNew || init.resumed) return
    let cancelled = false
    async function load() {
      const idx = (await (await fetch('stories/index.json')).json()).stories as IndexEntry[]
      const entry = idx.find((s) => s.id === id)
      if (!entry) throw new Error(`Story "${id}" is not in the index.`)
      const raw = await (await fetch(entry.path)).text()
      const dir = entry.path.replace(/[^/]+$/, '')
      const story = parseStory(raw, dir)
      if (cancelled) return
      setFm(story.frontmatter)
      setSections(story.sections)
      setSelectedId(story.sections[0]?.id ?? null)
      setBasePath(dir)
    }
    load().catch((e) => !cancelled && setLoadError(String(e)))
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  const selected = sections.find((i) => i.id === selectedId) ?? null

  // ── Draft mutations ───────────────────────────────────────────────────────
  function patchSection(sectionId: string, patch: Partial<Section>) {
    setSections((prev) => prev.map((i) => (i.id === sectionId ? { ...i, ...patch } : i)))
  }
  function changeType(sectionId: string, type: SectionType) {
    // Dropping to text clears media-only fields so export stays clean.
    setSections((prev) =>
      prev.map((i) =>
        i.id === sectionId
          ? { ...i, type, ...(type === 'text' ? { src: undefined, caption: undefined } : {}) }
          : i,
      ),
    )
  }
  function addSection() {
    setSections((prev) => {
      const it = newSection(prev)
      setSelectedId(it.id)
      return [...prev, it]
    })
  }
  function removeSection(sectionId: string) {
    setSections((prev) => {
      const next = prev.filter((i) => i.id !== sectionId)
      if (selectedId === sectionId) setSelectedId(next[0]?.id ?? null)
      return next
    })
  }
  function moveSection(sectionId: string, dir: -1 | 1) {
    setSections((prev) => {
      const idx = prev.findIndex((i) => i.id === sectionId)
      const swap = idx + dir
      if (idx < 0 || swap < 0 || swap >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }
  // ── Waypoints (named camera views) ─────────────────────────────────────────
  // The frontmatter holds the library; sections reference entries by name. The
  // opening view is simply the first section's waypoint (no separate control).

  /** Capture the current camera as a new named waypoint (library only). */
  function captureWaypoint(camera: Hotspot) {
    const name = nextWaypointName(fm.waypoints)
    setFm((m) => ({ ...m, waypoints: upsertWaypoint(m.waypoints, name, camera) }))
    setActiveWaypoint(name)
  }

  /** Fly the editor camera to a named waypoint (rail list + coverage go-to). */
  function goToWaypoint(name: string) {
    const v = viewerRef.current
    const w = (fm.waypoints ?? []).find((x) => x.name === name)
    if (!v || !w) return
    setLookMode('orbit')
    void v.flyToView(w.position, w.target, true)
  }

  /** Point a section at a named waypoint (or none). Reuse = pick an existing one. */
  function assignWaypoint(sectionId: string, name: string | undefined) {
    patchSection(sectionId, { waypoint: name })
    if (name) setActiveWaypoint(name)
  }

  /** Replace the active waypoint's camera (set-to-view / move / aim). */
  function editActiveCamera(camera: Hotspot) {
    if (!activeWaypoint) return
    setFm((m) => ({ ...m, waypoints: upsertWaypoint(m.waypoints, activeWaypoint, camera) }))
  }

  /** Rename a waypoint and rewrite every section reference (child validates uniqueness). */
  function renameActiveWaypoint(oldName: string, newName: string) {
    const out = renameWaypoint(fm.waypoints ?? [], sections, oldName, newName)
    setFm((m) => ({ ...m, waypoints: out.waypoints }))
    setSections(out.sections)
    setActiveWaypoint(newName)
  }

  /** Delete a waypoint (confirmed) — referencing sections fall back to default framing. */
  function deleteWaypointConfirmed(name: string) {
    const out = deleteWaypoint(fm.waypoints ?? [], sections, name)
    setFm((m) => ({ ...m, waypoints: out.waypoints }))
    setSections(out.sections)
    if (activeWaypoint === name) setActiveWaypoint(null)
    setConfirmDelete(null)
  }

  // ── Model selection ───────────────────────────────────────────────────────
  function setModelPath(value: string) {
    if (uploaded) {
      URL.revokeObjectURL(uploaded.url)
      setUploaded(null)
    }
    setFm((m) => ({ ...m, model: value }))
  }
  function onUpload(file: File) {
    if (uploaded) URL.revokeObjectURL(uploaded.url)
    const url = URL.createObjectURL(file)
    const format = file.name.split('.').pop()?.toLowerCase() ?? ''
    setUploaded({ url, file, format })
    setFm((m) => ({ ...m, model: `assets/${file.name}` }))
  }

  // ── Media uploads (image/audio/video) ─────────────────────────────────────
  // Hold the File so it can be bundled on export; preview from a blob URL by
  // pointing the section's src at the assets/ path it will export to.
  function onMediaUpload(sectionId: string, file: File) {
    const path = `assets/${file.name}`
    const url = URL.createObjectURL(file)
    setMediaUploads((prev) => {
      const next = { ...prev }
      const old = sections.find((i) => i.id === sectionId)?.src
      if (old && next[old] && old !== path) URL.revokeObjectURL(next[old].url)
      next[path] = { url, file }
      return next
    })
    patchSection(sectionId, { src: path })
  }

  // Uploaded model/media blob URLs intentionally live for the whole tab session:
  // they must survive the editor ⇄ /preview round-trip (the draft-store resume
  // snapshot keeps referencing them) and React StrictMode's dev remount, so we do
  // NOT revoke on unmount — doing so revoked a still-needed blob on the second
  // preview. Replacing a model/media file revokes the old URL at the point of
  // replacement (see onUpload / onMediaUpload / setModelPath); the browser frees
  // any remaining blob URLs when the tab closes.

  const previewSrc = uploaded ? uploaded.url : fm.model
  const previewFormat = uploaded ? uploaded.format : undefined

  // Uploaded model/media live only in this browser session (held as blob URLs,
  // not on disk). Warn before they're lost — but NOT when going to /preview
  // (a round-trip that keeps the uploads), and NOT once the story is saved to
  // the gallery (the session store then holds the uploads).
  const hasUploads = !!uploaded || Object.keys(mediaUploads).length > 0
  // Set when "Save to gallery" hands the draft to the gallery store; any later
  // edit re-arms the warning since the saved copy no longer matches the draft.
  const [saved, setSaved] = useState(false)
  const warnOnLeave = hasUploads && !saved
  const [confirmLeave, setConfirmLeave] = useState(false)

  useEffect(() => {
    setSaved(false)
  }, [fm, sections, uploaded, mediaUploads])

  function leaveToHome() {
    if (warnOnLeave) setConfirmLeave(true)
    else navigate('/')
  }

  // Closing/refreshing the tab also discards the uploads — trigger the browser's
  // native "Leave site?" guard (custom UI isn't allowed for unload) while unsaved.
  useEffect(() => {
    if (!warnOnLeave) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // required for the prompt to show in some browsers
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [warnOnLeave])

  // Bundle-able assets actually referenced by the current draft (shared with the
  // gallery export so both compute the same set).
  const bundleAssets = collectAssets(fm, sections, uploaded, mediaUploads)

  // Readiness for the header status pill (soft — never blocks save/preview).
  const issues = validateStory({ frontmatter: fm, sections, basePath, warnings: [] })

  // Finish → hand this draft to the in-session gallery (as an editor snapshot so
  // it re-opens verbatim), then go to the gallery where the author selects and
  // exports. Upsert by slug, so re-saving an edited story updates it in place.
  function saveToGallery() {
    if (validateStory({ frontmatter: fm, sections, basePath, warnings: [] }).length > 0) return
    const slug = slugify(fm.title)
    useGalleryStore.getState().save({
      slug,
      key: slug,
      fm,
      sections,
      basePath,
      uploaded,
      mediaUploads,
      savedAt: Date.now(),
    })
    setSaved(true)
    navigate('/')
  }

  // Open the draft in the real viewer (Mode A/B) without exporting. Stashes a
  // resume snapshot so returning restores this exact draft, blob model included.
  function goPreview() {
    // Point each uploaded media section at its blob URL so it renders in the real
    // viewer; the resume snapshot keeps the original assets/ paths + uploads.
    const previewSections = sections.map((i) =>
      i.src && mediaUploads[i.src] ? { ...i, src: mediaUploads[i.src].url } : i,
    )
    const story: Story = {
      frontmatter: { ...fm, model: previewSrc },
      sections: previewSections,
      basePath,
      warnings: [],
    }
    useDraftStore.getState().openPreview(
      { story, modelFormat: previewFormat, returnTo: isNew ? '/edit/new' : `/edit/${id}` },
      { key: routeKey, fm, sections, basePath, uploaded, mediaUploads },
    )
    navigate('/preview')
  }

  if (loadError) {
    return (
      <div className="page">
        <div className="page-topbar">
          <Link to="/" className="back">
            ← All stories
          </Link>
        </div>
        <p className="state">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="editor">
      <div className="editor-topbar">
        <button type="button" className="back" onClick={leaveToHome}>
          ← All stories
        </button>
        <p className="eyebrow">{isNew ? 'New story' : `Editing ${id}`}</p>
        <div className="editor-topbar-actions">
          <button className="btn" onClick={goPreview} title="Open this draft in the viewer (Mode A / B)">
            ▶ Preview
          </button>
          <button
            className="btn btn-accent"
            onClick={saveToGallery}
            disabled={issues.length > 0}
            title={
              issues.length > 0
                ? 'Resolve the items in the status checklist before saving'
                : 'Add this story to your gallery — then choose it (and any others) to export as a website'
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
          <AccordionSection step={1} title="Scene" open={openSteps.scene} onToggle={() => toggleStep('scene')}>
            <SceneForm
              fm={fm}
              uploadedModel={uploaded ? fm.model : null}
              onChange={(patch) => setFm((m) => ({ ...m, ...patch }))}
              onModelPath={setModelPath}
              onUpload={onUpload}
            />
          </AccordionSection>

          <AccordionSection step={2} title="Story" open={openSteps.story} onToggle={() => toggleStep('story')}>
            <StoryDetailsForm fm={fm} onChange={(patch) => setFm((m) => ({ ...m, ...patch }))} />
            <SectionList
              sections={sections}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAdd={addSection}
              onRemove={removeSection}
              onMove={moveSection}
            />
            {selected && (
              <SectionForm
                section={selected}
                waypoints={fm.waypoints ?? []}
                onChange={(patch) => patchSection(selected.id, patch)}
                onChangeType={(t) => changeType(selected.id, t)}
                onUpload={(file) => onMediaUpload(selected.id, file)}
                uploaded={!!selected.src && !!mediaUploads[selected.src]}
                onAssignWaypoint={(name) => assignWaypoint(selected.id, name)}
              />
            )}
          </AccordionSection>

          <AccordionSection
            step={3}
            title="Waypoints"
            open={openSteps.waypoints}
            onToggle={() => toggleStep('waypoints')}
            badge={`${sections.filter((s) => s.waypoint).length}/${sections.length}`}
          >
            <div className="ed-fields">
              <p className="ed-hint">
                Frame the 3D scene and use <strong>＋ Add a waypoint</strong> to save a view. Select
                one to edit it under the canvas.
              </p>
              {(fm.waypoints ?? []).length === 0 ? (
                <p className="ed-hint">No waypoints yet.</p>
              ) : (
                <ul className="wp-list">
                  {(fm.waypoints ?? []).map((w) => {
                    const isActive = w.name === activeWaypoint
                    const uses = countUsage(sections, w.name)
                    return (
                      <li
                        key={w.name}
                        className={isActive ? 'wp-row wp-row-active' : 'wp-row'}
                        onClick={() => setActiveWaypoint(isActive ? null : w.name)}
                      >
                        <span className="hp-key hp-key-cam">●</span>
                        <span className="wp-name">{w.name}</span>
                        <span className="wp-usage" title={`${uses} section(s) use this view`}>
                          {uses || '—'}
                        </span>
                        <button
                          className="ed-icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            goToWaypoint(w.name)
                          }}
                          title="Fly the camera to this view"
                        >
                          ↩
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </AccordionSection>

          <AccordionSection step={4} title="Publish" open={openSteps.publish} onToggle={() => toggleStep('publish')}>
            <p className="ed-hint">
              Use <strong>Save to gallery</strong> in the top bar to keep this story and export a
              website. Or grab the raw file:
            </p>
            <ExportBar
              story={{ frontmatter: fm, sections, basePath, warnings: [] }}
              assets={bundleAssets}
            />
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

        <main className="editor-stage">
          <HotspotPlacer
            previewSrc={previewSrc}
            previewFormat={previewFormat}
            previewOrientation={fm.orientation}
            basePath={basePath}
            waypoints={fm.waypoints ?? []}
            activeWaypoint={activeWaypoint}
            lookMode={lookMode}
            onLookMode={setLookMode}
            onViewerReady={(v) => {
              viewerRef.current = v
            }}
            onCapture={captureWaypoint}
            onRename={renameActiveWaypoint}
            onDelete={setConfirmDelete}
            onEditActive={editActiveCamera}
          />
        </main>
      </div>

      {confirmLeave && (
        <ConfirmDialog
          title="Discard uploaded files?"
          message={
            'Your uploaded 3D model and media live only in this browser session — ' +
            "they aren't saved anywhere yet. Save to your gallery first if you want to keep them."
          }
          confirmLabel="Leave & discard"
          cancelLabel="Keep editing"
          danger
          onConfirm={() => navigate('/')}
          onCancel={() => setConfirmLeave(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete waypoint "${confirmDelete}"?`}
          message={(() => {
            const uses = countUsage(sections, confirmDelete)
            return uses > 0
              ? `${uses} section${uses > 1 ? 's' : ''} use this view — they'll fall back to default framing.`
              : 'No sections use this view.'
          })()}
          confirmLabel="Delete & unset"
          cancelLabel="Keep"
          danger
          onConfirm={() => deleteWaypointConfirmed(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
