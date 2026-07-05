import { useEffect, useState } from 'react'
import type { StoryItem } from '../../parser/types'
import { resolveUrl } from '../../three/loadModel'
import { useStoryStore } from '../../store/useStoryStore'
import { TextBlock } from './TextBlock'

/** Video item: a native player, an optional caption, then any body prose. */
export function VideoBlock({ item, basePath }: { item: StoryItem; basePath: string }) {
  const src = item.src ? resolveUrl(item.src, basePath) : ''
  // Track the exact src that failed so fixing the path clears the message.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = src !== '' && failedSrc === src
  // Signal play state so the viewer can pause the auto-tour and quiesce its
  // render loop while a video plays (see useStoryStore.videoPlaying).
  const setVideoPlaying = useStoryStore((s) => s.setVideoPlaying)
  useEffect(() => () => setVideoPlaying(false), [setVideoPlaying]) // release on unmount
  return (
    <>
      <figure className="media-figure">
        {src && !failed && (
          <video
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
            Video could not be loaded. Expected at <code>{item.src}</code>
          </p>
        )}
        {item.caption && <figcaption>{item.caption}</figcaption>}
      </figure>
      <TextBlock item={item} />
    </>
  )
}
