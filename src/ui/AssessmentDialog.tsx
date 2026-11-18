import { useState } from 'react';
import { db, halfForDate } from '../db';
import { deleteAssessment } from '../actions';
import { formatNumber, parseNumber } from '../format';
import { Field } from './fields';
import { Modal } from './Modal';
import { confirmDialog } from './confirm';
import type { Assessment, Half, SchoolYear, Subject } from '../types';

interface Props {
  assessment: Assessment;
  subject: Subject;
  schoolYear: SchoolYear;
  onClose: () => void;
}

export function AssessmentDialog({ assessment, subject, schoolYear, onClose }: Props) {
  const [title, setTitle] = useState(assessment.title);
  const [categoryId, setCategoryId] = useState(assessment.categoryId);
  const [date, setDate] = useState(assessment.date);
  const [half, setHalf] = useState<Half>(assessment.half);
  const [weight, setWeight] = useState(formatNumber(assessment.weight));
  const w = parseNumber(weight);
  const valid = title.trim() !== '' && date !== '' && w !== null && w > 0;

  const save = async () => {
    if (!valid || w === null) return;
    await db.assessments.update(assessment.id, { title: title.trim(), categoryId, date, half, weight: w });
    onClose();
  };

  const remove = async () => {
    const count = await db.grades.where('assessmentId').equals(assessment.id).count();
    const msg = `„${assessment.title}“ löschen?${count ? ` Dabei werden ${count} eingetragene Noten gelöscht.` : ''}`;
    if (!(await confirmDialog(msg, { confirmLabel: 'Löschen', danger: true }))) return;
    await deleteAssessment(assessment.id);
    onClose();
  };

  return (
    <Modal title="Leistung bearbeiten" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Titel">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Bereich">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {subject.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="row">
          <Field label="Datum">
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (e.target.value) setHalf(halfForDate(e.target.value, schoolYear));
              }}
            />
          </Field>
          <Field label="Halbjahr">
            <select value={half} onChange={(e) => setHalf(Number(e.target.value) as Half)}>
              <option value={1}>1. Halbjahr</option>
              <option value={2}>2. Halbjahr</option>
            </select>
          </Field>
        </div>
        <Field label="Gewicht im Bereich" hint="1 = normal, 2 = zählt doppelt, 0,5 = halb">
          <input className="short" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Field>
        <div className="actions">
          <button type="submit" className="primary" disabled={!valid}>
            Speichern
          </button>
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="danger push-right" onClick={() => void remove()}>
            Löschen
          </button>
        </div>
      </form>
    </Modal>
  );
}
