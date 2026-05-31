import { useState, useEffect } from 'react'
import { getMachineId } from '../api/client'
import { getMachine } from '../api/machines'

type MachineState = 'checking' | 'ready' | 'setup'

export function useEnsureMachine(): { state: MachineState; onSetupComplete: () => void } {
  const [state, setState] = useState<MachineState>('checking')

  useEffect(() => {
    getMachine(getMachineId())
      .then(() => setState('ready'))
      .catch(err => {
        if (err instanceof Error && err.message.startsWith('404')) {
          setState('setup')
        } else {
          // Nettverksfeil e.l. — ikke blokker appen
          setState('ready')
        }
      })
  }, [])

  return {
    state,
    onSetupComplete: () => setState('ready'),
  }
}
