import type { StoryItem } from '../../parser/types'
import { resolveUrl } from '../../three/loadModel'
import { TextBlock } from './TextBlock'

/** Video item: a native player, an optional caption, then any body prose. */
export function VideoBlock({ item, basePath }: { item: StoryItem; basePath: string }) {
  const src = item.src ? resolveUrl(item.src, basePath) : ''
  return (
    <>
      <figure className="media-figure">
        {src && <video controls src={src} />}
        {item.caption && <figcaption>{item.caption}</figcaption>}
      </figure>
      <TextBlock item={item} />
    </>
  )
}
