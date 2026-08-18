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
      <p className="story-nav-heading">Continue reading</p>
      {(prev || next) && (
        <div className="story-nav-links">
          {prev ? (
            <Link to={`/story/${prev.id}`} className="story-nav-link story-nav-prev">
              <span className="story-nav-dir">← Previous story</span>
              <span className="story-nav-title">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/story/${next.id}`} className="story-nav-link story-nav-next">
              <span className="story-nav-dir">Next story →</span>
              <span className="story-nav-title">{next.title}</span>
            </Link>
          )}
        </div>
      )}
      {links.length > 0 && (
        <div className="story-nav-related">
          <p className="story-nav-related-label">Related stories</p>
          <ul className="story-chips">
            {links.map((l) => (
              <li key={l.id}>
                <Link to={`/story/${l.id}`} className="story-chip">
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  )
}
