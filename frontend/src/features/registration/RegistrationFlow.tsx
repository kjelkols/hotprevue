import { useState } from 'react'
import type { FileGroup, ProcessResult } from '../../types/api'
import type { AnalyzeResult, FolderMapping, QuickScanResult } from './registrationTypes'
import StepSetup from './StepSetup'
import StepTreeScan from './StepTreeScan'
import StepFolderMap from './StepFolderMap'
import StepUpload from './StepUpload'
import StepSummary from './StepSummary'

type Step = 'setup' | 'treescan' | 'foldermap' | 'upload' | 'summary'

interface Props {
  onClose: () => void
}

export default function RegistrationFlow({ onClose }: Props) {
  const [step, setStep] = useState<Step>('setup')
  const [quickScan, setQuickScan] = useState<QuickScanResult | null>(null)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [sessionName, setSessionName] = useState('')
  const [folderMappings, setFolderMappings] = useState<FolderMapping[]>([])
  const [result, setResult] = useState<ProcessResult | null>(null)

  function handleSetupDone(qs: QuickScanResult) {
    setQuickScan(qs)
    setStep('treescan')
  }

  function handleTreeScanDone(unknownGroups: FileGroup[]) {
    if (!quickScan || unknownGroups.length === 0) return
    setAnalyzeResult({ ...quickScan, unknownGroups })
    setStep('foldermap')
  }

  function handleFolderMapDone(name: string, mappings: FolderMapping[]) {
    setSessionName(name)
    setFolderMappings(mappings)
    setStep('upload')
  }

  function handleUploadDone(res: ProcessResult) {
    setResult(res)
    setStep('summary')
  }

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <header className="flex items-center border-b border-gray-800 px-6 py-4">
        <button onClick={onClose}
          className="mr-4 rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white">
          ← Avbryt
        </button>
        <h1 className="text-lg font-semibold text-white">Ny registrering</h1>
        <StepIndicator current={step} />
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        {step === 'setup' && <StepSetup onDone={handleSetupDone} />}
        {step === 'treescan' && quickScan && (
          <StepTreeScan
            scan={quickScan.scan}
            dirPath={quickScan.dirPath}
            onDone={handleTreeScanDone}
            onBack={() => setStep('setup')}
          />
        )}
        {step === 'foldermap' && analyzeResult && (
          <StepFolderMap
            result={analyzeResult}
            onDone={handleFolderMapDone}
            onBack={() => setStep('treescan')}
          />
        )}
        {step === 'upload' && analyzeResult && (
          <StepUpload
            unknownGroups={analyzeResult.unknownGroups}
            folderMappings={folderMappings}
            sessionName={sessionName}
            photographerId={analyzeResult.photographerId}
            dirPath={analyzeResult.dirPath}
            recursive={analyzeResult.recursive}
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
    { ids: ['setup'], label: 'Oppsett' },
    { ids: ['treescan'], label: 'Skann' },
    { ids: ['foldermap'], label: 'Kartlegg' },
    { ids: ['upload'], label: 'Last opp' },
    { ids: ['summary'], label: 'Resultat' },
  ]
  const idx = steps.findIndex(s => s.ids.includes(current))
  return (
    <div className="ml-auto flex gap-2">
      {steps.map((s, i) => (
        <span key={s.label}
          className={[
            'rounded px-2 py-0.5 text-xs font-medium',
            i === idx ? 'bg-blue-600 text-white' : i < idx ? 'text-green-400' : 'text-gray-600',
          ].join(' ')}>
          {i + 1}. {s.label}
        </span>
      ))}
    </div>
  )
}
