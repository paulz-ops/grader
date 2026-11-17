import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, halfForDate, today } from '../db';
import { computeTable, gradeKey, inPeriod, mean } from '../calc';
import { formatAverage, formatGrade, roundReport, GRADE_SYSTEMS } from '../grades';
import { createAssessment, setGrade } from '../actions';
import { sortStudents } from '../students';
import { formatNumber, formatShortDate } from '../format';
import { GradeCell, focusCell } from './GradeCell';
import { AssessmentDialog } from './AssessmentDialog';
import { CommentDialog } from './CommentDialog';
import { PhotoButton } from './photo';
import type { Assessment, Period, SchoolClass, SchoolYear, Subject } from '../types';

interface Props {
  cls: SchoolClass;
  subject: Subject;
  schoolYear: SchoolYear;
  period: Period;
}

export function GradeTable({ cls, subject, schoolYear, period }: Props) {
  const data = useLiveQuery(async () => {
    const [students, assessments] = await Promise.all([
      db.students.where('classId').equals(cls.id).toArray(),
      db.assessments.where('subjectId').equals(subject.id).toArray(),
    ]);
    const grades = assessments.length
      ? await db.grades.where('assessmentId').anyOf(assessments.map((a) => a.id)).toArray()
      : [];
    return { students, assessments, grades };
  }, [cls.id, subject.id]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [commentFor, setCommentFor] = useState<{ assessmentId: string; studentId: string } | null>(null);

  const view = useMemo(() => {
    if (!data) return null;
    const students = sortStudents(data.students.filter((s) => s.active));
    const assessments = data.assessments
      .filter((a) => inPeriod(a, period))
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
    const groups = subject.categories.map((category, index) => ({
      category,
      index,
      assessments: assessments.filter((a) => a.categoryId === category.id),
    }));
    const ordered = groups.flatMap((g) => g.assessments);
    const colIndex = new Map(ordered.map((a, i) => [a.id, i]));
    const gradeMap = new Map(data.grades.map((g) => [gradeKey(g.assessmentId, g.studentId), g]));
    const result = computeTable(subject, ordered, data.grades, students.map((s) => s.id));
    return { students, groups, colIndex, gradeMap, result };
  }, [data, subject, period]);

  // Nach "+": erstes Feld der neuen Spalte fokussieren
  useEffect(() => {
    if (!pendingFocus || !view) return;
    const col = view.colIndex.get(pendingFocus);
    if (col !== undefined) {
      focusCell(0, col);
      setPendingFocus(null);
    }
  }, [pendingFocus, view]);

  if (!data || !view) return null;
  const { students, groups, colIndex, gradeMap, result } = view;
  const system = cls.gradeSystem;
  const totalWeight = subject.categories.reduce((s, c) => s + Math.max(0, c.weight), 0);

  const report =
    period === 'year'
      ? { label: 'Zeugnis', title: 'Jahreszeugnis (gerundet)', threshold: cls.roundingFinal }
      : period === 1 && cls.halfYearReport
        ? { label: 'HJ-Zeugnis', title: 'Halbjahreszeugnis (gerundet)', threshold: cls.roundingHalf }
        : null;
  const reportOf = (avg: number | null) => (avg === null || !report ? null : roundReport(avg, system, report.threshold));

  const add = async (categoryId: string) => {
    const half = period === 'year' ? halfForDate(today(), schoolYear) : period;
    setPendingFocus(await createAssessment(subject, categoryId, half));
  };

  const editing: Assessment | undefined = data.assessments.find((a) => a.id === editingId);
  const showPhotos = cls.photos !== false;
  const comment = commentFor && {
    assessment: data.assessments.find((a) => a.id === commentFor.assessmentId),
    student: data.students.find((s) => s.id === commentFor.studentId),
    grade: gradeMap.get(gradeKey(commentFor.assessmentId, commentFor.studentId)),
  };

  if (students.length === 0) {
    return (
      <div className="empty">
        Diese Klasse hat noch keine Schüler. <a href={`#/klasse/${cls.id}/einstellungen`}>Schüler hinzufügen</a>
      </div>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table className="grades">
          <thead>
            <tr>
              <th rowSpan={2} className="name-col corner">
                {students.length} Schüler
              </th>
              {groups.map(({ category, index, assessments }) => (
                <th key={category.id} colSpan={assessments.length + 1} className={`cat c${index % 4}`}>
                  <div className="cat-head">
                    <span>
                      {category.name}{' '}
                      <span className="cat-weight">
                        {totalWeight > 0 ? `${Math.round((category.weight / totalWeight) * 100)} %` : ''}
                      </span>
                    </span>
                    <button
                      className="add-btn"
                      onClick={() => void add(category.id)}
                      title={`Neue Spalte: ${category.name}`}
                      aria-label={`Neue Note ${category.name}`}
                    >
                      +
                    </button>
                  </div>
                </th>
              ))}
              <th rowSpan={2} className="total">
                Ø gesamt
              </th>
              {report && (
                <th rowSpan={2} className="report" title={report.title}>
                  {report.label}
                </th>
              )}
            </tr>
            <tr>
              {groups.flatMap(({ category, index, assessments }) => [
                ...assessments.map((a) => (
                  <th key={a.id} className={`assess c${index % 4}`}>
                    <button className="assess-btn" onClick={() => setEditingId(a.id)} title="Bearbeiten">
                      <span className="assess-title">{a.title}</span>
                      <span className="assess-meta">
                        {formatShortDate(a.date)}
                        {period === 'year' && ` · ${a.half}. HJ`}
                        {a.weight !== 1 && ` · ×${formatNumber(a.weight)}`}
                      </span>
                    </button>
                  </th>
                )),
                <th key={`${category.id}-avg`} className={`avg-head c${index % 4}`}>
                  Ø
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {students.map((s, row) => {
              const r = result.students[s.id];
              const rep = reportOf(r.overall);
              return (
                <tr key={s.id}>
                  <th scope="row" className="name-col">
                    <div className="name-cell">
                      {showPhotos && <PhotoButton student={s} size={34} />}
                      <span className="name-text">
                        {s.lastName}, {s.firstName}
                      </span>
                    </div>
                  </th>
                  {groups.flatMap(({ category, assessments }) => [
                    ...assessments.map((a) => (
                      <td key={a.id} className="cell">
                        <GradeCell
                          grade={gradeMap.get(gradeKey(a.id, s.id))}
                          system={system}
                          row={row}
                          col={colIndex.get(a.id)!}
                          label={`${a.title}: ${s.firstName} ${s.lastName}`}
                          onCommit={(p) => void setGrade(a.id, s.id, p)}
                          onComment={() => setCommentFor({ assessmentId: a.id, studentId: s.id })}
                        />
                      </td>
                    )),
                    <td key={`${category.id}-avg`} className="avg">
                      {formatAverage(r.categoryAvg[category.id])}
                    </td>,
                  ])}
                  <td
                    className={r.provisional ? 'total provisional' : 'total'}
                    title={r.provisional ? 'Vorläufig: In mindestens einem Bereich fehlt noch eine Note.' : undefined}
                  >
                    {formatAverage(r.overall)}
                    {r.provisional && '*'}
                  </td>
                  {report && (
                    <td className={r.provisional ? 'report provisional' : 'report'}>
                      {rep !== null ? formatGrade(rep, system) : ''}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="name-col">
                Ø Klasse
              </th>
              {groups.flatMap(({ category, assessments }) => [
                ...assessments.map((a) => <td key={a.id}>{formatAverage(result.assessmentAvg[a.id])}</td>),
                <td key={`${category.id}-avg`} className="avg">
                  {formatAverage(result.categoryAvg[category.id])}
                </td>,
              ])}
              <td className="total">{formatAverage(result.overallAvg)}</td>
              {report && (
                <td className="report">
                  {formatAverage(mean(students.map((s) => reportOf(result.students[s.id].overall))))}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="legend">
        Eingabe: {GRADE_SYSTEMS[system].hint}. Enter → nächster Schüler, Tab → nächste Spalte. Kommentar: lange drücken,
        Rechtsklick oder Strg+K. Spaltenkopf antippen zum Bearbeiten. * = vorläufig, weil ein Bereich noch keine Note
        hat.
      </p>

      {comment?.assessment && comment.student && (
        <CommentDialog
          assessment={comment.assessment}
          student={comment.student}
          grade={comment.grade}
          system={system}
          onClose={() => setCommentFor(null)}
        />
      )}

      {editing && (
        <AssessmentDialog
          assessment={editing}
          subject={subject}
          schoolYear={schoolYear}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  );
}
