import { SYNC_TABLES, type SyncTable, type Tombstone } from '../types';

// Zusammenführen der Daten zweier Geräte ("last writer wins" pro Datensatz).
// - Jeder Datensatz trägt `updatedAt`. Der neuere gewinnt.
// - Löschungen werden als Löschmarken (Tombstones) übertragen. Eine Löschung gewinnt,
//   wenn sie nach der letzten Änderung des Datensatzes passiert ist.
// - Das Ergebnis ist unabhängig von der Reihenfolge (merge(a,b) == merge(b,a)).

export type SyncRecord = { id: string; updatedAt?: number; [key: string]: unknown };

export interface Snapshot {
  tables: Record<SyncTable, SyncRecord[]>;
  deletions: Tombstone[];
}

/** Löschmarken werden nach gut einem Jahr vergessen. */
export const TOMBSTONE_TTL_MS = 400 * 86_400_000;

export function emptySnapshot(): Snapshot {
  const tables = {} as Record<SyncTable, SyncRecord[]>;
  for (const name of SYNC_TABLES) tables[name] = [];
  return { tables, deletions: [] };
}

/** JSON mit sortierten Schlüsseln, damit gleiche Daten immer gleich aussehen. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

const time = (r: SyncRecord) => r.updatedAt ?? 0;

function isNewer(candidate: SyncRecord, current: SyncRecord): boolean {
  if (time(candidate) !== time(current)) return time(candidate) > time(current);
  // Gleicher Zeitstempel, anderer Inhalt: deterministisch entscheiden
  return stableStringify(candidate) > stableStringify(current);
}

const byId = (a: SyncRecord, b: SyncRecord) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function mergeSnapshots(a: Snapshot, b: Snapshot, now: number): Snapshot {
  const tombstones = new Map<string, Tombstone>();
  for (const t of [...a.deletions, ...b.deletions]) {
    if (now - t.deletedAt > TOMBSTONE_TTL_MS) continue;
    const existing = tombstones.get(t.key);
    if (!existing || t.deletedAt > existing.deletedAt) tombstones.set(t.key, t);
  }

  const tables = {} as Record<SyncTable, SyncRecord[]>;
  for (const name of SYNC_TABLES) {
    const winners = new Map<string, SyncRecord>();
    for (const r of [...(a.tables[name] ?? []), ...(b.tables[name] ?? [])]) {
      const current = winners.get(r.id);
      if (!current || isNewer(r, current)) winners.set(r.id, r);
    }
    tables[name] = [...winners.values()]
      .filter((r) => {
        const t = tombstones.get(`${name}:${r.id}`);
        return !t || time(r) > t.deletedAt;
      })
      .sort(byId);
  }

  const deletions = [...tombstones.values()].sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
  return { tables, deletions };
}

export function snapshotsEqual(a: Snapshot, b: Snapshot): boolean {
  return stableStringify(a) === stableStringify(b);
}

export interface SnapshotDiff {
  puts: Record<SyncTable, SyncRecord[]>;
  deletes: Record<SyncTable, string[]>;
  count: number;
}

/** Was muss an `from` geändert werden, damit es `to` entspricht? */
export function diffSnapshots(from: Snapshot, to: Snapshot): SnapshotDiff {
  const puts = {} as Record<SyncTable, SyncRecord[]>;
  const deletes = {} as Record<SyncTable, string[]>;
  let count = 0;
  for (const name of SYNC_TABLES) {
    const before = new Map((from.tables[name] ?? []).map((r) => [r.id, stableStringify(r)]));
    const after = to.tables[name] ?? [];
    puts[name] = after.filter((r) => before.get(r.id) !== stableStringify(r));
    const keep = new Set(after.map((r) => r.id));
    deletes[name] = [...before.keys()].filter((id) => !keep.has(id));
    count += puts[name].length + deletes[name].length;
  }
  return { puts, deletes, count };
}
