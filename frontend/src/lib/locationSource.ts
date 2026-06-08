export const LOCATION_SOURCE = {
  UNKNOWN: 0,
  EXIF_GPS: 1,
  MANUAL: 2,
  ESTIMATED: 3,
  GPX_TRACK: 4,
  BATCH_ASSIGNED: 5,
} as const;

export type LocationSource = (typeof LOCATION_SOURCE)[keyof typeof LOCATION_SOURCE];

export const LOCATION_SOURCE_LABELS: Record<number, string> = {
  [LOCATION_SOURCE.UNKNOWN]: "Ukjent",
  [LOCATION_SOURCE.EXIF_GPS]: "EXIF GPS",
  [LOCATION_SOURCE.MANUAL]: "Manuelt plassert",
  [LOCATION_SOURCE.ESTIMATED]: "Estimert",
  [LOCATION_SOURCE.GPX_TRACK]: "GPS-spor",
  [LOCATION_SOURCE.BATCH_ASSIGNED]: "Batch-tildelt",
};
