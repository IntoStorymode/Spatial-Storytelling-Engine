import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { parseStory } from '../parser/parseStory'
import type { Frontmatter, Hotspot, ItemType, Story, StoryItem } from '../parser/types'
import { useDraftStore } from '../store/useDraftStore'
import type { Upload } from '../store/useDraftStore'
import { StoryMetaForm } from '../components/editor/StoryMetaForm'
import { ItemList } from '../components/editor/ItemList'
import { ItemForm } from '../components/editor/ItemForm'
import { HotspotPlacer } from '../components/editor/HotspotPlacer'
import { ExportBar } from '../components/editor/ExportBar'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface IndexEntry {
  id: string
  path: string
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function emptyFrontmatter(): Frontmatter {
  return { title: 'Untitled story', author: '', location: '', date: todayISO(), model: 'builtin:room' }
}

function newItem(items: StoryItem[]): StoryItem {
  const ids = new Set(items.map((i) => i.id))
  let n = items.length + 1
  let id = `item-${String(n).padStart(2, '0')}`
  while (ids.has(id)) id = `item-${String(++n).padStart(2, '0')}`
  return { id, title: 'New section', type: 'text', body: '' }
}

/**
 * Editor (screen 2) — create or edit a story.md end to end: metadata, an ordered
 * list of items with per-type content, click-to-place hotspots in the 3D scene,
 * and export back to a story.md via the serializer. Draft lives in local state;
 * nothing is written until the author exports.
 */
export function EditorRoute() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const routeKey = id ?? 'new'

  // Restore the in-progress draft if we're returning from /preview (else seed a
  // fresh draft). Computed once per mount; peekResume is a pure read.
  const initRef = useRef<{
    fm: Frontmatter
    items: StoryItem[]
    basePath: string
    uploaded: (Upload & { format: string }) | null
    mediaUploads: Record<string, Upload>
    resumed: boolean
  } | null>(null)
  if (!initRef.current) {
    const snap = useDraftStore.getState().peekResume(routeKey)
    initRef.current = snap
      ? { fm: snap.fm, items: snap.items, basePath: snap.basePath, uploaded: snap.uploaded, mediaUploads: snap.mediaUploads, resumed: true }
      : { fm: emptyFrontmatter(), items: [newItem([])], basePath: '', uploaded: null, mediaUploads: {}, resumed: false }
  }
  const init = initRef.current

  const [fm, setFm] = useState<Frontmatter>(init.fm)
  const [items, setItems] = useState<StoryItem[]>(init.items)
  const [selectedId, setSelectedId] = useState<string | null>(init.items[0]?.id ?? null)
  const [basePath, setBasePath] = useState(init.basePath)
  // An uploaded model previews from a blob URL while exporting an assets/ path.
  const [uploaded, setUploaded] = useState<(Upload & { format: string }) | null>(init.uploaded)
  // Uploaded media, keyed by the assets/ path it will export to.
  const [mediaUploads, setMediaUploads] = useState<Record<string, Upload>>(init.mediaUploads)
  const [loadError, setLoadError] = useState<string | null>(null)

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
      setItems(story.items)
      setSelectedId(story.items[0]?.id ?? null)
      setBasePath(dir)
    }
    load().catch((e) => !cancelled && setLoadError(String(e)))
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  const selected = items.find((i) => i.id === selectedId) ?? null

  // ── Draft mutations ───────────────────────────────────────────────────────
  function patchItem(itemId: string, patch: Partial<StoryItem>) {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)))
  }
  function changeType(itemId: string, type: ItemType) {
    // Dropping to text clears media-only fields so export stays clean.
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, type, ...(type === 'text' ? { src: undefined, caption: undefined } : {}) }
          : i,
      ),
    )
  }
  function addItem() {
    setItems((prev) => {
      const it = newItem(prev)
      setSelectedId(it.id)
      return [...prev, it]
    })
  }
  function removeItem(itemId: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== itemId)
      if (selectedId === itemId) setSelectedId(next[0]?.id ?? null)
      return next
    })
  }
  function moveItem(itemId: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === itemId)
      const swap = idx + dir
      if (idx < 0 || swap < 0 || swap >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }
  function setHotspot(itemId: string, hotspot: Hotspot | undefined) {
    patchItem(itemId, { hotspot })
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
  // pointing the item's src at the assets/ path it will export to.
  function onMediaUpload(itemId: string, file: File) {
    const path = `assets/${file.name}`
    const url = URL.createObjectURL(file)
    setMediaUploads((prev) => {
      const next = { ...prev }
      const old = items.find((i) => i.id === itemId)?.src
      if (old && next[old] && old !== path) URL.revokeObjectURL(next[old].url)
      next[path] = { url, file }
      return next
    })
    patchItem(itemId, { src: path })
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
  // (a round-trip that keeps the uploads), and NOT once the site is downloaded.
  const hasUploads = !!uploaded || Object.keys(mediaUploads).length > 0
  // Set when "Download website" saves the uploads to disk; any later edit re-arms
  // the warning since the exported zip no longer matches the draft.
  const [exported, setExported] = useState(false)
  const warnOnLeave = hasUploads && !exported
  const [confirmLeave, setConfirmLeave] = useState(false)

  useEffect(() => {
    setExported(false)
  }, [fm, items, uploaded, mediaUploads])

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

  // Bundle-able assets actually referenced by the current draft: the uploaded
  // model plus any uploaded media still pointed at by an item.
  const bundleAssets: { path: string; file: File }[] = [
    ...(uploaded ? [{ path: fm.model, file: uploaded.file }] : []),
    ...items
      .map((i) => i.src)
      .filter((src): src is string => !!src && !!mediaUploads[src])
      .map((src) => ({ path: src, file: mediaUploads[src].file })),
  ]

  // Open the draft in the real viewer (Mode A/B) without exporting. Stashes a
  // resume snapshot so returning restores this exact draft, blob model included.
  function goPreview() {
    // Point each uploaded media item at its blob URL so it renders in the real
    // viewer; the resume snapshot keeps the original assets/ paths + uploads.
    const previewItems = items.map((i) =>
      i.src && mediaUploads[i.src] ? { ...i, src: mediaUploads[i.src].url } : i,
    )
    const story: Story = {
      frontmatter: { ...fm, model: previewSrc },
      items: previewItems,
      basePath,
      warnings: [],
    }
    useDraftStore.getState().openPreview(
      { story, modelFormat: previewFormat, returnTo: isNew ? '/edit/new' : `/edit/${id}` },
      { key: routeKey, fm, items, basePath, uploaded, mediaUploads },
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
          <ExportBar
            story={{ frontmatter: fm, items, basePath, warnings: [] }}
            assets={bundleAssets}
            onBundleDownloaded={() => setExported(true)}
          />
        </div>
      </div>

      <div className="editor-body">
        <aside className="editor-forms">
          <StoryMetaForm
            fm={fm}
            uploadedModel={uploaded ? fm.model : null}
            onChange={(patch) => setFm((m) => ({ ...m, ...patch }))}
            onModelPath={setModelPath}
            onUpload={onUpload}
          />
          <ItemList
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={addItem}
            onRemove={removeItem}
            onMove={moveItem}
          />
          {selected && (
            <ItemForm
              item={selected}
              onChange={(patch) => patchItem(selected.id, patch)}
              onChangeType={(t) => changeType(selected.id, t)}
              onUpload={(file) => onMediaUpload(selected.id, file)}
              uploaded={!!selected.src && !!mediaUploads[selected.src]}
            />
          )}
        </aside>

        <main className="editor-stage">
          <HotspotPlacer
            previewSrc={previewSrc}
            previewFormat={previewFormat}
            basePath={basePath}
            selected={selected}
            onHotspotChange={(h) => selected && setHotspot(selected.id, h)}
            start={fm.start ?? null}
            onStartChange={(start) => setFm((m) => ({ ...m, start }))}
          />
        </main>
      </div>

      {confirmLeave && (
        <ConfirmDialog
          title="Discard uploaded files?"
          message={
            'Your uploaded 3D model and media live only in this browser session — ' +
            "they aren't saved anywhere yet. Download the bundle first if you want to keep them."
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
