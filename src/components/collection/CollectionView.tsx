import { Link } from 'react-router-dom'
import type { Collection } from '../../parser/types'
import type { Neighbour } from '../../lib/storyNeighbours'
import { Prose } from '../content/TextBlock'
import { resolveUrl } from '../../lib/resolveUrl'

/**
 * A collection's landing page — the front door of a multi-story site.
 *
 * Deliberately *not* a PageView: it mounts no ViewerStage, so no WebGL context
 * is created and no model is ever fetched. The landing page stays light (prose
 * and, at most, a cover image) and the splat renderer — which is lazily imported
 * by the loaders — is never pulled in until the reader opens a story. Reusing
 * PageView would have meant threading "there is no model" through ViewerStage,
 * ThreeViewer and ModeToggle as a sentinel.
 *
 * Purely presentational: everything is fetched and resolved by CollectionRoute,
 * so the collection editor can render this inline as a live preview.
 */
export function CollectionView({
  collection,
  stories,
  hideBack = false,
}: {
  collection: Collection
  /** The collection's stories, already resolved against the index and in author order. */
  stories: Neighbour[]
  hideBack?: boolean
}) {
  const cover = collection.cover ? resolveUrl(collection.cover, collection.basePath) : null

  return (
    <div className="page">
      <div className="page-topbar">
        {hideBack ? (
          <span />
        ) : (
          <Link to="/" className="back">
            ← All stories
          </Link>
        )}
      </div>

      <article className="article">
        <header className="article-header">
          <p className="eyebrow">Collection</p>
          <h1 className="article-title">{collection.title}</h1>
          {collection.subtitle && <p className="article-byline">{collection.subtitle}</p>}
        </header>

        {cover && (
          <figure className="collection-cover">
            <img src={cover} alt="" />
          </figure>
        )}

        {collection.body && <Prose body={collection.body} className="collection-body" />}

        {stories.length > 0 && (
          <nav className="collection-stories" aria-label="Stories in this collection">
            <p className="story-nav-heading">
              {stories.length === 1 ? '1 story' : `${stories.length} stories`}
            </p>
            <ul className="story-nav-related-list">
              {stories.map((s) => (
                <li key={s.id}>
                  <span className="story-nav-related-arrow" aria-hidden="true">
                    →
                  </span>
                  <Link to={`/story/${s.id}`} className="story-nav-related-link">
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </article>
    </div>
  )
}
