import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { parseStory } from '../parser/parseStory'
import type { Story } from '../parser/types'
import { useStoryStore } from '../store/useStoryStore'
import { ViewerStage } from '../components/viewer/ViewerStage'
import { PageView } from '../components/viewer/PageView'
import { ImmersiveView } from '../components/viewer/ImmersiveView'
import { resolveStoryLinks, storyNeighbours } from '../lib/storyNeighbours'
import type { Neighbour, Neighbours } from '../lib/storyNeighbours'

interface IndexEntry {
  id: string
  title: string
  path: string
}

/** A story plus its index-derived navigation — swapped in as one unit. */
interface Bundle {
  story: Story
  neighbours: Neighbours
  /** Curated links resolved against the live index (existing targets only). */
  links: Neighbour[]
}

/**
 * Viewer (screens 3 & 4) — fetches + parses a story by :id and renders it.
 *
 * Two bundles are tracked so travel is seamless: `displayed` is what the reader
 * currently sees; `target` is the latest story parsed from the URL. On a switch
 * we set `target` but keep showing `displayed` — ViewerStage preloads the target's
 * model in the background and, once it's ready, commits it and calls `onCommit`,
 * which promotes target → displayed. So text, model and camera arrive together
 * with no black gap, and ViewerStage never unmounts (the WebGL context survives).
 */
export function ViewerRoute() {
  const { id } = useParams<{ id: string }>()
  const [displayed, setDisplayed] = useState<Bundle | null>(null)
  const [target, setTarget] = useState<Bundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mode = useStoryStore((s) => s.mode)

  // Latest target, for the commit callback (which runs in a promise, not render).
  const targetRef = useRef<Bundle | null>(null)
  targetRef.current = target

  useEffect(() => {
    let cancelled = false
    setError(null)

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
        // Set the target only. The displayed bundle keeps showing (with its live
        // viewer) until ViewerStage has the new model ready — see onCommit. Prev/
        // next follow the index's own (unsorted) order, matching the gallery;
        // curated links are resolved against that same index (existing only).
        const story = parseStory(raw, basePath)
        setTarget({
          story,
          neighbours: storyNeighbours(idx, id),
          links: resolveStoryLinks(idx, story.frontmatter.links, id),
        })
      }
    }

    load().catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [id])

  // The pending model is committed — promote the target to displayed so its text
  // and neighbours appear in the same batch as the model/camera.
  const onCommit = useCallback(() => {
    if (targetRef.current) setDisplayed(targetRef.current)
  }, [])

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

  if (!target) return <p className="state">Loading story…</p>

  // Drive the viewer's per-section/camera effects from the displayed story (or the
  // target on first load, before anything is shown); preload the target's model.
  const shown = displayed ?? target
  return (
    <ViewerStage story={shown.story} pendingStory={target.story} onCommit={onCommit}>
      {displayed && (
        <>
          {displayed.story.warnings.length > 0 && mode === 'page' && (
            <div className="warnings">
              <strong>Parser notes</strong>
              <ul>
                {displayed.story.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {mode === 'page' ? (
            <PageView
              story={displayed.story}
              prev={displayed.neighbours.prev}
              next={displayed.neighbours.next}
              links={displayed.links}
            />
          ) : (
            <ImmersiveView
              story={displayed.story}
              prev={displayed.neighbours.prev}
              next={displayed.neighbours.next}
            />
          )}
        </>
      )}
    </ViewerStage>
  )
}
