/**
 * Convert a Windows path to its WSL mount equivalent.
 * "C:\foo\bar" or "C:/foo/bar" → "/mnt/c/foo/bar"
 * Paths that don't match are returned unchanged.
 */
export function winToWsl(raw: string): string {
  const match = raw.match(/^([A-Za-z]):[\\\/](.*)/)
  if (!match) return raw
  const drive = match[1].toLowerCase()
  const rest = match[2].replace(/\\/g, '/')
  return `/mnt/${drive}/${rest}`
}
