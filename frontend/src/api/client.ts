let baseUrl = ''

export function setBaseUrl(url: string): void {
  baseUrl = url.replace(/\/$/, '')
}

export function getBaseUrl(): string {
  return baseUrl
}

function getMachineId(): string {
  const key = 'hotprevue_machine_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
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
