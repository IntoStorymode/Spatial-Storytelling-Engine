import { useState } from 'react'
import type { Section } from '../../parser/types'
import { resolveUrl } from '../../three/loadModel'
import { TextBlock } from './TextBlock'

/** Audio section: a native player, an optional caption, then any body prose. */
export function AudioBlock({ section, basePath }: { section: Section; basePath: string }) {
  const src = section.src ? resolveUrl(section.src, basePath) : ''
  // Track the exact src that failed so fixing the path clears the message.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = src !== '' && failedSrc === src
  return (
    <>
      <figure className="media-figure">
        {src && !failed && <audio controls src={src} onError={() => setFailedSrc(src)} />}
        {failed && (
          <p className="media-missing" role="alert">
            Audio could not be loaded. Expected at <code>{section.src}</code>
          </p>
        )}
        {section.caption && <figcaption>{section.caption}</figcaption>}
      </figure>
      <TextBlock section={section} />
    </>
  )
}
