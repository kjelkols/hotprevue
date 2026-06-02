import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import FolderPanel from '../features/preorganisering/FolderPanel'
import PhotoFolderGrid from '../features/preorganisering/PhotoFolderGrid'
import usePreorganiserStore from '../stores/usePreorganiserStore'

export default function PreorganiseringPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentDir = usePreorganiserStore(s => s.currentDir)
  const setCurrentDir = usePreorganiserStore(s => s.setCurrentDir)

  // Ved oppstart: gjenopprett katalog fra URL
  useEffect(() => {
    const dir = searchParams.get('dir')
    if (dir) setCurrentDir(dir)
  }, [])

  // Når katalogen endres: oppdater URL
  useEffect(() => {
    if (currentDir) setSearchParams({ dir: currentDir }, { replace: true })
    else setSearchParams({}, { replace: true })
  }, [currentDir])

  return (
    <div className="flex h-full overflow-hidden">
      <FolderPanel />
      <PhotoFolderGrid />
    </div>
  )
}
