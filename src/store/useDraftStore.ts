import { create } from 'zustand'
import type { Frontmatter, Story, Section } from '../parser/types'

/** An uploaded asset held in memory: its blob URL plus the File for bundling. */
export interface Upload {
  url: string
  file: File
}

/** The editor's working state, kept so it survives a trip to /preview and back. */
export interface EditSnapshot {
  /** Route identity: the story id, or 'new'. */
  key: string
  /**
   * The story's stable identity: its gallery key and its export folder name
   * (`<slug>-site`). Derived from the title when a story is first written, then
   * remembered — so re-saving an edited story replaces it instead of forking a
   * twin, and renaming the story doesn't silently rename the exported folder.
   */
  slug: string
  fm: Frontmatter
  sections: Section[]
  basePath: string
  uploaded: (Upload & { format: string }) | null
  /** Uploaded media, keyed by the asset path it will export to. */
  mediaUploads: Record<string, Upload>
}

/** What /preview needs to render the draft in the real viewer. */
export interface DraftPreview {
  story: Story
  /** Format hint for a blob: model URL (which carries no file extension). */
  modelFormat?: string
  /** Where "Back to editor" should return. */
  returnTo: string
}

interface DraftState {
  preview: DraftPreview | null
  /** Set when leaving the editor for /preview; consumed on the editor's next mount. */
  resume: EditSnapshot | null
  openPreview: (preview: DraftPreview, resume: EditSnapshot) => void
  /** Stash a resume snapshot without a preview — used to re-open a saved story. */
  stashResume: (resume: EditSnapshot) => void
  /** Pure read — the snapshot for `key`, or null. Safe to call during render. */
  peekResume: (key: string) => EditSnapshot | null
  clearResume: () => void
}

/**
 * Bridges the editor and the /preview route. The editor's draft lives in local
 * component state; to preview it on a separate page without losing the draft (or
 * the uploaded model's in-memory blob URL), we stash a resume snapshot here and
 * restore it when the editor remounts. Reads are split from the clear so the
 * editor can peek during render and consume in an effect.
 */
export const useDraftStore = create<DraftState>((set, get) => ({
  preview: null,
  resume: null,
  openPreview: (preview, resume) => set({ preview, resume }),
  stashResume: (resume) => set({ resume }),
  peekResume: (key) => {
    const snap = get().resume
    return snap && snap.key === key ? snap : null
  },
  clearResume: () => set({ resume: null }),
}))
