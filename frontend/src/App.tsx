import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { setBaseUrl } from './api/client'
import type { AppConfig } from './types/api'
import SetupPage from './pages/SetupPage'
import HomePage from './pages/HomePage'
import BrowsePage from './pages/BrowsePage'
import PhotoDetailPage from './pages/PhotoDetailPage'
import CollectionsListPage from './pages/CollectionsListPage'
import CollectionPage from './pages/CollectionPage'
import CollectionPresentPage from './pages/CollectionPresentPage'
import SessionsListPage from './pages/SessionsListPage'
import EventsListPage from './pages/EventsListPage'
import ContextMenuOverlay from './components/ui/ContextMenuOverlay'
import SelectionTray from './features/selection/SelectionTray'
import useSelectionStore from './stores/useSelectionStore'
import useContextMenuStore from './stores/useContextMenuStore'

export default function App() {
  const [config, setConfig] = useState<AppConfig | null | 'loading'>('loading')
  const clearPhotoSelection = useSelectionStore(s => s.clear)
  const contextMenuOpen = useContextMenuStore(s => s.open)
  const closeContextMenu = useContextMenuStore(s => s.closeContextMenu)

  useEffect(() => {
    window.electron.getConfig().then(cfg => {
      if (cfg) {
        setBaseUrl(cfg.backendUrl)
      }
      setConfig(cfg)
    })
  }, [])

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

  if (config === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400">
        Laster…
      </div>
    )
  }

  function handleConfigSaved(cfg: AppConfig) {
    setBaseUrl(cfg.backendUrl)
    setConfig(cfg)
  }

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/setup"
          element={<SetupPage onSaved={handleConfigSaved} />}
        />
        <Route
          path="/"
          element={config ? <HomePage /> : <Navigate to="/setup" replace />}
        />
        <Route
          path="/browse"
          element={config ? <BrowsePage /> : <Navigate to="/setup" replace />}
        />
        <Route
          path="/photos/:hothash"
          element={config ? <PhotoDetailPage /> : <Navigate to="/setup" replace />}
        />
        <Route
          path="/collections"
          element={config ? <CollectionsListPage /> : <Navigate to="/setup" replace />}
        />
        <Route
          path="/collections/:id"
          element={config ? <CollectionPage /> : <Navigate to="/setup" replace />}
        />
        <Route
          path="/collections/:id/present"
          element={config ? <CollectionPresentPage /> : <Navigate to="/setup" replace />}
        />
        <Route
          path="/sessions"
          element={config ? <SessionsListPage /> : <Navigate to="/setup" replace />}
        />
        <Route
          path="/events"
          element={config ? <EventsListPage /> : <Navigate to="/setup" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ContextMenuOverlay />
      <SelectionTray />
    </HashRouter>
  )
}
