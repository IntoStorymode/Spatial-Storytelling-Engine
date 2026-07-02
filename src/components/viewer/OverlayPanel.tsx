import { useState } from 'react'
import type { Story } from '../../parser/types'
import { useStoryStore } from '../../store/useStoryStore'
import { ItemContent } from '../content/ItemContent'

/**
 * Mode A content overlay — renders the active story item over the 3D scene
 * using the SAME ItemContent as the page view, so prose/media never diverge
 * between modes.
 *
 * The panel can be collapsed (tucked off to the left) so the reader can orbit
 * the scene and reach the header unobstructed — important on phones where the
 * expanded panel otherwise covers most of the screen. Collapse state lives on
 * this stable wrapper (not the keyed content) so it persists across items; the
 * inner block stays keyed on activeIndex so its fade replays per item.
 */
export function OverlayPanel({ story }: { story: Story }) {
  const activeIndex = useStoryStore((s) => s.activeIndex)
  const [collapsed, setCollapsed] = useState(false)
  const item = story.items[activeIndex]
  if (!item) return null

  return (
    <>
      <div className={collapsed ? 'overlay-panel collapsed' : 'overlay-panel'} aria-hidden={collapsed}>
        <button
          type="button"
          className="overlay-collapse"
          onClick={() => setCollapsed(true)}
          aria-label="Hide story text"
          tabIndex={collapsed ? -1 : undefined}
        >
          ‹ Hide
        </button>
        <div className="overlay-content" key={item.id}>
          <p className="item-eyebrow">
            {String(activeIndex + 1).padStart(2, '0')} /{' '}
            {String(story.items.length).padStart(2, '0')}
          </p>
          <h2 className="item-title">{item.title}</h2>
          <ItemContent item={item} basePath={story.basePath} />
        </div>
      </div>

      {collapsed && (
        <button
          type="button"
          className="overlay-reopen"
          onClick={() => setCollapsed(false)}
          aria-label="Show story text"
        >
          › Text
        </button>
      )}
    </>
  )
}
