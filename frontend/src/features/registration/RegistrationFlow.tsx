import { useState } from 'react'
import type { FileGroup, ProcessResult, ScanResult } from '../../types/api'
import type { AnalyzeResult, ResolvedEntry } from './registrationTypes'
import StepSetup from './StepSetup'
import StepFolderMap from './StepFolderMap'
import StepScan from './StepScan'
import StepUpload from './StepUpload'
import StepSummary from './StepSummary'

type Step = 'setup' | 'foldermap' | 'scan' | 'upload' | 'summary'

interface Props {
  onClose: () => void
}

export default function RegistrationFlow({ onClose }: Props) {
  const [step, setStep] = useState<Step>('setup')
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [unknownGroups, setUnknownGroups] = useState<FileGroup[]>([])
  const [resolvedEntries, setResolvedEntries] = useState<ResolvedEntry[]>([])
  const [result, setResult] = useState<ProcessResult | null>(null)

  function handleSetupDone(ar: AnalyzeResult) {
    setAnalyzeResult(ar)
    setStep('foldermap')
  }

  function handleFolderMapDone(
    id: string,
    scan: ScanResult,
    unknown: FileGroup[],
    entries: ResolvedEntry[],
  ) {
    setSessionId(id)
    setScanResult(scan)
    setUnknownGroups(unknown)
    setResolvedEntries(entries)
    setStep('scan')
  }

  function handleScanConfirmed() {
    setStep('upload')
  }

  function handleUploadDone(res: ProcessResult) {
    setResult(res)
    setStep('summary')
  }

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <header className="flex items-center border-b border-gray-800 px-6 py-4">
        <button
          onClick={onClose}
          className="mr-4 rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          ← Avbryt
        </button>
        <h1 className="text-lg font-semibold text-white">Ny registrering</h1>
        <StepIndicator current={step} />
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        {step === 'setup' && <StepSetup onDone={handleSetupDone} />}
        {step === 'foldermap' && analyzeResult && (
          <StepFolderMap
            result={analyzeResult}
            onDone={handleFolderMapDone}
            onBack={() => setStep('setup')}
          />
        )}
        {step === 'scan' && scanResult && (
          <StepScan
            scanResult={scanResult}
            unknownGroups={unknownGroups}
            onConfirm={handleScanConfirmed}
            onBack={() => setStep('foldermap')}
          />
        )}
        {step === 'upload' && (
          <StepUpload
            sessionId={sessionId}
            unknownGroups={unknownGroups}
            resolvedEntries={resolvedEntries}
            onDone={handleUploadDone}
          />
        )}
        {step === 'summary' && result && (
          <StepSummary result={result} onClose={onClose} />
        )}
      </main>
    </div>
  )
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { ids: Step[]; label: string }[] = [
    { ids: ['setup', 'foldermap'], label: 'Oppsett' },
    { ids: ['scan'], label: 'Skann' },
    { ids: ['upload'], label: 'Last opp' },
    { ids: ['summary'], label: 'Resultat' },
  ]
  const idx = steps.findIndex(s => s.ids.includes(current))
  return (
    <div className="ml-auto flex gap-2">
      {steps.map((s, i) => (
        <span
          key={s.label}
          className={[
            'rounded px-2 py-0.5 text-xs font-medium',
            i === idx ? 'bg-blue-600 text-white' : i < idx ? 'text-green-400' : 'text-gray-600'
          ].join(' ')}
        >
          {i + 1}. {s.label}
        </span>
      ))}
    </div>
  )
}
