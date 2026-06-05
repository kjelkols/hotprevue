import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import FolderPanel from '../features/preorganisering/FolderPanel'
import PhotoFolderGrid from '../features/preorganisering/PhotoFolderGrid'
import SplitPane from '../components/SplitPane'
import usePreorganiserStore from '../stores/usePreorganiserStore'

export default function PreorganiseringPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentDir = usePreorganiserStore(s => s.currentDir)
  const setCurrentDir = usePreorganiserStore(s => s.setCurrentDir)

  useEffect(() => {
    const dir = searchParams.get('dir')
    if (dir) setCurrentDir(dir)
  }, [])

  useEffect(() => {
    if (currentDir) setSearchParams({ dir: currentDir }, { replace: true })
    else setSearchParams({}, { replace: true })
  }, [currentDir])

  return (
    <div className="h-full">
      <SplitPane
        left={<FolderPanel />}
        right={<PhotoFolderGrid />}
        defaultSize={224}
        minSize={150}
        maxSize={400}
        storageKey="preorganisering"
      />
    </div>
  )
}
