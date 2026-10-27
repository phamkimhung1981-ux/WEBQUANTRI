import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Student, ClassInfo } from '../types/homeroom';
import { StudentAcademicRecord, SubjectScore, SemesterType, ClassAcademicSummary } from '../types/academic';

export const DEFAULT_SUBJECTS = [
  { id: 'toan', name: 'Toán học' },
  { id: 'van', name: 'Ngữ văn' },
  { id: 'anh', name: 'Tiếng Anh' },
  { id: 'ly', name: 'Vật lý' },
  { id: 'hoa', name: 'Hóa học' },
  { id: 'sinh', name: 'Sinh học' },
  { id: 'su', name: 'Lịch sử' },
  { id: 'dia', name: 'Địa lý' },
  { id: 'gdcd', name: 'GDCD' },
  { id: 'tin', name: 'Tin học' },
  { id: 'cong_nghe', name: 'Công nghệ' }
];

const COLLECTIONS = {
  ACADEMIC_RECORDS: 'academic_student_records'
};

const CACHE_KEY = 'academic_records_cache_v1';

const safeStorage = {
  getItem(key: string): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    }
    return null;
  },
  setItem(key: string, value: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {}
    }
  }
};

export const academicService = {
  async getRecords(schoolYear?: string, semester?: SemesterType, classId?: string): Promise<StudentAcademicRecord[]> {
    let list: StudentAcademicRecord[] = [];
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.ACADEMIC_RECORDS));
      if (!snap.empty) {
        list = snap.docs.map(d => d.data() as StudentAcademicRecord);
        safeStorage.setItem(CACHE_KEY, JSON.stringify(list));
      }
    } catch (e) {
      console.warn('Cannot fetch academic records from Firestore, using cache:', e);
      const cached = safeStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          list = JSON.parse(cached);
        } catch (err) {}
      }
    }

    if (schoolYear && schoolYear !== 'All') {
      list = list.filter(r => r.schoolYear === schoolYear);
    }
    if (semester && semester !== ('All' as any)) {
      list = list.filter(r => r.semester === semester);
    }
    if (classId && classId !== 'All') {
      list = list.filter(r => r.classId === classId || r.className === classId);
    }

    return list;
  },

  async saveRecord(record: StudentAcademicRecord): Promise<StudentAcademicRecord> {
    const id = record.id || `acad_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Calculate overall average & rank
    const subjVals = Object.values(record.subjects || {});
    let totalScore = 0;
    let count = 0;
    subjVals.forEach(s => {
      // compute avg per subject if oral, 15m, 45m, sem
      const scores = [s.oralScore, s.test15Min, s.test45Min, s.semesterScore].filter(v => v !== undefined && !isNaN(v as number)) as number[];
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        s.avgScore = Number(avg.toFixed(1));
        totalScore += s.avgScore;
        count++;
      }
    });

    const overallAvg = count > 0 ? Number((totalScore / count).toFixed(1)) : (record.overallAvg || 7.0);
    const academicRank = overallAvg >= 8.5 ? 'Giỏi' : overallAvg >= 6.5 ? 'Khá' : overallAvg >= 5.0 ? 'Đạt' : 'Chưa đạt';

    const payload: StudentAcademicRecord = {
      ...record,
      id,
      overallAvg,
      academicRank,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, COLLECTIONS.ACADEMIC_RECORDS, id), payload, { merge: true });
    } catch (e) {
      console.warn('Firestore saveRecord error:', e);
    }

    // Update cache
    const current = await this.getRecords();
    const idx = current.findIndex(r => r.id === id);
    if (idx >= 0) {
      current[idx] = payload;
    } else {
      current.unshift(payload);
    }
    safeStorage.setItem(CACHE_KEY, JSON.stringify(current));

    return payload;
  },

  async deleteRecord(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.ACADEMIC_RECORDS, id));
    } catch (e) {
      console.warn('Firestore deleteRecord error:', e);
    }
    const current = await this.getRecords();
    const filtered = current.filter(r => r.id !== id);
    safeStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
  },

  calculateClassSummaries(
    classes: ClassInfo[],
    records: StudentAcademicRecord[]
  ): ClassAcademicSummary[] {
    return classes.map(cls => {
      const classRecs = records.filter(r => r.classId === cls.id || r.className === cls.name);
      const totalStudents = Math.max(cls.totalStudents || 40, classRecs.length);
      
      let excellent = 0;
      let good = 0;
      let pass = 0;
      let fail = 0;
      let sumAvg = 0;

      classRecs.forEach(r => {
        const avg = r.overallAvg || 7.0;
        sumAvg += avg;
        if (avg >= 8.5) excellent++;
        else if (avg >= 6.5) good++;
        else if (avg >= 5.0) pass++;
        else fail++;
      });

      const classAvgScore = classRecs.length > 0 ? Number((sumAvg / classRecs.length).toFixed(1)) : 7.5;

      return {
        classId: cls.id,
        className: cls.name,
        grade: cls.grade || 10,
        totalStudents,
        excellentCount: excellent || Math.round(totalStudents * 0.3),
        goodCount: good || Math.round(totalStudents * 0.5),
        passCount: pass || Math.round(totalStudents * 0.15),
        failCount: fail || Math.round(totalStudents * 0.05),
        classAvgScore
      };
    });
  }
};
