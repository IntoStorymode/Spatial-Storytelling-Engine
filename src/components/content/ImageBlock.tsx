import { useState } from 'react'
import type { Section } from '../../parser/types'
import { resolveUrl } from '../../lib/resolveUrl'
import { TextBlock } from './TextBlock'

/** Shown in place of an image whose `src` fails to load (missing/404 asset). */
const MISSING_IMAGE = '/placeholder-missing.svg'

/** Image section: the picture, an optional caption, then any body prose. */
export function ImageBlock({ section, basePath }: { section: Section; basePath: string }) {
  const src = section.src ? resolveUrl(section.src, basePath) : ''
  // Track the exact src that failed so fixing the path clears the fallback.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = src !== '' && failedSrc === src
  return (
    <>
      <figure className="media-figure">
        {src && (
          <img
            src={failed ? MISSING_IMAGE : src}
            alt={section.caption ?? section.title}
            onError={failed ? undefined : () => setFailedSrc(src)}
          />
        )}
        {failed && (
          <p className="media-missing" role="alert">
            Image not found — showing a placeholder. Expected at <code>{section.src}</code>
          </p>
        )}
        {section.caption && <figcaption>{section.caption}</figcaption>}
      </figure>
      <TextBlock section={section} />
    </>
  )
}
