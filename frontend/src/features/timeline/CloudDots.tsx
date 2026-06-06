export function stableRandom(seed: string, index: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return ((h + index * 2654435761) >>> 0) / 0xFFFFFFFF
}

interface Props {
  count: number
  maxCount: number
  seed: string
  width: number
  height: number
  opacity?: number
}

export default function CloudDots({ count, maxCount, seed, width, height, opacity = 1 }: Props) {
  if (count === 0 || height < 2 || width < 4 || opacity < 0.01) return null

  const intensity = maxCount > 0 ? Math.min(1, count / maxCount) : 0.5

  // Thin rows: use a solid density bar (blur would be clipped by parent overflow)
  if (height < 22) {
    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity, background: `rgba(96,165,250,${0.12 + intensity * 0.65})` }}
      />
    )
  }

  // Taller rows: cloud dots with blur
  const numDots = Math.min(35, Math.max(3, Math.ceil(Math.sqrt(count))))
  const blurPx = Math.min(Math.max(height * 0.38, 6), 28)
  const maxSize = Math.min(height * 0.95, width * 0.12, 60)
  const minSize = Math.max(maxSize * 0.38, 6)

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ opacity, filter: `blur(${blurPx}px)` }}
    >
      {Array.from({ length: numDots }, (_, i) => {
        const size = minSize + stableRandom(seed, i * 3) * (maxSize - minSize)
        const x = stableRandom(seed, i * 3 + 1) * Math.max(0, width - size)
        const y = stableRandom(seed, i * 3 + 2) * Math.max(0, height - size)
        const a = (0.35 + stableRandom(seed, i * 3 + 9) * 0.5) * (0.5 + intensity * 0.5)
        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              left: x,
              top: y,
              background: `rgba(96,165,250,${a})`,
            }}
          />
        )
      })}
    </div>
  )
}
