import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { parseStory } from '../parser/parseStory'
import type { Story } from '../parser/types'
import { useStoryStore } from '../store/useStoryStore'
import { ViewerStage } from '../components/viewer/ViewerStage'
import { PageView } from '../components/viewer/PageView'
import { ImmersiveView } from '../components/viewer/ImmersiveView'
import { storyNeighbours } from '../lib/storyNeighbours'
import type { Neighbours } from '../lib/storyNeighbours'

interface IndexEntry {
  id: string
  title: string
  path: string
}

/**
 * Viewer (screens 3 & 4) — fetches + parses a story by :id, then renders it in
 * the current mode. ViewerStage stays mounted across the Mode A ⇄ Mode B toggle,
 * so the 3D model is never reloaded; only its child view swaps.
 */
export function ViewerRoute() {
  const { id } = useParams<{ id: string }>()
  const [story, setStory] = useState<Story | null>(null)
  const [neighbours, setNeighbours] = useState<Neighbours>({ prev: null, next: null })
  const [error, setError] = useState<string | null>(null)
  const mode = useStoryStore((s) => s.mode)
  const reset = useStoryStore((s) => s.reset)

  useEffect(() => {
    let cancelled = false
    setStory(null)
    setNeighbours({ prev: null, next: null })
    setError(null)
    reset() // fresh mode/activeIndex/auto-tour per story

    async function load() {
      const idxRes = await fetch('stories/index.json')
      if (!idxRes.ok) throw new Error(`Failed to load story index (HTTP ${idxRes.status})`)
      const idx = (await idxRes.json()).stories as IndexEntry[]
      const entry = idx.find((s) => s.id === id)
      if (!entry) throw new Error(`Story "${id}" is not in the index.`)

      const mdRes = await fetch(entry.path)
      if (!mdRes.ok) throw new Error(`Failed to load story.md (HTTP ${mdRes.status})`)
      const raw = await mdRes.text()

      const basePath = entry.path.replace(/[^/]+$/, '') // strip filename → directory
      if (!cancelled) {
        setStory(parseStory(raw, basePath))
        // Prev/next follow the index's own (unsorted) order — the same order the
        // gallery lists — so "next" is the story shown after this one on Home.
        setNeighbours(storyNeighbours(idx, id))
      }
    }

    load().catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [id, reset])

  if (error) {
    return (
      <div className="page">
        <div className="page-topbar">
          <Link to="/" className="back">
            ← All stories
          </Link>
        </div>
        <p className="state">{error}</p>
      </div>
    )
  }

  if (!story) return <p className="state">Loading story…</p>

  return (
    <ViewerStage story={story}>
      {story.warnings.length > 0 && mode === 'page' && (
        <div className="warnings">
          <strong>Parser notes</strong>
          <ul>
            {story.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {mode === 'page' ? (
        <PageView story={story} prev={neighbours.prev} next={neighbours.next} />
      ) : (
        <ImmersiveView story={story} prev={neighbours.prev} next={neighbours.next} />
      )}
    </ViewerStage>
  )
}
