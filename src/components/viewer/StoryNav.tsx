import { Link } from 'react-router-dom'
import type { Neighbour } from '../../lib/storyNeighbours'

/**
 * Linear travel to the neighbouring stories, shown in both reading modes:
 *  - `variant="page"` — an end-of-scroll "Continue reading" block.
 *  - `variant="immersive"` — a compact row in the footer (rendered only on the
 *    last section by ImmersiveView), where `emphasizeNext` makes "Next story" a
 *    filled call-to-action.
 *
 * Targets come from the live story index (see storyNeighbours), so a single-story
 * kiosk export passes both neighbours as null and this renders nothing. Phase 1
 * uses a plain <Link> route change; a later phase swaps stories in place.
 */
export function StoryNav({
  prev,
  next,
  variant,
  emphasizeNext,
}: {
  prev: Neighbour | null
  next: Neighbour | null
  variant: 'page' | 'immersive'
  emphasizeNext?: boolean
}) {
  if (!prev && !next) return null

  return (
    <nav className={`story-nav story-nav--${variant}`} aria-label="Other stories">
      {variant === 'page' && <p className="story-nav-heading">Continue reading</p>}
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
          <Link
            to={`/story/${next.id}`}
            className={`story-nav-link story-nav-next${emphasizeNext ? ' is-emphasized' : ''}`}
          >
            <span className="story-nav-dir">Next story →</span>
            <span className="story-nav-title">{next.title}</span>
          </Link>
        )}
      </div>
    </nav>
  )
}
