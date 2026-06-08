export const TIME_SOURCE = {
  UNKNOWN: 0,
  EXIF_ORIGINAL: 1,
  EXIF_GPS: 2,
  EXIF_DIGITIZED: 3,
  FILESYSTEM: 4,
  MANUAL: 5,
  OFFSET_CORRECTED: 6,
  ESTIMATED: 7,
  GPS_SYNCED: 8,
} as const;

export type TimeSource = (typeof TIME_SOURCE)[keyof typeof TIME_SOURCE];

export const TIME_SOURCE_LABELS: Record<number, string> = {
  [TIME_SOURCE.UNKNOWN]: "Ukjent",
  [TIME_SOURCE.EXIF_ORIGINAL]: "EXIF (kameraklokke)",
  [TIME_SOURCE.EXIF_GPS]: "EXIF GPS-tid",
  [TIME_SOURCE.EXIF_DIGITIZED]: "EXIF digitalisert",
  [TIME_SOURCE.FILESYSTEM]: "Filsystem-tid",
  [TIME_SOURCE.MANUAL]: "Manuelt angitt",
  [TIME_SOURCE.OFFSET_CORRECTED]: "Kamera-offset justert",
  [TIME_SOURCE.ESTIMATED]: "Estimert",
  [TIME_SOURCE.GPS_SYNCED]: "GPS-spor synkronisert",
};

export const ACCURACY_LABELS: Record<string, string> = {
  subsecond: "Sub-sekund",
  second: "Sekund",
  minute: "Minutt",
  hour: "Time",
  day: "Dag",
  month: "Måned",
  year: "År",
  decade: "Tiår",
  unknown: "Ukjent",
};
