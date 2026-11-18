/**
 * Anwendungs-ID (Client-ID) aus der Microsoft-App-Registrierung.
 * Sie ist öffentlich und kein Geheimnis – sie sagt Microsoft nur, welche App sich anmeldet.
 * Leer = Sync ausgeschaltet und in der App ausgeblendet.
 *
 * Derzeit pausiert (App wird nur auf einem Gerät genutzt; das Schul-Microsoft-365
 * erlaubt keine Zustimmung ohne Admin). Zum Wiedereinschalten diese ID eintragen:
 *   0f50f671-93c6-418a-9fbd-4b5996e4a7a7  (Registrierung "Grader", Kontotyp: alle Konten)
 * Mit Schulkonten klappt es nur, wenn die Schul-IT Grader freigibt; mit privaten
 * Microsoft-Konten sofort (dann ggf. MS_AUTHORITY auf .../consumers stellen).
 */
export const MS_CLIENT_ID: string = '';

/**
 * Schul-/Arbeitskonten (Microsoft 365) und persönliche Microsoft-Konten.
 * Die App-Registrierung muss dazu "Konten in einem beliebigen Organisationsverzeichnis
 * und persönliche Microsoft-Konten" erlauben.
 */
export const MS_AUTHORITY = 'https://login.microsoftonline.com/common';

/** Nur Zugriff auf den eigenen App-Ordner in OneDrive (Apps/Grader), nicht auf andere Dateien. */
export const MS_SCOPES = ['Files.ReadWrite.AppFolder'];

export const SYNC_FILE = 'grader-data.json';
export const PHOTO_FOLDER = 'photos';
