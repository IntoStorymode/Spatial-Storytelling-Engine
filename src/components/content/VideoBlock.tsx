import { useState } from 'react'
import type { StoryItem } from '../../parser/types'
import { resolveUrl } from '../../three/loadModel'
import { TextBlock } from './TextBlock'

/** Video item: a native player, an optional caption, then any body prose. */
export function VideoBlock({ item, basePath }: { item: StoryItem; basePath: string }) {
  const src = item.src ? resolveUrl(item.src, basePath) : ''
  // Track the exact src that failed so fixing the path clears the message.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = src !== '' && failedSrc === src
  return (
    <>
      <figure className="media-figure">
        {src && !failed && <video controls src={src} onError={() => setFailedSrc(src)} />}
        {failed && (
          <p className="media-missing" role="alert">
            Video could not be loaded. Expected at <code>{item.src}</code>
          </p>
        )}
        {item.caption && <figcaption>{item.caption}</figcaption>}
      </figure>
      <TextBlock item={item} />
    </>
  )
}
