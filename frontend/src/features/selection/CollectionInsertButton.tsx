import { useCollectionInsert } from '../collection/useCollectionInsert'

interface Props {
  collectionId: string
  collectionName: string
}

export default function CollectionInsertButton({ collectionId, collectionName }: Props) {
  const { insert, isPending } = useCollectionInsert(collectionId)

  return (
    <button
      onClick={insert}
      disabled={isPending}
      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
    >
      {isPending ? 'Setter inn…' : `Sett inn i «${collectionName}»`}
    </button>
  )
}
