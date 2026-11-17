import { describe, expect, it } from 'vitest';
import { applyGradeChange } from './gradeRecord';
import type { Grade } from './types';

const base = { id: 'a:s', assessmentId: 'a', studentId: 's' };
const grade = (extra: Partial<Grade>): Grade => ({ ...base, value: null, updatedAt: 0, ...extra });

describe('applyGradeChange', () => {
  it('legt eine Note an', () => {
    expect(applyGradeChange(undefined, base, { kind: 'grade', parsed: { kind: 'value', value: 2.25 } }, 5)).toEqual(
      grade({ value: 2.25, updatedAt: 5 }),
    );
  });

  it('behält den Kommentar, wenn die Note geändert oder gelöscht wird', () => {
    const existing = grade({ value: 3, comment: 'Referat' });
    expect(applyGradeChange(existing, base, { kind: 'grade', parsed: { kind: 'value', value: 2 } }, 1)).toEqual(
      grade({ value: 2, comment: 'Referat', updatedAt: 1 }),
    );
    expect(applyGradeChange(existing, base, { kind: 'grade', parsed: { kind: 'empty' } }, 1)).toEqual(
      grade({ value: null, comment: 'Referat', updatedAt: 1 }),
    );
  });

  it('behält die Note, wenn der Kommentar geändert wird', () => {
    const existing = grade({ value: 1.75 });
    expect(applyGradeChange(existing, base, { kind: 'comment', text: '  gute Mitarbeit ' }, 1)).toEqual(
      grade({ value: 1.75, comment: 'gute Mitarbeit', updatedAt: 1 }),
    );
  });

  it('erlaubt Kommentar ohne Note', () => {
    expect(applyGradeChange(undefined, base, { kind: 'comment', text: 'HA vergessen' }, 1)).toEqual(
      grade({ comment: 'HA vergessen', updatedAt: 1 }),
    );
  });

  it('löscht den Eintrag, wenn nichts mehr übrig ist', () => {
    expect(applyGradeChange(grade({ comment: 'x' }), base, { kind: 'comment', text: ' ' }, 1)).toBeNull();
    expect(applyGradeChange(grade({ value: 2 }), base, { kind: 'grade', parsed: { kind: 'empty' } }, 1)).toBeNull();
  });

  it('entschuldigt setzt den Wert zurück, ungültig ändert nichts', () => {
    const existing = grade({ value: 4, comment: 'krank' });
    expect(applyGradeChange(existing, base, { kind: 'grade', parsed: { kind: 'excused' } }, 1)).toEqual(
      grade({ excused: true, comment: 'krank', updatedAt: 1 }),
    );
    expect(applyGradeChange(existing, base, { kind: 'grade', parsed: { kind: 'invalid' } }, 1)).toBe(existing);
  });
});
