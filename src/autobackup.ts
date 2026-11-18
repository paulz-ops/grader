import { useSyncExternalStore } from 'react';
import { db, onLocalChange, today } from './db';
import { buildBackup, serializeBackup } from './backup';

// Automatisches Backup in einen frei gewählten Ordner (z. B. den OneDrive-Ordner
// auf dem Surface). Das OneDrive-Programm lädt die Dateien dann selbst hoch –
// ganz ohne Microsoft-Anmeldung in Grader.
// Technik: File System Access API (Edge/Chrome am PC). Pro Tag eine Datei
// grader-auto-JJJJ-MM-TT.json, die letzten KEEP_DAYS Tage werden aufbewahrt.

const KEEP_DAYS = 30;
const DEBOUNCE_MS = 20_000;
const FILE_RE = /^grader-auto-(\d{4}-\d{2}-\d{2})\.json$/;

type Mode = { mode: 'readwrite' };
interface DirHandle extends FileSystemDirectoryHandle {
  queryPermission(d: Mode): Promise<PermissionState>;
  requestPermission(d: Mode): Promise<PermissionState>;
  keys(): AsyncIterableIterator<string>;
}
type DirectoryPicker = (options?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: string }) => Promise<DirHandle>;

export type AutoBackupState = 'unsupported' | 'off' | 'needs-permission' | 'idle' | 'saving' | 'error';

export interface AutoBackupStatus {
  state: AutoBackupState;
  folder: string | null;
  last: number | null;
  message: string | null;
}

let status: AutoBackupStatus = { state: 'off', folder: null, last: null, message: null };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<AutoBackupStatus>): void {
  status = { ...status, ...patch };
  for (const l of listeners) l();
}

export function useAutoBackupStatus(): AutoBackupStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

async function getHandle(): Promise<DirHandle | null> {
  return ((await db.handles.get('backupDir'))?.handle as DirHandle | undefined) ?? null;
}

async function refresh(message: string | null = null): Promise<void> {
  const last = Number((await db.meta.get('autoBackupLast'))?.value) || null;
  if (!isSupported()) return setStatus({ state: 'unsupported', folder: null, last, message });
  const handle = await getHandle();
  if (!handle) return setStatus({ state: 'off', folder: null, last, message });
  const permission = await handle.queryPermission({ mode: 'readwrite' });
  setStatus({ state: permission === 'granted' ? 'idle' : 'needs-permission', folder: handle.name, last, message });
}

let dirty = false;
let timer: number | undefined;

function schedule(delay: number): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void runNow(), delay);
}

/** Einmal beim Start aufrufen. */
export async function startAutoBackup(): Promise<void> {
  await refresh();
  onLocalChange(() => {
    dirty = true;
    schedule(DEBOUNCE_MS);
  });
  // Beim Verlassen/Minimieren noch schnell sichern, falls es Änderungen gibt
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty) void runNow();
  });
  schedule(5000); // Tagesstand anlegen, falls heute noch keiner existiert
}

/** Ordner auswählen (muss durch einen Klick ausgelöst werden). */
export async function chooseFolder(): Promise<void> {
  const picker = (window as unknown as { showDirectoryPicker: DirectoryPicker }).showDirectoryPicker;
  let handle: DirHandle;
  try {
    handle = await picker({ id: 'grader-backup', mode: 'readwrite', startIn: 'documents' });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return; // abgebrochen
    throw e;
  }
  await db.handles.put({ id: 'backupDir', handle });
  await refresh();
  await runNow(true);
}

/** Zugriff nach einem Neustart wieder erlauben (muss durch einen Klick ausgelöst werden). */
export async function resumeAccess(): Promise<void> {
  const handle = await getHandle();
  if (!handle) return refresh();
  await handle.requestPermission({ mode: 'readwrite' });
  await refresh();
  await runNow(true);
}

export async function disableAutoBackup(): Promise<void> {
  await db.handles.delete('backupDir');
  await refresh();
}

let running = false;

/** Sichert jetzt (wenn es Änderungen gibt, heute noch nicht gesichert wurde oder force). */
export async function runNow(force = false): Promise<void> {
  if (running || !['idle', 'error'].includes(status.state)) return;
  const lastDay = status.last ? localDay(status.last) : null;
  if (!force && !dirty && lastDay === today()) return;

  running = true;
  setStatus({ state: 'saving', message: null });
  try {
    const handle = await getHandle();
    if (!handle) return void (await refresh());
    dirty = false;
    const data = await buildBackup();
    const file = await handle.getFileHandle(`grader-auto-${today()}.json`, { create: true });
    const writable = await file.createWritable();
    await writable.write(serializeBackup(data));
    await writable.close();
    await prune(handle);
    const now = Date.now();
    await db.meta.bulkPut([
      { key: 'autoBackupLast', value: String(now) },
      { key: 'lastBackup', value: data.exportedAt },
    ]);
    setStatus({ state: 'idle', last: now, message: null });
  } catch (e) {
    dirty = true;
    const err = e as Error;
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      await refresh('Der Browser braucht wieder deine Erlaubnis für den Backup-Ordner.');
    } else if (err.name === 'NotFoundError') {
      setStatus({ state: 'error', message: 'Der Backup-Ordner wurde nicht gefunden (verschoben oder gelöscht?). Bitte neu wählen.' });
    } else {
      setStatus({ state: 'error', message: `Backup fehlgeschlagen: ${err.message}` });
    }
  } finally {
    running = false;
  }
}

/** Behält die neuesten KEEP_DAYS Tagesdateien, löscht ältere automatische Backups. */
async function prune(handle: DirHandle): Promise<void> {
  const names: string[] = [];
  for await (const name of handle.keys()) if (FILE_RE.test(name)) names.push(name);
  names.sort().reverse(); // Datum im Namen → neueste zuerst
  for (const name of names.slice(KEEP_DAYS)) await handle.removeEntry(name);
}

function localDay(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
