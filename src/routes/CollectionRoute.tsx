import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { parseCollection } from '../parser/collection'
import type { Collection } from '../parser/types'
import { CollectionView } from '../components/collection/CollectionView'
import { resolveStoryLinks } from '../lib/storyNeighbours'
import type { Neighbour } from '../lib/storyNeighbours'
import { readCollectionEntries, collectionPathFor } from '../lib/collectionIndex'

/** A collection plus its resolved story list. */
interface Bundle {
  collection: Collection
  stories: Neighbour[]
}

/**
 * The collection landing page — fetches and parses a collection.md and renders
 * it. No ViewerStage, so no WebGL context and no model fetch: the landing page is
 * text and a cover image only.
 *
 * Mounted two ways, which is why the id can be passed in rather than only read
 * from the route:
 * - at `/collection/:id`, the canonical deep link, and how the dev app views one;
 * - at `/` on a published collection export, where Home *is* the landing page, so
 *   the reader's URL stays a clean `/` with no redirect and no duplicate story
 *   listing behind it (see HomeRoute).
 *
 * Discovery prefers the `collections` key in stories/index.json, falling back to
 * the conventional `collections/<id>/collection.md` path so a local, gitignored
 * collection previews without editing the tracked index.
 */
export function CollectionRoute({
  id: idProp,
  hideBack = false,
}: {
  /** Overrides the route param — used when Home renders the collection at `/`. */
  id?: string
  /** Hide the back link: at `/` there is nowhere further back to go. */
  hideBack?: boolean
} = {}) {
  const { id: routeId } = useParams<{ id: string }>()
  const id = idProp ?? routeId
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setBundle(null)

    async function load() {
      const idxRes = await fetch('stories/index.json')
      if (!idxRes.ok) throw new Error(`Failed to load story index (HTTP ${idxRes.status})`)
      const json = await idxRes.json()
      const idx = (json.stories ?? []) as Neighbour[]

      const entry = readCollectionEntries(json).find((c) => c.id === id)
      const path = entry?.path ?? collectionPathFor(id ?? '')

      const mdRes = await fetch(path)
      if (!mdRes.ok) throw new Error(`Collection "${id}" was not found in this site.`)
      const raw = await mdRes.text()

      const basePath = path.replace(/[^/]+$/, '') // strip filename → directory
      const collection = parseCollection(raw, basePath)

      if (!cancelled) {
        // The author's `stories:` order is the only order. resolveStoryLinks keeps
        // just the ids present in this deployment (so a story left out of an export
        // never renders a dead link), drops duplicates, and preserves that order;
        // `undefined` for currentId because a collection has no self to exclude.
        setBundle({ collection, stories: resolveStoryLinks(idx, collection.stories, undefined) })
      }
    }

    load().catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return (
      <div className="page">
        <div className="page-topbar">
          {hideBack ? <span /> : <Link to="/" className="back">← All stories</Link>}
        </div>
        <p className="state">{error}</p>
      </div>
    )
  }

  if (!bundle) return <p className="state">Loading collection…</p>

  return (
    <>
      {bundle.collection.warnings.length > 0 && (
        <div className="warnings">
          <strong>Parser notes</strong>
          <ul>
            {bundle.collection.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <CollectionView collection={bundle.collection} stories={bundle.stories} hideBack={hideBack} />
    </>
  )
}
