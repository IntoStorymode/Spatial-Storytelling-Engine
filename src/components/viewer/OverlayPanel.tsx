import type { Story } from '../../parser/types'
import { useStoryStore } from '../../store/useStoryStore'
import { ItemContent } from '../content/ItemContent'

/**
 * Mode A content overlay — renders the active story item over the 3D scene
 * using the SAME ItemContent as the page view, so prose/media never diverge
 * between modes. Keyed on activeIndex so a content fade can replay per item.
 */
export function OverlayPanel({ story }: { story: Story }) {
  const activeIndex = useStoryStore((s) => s.activeIndex)
  const item = story.items[activeIndex]
  if (!item) return null
  return (
    <div className="overlay-panel" key={item.id}>
      <p className="item-eyebrow">
        {String(activeIndex + 1).padStart(2, '0')} / {String(story.items.length).padStart(2, '0')}
      </p>
      <h2 className="item-title">{item.title}</h2>
      <ItemContent item={item} basePath={story.basePath} />
    </div>
  )
}
