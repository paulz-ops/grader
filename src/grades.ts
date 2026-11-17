import type { GradeSystem, ReportStep } from './types';

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
    hint: '1 bis 6, mit + oder - (z. B. 2-) oder als Kommanote (z. B. 2,5), e = entschuldigt',
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
  }

  // Kommanoten (auch im Tendenz-System erlaubt, z. B. 2,5 oder 2,3)
  if (system === 'tendency' || system === 'decimal') {
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
  }
  if (system === 'tendency' || system === 'decimal') {
    return value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }
  return String(Math.round(value));
}

/** Durchschnitte immer mit zwei Nachkommastellen */
export function formatAverage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const REPORT_STEPS: { value: ReportStep; label: string }[] = [
  { value: 1, label: 'Ganze Noten (1, 2, 3 …)' },
  { value: 0.5, label: 'Halbe Noten (2, 2-3, 3 …)' },
  { value: 0.25, label: 'Mit Tendenz (2+, 2, 2-, 2-3 …)' },
];

/** Punkte gibt es im Zeugnis nur ganz. */
export function effectiveStep(system: GradeSystem, step: ReportStep | undefined): ReportStep {
  return system === 'points' ? 1 : (step ?? 1);
}

/**
 * Rundet einen Schnitt zur Zeugnisnote in der gewählten Notenstufe.
 * threshold = Anteil innerhalb einer Stufe, ab dem die nächsthöhere Zahl gilt
 * (0,50 = kaufmännisch; 0,51 = genau auf der Mitte bleibt die bessere Note).
 * Beispiel ganze Noten: 2,50 → 3. Halbe Noten: 2,25 → 2-3.
 */
export function roundReport(avg: number, system: GradeSystem, threshold: number, step: ReportStep = 1): number {
  const info = GRADE_SYSTEMS[system];
  const s = effectiveStep(system, step);
  const a = Math.round((avg / s) * 1e6) / 1e6; // Gleitkomma-Rauschen entfernen
  const base = Math.floor(a);
  const frac = a - base;
  const r = Math.round((frac >= threshold - EPS ? base + 1 : base) * s * 100) / 100;
  return Math.min(info.max, Math.max(info.min, r));
}

/** Zeugnisnote anzeigen: 2, 2-3, 2+, 2- (bei Dezimalnoten als Zahl). */
export function formatReport(value: number, system: GradeSystem): string {
  if (system === 'points') return String(Math.round(value));
  const f = Math.floor(value + EPS);
  const frac = value - f;
  if (Math.abs(frac) < EPS) return String(f);
  if (system === 'tendency') {
    if (Math.abs(frac - 0.5) < EPS) return `${f}-${f + 1}`;
    if (Math.abs(frac - 0.25) < EPS) return `${f}-`;
    if (Math.abs(frac - 0.75) < EPS) return `${f + 1}+`;
  }
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

/** Beispieltext für eine Rundungsgrenze, z. B. "2,49 → 2 · 2,50 → 3" */
export function describeRounding(threshold: number, system: GradeSystem, step: ReportStep = 1): string {
  const s = effectiveStep(system, step);
  const base = system === 'points' ? 10 : 2;
  const at = Math.round((base + threshold * s) * 100) / 100;
  const below = at - 0.01;
  return `${formatAverage(below)} → ${formatReport(base, system)} · ${formatAverage(at)} → ${formatReport(base + s, system)}`;
}
