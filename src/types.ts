// Datenmodell von Grader. Alle IDs sind Zufalls-IDs (UUID), damit später
// mehrere Geräte ohne Konflikte synchronisieren können.

export type GradeSystem = 'tendency' | 'decimal' | 'points';
export type SchoolType = 'BS' | 'TG' | 'other';
export type Half = 1 | 2;
/** Ansicht: 1. Halbjahr, 2. Halbjahr oder ganzes Schuljahr */
export type Period = Half | 'year';
/** Feinheit der Zeugnisnote: ganze, halbe oder Viertel-Noten */
export type ReportStep = 1 | 0.5 | 0.25;

/** Datumswerte immer als 'YYYY-MM-DD' (lokales Datum). */
export interface SchoolYear {
  id: string;
  name: string; // z. B. "2026/27"
  start: string;
  secondHalfStart: string;
  end: string;
}

export interface SchoolClass {
  id: string;
  schoolYearId: string;
  name: string;
  schoolType: SchoolType;
  gradeSystem: GradeSystem;
  /** Bekommt die Klasse ein Halbjahreszeugnis? */
  halfYearReport: boolean;
  /** Rundungsgrenze (Nachkommaanteil, ab dem die nächste Zahl gilt) fürs Halbjahreszeugnis */
  roundingHalf: number;
  /** Rundungsgrenze fürs Jahreszeugnis */
  roundingFinal: number;
  /** Notenstufe im Halbjahreszeugnis: 1 = ganze, 0.5 = halbe (2-3), 0.25 = mit Tendenz (2+, 2-). Fehlt = 1 */
  reportStepHalf?: ReportStep;
  /** Notenstufe im Jahreszeugnis. Fehlt = 1 */
  reportStepFinal?: ReportStep;
  /** Schülerfotos anzeigen (fehlt bei alten Daten = an) */
  photos?: boolean;
  createdAt: number;
}

export interface Student {
  id: string;
  classId: string;
  lastName: string;
  firstName: string;
  /** false = ausgetreten; Noten bleiben erhalten, Schüler wird ausgeblendet */
  active: boolean;
  /** Foto als JPEG-Data-URL, quadratisch verkleinert (nur mit Einwilligung) */
  photo?: string;
}

/** Bereich wie mündlich / schriftlich / Projektkompetenz */
export interface Category {
  id: string;
  name: string;
  /** relatives Gewicht, z. B. 40 / 40 / 20 */
  weight: number;
}

/** Ein Fach ergibt eine Zeugnisnote (z. B. "TG Theorie", "TG Labor"). */
export interface Subject {
  id: string;
  classId: string;
  name: string;
  sort: number;
  categories: Category[];
}

/** Eine Leistung = eine Spalte in der Notentabelle (Schulaufgabe, mündliche Note …) */
export interface Assessment {
  id: string;
  subjectId: string;
  categoryId: string;
  title: string;
  date: string;
  half: Half;
  /** Gewicht innerhalb des Bereichs, Standard 1 */
  weight: number;
  createdAt: number;
}

export interface Grade {
  /** = `${assessmentId}:${studentId}` */
  id: string;
  assessmentId: string;
  studentId: string;
  /** Intern als Zahl: 2+ = 1,75; 2- = 2,25; Punkte 0–15 */
  value: number | null;
  /** entschuldigt gefehlt – zählt nicht in den Schnitt */
  excused?: boolean;
  /** Freitext-Kommentar, auch ohne Note möglich */
  comment?: string;
  updatedAt: number;
}

export interface Meta {
  key: string;
  value: string;
}
