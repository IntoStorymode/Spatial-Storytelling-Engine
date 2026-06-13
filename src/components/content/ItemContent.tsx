import type { StoryItem } from '../../parser/types'
import { TextBlock } from './TextBlock'
import { ImageBlock } from './ImageBlock'
import { AudioBlock } from './AudioBlock'
import { VideoBlock } from './VideoBlock'

/**
 * Single source of truth for rendering a story item's content by type.
 * BOTH Mode B (PageView) and Mode A (ImmersiveView, M4) render items through
 * here, so the two modes can never drift in how a media type looks.
 */
export function ItemContent({ item, basePath }: { item: StoryItem; basePath: string }) {
  switch (item.type) {
    case 'image':
      return <ImageBlock item={item} basePath={basePath} />
    case 'audio':
      return <AudioBlock item={item} basePath={basePath} />
    case 'video':
      return <VideoBlock item={item} basePath={basePath} />
    case 'text':
    default:
      return <TextBlock item={item} />
  }
}
