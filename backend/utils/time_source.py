UNKNOWN = 0
EXIF_ORIGINAL = 1
EXIF_GPS = 2
EXIF_DIGITIZED = 3
FILESYSTEM = 4
MANUAL = 5
OFFSET_CORRECTED = 6
ESTIMATED = 7
GPS_SYNCED = 8

LABELS = {
    UNKNOWN: "Ukjent",
    EXIF_ORIGINAL: "EXIF (kameraklokke)",
    EXIF_GPS: "EXIF GPS-tid",
    EXIF_DIGITIZED: "EXIF digitalisert",
    FILESYSTEM: "Filsystem-tid",
    MANUAL: "Manuelt angitt",
    OFFSET_CORRECTED: "Kamera-offset justert",
    ESTIMATED: "Estimert",
    GPS_SYNCED: "GPS-spor synkronisert",
}

ACCURACY_LABELS = {
    "subsecond": "Sub-sekund",
    "second": "Sekund",
    "minute": "Minutt",
    "hour": "Time",
    "day": "Dag",
    "month": "Måned",
    "year": "År",
    "decade": "Tiår",
    "unknown": "Ukjent",
}
