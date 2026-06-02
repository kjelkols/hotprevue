import FolderPanel from '../features/preorganisering/FolderPanel'
import PhotoFolderGrid from '../features/preorganisering/PhotoFolderGrid'

export default function PreorganiseringPage() {
  return (
    <div className="flex h-full overflow-hidden">
      <FolderPanel />
      <PhotoFolderGrid />
    </div>
  )
}
