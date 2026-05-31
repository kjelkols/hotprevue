import { useEffect } from 'react'
import { getMachineId } from '../api/client'
import { getMachine, registerMachine } from '../api/machines'

export function useEnsureMachine() {
  useEffect(() => {
    const machineId = getMachineId()
    getMachine(machineId).catch(err => {
      if (err instanceof Error && err.message.startsWith('404')) {
        registerMachine({ machine_name: navigator.userAgent.split('/')[0] ?? 'Klient' })
      }
    })
  }, [])
}
