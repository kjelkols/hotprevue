let baseUrl = ''

export function setBaseUrl(url: string): void {
  baseUrl = url.replace(/\/$/, '')
}

export function getBaseUrl(): string {
  return baseUrl
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = init?.body
    ? { 'Content-Type': 'application/json' }
    : {}
  const response = await fetch(baseUrl + path, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${response.status} ${text}`)
  }
  if (response.status === 204) return undefined as unknown as T
  return response.json() as Promise<T>
}
