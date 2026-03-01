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
  master_path: string
  master_type: string
  companions: CompanionFile[]
}

export interface ScanResult {
  groups: FileGroup[]
  total_files: number
}

export interface BrowseDir {
  name: string
  path: string
}

export interface BrowseFile {
  name: string
  path: string
  type: string
}

export interface BrowseResult {
  path: string
  parent: string | null
  dirs: BrowseDir[]
  files: BrowseFile[]
}

// ─── Backend API types ────────────────────────────────────────────────────────

export interface EventNode {
  id: string
  name: string
  description: string | null
  date: string | null
  location: string | null
  cover_hothash: string | null
  created_at: string
  photo_count: number
}

export interface Photographer {
  id: string
  name: string
  email?: string | null
  website?: string | null
  bio?: string | null
}

export interface GlobalSettings {
  installation_id: string
  instance_name: string
  owner_name: string
  owner_website: string | null
  owner_bio: string | null
  default_sort: string
  show_deleted_in_gallery: boolean
  browse_buffer_size: number
  coldpreview_max_px: number
  coldpreview_quality: number
  copy_verify_after_copy: boolean
  copy_include_videos: boolean
}

export interface MachineSettings {
  machine_id: string
  machine_name: string
  default_photographer_id: string | null
}

export interface Settings {
  global_: GlobalSettings
  machine: MachineSettings
}

export interface InputSessionCreate {
  name: string
  source_path: string
  default_photographer_id: string
  default_event_id?: string | null
  recursive?: boolean
  notes?: string | null
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
  notes: string | null
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
  width: number | null
  height: number | null
  dct_perceptual_hash: number | null
  difference_hash: number | null
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
  file_size_bytes: number | null
  file_content_hash: string | null
  exif_data: Record<string, unknown>
  width: number | null
  height: number | null
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

// ─── File copy ────────────────────────────────────────────────────────────────

export interface FileCopyOperation {
  id: string
  source_path: string
  destination_path: string
  device_label: string | null
  notes: string | null
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  files_total: number
  files_copied: number
  files_skipped: number
  bytes_total: number
  bytes_copied: number
  verify_after_copy: boolean
  include_videos: boolean
  started_at: string
  completed_at: string | null
  error: string | null
  input_session_id: string | null
}

export interface FileCopySkip {
  id: string
  operation_id: string
  source_path: string
  reason: 'already_exists' | 'hash_mismatch' | 'read_error' | 'write_error'
  skipped_at: string
}

export interface SuggestNameResult {
  suggested_name: string | null
  files_found: number
  bytes_total: number
}

// ─── Shortcuts ────────────────────────────────────────────────────────────────

export interface Shortcut {
  id: string
  machine_id: string
  name: string
  path: string
  position: number
  created_at: string
}

