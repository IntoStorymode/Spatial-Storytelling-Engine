import { useState } from 'react'
import type { StoryItem } from '../../parser/types'
import { resolveUrl } from '../../three/loadModel'
import { TextBlock } from './TextBlock'

/** Shown in place of an image whose `src` fails to load (missing/404 asset). */
const MISSING_IMAGE = '/placeholder-missing.svg'

/** Image item: the picture, an optional caption, then any body prose. */
export function ImageBlock({ item, basePath }: { item: StoryItem; basePath: string }) {
  const src = item.src ? resolveUrl(item.src, basePath) : ''
  // Track the exact src that failed so fixing the path clears the fallback.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = src !== '' && failedSrc === src
  return (
    <>
      <figure className="media-figure">
        {src && (
          <img
            src={failed ? MISSING_IMAGE : src}
            alt={item.caption ?? item.title}
            onError={failed ? undefined : () => setFailedSrc(src)}
          />
        )}
        {failed && (
          <p className="media-missing" role="alert">
            Image not found — showing a placeholder. Expected at <code>{item.src}</code>
          </p>
        )}
        {item.caption && <figcaption>{item.caption}</figcaption>}
      </figure>
      <TextBlock item={item} />
    </>
  )
}
