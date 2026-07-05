import type { Frontmatter, StoryItem } from '../parser/types'

/** Minimal shape of an in-memory upload (its File is what gets bundled). */
interface UploadRef {
  file: File
}

/**
 * The bundle-able assets actually referenced by a draft: the uploaded model
 * (when the model came from a file, not a `builtin:`/typed path) plus any
 * uploaded media still pointed at by an item's `src`.
 *
 * Shared by the editor (live draft) and the gallery export so both compute the
 * exact same asset set.
 */
export function collectAssets(
  fm: Frontmatter,
  items: StoryItem[],
  uploaded: UploadRef | null,
  mediaUploads: Record<string, UploadRef>,
): { path: string; file: File }[] {
  return [
    ...(uploaded ? [{ path: fm.model, file: uploaded.file }] : []),
    ...items
      .map((i) => i.src)
      .filter((src): src is string => !!src && !!mediaUploads[src])
      .map((src) => ({ path: src, file: mediaUploads[src].file })),
  ]
}
