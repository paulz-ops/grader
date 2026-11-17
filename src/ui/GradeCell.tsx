import { useRef, useState } from 'react';
import { formatGrade, GRADE_SYSTEMS, parseGrade, type ParsedGrade } from '../grades';
import type { Grade, GradeSystem } from '../types';

export function focusCell(row: number, col: number): void {
  document.querySelector<HTMLInputElement>(`input.grade-input[data-row="${row}"][data-col="${col}"]`)?.focus();
}

const LONG_PRESS_MS = 550;

interface Props {
  grade: Grade | undefined;
  system: GradeSystem;
  row: number;
  col: number;
  label: string;
  onCommit: (parsed: ParsedGrade) => void;
  onComment: () => void;
}

/**
 * Ein Notenfeld. Schnelleingabe: Note tippen, Enter → nächster Schüler.
 * Pfeil hoch/runter wechselt die Zeile, Tab die Spalte, Esc verwirft.
 * Kommentar: Rechtsklick, lange drücken oder Strg+K.
 */
export function GradeCell({ grade, system, row, col, label, onCommit, onComment }: Props) {
  const display = grade ? (grade.excused ? 'e' : grade.value !== null ? formatGrade(grade.value, system) : '') : '';
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseGrade(draft, system).kind === 'invalid';
  const pressTimer = useRef<number | undefined>(undefined);

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

  const cancelPress = () => {
    if (pressTimer.current !== undefined) window.clearTimeout(pressTimer.current);
    pressTimer.current = undefined;
  };

  const openComment = () => {
    cancelPress();
    commit();
    onComment();
  };

  const title = invalid
    ? `Ungültig. Erlaubt: ${GRADE_SYSTEMS[system].hint}`
    : grade?.comment
      ? `Kommentar: ${grade.comment}`
      : undefined;

  return (
    <div
      className="cell-wrap"
      onContextMenu={(e) => {
        e.preventDefault();
        openComment();
      }}
      onTouchStart={() => {
        cancelPress();
        pressTimer.current = window.setTimeout(() => {
          pressTimer.current = undefined;
          openComment();
        }, LONG_PRESS_MS);
      }}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onTouchCancel={cancelPress}
    >
      <input
        className={`grade-input${invalid ? ' invalid' : ''}${grade?.excused && draft === null ? ' excused' : ''}`}
        value={draft ?? display}
        inputMode={GRADE_SYSTEMS[system].inputMode}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label={grade?.comment ? `${label} (Kommentar: ${grade.comment})` : label}
        aria-invalid={invalid}
        title={title}
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
          } else if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            openComment();
          }
        }}
      />
      {grade?.comment && (
        <button
          type="button"
          className="comment-mark"
          tabIndex={-1}
          title={`Kommentar: ${grade.comment}`}
          aria-label="Kommentar anzeigen"
          onClick={openComment}
        />
      )}
    </div>
  );
}
