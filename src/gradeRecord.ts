import type { ParsedGrade } from './grades';
import type { Grade } from './types';

export type GradeChange = { kind: 'grade'; parsed: ParsedGrade } | { kind: 'comment'; text: string };

/**
 * Wendet eine Änderung (Note oder Kommentar) auf einen gespeicherten Eintrag an.
 * Note und Kommentar bleiben dabei unabhängig voneinander erhalten.
 * Gibt null zurück, wenn der Eintrag leer ist und gelöscht werden kann.
 */
export function applyGradeChange(
  existing: Grade | undefined,
  base: Pick<Grade, 'id' | 'assessmentId' | 'studentId'>,
  change: GradeChange,
  now: number,
): Grade | null {
  let value = existing?.value ?? null;
  let excused = existing?.excused ?? false;
  let comment = existing?.comment;

  if (change.kind === 'comment') {
    comment = change.text.trim() || undefined;
  } else {
    const p = change.parsed;
    if (p.kind === 'empty') {
      value = null;
      excused = false;
    } else if (p.kind === 'excused') {
      value = null;
      excused = true;
    } else if (p.kind === 'value') {
      value = p.value;
      excused = false;
    } else {
      return existing ?? null; // ungültig: nichts ändern
    }
  }

  if (value === null && !excused && !comment) return null;
  const grade: Grade = { ...base, value, updatedAt: now };
  if (excused) grade.excused = true;
  if (comment) grade.comment = comment;
  return grade;
}
