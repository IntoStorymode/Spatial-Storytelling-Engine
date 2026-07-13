import type { Upload } from '../store/useDraftStore'
import type { SavedStory } from '../store/useGalleryStore'
import type { ImportedStory } from './importSite'

/**
 * An imported story → a gallery entry the editor can open verbatim.
 *
 * The result is indistinguishable from a story authored in this session: `basePath`
 * is empty and every asset is a File behind a blob URL, exactly as `onUpload` leaves
 * them. That's what lets the editor, preview and export all work on an import without
 * a line of change — `fm.model` / `section.src` keep their `assets/…` paths, so
 * collectAssets re-derives the same bundle on the way back out.
 *
 * Blob URLs are deliberately not revoked, matching the editor's rationale (see the
 * note in EditorRoute around the uploads effect): they must outlive the editor ⇄
 * preview round-trip, and the session is the lifetime that matters.
 */
export function toSavedStory(imported: ImportedStory, savedAt: number): SavedStory {
  const { slug, story, model, media } = imported

  const mediaUploads: Record<string, Upload> = {}
  for (const [path, file] of Object.entries(media)) {
    mediaUploads[path] = { url: URL.createObjectURL(file), file }
  }

  return {
    slug,
    key: slug, // must match the /edit/:id route key — peekResume looks it up by this
    fm: story.frontmatter,
    sections: story.sections,
    basePath: '',
    uploaded: model
      ? { url: URL.createObjectURL(model.file), file: model.file, format: model.format }
      : null,
    mediaUploads,
    savedAt,
  }
}
