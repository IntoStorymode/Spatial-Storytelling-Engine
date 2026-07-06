import { Fragment, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Story } from '../../parser/types'
import { useStoryStore } from '../../store/useStoryStore'
import { StageSlot } from './StageSlot'
import { ModeToggle } from './ModeToggle'
import { SectionContent } from '../content/SectionContent'
import { isPublishedSite } from '../../publish/published'

/**
 * Mode B — the page view (default). A scrolling long-form article: header, then
 * story sections top-to-bottom via the shared SectionContent. The persistent 3D model
 * appears inline as ONE element in the scroll. An IntersectionObserver tracks
 * which section is centred so that toggling into Mode A lands on the same section.
 */
export function PageView({ story }: { story: Story }) {
  const { frontmatter: fm, sections, basePath } = story
  const { id } = useParams<{ id: string }>()
  const setActiveIndex = useStoryStore((s) => s.setActiveIndex)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])
  const modelAfter = sections.length > 1 ? 0 : sections.length - 1

  // Update activeIndex as sections scroll through the middle of the viewport.
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
  }, [sections, setActiveIndex])

  return (
    <div className="page">
      <div className="page-topbar">
        <Link to="/" className="back">
          ← All stories
        </Link>
        <div className="page-topbar-actions">
          {id && !isPublishedSite() && (
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

        {sections.map((section, i) => (
          <Fragment key={section.id}>
            <section
              className="section"
              id={section.id}
              ref={(el) => (sectionRefs.current[i] = el)}
            >
              <p className="item-eyebrow">
                {String(i + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}
              </p>
              <h2 className="item-title">{section.title}</h2>
              <SectionContent section={section} basePath={basePath} />
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
