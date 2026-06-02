export const AGENT_URL = (import.meta.env.VITE_AGENT_URL as string | undefined)?.replace(/\/$/, '')
  ?? 'http://localhost:8002'

export async function agentFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = init?.body
    ? { 'Content-Type': 'application/json' }
    : {}
  const response = await fetch(AGENT_URL + path, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Agent ${response.status}: ${text}`)
  }
  return response.json() as Promise<T>
}

export async function agentHealth(): Promise<boolean> {
  try {
    const res = await fetch(AGENT_URL + '/health')
    return res.ok
  } catch {
    return false
  }
}

export async function getAgentHostname(): Promise<string | null> {
  try {
    const res = await fetch(AGENT_URL + '/health')
    if (!res.ok) return null
    const data = await res.json()
    return data.hostname ?? null
  } catch {
    return null
  }
}
