// Empty collection slot — shown only when the collection has no items.
// For non-empty collections the cursor is visualized as a border on CollectionItemCell.
export default function InsertionPoint() {
  return (
    <div className="w-[150px] h-[150px] rounded-sm flex flex-col items-center justify-center gap-1 border-2 border-dashed border-blue-500/40 text-blue-500/40">
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      <span className="text-[10px] font-medium">Legg til bilder</span>
    </div>
  )
}
