import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../db';
import { addStudents, addSubject, deleteClass, deleteStudent, deleteSubject } from '../actions';
import { effectiveStep, GRADE_SYSTEMS, REPORT_STEPS } from '../grades';
import { SCHOOL_TYPES } from '../templates';
import { parseStudentLines, sortStudents } from '../students';
import { parseNumber, formatNumber } from '../format';
import { Field, RoundingField, TextField } from './fields';
import { PhotoButton } from './photo';
import { confirmDialog } from './confirm';
import type { Assessment, GradeSystem, ReportStep, SchoolClass, SchoolType, Student, Subject } from '../types';

export function ClassSettings({ cls }: { cls: SchoolClass }) {
  const data = useLiveQuery(async () => {
    const [students, subjects] = await Promise.all([
      db.students.where('classId').equals(cls.id).toArray(),
      db.subjects.where('classId').equals(cls.id).sortBy('sort'),
    ]);
    const assessments = subjects.length
      ? await db.assessments.where('subjectId').anyOf(subjects.map((s) => s.id)).toArray()
      : [];
    const gradeCount = assessments.length
      ? await db.grades.where('assessmentId').anyOf(assessments.map((a) => a.id)).count()
      : 0;
    return { students: sortStudents(students), subjects, assessments, gradeCount };
  }, [cls.id]);

  if (!data) return null;
  const update = (changes: Partial<SchoolClass>) => db.classes.update(cls.id, changes);

  return (
    <div className="settings">
      <StudentsSection cls={cls} students={data.students} />

      <section className="panel">
        <h2>Fächer und Gewichtung</h2>
        <p className="muted">Jedes Fach ergibt eine Zeugnisnote. Die Gewichte der Bereiche werden in Prozent umgerechnet.</p>
        {data.subjects.map((s) => (
          <SubjectEditor key={s.id} subject={s} assessments={data.assessments.filter((a) => a.subjectId === s.id)} />
        ))}
        <AddSubject cls={cls} />
      </section>

      <section className="panel form">
        <h2>Klasse</h2>
        <Field label="Klassenname">
          <TextField value={cls.name} onSave={(v) => v.trim() && update({ name: v.trim() })} />
        </Field>
        <Field label="Schulart" hint="Bestimmt die Bereiche für neu angelegte Fächer.">
          <select value={cls.schoolType} onChange={(e) => update({ schoolType: e.target.value as SchoolType })}>
            {Object.entries(SCHOOL_TYPES).map(([key, t]) => (
              <option key={key} value={key}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Notensystem"
          hint={data.gradeCount > 0 ? 'Kann nicht mehr geändert werden, weil schon Noten eingetragen sind.' : undefined}
        >
          <select
            value={cls.gradeSystem}
            disabled={data.gradeCount > 0}
            onChange={(e) => update({ gradeSystem: e.target.value as GradeSystem })}
          >
            {Object.entries(GRADE_SYSTEMS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={cls.halfYearReport}
            onChange={(e) => update({ halfYearReport: e.target.checked })}
          />
          Klasse bekommt ein Halbjahreszeugnis
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={cls.photos !== false}
            onChange={(e) => update({ photos: e.target.checked })}
          />
          Schülerfotos anzeigen
        </label>
        {cls.halfYearReport && (
          <div className="report-settings">
            <h3>Halbjahreszeugnis</h3>
            <StepField
              system={cls.gradeSystem}
              value={cls.reportStepHalf}
              onSave={(v) => update({ reportStepHalf: v })}
            />
            <RoundingField
              label="Rundung"
              value={cls.roundingHalf}
              system={cls.gradeSystem}
              step={effectiveStep(cls.gradeSystem, cls.reportStepHalf)}
              onSave={(v) => update({ roundingHalf: v })}
            />
          </div>
        )}
        <div className="report-settings">
          <h3>Jahreszeugnis</h3>
          <StepField
            system={cls.gradeSystem}
            value={cls.reportStepFinal}
            onSave={(v) => update({ reportStepFinal: v })}
          />
          <RoundingField
            label="Rundung"
            value={cls.roundingFinal}
            system={cls.gradeSystem}
            step={effectiveStep(cls.gradeSystem, cls.reportStepFinal)}
            onSave={(v) => update({ roundingFinal: v })}
          />
        </div>
      </section>

      <section className="panel">
        <h2>Klasse löschen</h2>
        <p className="muted">Löscht die Klasse mit allen Schülern, Fächern und Noten. Mach vorher ein Backup.</p>
        <button
          className="danger"
          onClick={async () => {
            const ok = await confirmDialog(`Klasse „${cls.name}“ mit allen Schülern, Fächern und Noten endgültig löschen?`, {
              confirmLabel: 'Klasse löschen',
              danger: true,
            });
            if (!ok) return;
            await deleteClass(cls.id);
            window.location.hash = '#/';
          }}
        >
          Klasse löschen
        </button>
      </section>
    </div>
  );
}

function StepField({
  system,
  value,
  onSave,
}: {
  system: GradeSystem;
  value: ReportStep | undefined;
  onSave: (v: ReportStep) => void;
}) {
  if (system === 'points') return null; // Punkte im Zeugnis immer ganz
  return (
    <Field label="Notenstufen">
      <select value={String(value ?? 1)} onChange={(e) => onSave(Number(e.target.value) as ReportStep)}>
        {REPORT_STEPS.map((s) => (
          <option key={s.value} value={String(s.value)}>
            {s.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function StudentsSection({ cls, students }: { cls: SchoolClass; students: Student[] }) {
  const [text, setText] = useState('');
  const parsed = parseStudentLines(text);
  const showPhotos = cls.photos !== false;

  return (
    <section className="panel">
      <h2>Schüler ({students.filter((s) => s.active).length})</h2>
      {showPhotos && students.length > 0 && (
        <p className="muted">
          Foto antippen, um eins aufzunehmen oder auszuwählen. Fotos nur mit Einwilligung. Sie liegen nur auf dem
          Gerät und im Backup.
        </p>
      )}
      {students.length > 0 && (
        <table className="list-table">
          <thead>
            <tr>
              {showPhotos && <th>Foto</th>}
              <th>Nachname</th>
              <th>Vorname</th>
              <th>Aktiv</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className={s.active ? undefined : 'inactive'}>
                {showPhotos && (
                  <td className="photo-cell">
                    <PhotoButton student={s} size={40} />
                  </td>
                )}
                <td>
                  <TextField
                    ariaLabel="Nachname"
                    value={s.lastName}
                    onSave={(v) => v.trim() && db.students.update(s.id, { lastName: v.trim() })}
                  />
                </td>
                <td>
                  <TextField
                    ariaLabel="Vorname"
                    value={s.firstName}
                    onSave={(v) => db.students.update(s.id, { firstName: v.trim() })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={s.active}
                    title={s.active ? 'Als ausgetreten markieren' : 'Wieder aktivieren'}
                    aria-label={`${s.firstName} ${s.lastName} aktiv`}
                    onChange={(e) => db.students.update(s.id, { active: e.target.checked })}
                  />
                </td>
                <td>
                  <button
                    className="icon-btn"
                    title="Schüler löschen"
                    aria-label={`${s.firstName} ${s.lastName} löschen`}
                    onClick={async () => {
                      const n = await db.grades.where('studentId').equals(s.id).count();
                      const msg = `${s.firstName} ${s.lastName} löschen?${n ? ` Dabei werden ${n} Noten gelöscht. Tipp: Bei Austritt lieber „Aktiv“ abwählen, dann bleiben die Noten erhalten.` : ''}`;
                      if (await confirmDialog(msg, { confirmLabel: 'Löschen', danger: true })) await deleteStudent(s.id);
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="form add-students">
        <Field
          label="Schüler hinzufügen"
          hint="Eine Person pro Zeile: „Nachname, Vorname“ oder „Vorname Nachname“. Du kannst eine Liste aus Excel oder WebUntis einfügen."
        >
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Müller, Anna\nYilmaz, Can'} />
        </Field>
        <button
          className="primary"
          disabled={parsed.length === 0}
          onClick={async () => {
            await addStudents(cls.id, parsed);
            setText('');
          }}
        >
          {parsed.length > 1 ? `${parsed.length} Schüler hinzufügen` : 'Hinzufügen'}
        </button>
      </div>
    </section>
  );
}

function SubjectEditor({ subject, assessments }: { subject: Subject; assessments: Assessment[] }) {
  const total = subject.categories.reduce((s, c) => s + Math.max(0, c.weight), 0);
  const saveCategories = (categories: Subject['categories']) => db.subjects.update(subject.id, { categories });

  return (
    <div className="subject-editor">
      <div className="subject-head">
        <TextField
          className="subject-name"
          ariaLabel="Fachname"
          value={subject.name}
          onSave={(v) => v.trim() && db.subjects.update(subject.id, { name: v.trim() })}
        />
        <button
          className="danger small"
          onClick={async () => {
            const msg = `Fach „${subject.name}“ löschen?${assessments.length ? ` Dabei werden ${assessments.length} Leistungen mit allen Noten gelöscht.` : ''}`;
            if (await confirmDialog(msg, { confirmLabel: 'Fach löschen', danger: true })) await deleteSubject(subject.id);
          }}
        >
          Fach löschen
        </button>
      </div>
      <table className="list-table">
        <thead>
          <tr>
            <th>Bereich</th>
            <th>Gewicht</th>
            <th>Anteil</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {subject.categories.map((c) => {
            const used = assessments.some((a) => a.categoryId === c.id);
            return (
              <tr key={c.id}>
                <td>
                  <TextField
                    ariaLabel="Bereichsname"
                    value={c.name}
                    onSave={(v) =>
                      v.trim() &&
                      saveCategories(subject.categories.map((x) => (x.id === c.id ? { ...x, name: v.trim() } : x)))
                    }
                  />
                </td>
                <td>
                  <TextField
                    className="short"
                    ariaLabel={`Gewicht ${c.name}`}
                    inputMode="decimal"
                    value={formatNumber(c.weight)}
                    onSave={(v) => {
                      const n = parseNumber(v);
                      if (n !== null) {
                        saveCategories(subject.categories.map((x) => (x.id === c.id ? { ...x, weight: n } : x)));
                      }
                    }}
                  />
                </td>
                <td className="muted">{total > 0 ? `${Math.round((Math.max(0, c.weight) / total) * 100)} %` : '–'}</td>
                <td>
                  <button
                    className="icon-btn"
                    disabled={used}
                    title={used ? 'Bereich enthält schon Leistungen' : 'Bereich entfernen'}
                    aria-label={`Bereich ${c.name} entfernen`}
                    onClick={() => saveCategories(subject.categories.filter((x) => x.id !== c.id))}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        className="link-btn"
        onClick={() => saveCategories([...subject.categories, { id: newId(), name: 'Neuer Bereich', weight: 0 }])}
      >
        + Bereich
      </button>
    </div>
  );
}

function AddSubject({ cls }: { cls: SchoolClass }) {
  const [name, setName] = useState('');
  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        await addSubject(cls, name);
        setName('');
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Neues Fach, z. B. TG Labor" aria-label="Neues Fach" />
      <button type="submit" disabled={!name.trim()}>
        + Fach
      </button>
    </form>
  );
}
