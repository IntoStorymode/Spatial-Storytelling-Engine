import { useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useStoryStore } from '../store/useStoryStore'
import { useDraftStore } from '../store/useDraftStore'
import { ViewerStage } from '../components/viewer/ViewerStage'
import { PageView } from '../components/viewer/PageView'
import { ImmersiveView } from '../components/viewer/ImmersiveView'

/**
 * Preview (M7) — renders the editor's draft in the REAL viewer (Mode A/B toggle,
 * scroll, nav), reading from the draft store instead of fetching a published
 * story.md. Lets an author flip between modes before exporting. "Back to editor"
 * returns to the in-progress draft (restored from the resume snapshot).
 */
export function PreviewRoute() {
  const preview = useDraftStore((s) => s.preview)
  const mode = useStoryStore((s) => s.mode)
  const reset = useStoryStore((s) => s.reset)

  // Fresh mode/activeIndex/auto-tour for the preview session.
  useEffect(() => {
    reset()
  }, [reset])

  // Nothing staged (e.g. a hard refresh on /preview) — go back to authoring.
  if (!preview) return <Navigate to="/edit/new" replace />

  const { story, modelFormat, returnTo } = preview

  return (
    <ViewerStage story={story} modelFormat={modelFormat}>
      <div className="preview-bar" role="status">
        <span className="preview-tag">Preview</span>
        <span className="muted">Draft — not published</span>
        <Link to={returnTo} className="btn preview-back">
          ← Back to editor
        </Link>
      </div>
      {mode === 'page' ? <PageView story={story} hideBack /> : <ImmersiveView story={story} hideBack />}
    </ViewerStage>
  )
}
