import { Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './lib/store'
import EditPage from './pages/EditPage'
import ViewPage from './pages/ViewPage'

export default function App() {
  return (
    <StoreProvider>
      <div className="app-shell">
        <div className="app-bg" aria-hidden />
        <Routes>
          <Route path="/" element={<Navigate to="/view" replace />} />
          <Route path="/view" element={<ViewPage />} />
          <Route path="/view/:nodeId" element={<ViewPage />} />
          <Route path="/edit" element={<EditPage />} />
          <Route path="/edit/:nodeId" element={<EditPage />} />
          <Route path="*" element={<Navigate to="/view" replace />} />
        </Routes>
      </div>
    </StoreProvider>
  )
}
