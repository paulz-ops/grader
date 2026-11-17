import { useSyncExternalStore } from 'react';
import { db, onLocalChange, SCHEMA_VERSION, syncFlags } from '../db';
import { SYNC_TABLES } from '../types';
import { PHOTO_FOLDER, SYNC_FILE } from './config';
import {
  decryptText,
  deriveKey,
  encryptText,
  isEncryptedPayload,
  randomSalt,
  sha256Hex,
  WrongPassphraseError,
  type EncryptedPayload,
} from './crypto';
import { diffSnapshots, emptySnapshot, mergeSnapshots, snapshotsEqual, TOMBSTONE_TTL_MS, type Snapshot, type SyncRecord } from './merge';
import { referencedPhotos, toLocalShape, toRemoteShape } from './photos';
import {
  ConflictError,
  currentAccount,
  downloadFile,
  isConfigured,
  listFolder,
  login,
  logout,
  NotSignedInError,
  uploadFile,
} from './onedrive';

// Ablauf eines Syncs:
// 1. verschlüsselte Datei aus OneDrive laden und entschlüsseln
// 2. mit den lokalen Daten zusammenführen (pro Datensatz gewinnt die neuere Änderung)
// 3. Ergebnis lokal speichern, fehlende Fotos hoch- bzw. herunterladen
// 4. Ergebnis verschlüsselt hochladen (nur wenn sich etwas geändert hat)

export type SyncState =
  | 'unconfigured' // keine App-ID hinterlegt
  | 'off' // Sync nicht eingeschaltet
  | 'signed-out' // eingeschaltet, aber nicht bei Microsoft angemeldet
  | 'locked' // angemeldet, Sync-Passwort fehlt
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'error';

export interface SyncStatus {
  state: SyncState;
  lastSync: number | null;
  message: string | null;
  account: string | null;
}

interface SyncFileContent {
  app: 'grader';
  schemaVersion: number;
  savedAt: string;
  snapshot: Snapshot;
}

// --- Status (für die Oberfläche) ---------------------------------------------

let status: SyncStatus = { state: 'unconfigured', lastSync: null, message: null, account: null };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  for (const l of listeners) l();
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

// --- Start und Einstellungen -------------------------------------------------

async function computeState(): Promise<SyncState> {
  if (!isConfigured()) return 'unconfigured';
  if ((await db.meta.get('syncEnabled'))?.value !== '1') return 'off';
  if (!currentAccount()) return 'signed-out';
  if (!(await db.keys.get('sync'))) return 'locked';
  return 'idle';
}

async function refreshState(message: string | null = null): Promise<void> {
  const lastSync = Number((await db.meta.get('lastSync'))?.value) || null;
  setStatus({ state: await computeState(), lastSync, message, account: currentAccount()?.username ?? null });
}

let timer: number | undefined;

export function syncSoon(delayMs = 0): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), delayMs);
}

/** Einmal beim App-Start aufrufen (nach initAuth). */
export async function startSync(): Promise<void> {
  await refreshState();
  onLocalChange(() => syncSoon(3000));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncSoon(0);
  });
  window.addEventListener('online', () => syncSoon(0));
  window.setInterval(() => {
    if (document.visibilityState === 'visible') syncSoon(0);
  }, 120_000);
  syncSoon(0);
}

/** Sync einschalten; leitet ggf. zur Microsoft-Anmeldung weiter. */
export async function enableSync(): Promise<void> {
  await db.meta.put({ key: 'syncEnabled', value: '1' });
  if (!currentAccount()) {
    await login();
    return;
  }
  await refreshState();
}

export async function signIn(): Promise<void> {
  await login();
}

/** Gibt es in OneDrive schon Daten (dann Passwort eingeben statt neu festlegen)? */
export async function remoteExists(): Promise<boolean> {
  return (await downloadFile(SYNC_FILE)) !== null;
}

/**
 * Sync-Passwort setzen. Gibt es schon Daten in OneDrive, muss es dazu passen
 * (sonst WrongPassphraseError). Sonst wird es neu festgelegt.
 */
export async function unlock(passphrase: string): Promise<void> {
  const remote = await downloadFile(SYNC_FILE);
  if (remote) {
    const payload = parsePayload(remote.text);
    const key = await deriveKey(passphrase, payload.kdf.salt, payload.kdf.iterations);
    await decryptText(key, payload); // wirft bei falschem Passwort
    await db.keys.put({ id: 'sync', salt: payload.kdf.salt, key });
  } else {
    const salt = randomSalt();
    await db.keys.put({ id: 'sync', salt, key: await deriveKey(passphrase, salt) });
  }
  await refreshState();
  await syncNow();
}

/** Sync auf diesem Gerät trennen. Lokale Daten und OneDrive-Daten bleiben erhalten. */
export async function disableSync(): Promise<void> {
  await db.keys.delete('sync');
  await db.meta.delete('syncEnabled');
  await logout();
  await refreshState();
}

// --- Sync --------------------------------------------------------------------

let running: Promise<void> | null = null;
let again = false;

