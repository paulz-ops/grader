import { useState } from 'react';
import { setComment } from '../actions';
import { formatGrade } from '../grades';
import { formatDate } from '../format';
import { Modal } from './Modal';
import type { Assessment, Grade, GradeSystem, Student } from '../types';

interface Props {
  student: Student;
  assessment: Assessment;
  grade: Grade | undefined;
  system: GradeSystem;
  onClose: () => void;
}

export function CommentDialog({ student, assessment, grade, system, onClose }: Props) {
  const [text, setText] = useState(grade?.comment ?? '');
  const note = grade?.excused ? 'entschuldigt' : grade?.value != null ? formatGrade(grade.value, system) : 'keine Note';

  const save = async (value: string) => {
    await setComment(assessment.id, student.id, value);
    onClose();
  };

  return (
    <Modal title={`Kommentar: ${student.firstName} ${student.lastName}`} onClose={onClose}>
      <p className="muted comment-context">
        {assessment.title} · {formatDate(assessment.date)} · Note: <strong>{note}</strong>
      </p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save(text);
        }}
      >
        <textarea
          autoFocus
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="z. B. Referat zu Getrieben, sehr anschaulich"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void save(text);
            }
          }}
        />
        <div className="actions">
          <button type="submit" className="primary">
            Speichern
          </button>
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          {grade?.comment && (
            <button type="button" className="danger push-right" onClick={() => void save('')}>
              Kommentar löschen
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
