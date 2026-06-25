import { Routes, Route, Navigate } from 'react-router-dom'
import { HomeRoute } from './routes/HomeRoute'
import { ViewerRoute } from './routes/ViewerRoute'
import { EditorRoute } from './routes/EditorRoute'
import { PreviewRoute } from './routes/PreviewRoute'

/**
 * App router. Home → Viewer (Mode A/B), the story Editor, and a draft Preview.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/story/:id" element={<ViewerRoute />} />
      <Route path="/edit/new" element={<EditorRoute />} />
      <Route path="/edit/:id" element={<EditorRoute />} />
      <Route path="/preview" element={<PreviewRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
