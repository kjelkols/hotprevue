import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import { getSettings, patchGlobalSettings, patchMachineSettings } from '../api/settings'
import { listPhotographers } from '../api/photographers'
import { listShortcuts, createShortcut, patchShortcut, deleteShortcut, moveShortcutUp, moveShortcutDown } from '../api/shortcuts'
import FileBrowser from '../components/FileBrowser'

// ─── Tab: Denne maskinen ──────────────────────────────────────────────────────

function MachineTab() {
  const queryClient = useQueryClient()
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const { data: photographers = [] } = useQuery({ queryKey: ['photographers'], queryFn: listPhotographers })

  const [machineName, setMachineName] = useState('')
  const [defaultPhotographerId, setDefaultPhotographerId] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!settings) return
    setMachineName(settings.machine.machine_name)
    setDefaultPhotographerId(settings.machine.default_photographer_id ?? '')
  }, [settings])

  const mutation = useMutation({
    mutationFn: patchMachineSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Maskinnavn</label>
        <input
          type="text"
          value={machineName}
          onChange={e => setMachineName(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
          placeholder="f.eks. Stue-PC"
        />
        <p className="mt-1 text-xs text-gray-500">Vises hvis databasen brukes på flere maskiner.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Maskin-ID</label>
        <div className="flex gap-2 items-center">
          <input
            readOnly
            value={settings?.machine.machine_id ?? ''}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-gray-400 text-sm font-mono outline-none select-all"
          />
          <button
            onClick={() => navigator.clipboard.writeText(settings?.machine.machine_id ?? '')}
            className="px-3 py-2 rounded-lg bg-gray-700 text-sm text-white hover:bg-gray-600"
          >
            Kopier
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">Unik identifikator generert ved første oppstart. Brukes til å skille maskiner i synkroniserte databaser.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Standard fotograf</label>
        <select
          value={defaultPhotographerId}
          onChange={e => setDefaultPhotographerId(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
        >
          <option value="">— Ingen standard —</option>
          {photographers.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">Forhåndsvelges i registreringsdialogen på denne maskinen.</p>
      </div>

      <SaveRow
        onSave={() => mutation.mutate({ machine_name: machineName, default_photographer_id: defaultPhotographerId || null })}
        pending={mutation.isPending}
        saved={saved}
      />
    </div>
  )
}

// ─── Tab: Generelt ────────────────────────────────────────────────────────────

function GeneralTab() {
  const queryClient = useQueryClient()
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  const [instanceName, setInstanceName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerWebsite, setOwnerWebsite] = useState('')
  const [ownerBio, setOwnerBio] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!settings) return
    setInstanceName(settings.global_.instance_name)
    setOwnerName(settings.global_.owner_name)
    setOwnerWebsite(settings.global_.owner_website ?? '')
    setOwnerBio(settings.global_.owner_bio ?? '')
  }, [settings])

  const mutation = useMutation({
    mutationFn: patchGlobalSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Instansnavn</label>
        <input
          type="text"
          value={instanceName}
          onChange={e => setInstanceName(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
          placeholder="f.eks. Familiearkivet"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Eier-navn</label>
        <input
          type="text"
          value={ownerName}
          onChange={e => setOwnerName(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
          placeholder="Ditt navn"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Nettsted</label>
        <input
          type="text"
          value={ownerWebsite}
          onChange={e => setOwnerWebsite(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
          placeholder="https://eksempel.no"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Bio</label>
        <textarea
          value={ownerBio}
          onChange={e => setOwnerBio(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500 resize-none"
          placeholder="Kort beskrivelse…"
        />
      </div>

      <SaveRow
        onSave={() => mutation.mutate({
          instance_name: instanceName,
          owner_name: ownerName,
          owner_website: ownerWebsite || null,
          owner_bio: ownerBio || null,
        })}
        pending={mutation.isPending}
        saved={saved}
      />
    </div>
  )
}

// ─── Tab: Filkopiering ────────────────────────────────────────────────────────

function CopyTab() {
  const queryClient = useQueryClient()
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  const [verifyAfterCopy, setVerifyAfterCopy] = useState(true)
  const [includeVideos, setIncludeVideos] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!settings) return
    setVerifyAfterCopy(settings.global_.copy_verify_after_copy)
    setIncludeVideos(settings.global_.copy_include_videos)
  }, [settings])

  const mutation = useMutation({
    mutationFn: patchGlobalSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="space-y-5">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={verifyAfterCopy}
          onChange={e => setVerifyAfterCopy(e.target.checked)}
          className="mt-0.5 rounded"
        />
        <div>
          <p className="text-sm font-medium text-gray-300">Verifiser etter kopiering</p>
          <p className="mt-0.5 text-xs text-gray-500">SHA256-sjekk av hver fil etter den er kopiert. Anbefales.</p>
        </div>
      </label>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={includeVideos}
          onChange={e => setIncludeVideos(e.target.checked)}
          className="mt-0.5 rounded"
        />
        <div>
          <p className="text-sm font-medium text-gray-300">Inkluder videofiler</p>
          <p className="mt-0.5 text-xs text-gray-500">MP4, MOV, MXF og andre videoformater kopieres i tillegg til bilder.</p>
        </div>
      </label>

      <SaveRow
        onSave={() => mutation.mutate({ copy_verify_after_copy: verifyAfterCopy, copy_include_videos: includeVideos })}
        pending={mutation.isPending}
        saved={saved}
      />
    </div>
  )
}

// ─── Tab: Snarveier ───────────────────────────────────────────────────────────

function ShortcutsTab() {
  const queryClient = useQueryClient()
  const { data: shortcuts = [], isLoading } = useQuery({
    queryKey: ['shortcuts'],
    queryFn: listShortcuts,
  })

  const [newName, setNewName] = useState('')
  const [newPath, setNewPath] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['shortcuts'] })

  const createMut = useMutation({
    mutationFn: createShortcut,
    onSuccess: () => { setNewName(''); setNewPath(''); invalidate() },
  })
  const patchMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string } }) => patchShortcut(id, data),
    onSuccess: () => { setEditingId(null); invalidate() },
  })
  const deleteMut = useMutation({ mutationFn: deleteShortcut, onSuccess: invalidate })
  const upMut = useMutation({ mutationFn: moveShortcutUp, onSuccess: invalidate })
  const downMut = useMutation({ mutationFn: moveShortcutDown, onSuccess: invalidate })

  function startEdit(id: string, name: string) {
    setEditingId(id)
    setEditName(name)
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-400">
        Snarveier vises i filutforskeren og brukes som startpunkt når ingen sti er valgt.
        Stier er spesifikke for denne maskinen.
      </p>

      {/* Liste */}
      {isLoading && <p className="text-sm text-gray-600">Laster…</p>}
      <div className="space-y-1">
        {shortcuts.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">
            <div className="flex flex-col gap-0.5 mr-1">
              <button
                onClick={() => upMut.mutate(s.id)}
                disabled={i === 0}
                className="text-gray-500 hover:text-white disabled:opacity-20 text-xs leading-none"
                title="Flytt opp"
              >▲</button>
              <button
                onClick={() => downMut.mutate(s.id)}
                disabled={i === shortcuts.length - 1}
                className="text-gray-500 hover:text-white disabled:opacity-20 text-xs leading-none"
                title="Flytt ned"
              >▼</button>
            </div>

            <div className="flex-1 min-w-0">
              {editingId === s.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') patchMut.mutate({ id: s.id, data: { name: editName } })
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-0.5 text-sm text-white outline-none focus:border-blue-500"
                />
              ) : (
                <button
                  onClick={() => startEdit(s.id, s.name)}
                  className="text-sm text-white hover:text-blue-400 text-left"
                  title="Klikk for å endre navn"
                >{s.name}</button>
              )}
              <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{s.path}</p>
            </div>

            <button
              onClick={() => deleteMut.mutate(s.id)}
              className="shrink-0 text-gray-600 hover:text-red-400 text-sm px-1"
              title="Slett"
            >✕</button>
          </div>
        ))}
        {!isLoading && shortcuts.length === 0 && (
          <p className="text-sm text-gray-600 py-2">Ingen snarveier ennå.</p>
        )}
      </div>

      {/* Legg til */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 space-y-3">
        <p className="text-sm font-medium text-gray-300">Legg til snarvei</p>
        <div>
          <label className="mb-1 block text-xs text-gray-400">Navn</label>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="f.eks. Bilder"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400">Sti</label>
          <div className="flex gap-2">
            <input
              value={newPath}
              onChange={e => setNewPath(e.target.value)}
              placeholder="/home/bruker/Bilder"
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white font-mono outline-none focus:border-blue-500"
            />
            <FileBrowser
              initialPath={newPath}
              onSelect={setNewPath}
              imagesOnly={false}
              trigger={
                <button
                  type="button"
                  className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600"
                >Bla…</button>
              }
            />
          </div>
        </div>
        <button
          onClick={() => createMut.mutate({ name: newName.trim(), path: newPath.trim() })}
          disabled={!newName.trim() || !newPath.trim() || createMut.isPending}
          className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {createMut.isPending ? 'Lagrer…' : 'Legg til'}
        </button>
      </div>
    </div>
  )
}

