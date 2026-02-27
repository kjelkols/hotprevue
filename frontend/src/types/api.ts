// ─── Config ───────────────────────────────────────────────────────────────────

export interface AppConfig {
  backendUrl: string
}

// ─── Scanning ─────────────────────────────────────────────────────────────────

export interface CompanionFile {
  path: string
  type: string
}

export interface FileGroup {
  masterPath: string
  masterType: string
  companions: CompanionFile[]
}

export interface ScanResult {
  groups: FileGroup[]
  totalFiles: number
}

// ─── Backend API types ────────────────────────────────────────────────────────

export interface EventNode {
  id: string
  name: string
  parent_id: string | null
  photo_count: number
  children: EventNode[]
}

export interface Photographer {
  id: string
  name: string
  email?: string | null
  website?: string | null
  bio?: string | null
}

export interface InputSessionCreate {
  name: string
  source_path: string
  default_photographer_id: string
  default_event_id?: string | null
  recursive?: boolean
}

export interface InputSession {
  id: string
  name: string
  source_path: string
  recursive: boolean
  default_photographer_id: string
  default_event_id: string | null
  status: string
  started_at: string
  completed_at: string | null
  photo_count: number
  duplicate_count: number
  error_count: number
}

export interface CheckResponse {
  known: string[]
  unknown: string[]
}

export interface GroupResult {
  status: 'registered' | 'duplicate' | 'already_registered'
  hothash: string
  photo_id: string
}

export interface ProcessResult {
  registered: number
  duplicates: number
  errors: number
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export interface PhotoListItem {
  hothash: string
  hotpreview_b64: string
  taken_at: string | null
  taken_at_accuracy: string
  rating: number | null
  tags: string[]
  category_id: string | null
  event_id: string | null
  photographer_id: string
  location_lat: number | null
  location_lng: number | null
  location_accuracy: string | null
  stack_id: string | null
  is_stack_cover: boolean
  deleted_at: string | null
  has_correction: boolean
  camera_make: string | null
  camera_model: string | null
  iso: number | null
  shutter_speed: string | null
  aperture: number | null
  focal_length: number | null
}

// ─── Photo detail ─────────────────────────────────────────────────────────────

export interface ImageFileInfo {
  id: string
  photo_id: string
  file_path: string
  file_type: string
  is_master: boolean
}

export interface PhotoCorrection {
  photo_id: string
  rotation: number | null
  horizon_angle: number | null
  exposure_ev: number | null
  crop_left: number | null
  crop_top: number | null
  crop_right: number | null
  crop_bottom: number | null
  updated_at: string
}

export interface PhotoDetail extends PhotoListItem {
  exif_data: Record<string, unknown>
  taken_at_source: number
  location_source: number | null
  input_session_id: string | null
  registered_at: string
  image_files: ImageFileInfo[]
  correction: PhotoCorrection | null
}

// ─── TextItems ────────────────────────────────────────────────────────────────

export interface TextItem {
  id: string
  markup: string
  created_at: string
}

// ─── Collections ──────────────────────────────────────────────────────────────

export interface Collection {
  id: string
  name: string
  description: string | null
  cover_hothash: string | null
  created_at: string
  item_count: number
}

export interface CollectionItem {
  id: string
  collection_id: string
  hothash: string | null         // null for text items
  text_item_id: string | null    // null for photo items
  hotpreview_b64: string | null  // null for text items; joined from Photo in backend response
  markup: string | null          // null for photo items; inlined from TextItem in backend response
  position: number
  caption: string | null
  notes: string | null           // presenter/speaker notes; shown in visningsmodus only
}

// ─── Electron API (window.electron) ──────────────────────────────────────────

declare global {
  interface Window {
    electron: {
      selectDirectory(): Promise<string | null>
      scanDirectory(dirPath: string, recursive: boolean): Promise<ScanResult>
      readFileBytes(filePath: string): Promise<Uint8Array>
      getConfig(): Promise<AppConfig | null>
      setConfig(config: AppConfig): Promise<void>
    }
  }
}