export async function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  if (!['idle', 'error', 'offline'].includes(status.state)) return;
  running = (async () => {
    do {
      again = false;
      await runWithRetry();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function runWithRetry(): Promise<void> {
  setStatus({ state: 'syncing', message: null });
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await syncOnce();
        break;
      } catch (e) {
        if (e instanceof ConflictError && attempt < 3) continue; // anderes Gerät war schneller
        throw e;
      }
    }
    const now = Date.now();
    await db.meta.put({ key: 'lastSync', value: String(now) });
    setStatus({ state: 'idle', lastSync: now, message: null });
  } catch (e) {
    if (e instanceof WrongPassphraseError) {
      await db.keys.delete('sync');
      await refreshState('Das Sync-Passwort passt nicht (mehr). Wurde es auf einem anderen Gerät geändert?');
    } else if (e instanceof NotSignedInError) {
      await refreshState('Bitte erneut bei Microsoft anmelden.');
    } else if (!navigator.onLine || e instanceof TypeError) {
      setStatus({ state: 'offline', message: 'Keine Verbindung – es wird später erneut versucht.' });
    } else {
      setStatus({ state: 'error', message: (e as Error).message });
    }
  }
}

function parsePayload(text: string): EncryptedPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Die Sync-Datei in OneDrive ist beschädigt.');
  }
  if (!isEncryptedPayload(parsed)) throw new Error('Unbekanntes Dateiformat in OneDrive.');
  return parsed;
}

async function readLocal(): Promise<Snapshot> {
  const snap = emptySnapshot();
  for (const name of SYNC_TABLES) snap.tables[name] = (await db.table(name).toArray()) as SyncRecord[];
  snap.deletions = await db.deletions.toArray();
  return snap;
}

async function writeLocal(before: Snapshot, after: Snapshot): Promise<void> {
  const diff = diffSnapshots(before, after);
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  syncFlags.applyingRemote = true;
  try {
    await db.transaction('rw', [...SYNC_TABLES.map((n) => db.table(n)), db.deletions], async () => {
      for (const name of SYNC_TABLES) {
        if (diff.puts[name].length) await db.table(name).bulkPut(diff.puts[name]);
        if (diff.deletes[name].length) await db.table(name).bulkDelete(diff.deletes[name]);
      }
      // Löschmarken ergänzen (nicht ersetzen, damit gleichzeitige lokale Löschungen erhalten bleiben)
      await db.deletions.bulkPut(after.deletions);
      await db.deletions.where('deletedAt').below(cutoff).delete();
    });
  } finally {
    syncFlags.applyingRemote = false;
  }
}

async function syncOnce(): Promise<void> {
  const keyRecord = await db.keys.get('sync');
  if (!keyRecord) throw new WrongPassphraseError();
  const { key, salt } = keyRecord;

  // 1. OneDrive lesen
  const remoteFile = await downloadFile(SYNC_FILE);
  let remote = emptySnapshot();
  if (remoteFile) {
    const payload = parsePayload(remoteFile.text);
    if (payload.kdf.salt !== salt) throw new WrongPassphraseError();
    const content = JSON.parse(await decryptText(key, payload)) as SyncFileContent;
    if (content.schemaVersion > SCHEMA_VERSION) {
      throw new Error('Die Daten in OneDrive stammen aus einer neueren Grader-Version. Bitte die App aktualisieren.');
    }
    remote = content.snapshot;
  }

  // 2. Zusammenführen
  const localRaw = await readLocal();
  const local = await toRemoteShape(localRaw, sha256Hex);
  const merged = mergeSnapshots(local.snapshot, remote, Date.now());

  // 3. Fotos abgleichen
  const needed = referencedPhotos(merged);
  const photos = new Map(local.photos);
  if (needed.size > 0) {
    const onServer = new Set(await listFolder(PHOTO_FOLDER));
    for (const ref of needed) {
      const file = `${ref}.json`;
      if (photos.has(ref) && !onServer.has(file)) {
        const payload = await encryptText(key, salt, photos.get(ref)!);
        try {
          await uploadFile(`${PHOTO_FOLDER}/${file}`, JSON.stringify(payload), null);
        } catch (e) {
          if (!(e instanceof ConflictError)) throw e; // existiert schon: gleicher Inhalt
        }
      } else if (!photos.has(ref) && onServer.has(file)) {
        const f = await downloadFile(`${PHOTO_FOLDER}/${file}`);
        if (f) photos.set(ref, await decryptText(key, parsePayload(f.text)));
      }
    }
  }

  // 4. Lokal speichern
  await writeLocal(localRaw, toLocalShape(merged, photos));

  // 5. Hochladen, wenn sich gegenüber OneDrive etwas geändert hat
  if (!remoteFile || !snapshotsEqual(merged, remote)) {
    const content: SyncFileContent = {
      app: 'grader',
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      snapshot: merged,
    };
    const payload = await encryptText(key, salt, JSON.stringify(content));
    await uploadFile(SYNC_FILE, JSON.stringify(payload), remoteFile?.eTag ?? null);
  }
}
