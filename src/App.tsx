import { Routes, Route, Navigate } from 'react-router-dom'
import { HomeRoute } from './routes/HomeRoute'
import { ViewerRoute } from './routes/ViewerRoute'
import { EditorRoute } from './routes/EditorRoute'
import { PreviewRoute } from './routes/PreviewRoute'
import { isPublishedSite } from './publish/published'

/**
 * App router. Home → Viewer (Mode A/B), the story Editor, and a draft Preview.
 * On a published (exported/hosted) site the authoring routes are read-only:
 * /edit/* and /preview redirect to Home so the editor is genuinely unreachable,
 * not merely hidden.
 */
export default function App() {
  const published = isPublishedSite()
  const home = <Navigate to="/" replace />
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/story/:id" element={<ViewerRoute />} />
      <Route path="/edit/new" element={published ? home : <EditorRoute />} />
      <Route path="/edit/:id" element={published ? home : <EditorRoute />} />
      <Route path="/preview" element={published ? home : <PreviewRoute />} />
      <Route path="*" element={home} />
    </Routes>
  )
}
