let baseUrl = ''

export function setBaseUrl(url: string): void {
  baseUrl = url.replace(/\/$/, '')
}

export function getBaseUrl(): string {
  return baseUrl
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(baseUrl + path, init)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${response.status} ${text}`)
  }
  return response.json() as Promise<T>
}
