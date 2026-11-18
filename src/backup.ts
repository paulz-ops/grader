import { db, SCHEMA_VERSION, today } from './db';

const TABLES = ['schoolYears', 'classes', 'students', 'subjects', 'assessments', 'grades'] as const;
type TableName = (typeof TABLES)[number];

export interface BackupFile {
  app: 'grader';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

/** Alle Daten als Backup-Objekt (offenes JSON-Format, jederzeit lesbar). */
export async function buildBackup(): Promise<BackupFile> {
  const tables = {} as Record<TableName, unknown[]>;
  for (const name of TABLES) tables[name] = await db.table(name).toArray();
  return { app: 'grader', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), tables };
}

export function serializeBackup(data: BackupFile): string {
  return JSON.stringify(data, null, 1);
}

/** Lädt alle Daten als JSON-Datei herunter. */
export async function exportBackup(): Promise<void> {
  const data = await buildBackup();
  const blob = new Blob([serializeBackup(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `grader-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  await db.meta.put({ key: 'lastBackup', value: data.exportedAt });
}

export function validateBackup(data: unknown): BackupFile {
  const d = data as Partial<BackupFile> | null;
  if (!d || d.app !== 'grader' || typeof d.schemaVersion !== 'number' || !d.tables) {
    throw new Error('Das ist keine Grader-Backup-Datei.');
  }
  if (d.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Das Backup stammt aus einer neueren Grader-Version. Bitte zuerst die App aktualisieren.');
  }
  for (const name of TABLES) {
    if (!Array.isArray(d.tables[name])) throw new Error(`Backup unvollständig (${name} fehlt).`);
  }
  return d as BackupFile;
}

/** Ersetzt alle aktuellen Daten durch das Backup. */
export async function importBackup(file: File): Promise<BackupFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('Die Datei konnte nicht gelesen werden (kein gültiges JSON).');
  }
  const data = validateBackup(parsed);
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const name of TABLES) {
      await db.table(name).clear();
      await db.table(name).bulkPut(data.tables[name]);
    }
  });
  return data;
}
