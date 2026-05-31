let baseUrl = ''

export function setBaseUrl(url: string): void {
  baseUrl = url.replace(/\/$/, '')
}

export function getBaseUrl(): string {
  return baseUrl
}

function generateUUID(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  // Fallback for HTTP (non-secure) contexts
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function getMachineId(): string {
  const key = 'hotprevue_machine_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = generateUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export { getMachineId }

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'X-Machine-ID': getMachineId(),
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers ?? {}),
  }
  const response = await fetch(baseUrl + path, { ...init, headers })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${response.status} ${text}`)
  }
  if (response.status === 204) return undefined as unknown as T
  return response.json() as Promise<T>
}
