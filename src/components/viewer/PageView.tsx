import { Fragment } from 'react'
import type { Story } from '../../parser/types'
import { ThreeCanvas } from '../ThreeCanvas'
import { ItemContent } from '../content/ItemContent'

/**
 * Mode B — the page view (default). A scrolling long-form article: header,
 * then story items top-to-bottom rendered through the shared ItemContent. The
 * 3D model appears inline as ONE element in the scroll (after the first item),
 * embodying "narrative *around* the scan."
 */
export function PageView({ story }: { story: Story }) {
  const { frontmatter: fm, items, basePath } = story
  const modelAfter = items.length > 1 ? 0 : items.length - 1 // index to place model after

  return (
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
          <section className="item" id={item.id}>
            <p className="item-eyebrow">
              {String(i + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
            </p>
            <h2 className="item-title">{item.title}</h2>
            <ItemContent item={item} basePath={basePath} />
          </section>

          {i === modelAfter && (
            <figure className="model-figure">
              <div className="model-frame">
                <ThreeCanvas model={fm.model} basePath={basePath} />
              </div>
              <figcaption>
                The 3D scan — drag to orbit, scroll to zoom. The same model leads the
                immersive view.
              </figcaption>
            </figure>
          )}
        </Fragment>
      ))}
    </article>
  )
}
