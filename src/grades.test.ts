import { describe, expect, it } from 'vitest';
import { describeRounding, formatAverage, formatGrade, formatReport, parseGrade, roundReport } from './grades';

const val = (value: number) => ({ kind: 'value', value });

describe('parseGrade – Noten mit Tendenz', () => {
  it('rechnet + und - als Viertelnote', () => {
    expect(parseGrade('2', 'tendency')).toEqual(val(2));
    expect(parseGrade('2+', 'tendency')).toEqual(val(1.75));
    expect(parseGrade('2-', 'tendency')).toEqual(val(2.25));
    expect(parseGrade(' 3 − ', 'tendency')).toEqual(val(3.25));
  });
  it('akzeptiert Zwischen- und Kommanoten', () => {
    expect(parseGrade('2,25', 'tendency')).toEqual(val(2.25));
    expect(parseGrade('2,5', 'tendency')).toEqual(val(2.5));
    expect(parseGrade('2,3', 'tendency')).toEqual(val(2.3));
    expect(parseGrade('6,5', 'tendency').kind).toBe('invalid');
    expect(parseGrade('2,345', 'tendency').kind).toBe('invalid');
  });
  it('lehnt 1+, 6- und Werte außerhalb ab', () => {
    expect(parseGrade('1+', 'tendency').kind).toBe('invalid');
    expect(parseGrade('6-', 'tendency').kind).toBe('invalid');
    expect(parseGrade('7', 'tendency').kind).toBe('invalid');
    expect(parseGrade('abc', 'tendency').kind).toBe('invalid');
  });
  it('erkennt leer und entschuldigt', () => {
    expect(parseGrade('  ', 'tendency')).toEqual({ kind: 'empty' });
    expect(parseGrade('E', 'tendency')).toEqual({ kind: 'excused' });
  });
});

describe('parseGrade – Dezimal und Punkte', () => {
  it('Dezimalnoten 1,0–6,0', () => {
    expect(parseGrade('2,3', 'decimal')).toEqual(val(2.3));
    expect(parseGrade('1.0', 'decimal')).toEqual(val(1));
    expect(parseGrade('6,5', 'decimal').kind).toBe('invalid');
    expect(parseGrade('0,9', 'decimal').kind).toBe('invalid');
  });
  it('Punkte 0–15, nur ganze Zahlen', () => {
    expect(parseGrade('0', 'points')).toEqual(val(0));
    expect(parseGrade('15', 'points')).toEqual(val(15));
    expect(parseGrade('16', 'points').kind).toBe('invalid');
    expect(parseGrade('7,5', 'points').kind).toBe('invalid');
  });
});

describe('formatGrade', () => {
  it('zeigt Tendenzen wieder als + und -', () => {
    expect(formatGrade(1.75, 'tendency')).toBe('2+');
    expect(formatGrade(2.25, 'tendency')).toBe('2-');
    expect(formatGrade(3, 'tendency')).toBe('3');
  });
  it('zeigt Kommanoten im Tendenz-System als Dezimalzahl', () => {
    expect(formatGrade(2.5, 'tendency')).toBe('2,5');
    expect(formatGrade(2.3, 'tendency')).toBe('2,3');
  });
  it('Dezimal und Punkte', () => {
    expect(formatGrade(2.3, 'decimal')).toBe('2,3');
    expect(formatGrade(2, 'decimal')).toBe('2,0');
    expect(formatGrade(11, 'points')).toBe('11');
  });
  it('Durchschnitt mit zwei Nachkommastellen', () => {
    expect(formatAverage(2.266666)).toBe('2,27');
    expect(formatAverage(null)).toBe('');
  });
});

describe('roundReport', () => {
  it('kaufmännisch: ab x,50 die nächste Zahl', () => {
    expect(roundReport(2.49, 'tendency', 0.5)).toBe(2);
    expect(roundReport(2.5, 'tendency', 0.5)).toBe(3);
  });
  it('Grenze 0,51: 2,50 bleibt 2', () => {
    expect(roundReport(2.5, 'tendency', 0.51)).toBe(2);
    expect(roundReport(2.51, 'tendency', 0.51)).toBe(3);
  });
  it('ist robust gegen Gleitkomma-Rauschen', () => {
    expect(roundReport((2.2 + 2.8) / 2, 'tendency', 0.5)).toBe(3); // 2.5
    expect(roundReport(0.1 + 0.2 + 2.2, 'tendency', 0.5)).toBe(3); // 2.5000000000000004
  });
  it('Punkte und Grenzen des Systems', () => {
    expect(roundReport(10.5, 'points', 0.5)).toBe(11);
    expect(roundReport(14.9, 'points', 0.5)).toBe(15);
    expect(roundReport(1, 'tendency', 0.5)).toBe(1);
  });
  it('beschreibt die Rundung mit Beispiel', () => {
    expect(describeRounding(0.5, 'tendency')).toBe('2,49 → 2 · 2,50 → 3');
    expect(describeRounding(0.51, 'points')).toBe('10,50 → 10 · 10,51 → 11');
    expect(describeRounding(0.5, 'tendency', 0.5)).toBe('2,24 → 2 · 2,25 → 2-3');
    expect(describeRounding(0.5, 'tendency', 0.25)).toBe('2,12 → 2 · 2,13 → 2-');
  });
});

describe('Zeugnisnoten in halben Noten und mit Tendenz', () => {
  it('halbe Noten: x,25 und x,75 sind die Grenzen', () => {
    expect(roundReport(2.24, 'tendency', 0.5, 0.5)).toBe(2);
    expect(roundReport(2.25, 'tendency', 0.5, 0.5)).toBe(2.5);
    expect(roundReport(2.74, 'tendency', 0.5, 0.5)).toBe(2.5);
    expect(roundReport(2.75, 'tendency', 0.5, 0.5)).toBe(3);
  });
  it('mit Tendenz: Viertelschritte', () => {
    expect(roundReport(1.8, 'tendency', 0.5, 0.25)).toBe(1.75);
    expect(roundReport(2.4, 'tendency', 0.5, 0.25)).toBe(2.5);
    expect(roundReport(2.62, 'tendency', 0.5, 0.25)).toBe(2.5);
    expect(roundReport(2.63, 'tendency', 0.5, 0.25)).toBe(2.75);
  });
  it('Punkte bleiben im Zeugnis ganzzahlig', () => {
    expect(roundReport(10.3, 'points', 0.5, 0.5)).toBe(10);
  });
  it('formatReport zeigt 2-3, 2+, 2-', () => {
    expect(formatReport(2, 'tendency')).toBe('2');
    expect(formatReport(2.5, 'tendency')).toBe('2-3');
    expect(formatReport(1.75, 'tendency')).toBe('2+');
    expect(formatReport(2.25, 'tendency')).toBe('2-');
    expect(formatReport(5.75, 'tendency')).toBe('6+');
    expect(formatReport(2.5, 'decimal')).toBe('2,5');
    expect(formatReport(11, 'points')).toBe('11');
  });
});
