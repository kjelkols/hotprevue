import { useEffect } from 'react'
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { setBaseUrl } from './api/client'
import AppLayout from './pages/AppLayout'
import HomePage from './pages/HomePage'
import BrowsePage from './pages/BrowsePage'
import PhotoDetailPage from './pages/PhotoDetailPage'
import CollectionsListPage from './pages/CollectionsListPage'
import CollectionPage from './pages/CollectionPage'
import CollectionPresentPage from './pages/CollectionPresentPage'
import SessionsListPage from './pages/SessionsListPage'
import EventsListPage from './pages/EventsListPage'
import SettingsPage from './pages/SettingsPage'
import ContextMenuOverlay from './components/ui/ContextMenuOverlay'
import SelectionTray from './features/selection/SelectionTray'
import useSelectionStore from './stores/useSelectionStore'
import useContextMenuStore from './stores/useContextMenuStore'

// I utvikling peker Vite mot localhost:8000 direkte.
// I produksjon serveres frontend fra samme origin som API.
setBaseUrl(import.meta.env.DEV ? 'http://localhost:8000' : '')

export default function App() {
  const clearPhotoSelection = useSelectionStore(s => s.clear)
  const contextMenuOpen = useContextMenuStore(s => s.open)
  const closeContextMenu = useContextMenuStore(s => s.closeContextMenu)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (contextMenuOpen) closeContextMenu()
        else clearPhotoSelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [contextMenuOpen, closeContextMenu, clearPhotoSelection])

  return (
    <HashRouter>
      <Routes>
        <Route path="/collections/:id/present" element={<CollectionPresentPage />} />
        <Route element={<AppLayout />}>
          <Route path="/"                element={<HomePage />} />
          <Route path="/browse"          element={<BrowsePage />} />
          <Route path="/photos/:hothash" element={<PhotoDetailPage />} />
          <Route path="/collections"     element={<CollectionsListPage />} />
          <Route path="/collections/:id" element={<CollectionPage />} />
          <Route path="/sessions"        element={<SessionsListPage />} />
          <Route path="/events"          element={<EventsListPage />} />
          <Route path="/settings"        element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ContextMenuOverlay />
      <SelectionTray />
    </HashRouter>
  )
}
