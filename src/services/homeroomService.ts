import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import {
  ClassInfo,
  Student,
  HomeroomAssignment,
  ConductCategory,
  ConductCriterion,
  ConductRecord,
  ConductEvaluation,
  ConductSettings
} from '../types/homeroom';
import {
  DEFAULT_CONDUCT_CATEGORIES,
  DEFAULT_CONDUCT_CRITERIA,
  DEFAULT_CLASSES,
  SAMPLE_STUDENTS,
  DEFAULT_CONDUCT_SETTINGS
} from '../lib/homeroomData';

const sanitize = <T extends Record<string, any>>(data: T): T => {
  const result = { ...data };
  for (const key in result) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result;
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Homeroom Error: ', JSON.stringify(errInfo));
}

export const homeroomService = {
  // 1. SEED DEFAULT DATA IF EMPTY
  async seedIfEmpty() {
    try {
      // Seed Categories
      const catCol = collection(db, 'conduct_categories');
      const catSnap = await getDocs(catCol);
      if (catSnap.empty) {
        const batch = writeBatch(db);
        DEFAULT_CONDUCT_CATEGORIES.forEach(c => {
          batch.set(doc(db, 'conduct_categories', c.id), sanitize(c));
        });
        await batch.commit();
      }

      // Seed Criteria
      const critCol = collection(db, 'conduct_criteria');
      const critSnap = await getDocs(critCol);
      if (critSnap.empty) {
        const batch = writeBatch(db);
        DEFAULT_CONDUCT_CRITERIA.forEach(c => {
          batch.set(doc(db, 'conduct_criteria', c.id), sanitize(c));
        });
        await batch.commit();
      }

      // Seed Classes
      const clsCol = collection(db, 'classes');
      const clsSnap = await getDocs(clsCol);
      if (clsSnap.empty) {
        const batch = writeBatch(db);
        DEFAULT_CLASSES.forEach(c => {
          batch.set(doc(db, 'classes', c.id), sanitize(c));
        });
        await batch.commit();
      }

      // Seed Students
      const stdCol = collection(db, 'students');
      const stdSnap = await getDocs(stdCol);
      if (stdSnap.empty) {
        const batch = writeBatch(db);
        SAMPLE_STUDENTS.forEach(s => {
          batch.set(doc(db, 'students', s.id), sanitize(s));
        });
        await batch.commit();
      }

      // Seed Homeroom Assignments
      const assignCol = collection(db, 'homeroom_assignments');
      const assignSnap = await getDocs(assignCol);
      if (assignSnap.empty) {
        const sampleAssignments: HomeroomAssignment[] = [
          { id: 'assign_1', teacherId: 't1', teacherName: 'Nguyễn Thị A', classId: 'class_10a1', className: '10A1', schoolYear: '2026–2027', startDate: '2026-09-01', status: 'active' },
          { id: 'assign_2', teacherId: 't2', teacherName: 'Trần Văn B', classId: 'class_10a2', className: '10A2', schoolYear: '2026–2027', startDate: '2026-09-01', status: 'active' },
          { id: 'assign_3', teacherId: 't3', teacherName: 'Lê Thị C', classId: 'class_10a3', className: '10A3', schoolYear: '2026–2027', startDate: '2026-09-01', status: 'active' }
        ];
        const batch = writeBatch(db);
        sampleAssignments.forEach(a => {
          batch.set(doc(db, 'homeroom_assignments', a.id), sanitize(a));
        });
        await batch.commit();
      }

      // Seed Settings
      const setCol = collection(db, 'conduct_settings');
      const setSnap = await getDocs(setCol);
      if (setSnap.empty) {
        await setDoc(doc(db, 'conduct_settings', DEFAULT_CONDUCT_SETTINGS.id), sanitize(DEFAULT_CONDUCT_SETTINGS));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'homeroom_seed');
    }
  },

  // 2. LISTENERS FOR REAL-TIME SYNC
  subscribeClasses(callback: (classes: ClassInfo[]) => void) {
    const q = collection(db, 'classes');
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ClassInfo));
      callback(data.sort((a, b) => a.name.localeCompare(b.name)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'classes'));
  },

  subscribeStudents(callback: (students: Student[]) => void) {
    const q = collection(db, 'students');
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      callback(data.sort((a, b) => a.name.localeCompare(b.name)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'students'));
  },

  subscribeAssignments(callback: (assignments: HomeroomAssignment[]) => void) {
    const q = collection(db, 'homeroom_assignments');
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HomeroomAssignment));
      callback(data);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'homeroom_assignments'));
  },

  subscribeCategories(callback: (categories: ConductCategory[]) => void) {
    const q = collection(db, 'conduct_categories');
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConductCategory));
      callback(data.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'conduct_categories'));
  },

  subscribeCriteria(callback: (criteria: ConductCriterion[]) => void) {
    const q = collection(db, 'conduct_criteria');
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConductCriterion));
      callback(data.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'conduct_criteria'));
  },

  subscribeRecords(callback: (records: ConductRecord[]) => void) {
    const q = collection(db, 'conduct_records');
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConductRecord));
      callback(data.sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime()));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'conduct_records'));
  },

  subscribeEvaluations(callback: (evaluations: ConductEvaluation[]) => void) {
    const q = collection(db, 'conduct_evaluations');
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConductEvaluation));
      callback(data);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'conduct_evaluations'));
  },

  subscribeSettings(callback: (settings: ConductSettings) => void) {
    const q = collection(db, 'conduct_settings');
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const d = snapshot.docs[0];
        callback({ id: d.id, ...d.data() } as ConductSettings);
      } else {
        callback(DEFAULT_CONDUCT_SETTINGS);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'conduct_settings'));
  },

  // 3. CRUD ACTIONS FOR CONDUCT RECORDS
  async addConductRecord(record: Omit<ConductRecord, 'id' | 'createdAt'>) {
    try {
      const id = `crec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newRecord: ConductRecord = {
        ...record,
        id,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'conduct_records', id), sanitize(newRecord));
      return newRecord;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'conduct_records');
      throw err;
    }
  },

  async updateConductRecord(id: string, data: Partial<ConductRecord>) {
    try {
      const updateData = { ...data, updatedAt: new Date().toISOString() };
      await updateDoc(doc(db, 'conduct_records', id), sanitize(updateData));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'conduct_records');
      throw err;
    }
  },

  async deleteConductRecord(id: string) {
    try {
      await deleteDoc(doc(db, 'conduct_records', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'conduct_records');
      throw err;
    }
  },

  // 4. CRUD ACTIONS FOR CONDUCT CRITERIA
  async addCriterion(criterion: Omit<ConductCriterion, 'id'>) {
    try {
      const id = `crit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newCrit: ConductCriterion = { ...criterion, id };
      await setDoc(doc(db, 'conduct_criteria', id), sanitize(newCrit));
      return newCrit;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'conduct_criteria');
      throw err;
    }
  },

  async updateCriterion(id: string, data: Partial<ConductCriterion>) {
    try {
      await updateDoc(doc(db, 'conduct_criteria', id), sanitize(data));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'conduct_criteria');
      throw err;
    }
  },

  async deleteCriterion(id: string) {
    try {
      await deleteDoc(doc(db, 'conduct_criteria', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'conduct_criteria');
      throw err;
    }
  },

  // 5. CRUD ACTIONS FOR CONDUCT EVALUATIONS
  async saveEvaluation(evaluation: Omit<ConductEvaluation, 'id' | 'createdAt'> & { id?: string }) {
    try {
      const id = evaluation.id || `eval_${evaluation.studentId}_${evaluation.period.replace(/\s+/g, '_')}_${evaluation.schoolYear.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const payload: ConductEvaluation = {
        ...evaluation,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'conduct_evaluations', id), sanitize(payload), { merge: true });
      return payload;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'conduct_evaluations');
      throw err;
    }
  },

  async updateEvaluationStatus(id: string, updates: Partial<ConductEvaluation>) {
    try {
      await updateDoc(doc(db, 'conduct_evaluations', id), sanitize({ ...updates, updatedAt: new Date().toISOString() }));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'conduct_evaluations');
      throw err;
    }
  },

  // 6. SETTINGS & HOMEROOM ASSIGNMENTS
  async saveSettings(settings: ConductSettings) {
    try {
      await setDoc(doc(db, 'conduct_settings', settings.id || 'default_conduct_settings'), sanitize(settings), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'conduct_settings');
      throw err;
    }
  },

  async saveAssignment(assignment: Omit<HomeroomAssignment, 'id'> & { id?: string }) {
    try {
      const id = assignment.id || `assign_${Date.now()}`;
      const payload: HomeroomAssignment = { ...assignment, id };
      await setDoc(doc(db, 'homeroom_assignments', id), sanitize(payload), { merge: true });
      return payload;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'homeroom_assignments');
      throw err;
    }
  },

  async addStudent(student: Omit<Student, 'id'>) {
    try {
      const id = `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const payload: Student = { ...student, id };
      await setDoc(doc(db, 'students', id), sanitize(payload));
      return payload;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'students');
      throw err;
    }
  },

  async addStudentsBulk(studentsList: Omit<Student, 'id'>[]) {
    try {
      const batch = writeBatch(db);
      const created: Student[] = [];

      studentsList.forEach((s, idx) => {
        const id = `std_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
        const payload: Student = { ...s, id };
        batch.set(doc(db, 'students', id), sanitize(payload));
        created.push(payload);
      });

      await batch.commit();
      return created;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'students_bulk');
      throw err;
    }
  },

  async updateStudent(id: string, updates: Partial<Student>) {
    try {
      await updateDoc(doc(db, 'students', id), sanitize(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'students');
      throw err;
    }
  },

  async deleteStudent(id: string) {
    try {
      await deleteDoc(doc(db, 'students', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'students');
      throw err;
    }
  },

  async deleteStudentsBulk(ids: string[]) {
    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.delete(doc(db, 'students', id));
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'students_bulk');
      throw err;
    }
  },

  // 7. CLASS MANAGEMENT
  async addClass(classInfo: Omit<ClassInfo, 'id'>) {
    try {
      const slug = classInfo.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const id = `class_${slug}_${Date.now()}`;
      const payload: ClassInfo = {
        name: classInfo.name.trim().toUpperCase(),
        grade: Number(classInfo.grade) || 10,
        schoolYear: classInfo.schoolYear || '2026–2027',
        homeroomTeacherId: classInfo.homeroomTeacherId || '',
        homeroomTeacherName: classInfo.homeroomTeacherName || '',
        room: classInfo.room || '',
        totalStudents: Number(classInfo.totalStudents) || 0,
        status: classInfo.status || 'active',
        id
      };
      await setDoc(doc(db, 'classes', id), sanitize(payload));

      // Also create a default homeroom assignment if teacher is assigned
      if (classInfo.homeroomTeacherName) {
        await this.saveAssignment({
          teacherId: classInfo.homeroomTeacherId || `teacher_${Date.now()}`,
          teacherName: classInfo.homeroomTeacherName,
          classId: id,
          className: classInfo.name,
          schoolYear: classInfo.schoolYear || '2026–2027',
          startDate: new Date().toISOString().split('T')[0],
          status: classInfo.status === 'inactive' ? 'inactive' : 'active'
        });
      }

      return payload;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'classes');
      throw err;
    }
  },

  async addClassesBulk(classesList: Omit<ClassInfo, 'id'>[]) {
    try {
      const batch = writeBatch(db);
      const created: ClassInfo[] = [];

      classesList.forEach((c, idx) => {
        const slug = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const id = `class_${slug}_${Date.now()}_${idx}`;
        const payload: ClassInfo = {
          name: c.name.trim().toUpperCase(),
          grade: Number(c.grade) || 10,
          schoolYear: c.schoolYear || '2026–2027',
          homeroomTeacherId: c.homeroomTeacherId || '',
          homeroomTeacherName: c.homeroomTeacherName || '',
          room: c.room || '',
          totalStudents: Number(c.totalStudents) || 0,
          status: c.status || 'active',
          id
        };
        batch.set(doc(db, 'classes', id), sanitize(payload));
        created.push(payload);
      });

      await batch.commit();
      return created;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'classes_bulk');
      throw err;
    }
  },

  async updateClass(id: string, updates: Partial<ClassInfo>) {
    try {
      await updateDoc(doc(db, 'classes', id), sanitize(updates));

      // Sync with homeroom_assignments
      if (
        updates.homeroomTeacherName !== undefined ||
        updates.homeroomTeacherId !== undefined ||
        updates.name !== undefined ||
        updates.status !== undefined ||
        updates.schoolYear !== undefined
      ) {
        const q = query(collection(db, 'homeroom_assignments'), where('classId', '==', id));
        const snap = await getDocs(q);
        const batch = writeBatch(db);

        if (updates.homeroomTeacherName === '') {
          // Unassigned: set any active assignments to inactive
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status === 'active') {
              batch.update(docSnap.ref, {
                status: 'inactive',
                endDate: new Date().toISOString().split('T')[0]
              });
            }
          });
        } else if (updates.homeroomTeacherName) {
          // Assigned/Updated: update active or create new
          let hasActive = false;
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status === 'active') {
              hasActive = true;
              batch.update(docSnap.ref, {
                teacherId: updates.homeroomTeacherId || data.teacherId,
                teacherName: updates.homeroomTeacherName,
                className: updates.name || data.className,
                schoolYear: updates.schoolYear || data.schoolYear || '2026–2027',
                status: updates.status === 'inactive' ? 'inactive' : 'active'
              });
            } else if (updates.name) {
              // Update name for inactive assignments too for historical correctness
              batch.update(docSnap.ref, { className: updates.name });
            }
          });

          if (!hasActive) {
            const assignId = `assign_${Date.now()}`;
            const newAssign = {
              id: assignId,
              teacherId: updates.homeroomTeacherId || `teacher_${Date.now()}`,
              teacherName: updates.homeroomTeacherName,
              classId: id,
              className: updates.name || '',
              schoolYear: updates.schoolYear || '2026–2027',
              startDate: new Date().toISOString().split('T')[0],
              status: updates.status === 'inactive' ? 'inactive' : 'active'
            };
            batch.set(doc(db, 'homeroom_assignments', assignId), sanitize(newAssign));
          }
        } else {
          // No teacher change but status or name changed
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const fieldUpdates: any = {};
            if (updates.name !== undefined) fieldUpdates.className = updates.name;
            if (updates.schoolYear !== undefined) fieldUpdates.schoolYear = updates.schoolYear;
            if (updates.status !== undefined) {
              fieldUpdates.status = updates.status;
              if (updates.status === 'inactive') {
                fieldUpdates.endDate = new Date().toISOString().split('T')[0];
              }
            }
            if (Object.keys(fieldUpdates).length > 0) {
              batch.update(docSnap.ref, fieldUpdates);
            }
          });
        }
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'classes');
      throw err;
    }
  },

  async deleteClass(id: string) {
    try {
      await deleteDoc(doc(db, 'classes', id));
      
      // Also delete related assignments
      const q = query(collection(db, 'homeroom_assignments'), where('classId', '==', id));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      // Also update related students to have empty classId
      const qStd = query(collection(db, 'students'), where('classId', '==', id));
      const snapStd = await getDocs(qStd);
      if (!snapStd.empty) {
        const batchStd = writeBatch(db);
        snapStd.docs.forEach((docSnap) => {
          batchStd.update(docSnap.ref, { classId: '' });
        });
        await batchStd.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'classes');
      throw err;
    }
  }
};
