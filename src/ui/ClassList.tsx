import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { createClass } from '../actions';
import { GRADE_SYSTEMS } from '../grades';
import { SCHOOL_TYPES } from '../templates';
import { daysSince } from '../format';
import { Field } from './fields';
import { AutoBackupNotice } from './AutoBackupPanel';
import type { GradeSystem, SchoolType, SchoolYear } from '../types';

export function ClassList({ schoolYear }: { schoolYear: SchoolYear }) {
  const [creating, setCreating] = useState(false);
  const data = useLiveQuery(async () => {
    const classes = await db.classes.where('schoolYearId').equals(schoolYear.id).toArray();
    classes.sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
    const details = await Promise.all(
      classes.map(async (c) => ({
        cls: c,
        studentCount: await db.students.where('classId').equals(c.id).filter((s) => s.active).count(),
        subjects: (await db.subjects.where('classId').equals(c.id).sortBy('sort')).map((s) => s.name),
      })),
    );
    const lastBackup = (await db.meta.get('lastBackup'))?.value ?? null;
    return { details, lastBackup };
  }, [schoolYear.id]);

  if (!data) return null;
  const { details, lastBackup } = data;
  const backupAge = lastBackup ? daysSince(lastBackup) : null;
  const needsBackup = details.length > 0 && (backupAge === null || backupAge >= 7);

  return (
    <div className="page">
      <h1>Meine Klassen</h1>

      <AutoBackupNotice />

      {needsBackup && (
        <div className="notice">
          {backupAge === null ? 'Du hast noch kein Backup gemacht.' : `Dein letztes Backup ist ${backupAge} Tage alt.`}{' '}
          <a href="#/einstellungen">Jetzt sichern</a>
        </div>
      )}

      <div className="card-grid">
        {details.map(({ cls, studentCount, subjects }) => (
          <a key={cls.id} href={`#/klasse/${cls.id}`} className="class-card">
            <span className="class-card-name">{cls.name}</span>
            <span className="class-card-meta">
              {SCHOOL_TYPES[cls.schoolType].label} · {GRADE_SYSTEMS[cls.gradeSystem].short}
            </span>
            <span className="class-card-meta">
              {studentCount} Schüler{subjects.length > 0 && ` · ${subjects.join(', ')}`}
            </span>
          </a>
        ))}
        {!creating && (
          <button className="class-card add-card" onClick={() => setCreating(true)}>
            + Neue Klasse
          </button>
        )}
      </div>

      {creating && <NewClassForm schoolYear={schoolYear} onCancel={() => setCreating(false)} />}

      {details.length === 0 && !creating && (
        <p className="muted">Lege deine erste Klasse an. Danach fügst du die Schüler hinzu und kannst Noten eintragen.</p>
      )}
    </div>
  );
}

function NewClassForm({ schoolYear, onCancel }: { schoolYear: SchoolYear; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [schoolType, setSchoolType] = useState<SchoolType>('BS');
  const [gradeSystem, setGradeSystem] = useState<GradeSystem>(SCHOOL_TYPES.BS.defaultSystem);
  const [halfYearReport, setHalfYearReport] = useState(true);
  const [subjects, setSubjects] = useState('');
  const subjectNames = subjects
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = name.trim() !== '' && subjectNames.length > 0;

  const submit = async () => {
    if (!valid) return;
    const id = await createClass({ schoolYearId: schoolYear.id, name, schoolType, gradeSystem, halfYearReport, subjectNames });
    window.location.hash = `#/klasse/${id}/einstellungen`;
  };

  return (
    <form
      className="panel form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2>Neue Klasse</h2>
      <Field label="Klassenname">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. 11TG2" />
      </Field>
      <Field label="Schulart" hint={`Bereiche: ${SCHOOL_TYPES[schoolType].categories.map((c) => c.name).join(', ')}`}>
        <select
          value={schoolType}
          onChange={(e) => {
            const t = e.target.value as SchoolType;
            setSchoolType(t);
            setGradeSystem(SCHOOL_TYPES[t].defaultSystem);
          }}
        >
          {Object.entries(SCHOOL_TYPES).map(([key, t]) => (
            <option key={key} value={key}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notensystem">
        <select value={gradeSystem} onChange={(e) => setGradeSystem(e.target.value as GradeSystem)}>
          {Object.entries(GRADE_SYSTEMS).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Fächer" hint="Jedes Fach ergibt eine eigene Zeugnisnote. Mehrere mit Komma trennen.">
        <input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="z. B. TG Theorie, TG Labor" />
      </Field>
      <label className="check">
        <input type="checkbox" checked={halfYearReport} onChange={(e) => setHalfYearReport(e.target.checked)} />
        Klasse bekommt ein Halbjahreszeugnis
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={!valid}>
          Anlegen und Schüler hinzufügen
        </button>
        <button type="button" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
