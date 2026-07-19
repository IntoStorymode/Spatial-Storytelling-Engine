import type { Section } from '../../parser/types'
import { TextBlock } from './TextBlock'
import { ImageBlock } from './ImageBlock'
import { AudioBlock } from './AudioBlock'
import { VideoBlock } from './VideoBlock'

/**
 * Single source of truth for rendering a story section's content by type.
 * BOTH Mode B (PageView) and Mode A (ImmersiveView, M4) render sections through
 * here, so the two modes can never drift in how a media type looks.
 *
 * Per-section `autoplay` only fires in the immersive overlay (Mode A), which
 * passes `immersive`; page view never does, so media there always waits for the
 * reader. The flag is a section property, so each clip opts in independently.
 */
export function SectionContent({
  section,
  basePath,
  immersive = false,
}: {
  section: Section
  basePath: string
  immersive?: boolean
}) {
  const autoplay = immersive && !!section.autoplay
  switch (section.type) {
    case 'image':
      return <ImageBlock section={section} basePath={basePath} />
    case 'audio':
      return <AudioBlock section={section} basePath={basePath} autoplay={autoplay} />
    case 'video':
      return <VideoBlock section={section} basePath={basePath} autoplay={autoplay} />
    case 'text':
    default:
      return <TextBlock section={section} />
  }
}
