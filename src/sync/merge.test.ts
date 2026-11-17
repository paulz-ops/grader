import { describe, expect, it } from 'vitest';
import { diffSnapshots, emptySnapshot, mergeSnapshots, snapshotsEqual, stableStringify, TOMBSTONE_TTL_MS, type Snapshot } from './merge';

// "Jetzt" kurz nach den Zeitstempeln in den Testdaten (1–30)
const NOW = 1_000;

function snap(build: (s: Snapshot) => void): Snapshot {
  const s = emptySnapshot();
  build(s);
  return s;
}

describe('stableStringify', () => {
  it('sortiert Schlüssel und lässt undefined weg', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: undefined } })).toBe('{"a":{"d":2},"b":1}');
  });
});

describe('mergeSnapshots', () => {
  it('vereinigt Datensätze beider Geräte', () => {
    const a = snap((s) => (s.tables.students = [{ id: 's1', updatedAt: 1, lastName: 'A' }]));
    const b = snap((s) => (s.tables.students = [{ id: 's2', updatedAt: 1, lastName: 'B' }]));
    expect(mergeSnapshots(a, b, NOW).tables.students.map((r) => r.id)).toEqual(['s1', 's2']);
  });

  it('nimmt pro Datensatz die neuere Änderung', () => {
    const a = snap((s) => (s.tables.grades = [{ id: 'g', updatedAt: 10, value: 2 }]));
    const b = snap((s) => (s.tables.grades = [{ id: 'g', updatedAt: 20, value: 3 }]));
    expect(mergeSnapshots(a, b, NOW).tables.grades[0].value).toBe(3);
    expect(mergeSnapshots(b, a, NOW).tables.grades[0].value).toBe(3);
  });

  it('entscheidet bei gleichem Zeitstempel deterministisch', () => {
    const a = snap((s) => (s.tables.grades = [{ id: 'g', updatedAt: 10, value: 2 }]));
    const b = snap((s) => (s.tables.grades = [{ id: 'g', updatedAt: 10, value: 3 }]));
    expect(snapshotsEqual(mergeSnapshots(a, b, NOW), mergeSnapshots(b, a, NOW))).toBe(true);
  });

  it('überträgt Löschungen', () => {
    const a = snap((s) => (s.tables.students = [{ id: 's1', updatedAt: 10 }]));
    const b = snap((s) => (s.deletions = [{ key: 'students:s1', table: 'students', id: 's1', deletedAt: 20 }]));
    const m = mergeSnapshots(a, b, NOW);
    expect(m.tables.students).toEqual([]);
    expect(m.deletions).toHaveLength(1);
  });

  it('eine spätere Änderung überlebt eine frühere Löschung', () => {
    const a = snap((s) => (s.tables.students = [{ id: 's1', updatedAt: 30 }]));
    const b = snap((s) => (s.deletions = [{ key: 'students:s1', table: 'students', id: 's1', deletedAt: 20 }]));
    expect(mergeSnapshots(a, b, NOW).tables.students).toHaveLength(1);
  });

  it('vergisst sehr alte Löschmarken', () => {
    const old = NOW - TOMBSTONE_TTL_MS - 1;
    const a = snap((s) => (s.deletions = [{ key: 'grades:g', table: 'grades', id: 'g', deletedAt: old }]));
    expect(mergeSnapshots(a, emptySnapshot(), NOW).deletions).toEqual([]);
  });

  it('ist idempotent', () => {
    const a = snap((s) => {
      s.tables.grades = [{ id: 'g1', updatedAt: 5, value: 1 }];
      s.deletions = [{ key: 'grades:g2', table: 'grades', id: 'g2', deletedAt: 7 }];
    });
    const once = mergeSnapshots(a, emptySnapshot(), NOW);
    expect(snapshotsEqual(mergeSnapshots(once, once, NOW), once)).toBe(true);
  });
});

describe('diffSnapshots', () => {
  it('findet neue, geänderte und gelöschte Datensätze', () => {
    const from = snap((s) => (s.tables.grades = [{ id: 'a', updatedAt: 1, value: 1 }, { id: 'b', updatedAt: 1, value: 2 }]));
    const to = snap((s) => (s.tables.grades = [{ id: 'b', updatedAt: 2, value: 3 }, { id: 'c', updatedAt: 1, value: 4 }]));
    const d = diffSnapshots(from, to);
    expect(d.puts.grades.map((r) => r.id)).toEqual(['b', 'c']);
    expect(d.deletes.grades).toEqual(['a']);
    expect(d.count).toBe(3);
  });

  it('meldet keine Änderungen bei gleichen Daten', () => {
    const s = snap((x) => (x.tables.classes = [{ id: 'k', updatedAt: 1, name: '10A' }]));
    expect(diffSnapshots(s, s).count).toBe(0);
  });
});
