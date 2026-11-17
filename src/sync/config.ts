/**
 * Anwendungs-ID (Client-ID) aus der Microsoft-App-Registrierung.
 * Sie ist öffentlich und kein Geheimnis – sie sagt Microsoft nur, welche App sich anmeldet.
 * Leer = Sync noch nicht eingerichtet.
 */
export const MS_CLIENT_ID = '';

/** Persönliche Microsoft-Konten (outlook.de, hotmail.com, …) */
export const MS_AUTHORITY = 'https://login.microsoftonline.com/consumers';

/** Nur Zugriff auf den eigenen App-Ordner in OneDrive (Apps/Grader), nicht auf andere Dateien. */
export const MS_SCOPES = ['Files.ReadWrite.AppFolder'];

export const SYNC_FILE = 'grader-data.json';
export const PHOTO_FOLDER = 'photos';
