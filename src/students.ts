import type { Student } from './types';

export interface StudentName {
  lastName: string;
  firstName: string;
}

/**
 * Liest eine eingefügte Schülerliste (eine Person pro Zeile).
 * - "Nachname, Vorname" / "Nachname; Vorname" / "Nachname<TAB>Vorname" (z. B. aus Excel)
 * - "Vorname Nachname" (das letzte Wort ist der Nachname)
 */
export function parseStudentLines(text: string): StudentName[] {
  const result: StudentName[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sep = /[,;\t]/.exec(line);
    if (sep) {
      const [last, ...rest] = line.split(/[,;\t]/);
      result.push({ lastName: last.trim(), firstName: rest.join(' ').trim().replace(/\s+/g, ' ') });
    } else {
      const parts = line.split(/\s+/);
      const lastName = parts.pop() ?? '';
      result.push({ lastName, firstName: parts.join(' ') });
    }
  }
  return result.filter((s) => s.lastName);
}

const collator = new Intl.Collator('de', { sensitivity: 'base' });

export function sortStudents<T extends Pick<Student, 'lastName' | 'firstName'>>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName),
  );
}
