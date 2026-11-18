import Dexie, { type Table } from 'dexie';
import {
  SYNC_TABLES,
  type Assessment,
  type Grade,
  type Half,
  type Meta,
  type SchoolClass,
  type SchoolYear,
  type Student,
  type Subject,
  type SyncKey,
  type Tombstone,
} from './types';

/**
 * Lokale Datenbank (IndexedDB im Browser).
 * Wichtig für die Langlebigkeit: Das Schema nie stillschweigend ändern, sondern
 * immer eine neue `this.version(n)` mit Migration ergänzen.
 */
export class GraderDB extends Dexie {
  schoolYears!: Table<SchoolYear, string>;
  classes!: Table<SchoolClass, string>;
  students!: Table<Student, string>;
  subjects!: Table<Subject, string>;
  assessments!: Table<Assessment, string>;
  grades!: Table<Grade, string>;
  meta!: Table<Meta, string>;
  deletions!: Table<Tombstone, string>;
  keys!: Table<SyncKey, string>;
  handles!: Table<{ id: string; handle: FileSystemDirectoryHandle }, string>;

  constructor() {
    super('grader');
    this.version(1).stores({
      schoolYears: 'id',
      classes: 'id, schoolYearId',
      students: 'id, classId',
      subjects: 'id, classId',
      assessments: 'id, subjectId',
      grades: 'id, assessmentId, studentId',
      meta: 'key',
    });
    // Version 2: Grundlage für den Sync (Löschmarken, Schlüssel, Änderungszeiten)
    this.version(2)
      .stores({ deletions: 'key, deletedAt', keys: 'id' })
      .upgrade(async (tx) => {
        const now = Date.now();
        for (const name of SYNC_TABLES) {
          await tx
            .table(name)
            .toCollection()
            .modify((r: { updatedAt?: number }) => {
              if (!r.updatedAt) r.updatedAt = now;
            });
        }
      });
    // Version 3: gemerkter Ordner für das automatische Backup
    this.version(3).stores({ handles: 'id' });
  }
}

export const db = new GraderDB();

// ---------------------------------------------------------------------------
// Änderungsverfolgung für den Sync
// ---------------------------------------------------------------------------

/** Während der Sync fremde Daten einspielt, sollen keine Zeitstempel/Löschmarken entstehen. */
export const syncFlags = { applyingRemote: false };

const changeListeners = new Set<() => void>();

/** Wird nach jeder lokalen Änderung an synchronisierten Daten aufgerufen. */
export function onLocalChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyChange(): void {
  for (const l of changeListeners) l();
}

for (const name of SYNC_TABLES) {
  const table = db.table(name);
  table.hook('creating', function (_key, obj: { updatedAt?: number }) {
    if (syncFlags.applyingRemote) return;
    obj.updatedAt = Date.now();
    this.onsuccess = notifyChange;
  });
  table.hook('updating', function () {
    if (syncFlags.applyingRemote) return undefined;
    this.onsuccess = notifyChange;
    return { updatedAt: Date.now() };
  });
  table.hook('deleting', function (key, _obj, trans) {
    if (syncFlags.applyingRemote) return;
    const id = String(key);
    const deletedAt = Date.now();
    // Löschmarke nach erfolgreichem Abschluss schreiben (andere Tabelle als die Transaktion)
    trans.on('complete', () => {
      void db.deletions.put({ key: `${name}:${id}`, table: name, id, deletedAt }).then(notifyChange);
    });
  });
}

/** Datenschema-Version für Backups */
export const SCHEMA_VERSION = 1;

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback für unsichere Kontexte (http im lokalen Netz)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Heutiges Datum als 'YYYY-MM-DD' in lokaler Zeit */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function defaultSchoolYear(d: Date): SchoolYear {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return {
    id: newId(),
    name: `${y}/${String(y + 1).slice(2)}`,
    start: `${y}-08-01`,
    secondHalfStart: `${y + 1}-02-01`,
    end: `${y + 1}-07-31`,
  };
}

export function halfForDate(date: string, schoolYear: SchoolYear): Half {
  return date >= schoolYear.secondHalfStart ? 2 : 1;
}

/** Legt beim ersten Start das aktuelle Schuljahr an. */
export async function ensureSchoolYear(): Promise<void> {
  if ((await db.schoolYears.count()) > 0) return;
  await db.schoolYears.add(defaultSchoolYear(new Date()));
}
