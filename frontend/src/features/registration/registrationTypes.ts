export interface EventSlot {
  localId: string
  eventName: string
  folderName: string   // sanitisert filsystemnavn, avledet fra eventName
  eventId: string | null  // null = opprett nytt event ved registrering
}

export function deriveFolderName(name: string): string {
  return name
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function makeSlot(overrides: Partial<EventSlot> = {}): EventSlot {
  return {
    localId: randomId(),
    eventName: '',
    folderName: '',
    eventId: null,
    ...overrides,
  }
}
