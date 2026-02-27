import type { ProcessResult } from '../../types/api'

interface Props {
  result: ProcessResult
  onClose: () => void
}

export default function StepSummary({ result, onClose }: Props) {
  const total = result.registered + result.duplicates + result.errors

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-6">
        <h2 className="mb-2 text-2xl font-bold text-white">Registrering fullført</h2>
        <p className="mb-6 text-gray-400">
          {total} grupper behandlet
        </p>

        <div className="grid grid-cols-3 gap-4">
          <ResultStat
            label="Registrert"
            value={result.registered}
            color="text-green-400"
            bg="bg-green-950 border-green-800"
          />
          <ResultStat
            label="Duplikater"
            value={result.duplicates}
            color="text-yellow-400"
            bg="bg-yellow-950 border-yellow-800"
          />
          <ResultStat
            label="Feil"
            value={result.errors}
            color="text-red-400"
            bg="bg-red-950 border-red-800"
          />
        </div>
      </div>

      {result.errors > 0 && (
        <p className="rounded-xl border border-yellow-800 bg-yellow-950 px-4 py-3 text-sm text-yellow-300">
          {result.errors} filer kunne ikke registreres. Sjekk backend-loggene for detaljer.
        </p>
      )}

      <button
        onClick={onClose}
        className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500"
      >
        Tilbake til forsiden
      </button>
    </div>
  )
}

function ResultStat({
  label,
  value,
  color,
  bg
}: {
  label: string
  value: number
  color: string
  bg: string
}) {
  return (
    <div className={`rounded-xl border px-4 py-4 text-center ${bg}`}>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-sm text-gray-400">{label}</p>
    </div>
  )
}