// ─── Placeholder-tabs ─────────────────────────────────────────────────────────

function PlaceholderTab({ items }: { items: string[] }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <p className="text-sm font-medium text-gray-400 mb-3">Planlagte innstillinger:</p>
      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item} className="flex items-center gap-2 text-sm text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-700 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-gray-600">Ikke implementert ennå.</p>
    </div>
  )
}

// ─── Felles lagre-rad ─────────────────────────────────────────────────────────

function SaveRow({ onSave, pending, saved }: { onSave: () => void; pending: boolean; saved: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        onClick={onSave}
        disabled={pending}
        className="rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {pending ? 'Lagrer…' : 'Lagre'}
      </button>
      {saved && <span className="text-sm text-green-400">Lagret!</span>}
    </div>
  )
}

// ─── Hoved-komponent ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'machine',   label: 'Denne maskinen' },
  { id: 'shortcuts', label: 'Snarveier'      },
  { id: 'general',   label: 'Generelt'       },
  { id: 'copy',      label: 'Filkopiering'   },
  { id: 'images',    label: 'Bilder'         },
  { id: 'appearance',label: 'Utseende'       },
  { id: 'advanced',  label: 'Avansert'       },
] as const

export default function SettingsPage() {
  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Innstillinger</h1>
      </div>

      <Tabs.Root defaultValue="machine" className="flex min-h-[calc(100vh-2.75rem-1px)]">
        {/* Vertikal tab-liste til venstre */}
        <Tabs.List className="flex flex-col shrink-0 w-44 border-r border-gray-800 pt-3 gap-0.5 px-2">
          {TABS.map(({ id, label }) => (
            <Tabs.Trigger
              key={id}
              value={id}
              className="text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors data-[state=active]:bg-gray-800 data-[state=active]:text-white"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Innhold til høyre */}
        <div className="flex-1 overflow-y-auto">
          <Tabs.Content value="machine" className="p-6 max-w-xl">
            <MachineTab />
          </Tabs.Content>

          <Tabs.Content value="shortcuts" className="p-6 max-w-xl">
            <ShortcutsTab />
          </Tabs.Content>

          <Tabs.Content value="general" className="p-6 max-w-xl">
            <GeneralTab />
          </Tabs.Content>

          <Tabs.Content value="copy" className="p-6 max-w-xl">
            <CopyTab />
          </Tabs.Content>

          <Tabs.Content value="images" className="p-6 max-w-xl">
            <PlaceholderTab items={[
              'Miniatyrbildestørrelse (hotpreview)',
              'Forhåndsvisningsstørrelse (coldpreview)',
              'Kvalitet på forhåndsvisning (JPEG)',
              'Standard sortering i utvalget',
              'Vis slettede bilder i utvalget',
              'Hurtigbufferstørrelse (antall bilder lastet inn i forhånd)',
            ]} />
          </Tabs.Content>

          <Tabs.Content value="appearance" className="p-6 max-w-xl">
            <PlaceholderTab items={[
              'Språk / Language',
              'Fargetema (mørkt / lyst)',
              'Kompakt eller romslig layout',
              'Antall kolonner i gallerivisning',
              'Tastatursnarvei-oversikt',
            ]} />
          </Tabs.Content>

          <Tabs.Content value="advanced" className="p-6 max-w-xl">
            <PlaceholderTab items={[
              'Datakatalog (plassering av database og forhåndsvisninger)',
              'Databaseinformasjon og statistikk',
              'Regenerer alle forhåndsvisninger',
              'Eksporter / importer innstillinger',
              'Loggfiler og feilsøking',
              'Om Hotprevue (versjon, lisens)',
            ]} />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  )
}
