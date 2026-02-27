import type { TextSlide } from '../../types/presentation'

function renderMarkup(markup: string) {
  const blocks = markup.trim().split(/\n{2,}/)
  return blocks.map((block, i) => {
    const t = block.trim()
    if (t.startsWith('# '))
      return (
        <h1 key={i} className="text-4xl font-bold text-white leading-tight">
          {t.slice(2)}
        </h1>
      )
    if (t.startsWith('## '))
      return (
        <h2 key={i} className="text-2xl font-semibold text-gray-200 leading-snug">
          {t.slice(3)}
        </h2>
      )
    return (
      <p key={i} className="text-xl text-gray-300 leading-relaxed">
        {t}
      </p>
    )
  })
}

interface Props {
  slide: TextSlide
}

export default function TextSlideView({ slide }: Props) {
  return (
    <div className="flex items-center justify-center w-full h-full px-12">
      <div className="flex flex-col gap-6 max-w-2xl w-full">
        {renderMarkup(slide.markup)}
      </div>
    </div>
  )
}
