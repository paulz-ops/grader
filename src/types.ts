// Datenmodell von Grader. Alle IDs sind Zufalls-IDs (UUID), damit später
// mehrere Geräte ohne Konflikte synchronisieren können.

export type GradeSystem = 'tendency' | 'decimal' | 'points';
export type SchoolType = 'BS' | 'TG' | 'other';
export type Half = 1 | 2;
/** Ansicht: 1. Halbjahr, 2. Halbjahr oder ganzes Schuljahr */
export type Period = Half | 'year';
/** Feinheit der Zeugnisnote: ganze, halbe oder Viertel-Noten */
export type ReportStep = 1 | 0.5 | 0.25;

/** Gemeinsame Felder aller synchronisierten Datensätze */
export interface Synced {
  id: string;
  /** Zeitpunkt der letzten Änderung (ms). Wird automatisch gesetzt, Grundlage für den Sync. */
  updatedAt?: number;
}

/** Datumswerte immer als 'YYYY-MM-DD' (lokales Datum). */
export interface SchoolYear extends Synced {
  id: string;
  name: string; // z. B. "2026/27"
  start: string;
  secondHalfStart: string;
  end: string;
}

export interface SchoolClass extends Synced {
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

export interface Student extends Synced {
  id: string;
  classId: string;
  lastName: string;
  firstName: string;
  /** false = ausgetreten; Noten bleiben erhalten, Schüler wird ausgeblendet */
  active: boolean;
  /** Foto als JPEG-Data-URL, quadratisch verkleinert (nur mit Einwilligung) */
  photo?: string;
  /** Intern (Sync): Verweis auf ein Foto, das auf diesem Gerät noch fehlt */
  photoRef?: string;
}

/** Bereich wie mündlich / schriftlich / Projektkompetenz */
export interface Category {
  id: string;
  name: string;
  /** relatives Gewicht, z. B. 40 / 40 / 20 */
  weight: number;
}

/** Ein Fach ergibt eine Zeugnisnote (z. B. "TG Theorie", "TG Labor"). */
export interface Subject extends Synced {
  id: string;
  classId: string;
  name: string;
  sort: number;
  categories: Category[];
}

/** Eine Leistung = eine Spalte in der Notentabelle (Schulaufgabe, mündliche Note …) */
export interface Assessment extends Synced {
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

export interface Grade extends Synced {
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

export const SYNC_TABLES = ['schoolYears', 'classes', 'students', 'subjects', 'assessments', 'grades'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

/** Löschmarke, damit Löschungen auch auf anderen Geräten ankommen */
export interface Tombstone {
  /** = `${table}:${id}` */
  key: string;
  table: SyncTable;
  id: string;
  deletedAt: number;
}

/** Gespeicherter Schlüssel für die Sync-Verschlüsselung (nicht auslesbar) */
export interface SyncKey {
  id: 'sync';
  /** Salz der Schlüsselableitung (Base64), muss zur Datei in OneDrive passen */
  salt: string;
  key: CryptoKey;
}
