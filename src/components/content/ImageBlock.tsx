import type { StoryItem } from '../../parser/types'
import { resolveUrl } from '../../three/loadModel'
import { TextBlock } from './TextBlock'

/** Image item: the picture, an optional caption, then any body prose. */
export function ImageBlock({ item, basePath }: { item: StoryItem; basePath: string }) {
  const src = item.src ? resolveUrl(item.src, basePath) : ''
  return (
    <>
      <figure className="media-figure">
        {src && <img src={src} alt={item.caption ?? item.title} />}
        {item.caption && <figcaption>{item.caption}</figcaption>}
      </figure>
      <TextBlock item={item} />
    </>
  )
}
