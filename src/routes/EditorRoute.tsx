import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { parseStory } from '../parser/parseStory'
import type { Frontmatter, Hotspot, ItemType, StoryItem } from '../parser/types'
import { StoryMetaForm } from '../components/editor/StoryMetaForm'
import { ItemList } from '../components/editor/ItemList'
import { ItemForm } from '../components/editor/ItemForm'
import { HotspotPlacer } from '../components/editor/HotspotPlacer'
import { ExportBar } from '../components/editor/ExportBar'

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
  const isNew = !id

  const [fm, setFm] = useState<Frontmatter>(emptyFrontmatter)
  const [items, setItems] = useState<StoryItem[]>(() => [newItem([])])
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null)
  const [basePath, setBasePath] = useState('')
  // An uploaded model previews from a blob URL while exporting an assets/ path.
  const [uploaded, setUploaded] = useState<{ url: string; format: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load an existing story for editing.
  useEffect(() => {
    if (isNew) return
    let cancelled = false
    async function load() {
      const idx = (await (await fetch('/stories/index.json')).json()).stories as IndexEntry[]
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
    setUploaded({ url, format })
    setFm((m) => ({ ...m, model: `assets/${file.name}` }))
  }

  const previewSrc = uploaded ? uploaded.url : fm.model
  const previewFormat = uploaded ? uploaded.format : undefined

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
        <Link to="/" className="back">
          ← All stories
        </Link>
        <p className="eyebrow">{isNew ? 'New story' : `Editing ${id}`}</p>
        <ExportBar story={{ frontmatter: fm, items, basePath, warnings: [] }} uploaded={!!uploaded} />
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
          />
        </main>
      </div>
    </div>
  )
}
