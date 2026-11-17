import { useState } from 'react';
import { formatGrade, GRADE_SYSTEMS, parseGrade, type ParsedGrade } from '../grades';
import type { Grade, GradeSystem } from '../types';

export function focusCell(row: number, col: number): void {
  document.querySelector<HTMLInputElement>(`input.grade-input[data-row="${row}"][data-col="${col}"]`)?.focus();
}

interface Props {
  grade: Grade | undefined;
  system: GradeSystem;
  row: number;
  col: number;
  label: string;
  onCommit: (parsed: ParsedGrade) => void;
}

/**
 * Ein Notenfeld. Schnelleingabe: Note tippen, Enter → nächster Schüler.
 * Pfeil hoch/runter wechselt die Zeile, Tab die Spalte, Esc verwirft.
 */
export function GradeCell({ grade, system, row, col, label, onCommit }: Props) {
  const display = grade ? (grade.excused ? 'e' : grade.value !== null ? formatGrade(grade.value, system) : '') : '';
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseGrade(draft, system).kind === 'invalid';

  const commit = (): boolean => {
    if (draft === null) return true;
    const parsed = parseGrade(draft, system);
    if (parsed.kind === 'invalid') return false;
    if (draft.trim() !== display) onCommit(parsed);
    setDraft(null);
    return true;
  };

  const move = (dRow: number) => {
    if (commit()) focusCell(row + dRow, col);
  };

  return (
    <input
      className={`grade-input${invalid ? ' invalid' : ''}${grade?.excused && draft === null ? ' excused' : ''}`}
      value={draft ?? display}
      inputMode={GRADE_SYSTEMS[system].inputMode}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      aria-label={label}
      aria-invalid={invalid}
      title={invalid ? `Ungültig. Erlaubt: ${GRADE_SYSTEMS[system].hint}` : undefined}
      data-row={row}
      data-col={col}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          move(e.shiftKey ? -1 : 1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          move(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          move(-1);
        } else if (e.key === 'Escape') {
          setDraft(null);
        }
      }}
    />
  );
}
