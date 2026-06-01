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

export function makeSlot(overrides: Partial<EventSlot> = {}): EventSlot {
  return {
    localId: crypto.randomUUID(),
    eventName: '',
    folderName: '',
    eventId: null,
    ...overrides,
  }
}
