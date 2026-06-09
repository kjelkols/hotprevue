import { useEffect } from 'react'
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { setBaseUrl } from './api/client'
import { useEnsureMachine } from './hooks/useEnsureMachine'
import MachineSetupDialog from './features/setup/MachineSetupDialog'
import AppLayout from './pages/AppLayout'
import HomePage from './pages/HomePage'
import BrowsePage from './pages/BrowsePage'
import PhotoDetailPage from './pages/PhotoDetailPage'
import CollectionsListPage from './pages/CollectionsListPage'
import CollectionPage from './pages/CollectionPage'
import CollectionPresentPage from './pages/CollectionPresentPage'
import RegisterPage from './pages/RegisterPage'
import SessionsListPage from './pages/SessionsListPage'
import EventsListPage from './pages/EventsListPage'
import EventPage from './pages/EventPage'
import SavedSearchesPage from './pages/SavedSearchesPage'
import SearchPage from './pages/SearchPage'
import SettingsPage from './pages/SettingsPage'
import LocationEditorPage from './pages/LocationEditorPage'
import PhotographersPage from './pages/PhotographersPage'
import MachinesPage from './pages/MachinesPage'
import SharedPhotoPage from './pages/SharedPhotoPage'
import KindsPage from './pages/KindsPage'
import TagsPage from './pages/TagsPage'
import PreorganiseringPage from './pages/PreorganiseringPage'
import AiSearchPage from './pages/AiSearchPage'
import TimelinePage from './pages/TimelinePage'
import ContextMenuOverlay from './components/ui/ContextMenuOverlay'
import ToastOverlay from './components/ui/ToastOverlay'
import SelectionTray from './features/selection/SelectionTray'
import EventPickerModal from './features/assignment/EventPickerModal'
import CollectionPickerModal from './features/assignment/CollectionPickerModal'
import useSelectionStore from './stores/useSelectionStore'
import useContextMenuStore from './stores/useContextMenuStore'

// Frontend og API serveres alltid fra samme origin.
// I utvikling proxyer Vite API-kall til backend på port 8000 (se vite.config.ts).
setBaseUrl('')

export default function App() {
  const { state, onSetupComplete } = useEnsureMachine()
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

  if (state === 'setup') {
    return <MachineSetupDialog onComplete={onSetupComplete} />
  }

  return (
    <HashRouter>
      {import.meta.env.VITE_IS_TEST === 'true' && (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-yellow-500 py-0.5 text-center text-xs font-bold text-black tracking-widest uppercase pointer-events-none select-none">
          Testinstans
        </div>
      )}
      <Routes>
        <Route path="/collections/:id/present" element={<CollectionPresentPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/share/photo/:hothash" element={<SharedPhotoPage />} />
        <Route element={<AppLayout />}>
          <Route path="/"                element={<HomePage />} />
          <Route path="/browse"          element={<BrowsePage />} />
          <Route path="/photos/:hothash" element={<PhotoDetailPage />} />
          <Route path="/collections"     element={<CollectionsListPage />} />
          <Route path="/collections/:id" element={<CollectionPage />} />
          <Route path="/sessions"        element={<SessionsListPage />} />
          <Route path="/events"          element={<EventsListPage />} />
          <Route path="/events/:id"      element={<EventPage />} />
          <Route path="/searches"        element={<SavedSearchesPage />} />
          <Route path="/searches/new"    element={<SearchPage />} />
          <Route path="/searches/:id"    element={<SearchPage />} />
          <Route path="/settings"        element={<SettingsPage />} />
          <Route path="/sted"            element={<LocationEditorPage />} />
          <Route path="/fotografer"        element={<PhotographersPage />} />
          <Route path="/maskiner"          element={<MachinesPage />} />
          <Route path="/kinds"             element={<KindsPage />} />
          <Route path="/tags"              element={<TagsPage />} />
          <Route path="/preorganisering"   element={<PreorganiseringPage />} />
          <Route path="/ai-search"         element={<AiSearchPage />} />
          <Route path="/timeline"          element={<TimelinePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ContextMenuOverlay />
      <ToastOverlay />
      <SelectionTray />
      <EventPickerModal />
      <CollectionPickerModal />
    </HashRouter>
  )
}
