import { useEffect, useRef, useState } from 'react'
import type { Section } from '../../parser/types'
import { resolveUrl } from '../../three/loadModel'
import { TextBlock } from './TextBlock'

/** Audio section: a native player, an optional caption, then any body prose. */
export function AudioBlock({
  section,
  basePath,
  autoplay = false,
}: {
  section: Section
  basePath: string
  autoplay?: boolean
}) {
  const src = section.src ? resolveUrl(section.src, basePath) : ''
  // Track the exact src that failed so fixing the path clears the message.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = src !== '' && failedSrc === src

  // Immersive auto-play: the block remounts per section (keyed on section.id),
  // so this fires each time the reader arrives. play() may reject under the
  // browser's autoplay policy — swallow it; the controls stay for manual play.
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (autoplay && src && !failed) audioRef.current?.play().catch(() => {})
  }, [autoplay, src, failed])

  return (
    <>
      <figure className="media-figure">
        {src && !failed && <audio ref={audioRef} controls src={src} onError={() => setFailedSrc(src)} />}
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
