import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, halfForDate, today } from '../db';
import { GRADE_SYSTEMS } from '../grades';
import { SCHOOL_TYPES } from '../templates';
import { ClassSettings } from './ClassSettings';
import { GradeTable } from './GradeTable';
import type { Period, SchoolYear } from '../types';

interface Props {
  classId: string;
  section?: string;
  subjectId?: string;
  schoolYear: SchoolYear;
}

export function ClassView({ classId, section, subjectId, schoolYear }: Props) {
  const cls = useLiveQuery(async () => (await db.classes.get(classId)) ?? null, [classId]);
  const subjects = useLiveQuery(() => db.subjects.where('classId').equals(classId).sortBy('sort'), [classId]);
  const [period, setPeriod] = useState<Period>(() => halfForDate(today(), schoolYear));

  if (cls === undefined || subjects === undefined) return <p className="loading">Lade …</p>;
  if (cls === null) {
    return (
      <div className="page">
        <p>Diese Klasse gibt es nicht (mehr).</p>
        <a href="#/">Zur Übersicht</a>
      </div>
    );
  }

  const isSettings = section === 'einstellungen';
  const subject = isSettings ? undefined : (subjects.find((s) => s.id === subjectId) ?? subjects[0]);

  return (
    <div className="page wide">
      <div className="class-head">
        <a href="#/" className="back">
          ← Klassen
        </a>
        <h1>{cls.name}</h1>
        <span className="badge">{SCHOOL_TYPES[cls.schoolType].label}</span>
        <span className="badge">{GRADE_SYSTEMS[cls.gradeSystem].short}</span>
      </div>

      <nav className="tabs">
        {subjects.map((s) => (
          <a
            key={s.id}
            href={`#/klasse/${cls.id}/fach/${s.id}`}
            className={subject?.id === s.id ? 'tab active' : 'tab'}
          >
            {s.name}
          </a>
        ))}
        <a href={`#/klasse/${cls.id}/einstellungen`} className={isSettings ? 'tab active settings' : 'tab settings'}>
          ⚙ Einstellungen
        </a>
      </nav>

      {isSettings ? (
        <ClassSettings cls={cls} />
      ) : subject ? (
        <>
          <div className="segmented" role="group" aria-label="Zeitraum">
            {([1, 2, 'year'] as Period[]).map((p) => (
              <button key={p} className={period === p ? 'active' : undefined} onClick={() => setPeriod(p)}>
                {p === 'year' ? 'Ganzes Schuljahr' : `${p}. Halbjahr`}
              </button>
            ))}
          </div>
          <GradeTable cls={cls} subject={subject} schoolYear={schoolYear} period={period} />
        </>
      ) : (
        <div className="empty">
          Noch kein Fach angelegt. <a href={`#/klasse/${cls.id}/einstellungen`}>Fach anlegen</a>
        </div>
      )}
    </div>
  );
}
