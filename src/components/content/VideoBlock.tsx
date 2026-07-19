import { useEffect, useRef, useState } from 'react'
import type { Section } from '../../parser/types'
import { resolveUrl } from '../../three/loadModel'
import { useStoryStore } from '../../store/useStoryStore'
import { TextBlock } from './TextBlock'

/** Video section: a native player, an optional caption, then any body prose. */
export function VideoBlock({
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
  // Signal play state so the viewer can pause the auto-tour and quiesce its
  // render loop while a video plays (see useStoryStore.videoPlaying).
  const setVideoPlaying = useStoryStore((s) => s.setVideoPlaying)
  useEffect(() => () => setVideoPlaying(false), [setVideoPlaying]) // release on unmount

  // Immersive auto-play: the block remounts per section (keyed on section.id),
  // so this fires each time the reader arrives. play() may reject under the
  // browser's autoplay policy (no user gesture yet) — swallow it; the controls
  // stay so the reader can start it manually. onPlay still wires videoPlaying.
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (autoplay && src && !failed) videoRef.current?.play().catch(() => {})
  }, [autoplay, src, failed])

  return (
    <>
      <figure className="media-figure">
        {src && !failed && (
          <video
            ref={videoRef}
            controls
            playsInline
            preload="auto"
            src={src}
            onPlay={() => setVideoPlaying(true)}
            onPause={() => setVideoPlaying(false)}
            onEnded={() => setVideoPlaying(false)}
            onError={() => setFailedSrc(src)}
          />
        )}
        {failed && (
          <p className="media-missing" role="alert">
            Video could not be loaded. Expected at <code>{section.src}</code>
          </p>
        )}
        {section.caption && <figcaption>{section.caption}</figcaption>}
      </figure>
      <TextBlock section={section} />
    </>
  )
}
