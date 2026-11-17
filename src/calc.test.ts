import { describe, expect, it } from 'vitest';
import { computeTable, gradeKey, inPeriod, mean, weightedMean } from './calc';
import type { Assessment, Grade, Subject } from './types';

const subject: Subject = {
  id: 's',
  classId: 'k',
  name: 'TG Theorie',
  sort: 0,
  categories: [
    { id: 'M', name: 'Mündlich', weight: 40 },
    { id: 'S', name: 'Schriftlich', weight: 40 },
    { id: 'P', name: 'Projektkompetenz', weight: 20 },
  ],
};

const a = (id: string, categoryId: string, weight = 1, half: 1 | 2 = 1): Assessment => ({
  id,
  subjectId: 's',
  categoryId,
  title: id,
  date: '2026-10-01',
  half,
  weight,
  createdAt: 0,
});

const g = (assessmentId: string, studentId: string, value: number | null, excused = false): Grade => ({
  id: gradeKey(assessmentId, studentId),
  assessmentId,
  studentId,
  value,
  excused,
  updatedAt: 0,
});

describe('Hilfsfunktionen', () => {
  it('weightedMean ignoriert Gewicht 0 und leere Listen', () => {
    expect(weightedMean([{ value: 2, weight: 1 }, { value: 4, weight: 3 }])).toBe(3.5);
    expect(weightedMean([{ value: 2, weight: 0 }])).toBeNull();
    expect(weightedMean([])).toBeNull();
  });
  it('mean überspringt null', () => {
    expect(mean([2, null, 4, undefined])).toBe(3);
    expect(mean([null])).toBeNull();
  });
  it('inPeriod filtert nach Halbjahr', () => {
    expect(inPeriod(a('x', 'M', 1, 2), 1)).toBe(false);
    expect(inPeriod(a('x', 'M', 1, 2), 2)).toBe(true);
    expect(inPeriod(a('x', 'M', 1, 2), 'year')).toBe(true);
  });
});

describe('computeTable', () => {
  const assessments = [a('m1', 'M'), a('m2', 'M'), a('s1', 'S', 2), a('s2', 'S'), a('p1', 'P')];
  const grades = [
    // Schüler A: alle Bereiche
    g('m1', 'A', 2),
    g('m2', 'A', 3),
    g('s1', 'A', 2),
    g('s2', 'A', 4),
    g('p1', 'A', 1),
    // Schüler B: m1 entschuldigt, kein Projekt
    g('m1', 'B', null, true),
    g('m2', 'B', 4),
    g('s1', 'B', 3),
    g('s2', 'B', 3),
    // Schüler C ist inaktiv und wird nicht übergeben
    g('m1', 'C', 6),
  ];
  const r = computeTable(subject, assessments, grades, ['A', 'B']);

  it('gewichtet Leistungen innerhalb des Bereichs', () => {
    expect(r.students.A.categoryAvg.M).toBe(2.5);
    expect(r.students.A.categoryAvg.S).toBeCloseTo(8 / 3);
    expect(r.students.A.categoryAvg.P).toBe(1);
  });

  it('gewichtet die Bereiche zur Gesamtnote', () => {
    expect(r.students.A.overall).toBeCloseTo(0.4 * 2.5 + 0.4 * (8 / 3) + 0.2 * 1);
    expect(r.students.A.provisional).toBe(false);
  });

  it('rechnet fehlende Bereiche hoch und markiert vorläufig', () => {
    expect(r.students.B.categoryAvg.M).toBe(4); // entschuldigt zählt nicht
    expect(r.students.B.categoryAvg.P).toBeNull();
    expect(r.students.B.overall).toBeCloseTo(3.5);
    expect(r.students.B.provisional).toBe(true);
  });

  it('berechnet Klassenschnitte nur über übergebene Schüler', () => {
    expect(r.assessmentAvg.m1).toBe(2); // C (6) und B (entschuldigt) zählen nicht
    expect(r.assessmentAvg.m2).toBe(3.5);
    expect(r.categoryAvg.P).toBe(1);
    expect(r.overallAvg).toBeCloseTo((0.4 * 2.5 + 0.4 * (8 / 3) + 0.2 + 3.5) / 2);
  });

  it('liefert null, solange keine Noten da sind', () => {
    const empty = computeTable(subject, assessments, [], ['A']);
    expect(empty.students.A.overall).toBeNull();
    expect(empty.students.A.provisional).toBe(false);
    expect(empty.overallAvg).toBeNull();
  });
});
