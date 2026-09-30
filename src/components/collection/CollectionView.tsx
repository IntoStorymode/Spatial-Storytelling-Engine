import { Link } from 'react-router-dom'
import type { Collection } from '../../parser/types'
import type { Neighbour } from '../../lib/storyNeighbours'
import { Prose } from '../content/TextBlock'

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
  coverUrl = null,
  hideBack = false,
  storyLinks = true,
}: {
  collection: Collection
  /** The collection's stories, already resolved against the index and in author order. */
  stories: Neighbour[]
  /**
   * The cover, already resolved to something an <img> can load. Passed in rather
   * than derived, because the two callers resolve it differently: a deployed
   * collection resolves `cover` against its basePath, while one held in the
   * gallery has only a blob URL for an uploaded File. Null renders no cover.
   */
  coverUrl?: string | null
  hideBack?: boolean
  /**
   * Render the story list as links. False in the editor preview, where the
   * stories may exist only in the session gallery and have nowhere to navigate to.
   */
  storyLinks?: boolean
}) {
  const cover = coverUrl

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
                  {storyLinks ? (
                    <Link to={`/story/${s.id}`} className="story-nav-related-link">
                      {s.title}
                    </Link>
                  ) : (
                    <span className="story-nav-related-link">{s.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        )}
      </article>
    </div>
  )
}
