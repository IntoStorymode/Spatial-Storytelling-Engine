import { Link } from 'react-router-dom'
import type { Neighbour } from '../../lib/storyNeighbours'

/**
 * The page view's end-of-scroll "Continue reading" block — links to the previous
 * and next stories. Targets come from the live story index (see storyNeighbours),
 * so a single-story kiosk export passes both neighbours as null and this renders
 * nothing. Immersive mode surfaces story travel through NavControls instead.
 */
export function StoryNav({ prev, next }: { prev: Neighbour | null; next: Neighbour | null }) {
  if (!prev && !next) return null

  return (
    <nav className="story-nav story-nav--page" aria-label="Other stories">
      <p className="story-nav-heading">Continue reading</p>
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
    </nav>
  )
}
