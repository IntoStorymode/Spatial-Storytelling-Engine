import { Fragment, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Story } from '../../parser/types'
import { useStoryStore } from '../../store/useStoryStore'
import { StageSlot } from './StageSlot'
import { ModeToggle } from './ModeToggle'
import { ItemContent } from '../content/ItemContent'

/**
 * Mode B — the page view (default). A scrolling long-form article: header, then
 * story items top-to-bottom via the shared ItemContent. The persistent 3D model
 * appears inline as ONE element in the scroll. An IntersectionObserver tracks
 * which item is centred so that toggling into Mode A lands on the same item.
 */
export function PageView({ story }: { story: Story }) {
  const { frontmatter: fm, items, basePath } = story
  const { id } = useParams<{ id: string }>()
  const setActiveIndex = useStoryStore((s) => s.setActiveIndex)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])
  const modelAfter = items.length > 1 ? 0 : items.length - 1

  // Update activeIndex as items scroll through the middle of the viewport.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = sectionRefs.current.indexOf(e.target as HTMLElement)
            if (i >= 0) setActiveIndex(i)
          }
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    sectionRefs.current.forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [items, setActiveIndex])

  return (
    <div className="page">
      <div className="page-topbar">
        <Link to="/" className="back">
          ← All stories
        </Link>
        <div className="page-topbar-actions">
          {id && (
            <Link to={`/edit/${id}`} className="btn mode-toggle">
              ✎ Edit
            </Link>
          )}
          <ModeToggle />
        </div>
      </div>

      <article className="article">
        <header className="article-header">
          <p className="eyebrow">Story</p>
          <h1 className="article-title">{fm.title}</h1>
          <p className="article-byline">
            {fm.author}
            {fm.location && (
              <>
                <span className="sep">·</span>
                {fm.location}
              </>
            )}
            {fm.date && (
              <>
                <span className="sep">·</span>
                {fm.date}
              </>
            )}
          </p>
        </header>

        {items.map((item, i) => (
          <Fragment key={item.id}>
            <section
              className="item"
              id={item.id}
              ref={(el) => (sectionRefs.current[i] = el)}
            >
              <p className="item-eyebrow">
                {String(i + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
              </p>
              <h2 className="item-title">{item.title}</h2>
              <ItemContent item={item} basePath={basePath} />
            </section>

            {i === modelAfter && (
              <figure className="model-figure">
                <StageSlot className="model-frame" />
                <figcaption>
                  The 3D scan — drag to orbit, scroll to zoom. Switch to the immersive
                  view to move through it hotspot by hotspot.
                </figcaption>
              </figure>
            )}
          </Fragment>
        ))}
      </article>
    </div>
  )
}
