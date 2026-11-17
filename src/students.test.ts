import { describe, expect, it } from 'vitest';
import { parseStudentLines, sortStudents } from './students';

describe('parseStudentLines', () => {
  it('erkennt "Nachname, Vorname", Semikolon und Tabulator', () => {
    expect(parseStudentLines('Müller, Anna\nYılmaz; Can\nMeier\tTom')).toEqual([
      { lastName: 'Müller', firstName: 'Anna' },
      { lastName: 'Yılmaz', firstName: 'Can' },
      { lastName: 'Meier', firstName: 'Tom' },
    ]);
  });
  it('erkennt "Vorname Nachname" und überspringt leere Zeilen', () => {
    expect(parseStudentLines('\n  Anna Maria Schmidt \n\nBen\n')).toEqual([
      { lastName: 'Schmidt', firstName: 'Anna Maria' },
      { lastName: 'Ben', firstName: '' },
    ]);
  });
});

describe('sortStudents', () => {
  it('sortiert nach Nachname, dann Vorname, mit Umlauten', () => {
    const sorted = sortStudents([
      { lastName: 'Zimmer', firstName: 'A' },
      { lastName: 'Öztürk', firstName: 'B' },
      { lastName: 'Arnold', firstName: 'Z' },
      { lastName: 'Arnold', firstName: 'B' },
    ]);
    expect(sorted.map((s) => `${s.lastName} ${s.firstName}`)).toEqual([
      'Arnold B',
      'Arnold Z',
      'Öztürk B',
      'Zimmer A',
    ]);
  });
});
