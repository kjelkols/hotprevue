import useCollectionViewStore from '../../stores/useCollectionViewStore'

interface Props {
  index: number
}

export default function InsertionPoint({ index }: Props) {
  const setInsertionPoint = useCollectionViewStore(s => s.setInsertionPoint)
  const insertionIndex = useCollectionViewStore(s => s.insertionIndex)
  const isActive = insertionIndex === index

  return (
    <div
      onClick={() => setInsertionPoint(isActive ? null : index)}
      className={[
        'w-[150px] h-[150px] rounded-sm flex flex-col items-center justify-center gap-1',
        'cursor-pointer transition-colors border-2 border-dashed',
        isActive
          ? 'border-blue-400 bg-blue-400/10 text-blue-400'
          : 'border-gray-700 bg-transparent text-gray-600 hover:border-gray-500 hover:text-gray-500',
      ].join(' ')}
    >
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      <span className="text-[10px] font-medium">Sett inn her</span>
    </div>
  )
}
