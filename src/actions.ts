import { db, newId, today } from './db';
import { gradeKey } from './calc';
import { SCHOOL_TYPES } from './templates';
import type { ParsedGrade } from './grades';
import { applyGradeChange, type GradeChange } from './gradeRecord';
import type { GradeSystem, Half, SchoolClass, SchoolType, Subject } from './types';
import type { StudentName } from './students';

// Alle schreibenden Aktionen an einer Stelle. Löschen räumt abhängige Daten mit auf.

export interface NewClassInput {
  schoolYearId: string;
  name: string;
  schoolType: SchoolType;
  gradeSystem: GradeSystem;
  halfYearReport: boolean;
  subjectNames: string[];
}

export async function createClass(input: NewClassInput): Promise<string> {
  const cls: SchoolClass = {
    id: newId(),
    schoolYearId: input.schoolYearId,
    name: input.name.trim(),
    schoolType: input.schoolType,
    gradeSystem: input.gradeSystem,
    halfYearReport: input.halfYearReport,
    roundingHalf: 0.5,
    roundingFinal: 0.5,
    photos: true,
    createdAt: Date.now(),
  };
  await db.transaction('rw', db.classes, db.subjects, async () => {
    await db.classes.add(cls);
    let sort = 0;
    for (const name of input.subjectNames) {
      await db.subjects.add(newSubject(cls.id, name, input.schoolType, sort++));
    }
  });
  return cls.id;
}

function newSubject(classId: string, name: string, schoolType: SchoolType, sort: number): Subject {
  return {
    id: newId(),
    classId,
    name: name.trim(),
    sort,
    categories: SCHOOL_TYPES[schoolType].categories.map((c) => ({ id: newId(), ...c })),
  };
}

export async function addSubject(cls: SchoolClass, name: string): Promise<void> {
  const existing = await db.subjects.where('classId').equals(cls.id).toArray();
  const sort = existing.reduce((m, s) => Math.max(m, s.sort + 1), 0);
  await db.subjects.add(newSubject(cls.id, name, cls.schoolType, sort));
}

export async function addStudents(classId: string, names: StudentName[]): Promise<void> {
  await db.students.bulkAdd(
    names.map((n) => ({ id: newId(), classId, lastName: n.lastName, firstName: n.firstName, active: true })),
  );
}

export async function createAssessment(subject: Subject, categoryId: string, half: Half): Promise<string> {
  const category = subject.categories.find((c) => c.id === categoryId);
  const count = await db.assessments
    .where('subjectId')
    .equals(subject.id)
    .filter((a) => a.categoryId === categoryId)
    .count();
  const id = newId();
  await db.assessments.add({
    id,
    subjectId: subject.id,
    categoryId,
    title: `${category?.name ?? 'Note'} ${count + 1}`,
    date: today(),
    half,
    weight: 1,
    createdAt: Date.now(),
  });
  return id;
}

async function updateGrade(assessmentId: string, studentId: string, change: GradeChange): Promise<void> {
  const id = gradeKey(assessmentId, studentId);
  await db.transaction('rw', db.grades, async () => {
    const next = applyGradeChange(await db.grades.get(id), { id, assessmentId, studentId }, change, Date.now());
    if (next) await db.grades.put(next);
    else await db.grades.delete(id);
  });
}

export function setGrade(assessmentId: string, studentId: string, parsed: ParsedGrade): Promise<void> {
  return updateGrade(assessmentId, studentId, { kind: 'grade', parsed });
}

export function setComment(assessmentId: string, studentId: string, text: string): Promise<void> {
  return updateGrade(assessmentId, studentId, { kind: 'comment', text });
}

export async function setPhoto(studentId: string, photo: string | undefined): Promise<void> {
  await db.students.update(studentId, { photo });
}

export async function deleteAssessment(id: string): Promise<void> {
  await db.transaction('rw', db.assessments, db.grades, async () => {
    await db.grades.where('assessmentId').equals(id).delete();
    await db.assessments.delete(id);
  });
}

export async function deleteSubject(id: string): Promise<void> {
  await db.transaction('rw', db.subjects, db.assessments, db.grades, async () => {
    const ids = await db.assessments.where('subjectId').equals(id).primaryKeys();
    if (ids.length) await db.grades.where('assessmentId').anyOf(ids).delete();
    await db.assessments.bulkDelete(ids);
    await db.subjects.delete(id);
  });
}

export async function deleteStudent(id: string): Promise<void> {
  await db.transaction('rw', db.students, db.grades, async () => {
    await db.grades.where('studentId').equals(id).delete();
    await db.students.delete(id);
  });
}

export async function deleteClass(id: string): Promise<void> {
  await db.transaction('rw', [db.classes, db.students, db.subjects, db.assessments, db.grades], async () => {
    const subjectIds = await db.subjects.where('classId').equals(id).primaryKeys();
    const assessmentIds = subjectIds.length
      ? await db.assessments.where('subjectId').anyOf(subjectIds).primaryKeys()
      : [];
    if (assessmentIds.length) await db.grades.where('assessmentId').anyOf(assessmentIds).delete();
    await db.assessments.bulkDelete(assessmentIds);
    await db.subjects.bulkDelete(subjectIds);
    await db.students.where('classId').equals(id).delete();
    await db.classes.delete(id);
  });
}
