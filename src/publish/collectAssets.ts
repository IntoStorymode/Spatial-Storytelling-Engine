import type { Collection, Frontmatter, Section } from '../parser/types'

/** Minimal shape of an in-memory upload (its File is what gets bundled). */
interface UploadRef {
  file: File
}

/**
 * The bundle-able assets actually referenced by a draft: the uploaded model
 * (when the model came from a file, not a `builtin:`/typed path) plus any
 * uploaded media still pointed at by an section's `src`.
 *
 * Shared by the editor (live draft) and the gallery export so both compute the
 * exact same asset set.
 */
export function collectAssets(
  fm: Frontmatter,
  sections: Section[],
  uploaded: UploadRef | null,
  mediaUploads: Record<string, UploadRef>,
): { path: string; file: File }[] {
  return [
    ...(uploaded ? [{ path: fm.model, file: uploaded.file }] : []),
    ...sections
      .map((i) => i.src)
      .filter((src): src is string => !!src && !!mediaUploads[src])
      .map((src) => ({ path: src, file: mediaUploads[src].file })),
  ]
}

/**
 * The bundle-able assets of a collection: its cover, when the cover came from an
 * upload rather than a typed path.
 *
 * Separate from collectAssets rather than folded into it: a collection has no
 * model and no sections, so there is nothing for that function to walk. It also
 * means the story asset set is provably unchanged by collections existing.
 *
 * A typed-path cover (not uploaded through the editor) is deliberately omitted,
 * matching how a story's typed media is treated — the browser can only bundle
 * Files it was actually handed.
 */
export function collectCollectionAssets(
  collection: Pick<Collection, 'cover'>,
  cover: UploadRef | null,
): { path: string; file: File }[] {
  return collection.cover && cover ? [{ path: collection.cover, file: cover.file }] : []
}
