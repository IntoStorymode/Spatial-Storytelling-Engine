import type { Section } from '../../parser/types'
import { TextBlock } from './TextBlock'
import { ImageBlock } from './ImageBlock'
import { AudioBlock } from './AudioBlock'
import { VideoBlock } from './VideoBlock'

/**
 * Single source of truth for rendering a story section's content by type.
 * BOTH Mode B (PageView) and Mode A (ImmersiveView, M4) render sections through
 * here, so the two modes can never drift in how a media type looks.
 */
export function SectionContent({ section, basePath }: { section: Section; basePath: string }) {
  switch (section.type) {
    case 'image':
      return <ImageBlock section={section} basePath={basePath} />
    case 'audio':
      return <AudioBlock section={section} basePath={basePath} />
    case 'video':
      return <VideoBlock section={section} basePath={basePath} />
    case 'text':
    default:
      return <TextBlock section={section} />
  }
}
