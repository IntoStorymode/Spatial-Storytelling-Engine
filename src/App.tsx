import { Routes, Route, Navigate } from 'react-router-dom'
import { HomeRoute } from './routes/HomeRoute'
import { ViewerRoute } from './routes/ViewerRoute'

/**
 * App router. M3 wires Home → Viewer (Mode B). The editor (/edit) and the
 * Mode A toggle land in later milestones.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/story/:id" element={<ViewerRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
