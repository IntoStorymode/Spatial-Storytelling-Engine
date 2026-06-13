import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { parseStory } from '../parser/parseStory'
import type { Story } from '../parser/types'
import { PageView } from '../components/viewer/PageView'

interface IndexEntry {
  id: string
  path: string
}

/**
 * Viewer (screens 3 & 4) — fetches + parses a story by :id, then renders it.
 * M3 ships Mode B (PageView) only; the Mode A toggle arrives in M4 and will
 * re-lay-out around the SAME persistent canvas without reloading the model.
 */
export function ViewerRoute() {
  const { id } = useParams<{ id: string }>()
  const [story, setStory] = useState<Story | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStory(null)
    setError(null)

    async function load() {
      // Resolve the story's path + base directory from the static registry.
      const idxRes = await fetch('/stories/index.json')
      if (!idxRes.ok) throw new Error(`Failed to load story index (HTTP ${idxRes.status})`)
      const idx = (await idxRes.json()).stories as IndexEntry[]
      const entry = idx.find((s) => s.id === id)
      if (!entry) throw new Error(`Story "${id}" is not in the index.`)

      const mdRes = await fetch(entry.path)
      if (!mdRes.ok) throw new Error(`Failed to load story.md (HTTP ${mdRes.status})`)
      const raw = await mdRes.text()

      const basePath = entry.path.replace(/[^/]+$/, '') // strip filename → directory
      if (!cancelled) setStory(parseStory(raw, basePath))
    }

    load().catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className="page">
      <div className="page-topbar">
        <Link to="/" className="back">
          ← All stories
        </Link>
        <p className="eyebrow">Page view</p>
      </div>

      {error && <p className="state">{error}</p>}
      {!error && !story && <p className="state">Loading story…</p>}

      {story && story.warnings.length > 0 && (
        <div className="warnings">
          <strong>Parser notes</strong>
          <ul>
            {story.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {story && <PageView story={story} />}
    </div>
  )
}
