import { Outlet } from 'react-router-dom'
import TopNav from '../components/TopNav'
import SourceTargetPanel from '../features/navigation/SourceTargetPanel'

export default function AppLayout() {
  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      <TopNav />
      <SourceTargetPanel />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
