import type { Snapshot, SyncRecord } from './merge';

// Fotos werden nicht in der Hauptdatei übertragen, sondern einzeln als eigene
// (verschlüsselte) Dateien, benannt nach ihrem Inhalts-Hash. So muss ein Foto
// nur einmal hochgeladen werden, und die Hauptdatei bleibt klein.

export interface RemoteShaped {
  snapshot: Snapshot;
  /** Hash → Foto (Data-URL) aller lokal vorhandenen Fotos */
  photos: Map<string, string>;
}

/** Ersetzt in Schülerdatensätzen `photo` durch `photoRef` (Hash). */
export async function toRemoteShape(snapshot: Snapshot, hash: (s: string) => Promise<string>): Promise<RemoteShaped> {
  const photos = new Map<string, string>();
  const students: SyncRecord[] = [];
  for (const s of snapshot.tables.students) {
    const { photo, ...rest } = s;
    if (typeof photo === 'string' && photo) {
      const ref = await hash(photo);
      photos.set(ref, photo);
      students.push({ ...rest, photoRef: ref });
    } else {
      students.push(rest);
    }
  }
  return { snapshot: { ...snapshot, tables: { ...snapshot.tables, students } }, photos };
}

/** Alle Foto-Hashes, die ein Snapshot (im Remote-Format) braucht. */
export function referencedPhotos(snapshot: Snapshot): Set<string> {
  const refs = new Set<string>();
  for (const s of snapshot.tables.students) if (typeof s.photoRef === 'string') refs.add(s.photoRef);
  return refs;
}

/**
 * Wandelt zurück ins lokale Format (`photoRef` → `photo`).
 * Ist ein Foto (noch) nicht verfügbar, bleibt `photoRef` stehen, damit es nicht verloren geht.
 */
export function toLocalShape(snapshot: Snapshot, photos: Map<string, string>): Snapshot {
  const students = snapshot.tables.students.map((s) => {
    const { photoRef, ...rest } = s;
    if (typeof photoRef !== 'string') return rest;
    const photo = photos.get(photoRef);
    return photo ? { ...rest, photo } : s;
  });
  return { ...snapshot, tables: { ...snapshot.tables, students } };
}
