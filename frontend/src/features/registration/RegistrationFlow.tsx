import { useState } from 'react'
import type { FileGroup, ProcessResult, ScanResult } from '../../types/api'
import StepSetup from './StepSetup'
import StepScan from './StepScan'
import StepUpload from './StepUpload'
import StepSummary from './StepSummary'

type Step = 'setup' | 'scan' | 'upload' | 'summary'

interface Props {
  onClose: () => void
}

export default function RegistrationFlow({ onClose }: Props) {
  const [step, setStep] = useState<Step>('setup')
  const [sessionId, setSessionId] = useState('')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [unknownGroups, setUnknownGroups] = useState<FileGroup[]>([])
  const [result, setResult] = useState<ProcessResult | null>(null)

  function handleSetupDone(id: string, scan: ScanResult, unknown: FileGroup[]) {
    setSessionId(id)
    setScanResult(scan)
    setUnknownGroups(unknown)
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
        {step === 'setup' && (
          <StepSetup onDone={handleSetupDone} />
        )}
        {step === 'scan' && scanResult && (
          <StepScan
            scanResult={scanResult}
            unknownGroups={unknownGroups}
            onConfirm={handleScanConfirmed}
            onBack={() => setStep('setup')}
          />
        )}
        {step === 'upload' && (
          <StepUpload
            sessionId={sessionId}
            unknownGroups={unknownGroups}
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
  const steps: { id: Step; label: string }[] = [
    { id: 'setup', label: 'Oppsett' },
    { id: 'scan', label: 'Skann' },
    { id: 'upload', label: 'Last opp' },
    { id: 'summary', label: 'Resultat' }
  ]
  const idx = steps.findIndex(s => s.id === current)
  return (
    <div className="ml-auto flex gap-2">
      {steps.map((s, i) => (
        <span
          key={s.id}
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
