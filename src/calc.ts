import type { Assessment, Grade, Period, Subject } from './types';

export interface WeightedValue {
  value: number;
  weight: number;
}

export function weightedMean(items: WeightedValue[]): number | null {
  let sum = 0;
  let weights = 0;
  for (const { value, weight } of items) {
    if (weight > 0) {
      sum += value * weight;
      weights += weight;
    }
  }
  return weights > 0 ? sum / weights : null;
}

export function mean(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number');
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function inPeriod(a: Assessment, period: Period): boolean {
  return period === 'year' || a.half === period;
}

export const gradeKey = (assessmentId: string, studentId: string) => `${assessmentId}:${studentId}`;

export interface StudentResult {
  /** Schnitt je Bereich (null = noch keine Note) */
  categoryAvg: Record<string, number | null>;
  overall: number | null;
  /** true, wenn ein gewichteter Bereich noch keine Note hat */
  provisional: boolean;
}

export interface TableResult {
  students: Record<string, StudentResult>;
  assessmentAvg: Record<string, number | null>;
  categoryAvg: Record<string, number | null>;
  overallAvg: number | null;
}

/**
 * Berechnet alle Schnitte eines Fachs.
 * - Bereichsschnitt = gewichteter Mittelwert der Noten im Bereich
 * - Gesamt = gewichteter Mittelwert der Bereichsschnitte; Bereiche ohne Note
 *   werden weggelassen und die übrigen hochgerechnet (dann "vorläufig")
 * - Entschuldigte oder leere Noten zählen nicht
 * `assessments` müssen bereits auf den Zeitraum gefiltert sein.
 */
export function computeTable(
  subject: Subject,
  assessments: Assessment[],
  grades: Grade[],
  studentIds: string[],
): TableResult {
  const gradeMap = new Map(grades.map((g) => [gradeKey(g.assessmentId, g.studentId), g]));
  const valueOf = (a: Assessment, sid: string): number | null => {
    const g = gradeMap.get(gradeKey(a.id, sid));
    return g && !g.excused && g.value !== null ? g.value : null;
  };

  const byCategory = new Map<string, Assessment[]>(subject.categories.map((c) => [c.id, []]));
  for (const a of assessments) byCategory.get(a.categoryId)?.push(a);

  const students: Record<string, StudentResult> = {};
  for (const sid of studentIds) {
    const categoryAvg: Record<string, number | null> = {};
    for (const c of subject.categories) {
      const items: WeightedValue[] = [];
      for (const a of byCategory.get(c.id) ?? []) {
        const v = valueOf(a, sid);
        if (v !== null) items.push({ value: v, weight: a.weight });
      }
      categoryAvg[c.id] = weightedMean(items);
    }
    const overall = weightedMean(
      subject.categories
        .filter((c) => categoryAvg[c.id] !== null)
        .map((c) => ({ value: categoryAvg[c.id] as number, weight: c.weight })),
    );
    const provisional =
      overall !== null && subject.categories.some((c) => c.weight > 0 && categoryAvg[c.id] === null);
    students[sid] = { categoryAvg, overall, provisional };
  }

  const assessmentAvg: Record<string, number | null> = {};
  for (const a of assessments) assessmentAvg[a.id] = mean(studentIds.map((sid) => valueOf(a, sid)));

  const categoryAvg: Record<string, number | null> = {};
  for (const c of subject.categories) {
    categoryAvg[c.id] = mean(studentIds.map((sid) => students[sid].categoryAvg[c.id]));
  }

  const overallAvg = mean(studentIds.map((sid) => students[sid].overall));
  return { students, assessmentAvg, categoryAvg, overallAvg };
}
