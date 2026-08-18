import { Link } from 'react-router-dom'
import type { Neighbour } from '../../lib/storyNeighbours'

/**
 * The page view's end-of-scroll navigation: the linear previous/next stories,
 * plus any curated links the author declared (`frontmatter.links`, already
 * resolved against the live index). Targets come from the live story index, so a
 * single-story kiosk export has no neighbours or links and this renders nothing.
 * Immersive mode surfaces the linear prev/next through NavControls instead.
 */
export function StoryNav({
  prev,
  next,
  links = [],
}: {
  prev: Neighbour | null
  next: Neighbour | null
  links?: Neighbour[]
}) {
  if (!prev && !next && links.length === 0) return null

  return (
    <nav className="story-nav story-nav--page" aria-label="Other stories">
      {links.length > 0 && (
        <div className="story-nav-related">
          <p className="story-nav-heading">Related stories</p>
          <ul className="story-nav-related-list">
            {links.map((l) => (
              <li key={l.id}>
                <span className="story-nav-related-arrow" aria-hidden="true">
                  →
                </span>
                <Link to={`/story/${l.id}`} className="story-nav-related-link">
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(prev || next) && (
        <div className="story-nav-continue">
          <p className="story-nav-heading">Continue reading</p>
          <div className="story-nav-links">
            {prev ? (
              <div className="story-nav-link story-nav-prev">
                <span className="story-nav-dir">← Previous story</span>
                <Link to={`/story/${prev.id}`} className="story-nav-title">
                  {prev.title}
                </Link>
              </div>
            ) : (
              <span />
            )}
            {next && (
              <div className="story-nav-link story-nav-next">
                <span className="story-nav-dir">Next story →</span>
                <Link to={`/story/${next.id}`} className="story-nav-title">
                  {next.title}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
