import type { GradeSystem } from './types';

export interface GradeSystemInfo {
  label: string;
  short: string;
  min: number;
  max: number;
  /** Bei Punkten ist mehr besser, bei Noten weniger */
  higherIsBetter: boolean;
  hint: string;
  inputMode: 'text' | 'decimal' | 'numeric';
}

export const GRADE_SYSTEMS: Record<GradeSystem, GradeSystemInfo> = {
  tendency: {
    label: 'Noten 1–6 mit Tendenz (2+, 2, 2-)',
    short: 'Noten 1–6 ±',
    min: 1,
    max: 6,
    higherIsBetter: false,
    hint: '1 bis 6, mit + oder - (z. B. 2-), e = entschuldigt',
    inputMode: 'text',
  },
  decimal: {
    label: 'Noten 1–6 mit Dezimalen (2,3)',
    short: 'Noten 1,0–6,0',
    min: 1,
    max: 6,
    higherIsBetter: false,
    hint: '1,0 bis 6,0 (z. B. 2,3), e = entschuldigt',
    inputMode: 'decimal',
  },
  points: {
    label: 'Punkte 0–15',
    short: 'Punkte 0–15',
    min: 0,
    max: 15,
    higherIsBetter: true,
    hint: 'ganze Punkte 0 bis 15, e = entschuldigt',
    inputMode: 'text',
  },
};

const EPS = 1e-9;

export type ParsedGrade =
  | { kind: 'empty' }
  | { kind: 'excused' }
  | { kind: 'value'; value: number }
  | { kind: 'invalid' };

const INVALID: ParsedGrade = { kind: 'invalid' };

function toNumber(s: string): number | null {
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

function isMultiple(n: number, step: number): boolean {
  const q = n / step;
  return Math.abs(q - Math.round(q)) < 1e-6;
}

/** Wandelt eine Eingabe wie "2-", "2,3" oder "11" in einen Zahlenwert um. */
export function parseGrade(input: string, system: GradeSystem): ParsedGrade {
  const s = input.trim().toLowerCase().replace(/[−–]/g, '-').replace(',', '.');
  if (s === '') return { kind: 'empty' };
  if (s === 'e') return { kind: 'excused' };

  if (system === 'tendency') {
    const m = /^([1-6])\s*([+-]?)$/.exec(s);
    if (m) {
      const base = Number(m[1]);
      const value = m[2] === '+' ? base - 0.25 : m[2] === '-' ? base + 0.25 : base;
      // 1+ und 6- gibt es nicht
      if (value < 1 || value > 6) return INVALID;
      return { kind: 'value', value };
    }
    // Auch Viertelwerte direkt erlauben (2,25 = 2-)
    const n = toNumber(s);
    if (n !== null && n >= 1 && n <= 6 && isMultiple(n, 0.25)) return { kind: 'value', value: n };
    return INVALID;
  }

  if (system === 'decimal') {
    const n = toNumber(s);
    if (n !== null && n >= 1 && n <= 6 && isMultiple(n, 0.01)) {
      return { kind: 'value', value: Math.round(n * 100) / 100 };
    }
    return INVALID;
  }

  // Punkte
  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    if (n <= 15) return { kind: 'value', value: n };
  }
  return INVALID;
}

/** Zeigt einen gespeicherten Notenwert im Notensystem der Klasse an. */
export function formatGrade(value: number, system: GradeSystem): string {
  if (system === 'tendency') {
    const base = Math.round(value);
    const d = value - base;
    if (Math.abs(d) < EPS) return String(base);
    if (Math.abs(d + 0.25) < EPS) return `${base}+`;
    if (Math.abs(d - 0.25) < EPS) return `${base}-`;
    return formatAverage(value);
  }
  if (system === 'decimal') {
    return value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }
  return String(Math.round(value));
}

/** Durchschnitte immer mit zwei Nachkommastellen */
export function formatAverage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Rundet einen Schnitt zur Zeugnisnote.
 * threshold = Nachkommaanteil, ab dem die nächsthöhere Zahl gilt
 * (0,50 = kaufmännisch; 0,51 = 2,50 wird noch zur 2).
 */
export function roundReport(avg: number, system: GradeSystem, threshold: number): number {
  const info = GRADE_SYSTEMS[system];
  const a = Math.round(avg * 1e6) / 1e6; // Gleitkomma-Rauschen entfernen
  const base = Math.floor(a);
  const frac = a - base;
  const r = frac >= threshold - EPS ? base + 1 : base;
  return Math.min(info.max, Math.max(info.min, r));
}

/** Beispieltext für eine Rundungsgrenze, z. B. "2,49 → 2 · 2,50 → 3" */
export function describeRounding(threshold: number, system: GradeSystem): string {
  const base = system === 'points' ? 10 : 2;
  const below = base + threshold - 0.01;
  const at = base + threshold;
  return `${formatAverage(below)} → ${base} · ${formatAverage(at)} → ${base + 1}`;
}
