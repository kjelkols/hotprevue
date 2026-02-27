import type { FileGroup, ScanResult } from '../../types/api'

interface Props {
  scanResult: ScanResult
  unknownGroups: FileGroup[]
  onConfirm: () => void
  onBack: () => void
}

export default function StepScan({ scanResult, unknownGroups, onConfirm, onBack }: Props) {
  const known = scanResult.groups.length - unknownGroups.length

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Skannresultat</h2>

        <div className="grid grid-cols-2 gap-4">
          <Stat label="Totalt filer" value={scanResult.totalFiles} />
          <Stat label="Bildegrupper" value={scanResult.groups.length} />
          <Stat label="Allerede registrert" value={known} color="text-gray-400" />
          <Stat label="Nye bilder" value={unknownGroups.length} color="text-blue-400" />
        </div>
      </div>

      {unknownGroups.length > 0 ? (
        <>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900">
            <div className="sticky top-0 border-b border-gray-700 bg-gray-900 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Nye bilder som vil bli registrert
            </div>
            <ul className="divide-y divide-gray-800">
              {unknownGroups.map(g => (
                <li key={g.masterPath} className="px-4 py-2">
                  <p className="truncate text-sm text-gray-200">{g.masterPath}</p>
                  {g.companions.length > 0 && (
                    <p className="text-xs text-gray-500">
                      + {g.companions.length} vedlegg ({g.companions.map(c => c.type).join(', ')})
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
            >
              ← Tilbake
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500"
            >
              Start opplasting ({unknownGroups.length} bilder) →
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-green-800 bg-green-950 px-6 py-4 text-green-300">
          Alle bilder i denne katalogen er allerede registrert.
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg bg-gray-800 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
