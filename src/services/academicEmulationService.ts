import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ClassAcademicEmulationRecord, AcademicEmulationConfig, DEFAULT_EMULATION_CONFIG, MonthlyEmulationSummary } from '../types/academicEmulation';
import { ClassInfo } from '../types/homeroom';
import { getWeeksForMonth } from '../utils/schoolWeekUtils';

const COLLECTIONS = {
  RECORDS: 'academic_emulation_records',
  CONFIG: 'academic_emulation_config'
};

const CACHE_KEY_RECORDS = 'academic_emulation_records_cache_v1';
const CACHE_KEY_CONFIG = 'academic_emulation_config_cache_v1';

const safeStorage = {
  getItem(key: string): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }
    return null;
  },
  setItem(key: string, value: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try { window.localStorage.setItem(key, value); } catch (e) {}
    }
  }
};

export const academicEmulationService = {
  async getConfig(schoolYear: string = '2026–2027'): Promise<AcademicEmulationConfig> {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.CONFIG, schoolYear.replace(/[^a-zA-Z0-9]/g, '_')));
      if (snap.exists()) {
        const cfg = snap.data() as AcademicEmulationConfig;
        safeStorage.setItem(`${CACHE_KEY_CONFIG}_${schoolYear}`, JSON.stringify(cfg));
        return cfg;
      }
    } catch (e) {
      console.warn('Firestore getConfig warning:', e);
    }

    const cached = safeStorage.getItem(`${CACHE_KEY_CONFIG}_${schoolYear}`);
    if (cached) {
      try { return JSON.parse(cached); } catch (err) {}
    }
    return { ...DEFAULT_EMULATION_CONFIG, schoolYear };
  },

  async saveConfig(config: AcademicEmulationConfig): Promise<void> {
    safeStorage.setItem(`${CACHE_KEY_CONFIG}_${config.schoolYear}`, JSON.stringify(config));
    try {
      await setDoc(doc(db, COLLECTIONS.CONFIG, config.schoolYear.replace(/[^a-zA-Z0-9]/g, '_')), config, { merge: true });
    } catch (e) {
      console.warn('Firestore saveConfig error:', e);
    }
  },

  async getRecords(schoolYear: string, weekNumber: number): Promise<ClassAcademicEmulationRecord[]> {
    let list: ClassAcademicEmulationRecord[] = [];
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.RECORDS));
      if (!snap.empty) {
        list = snap.docs.map(d => d.data() as ClassAcademicEmulationRecord);
        safeStorage.setItem(CACHE_KEY_RECORDS, JSON.stringify(list));
      }
    } catch (e) {
      console.warn('Firestore getRecords error, using cache:', e);
      const cached = safeStorage.getItem(CACHE_KEY_RECORDS);
      if (cached) {
        try { list = JSON.parse(cached); } catch (err) {}
      }
    }

    return list.filter(r => r.schoolYear === schoolYear && (weekNumber === 0 || r.weekNumber === weekNumber));
  },

  async saveRecord(record: ClassAcademicEmulationRecord, config: AcademicEmulationConfig): Promise<ClassAcademicEmulationRecord> {
    const id = record.id || `${record.schoolYear.replace(/[^a-zA-Z0-9]/g, '_')}_w${record.weekNumber}_${record.classId}`;

    // Values
    const goodLessons = Math.max(0, Number(record.goodLessons) || 0);
    const fairLessons = Math.max(0, Number(record.fairLessons) || 0);
    const avgLessons = Math.max(0, Number(record.avgLessons) || 0);
    const weakLessons = Math.max(0, Number(record.weakLessons) || 0);
    const goodDays = Math.max(0, Number(record.goodDays) || 0);
    const goodWeeks = Math.max(0, Number(record.goodWeeks) || 0);
    const goodMarks = Math.max(0, Number(record.goodMarks) || 0);
    const badMarks = Math.max(0, Number(record.badMarks) || 0);

    // Điểm cộng:
    // - Học sinh đạt điểm 8, 9, 10: 2đ / lượt
    // - Ngày học tốt: 10đ / ngày
    // - Tuần học tốt: 20đ / tuần
    const bonusGoodMarks = goodMarks * (config.pointPerGoodMark ?? 2);
    const bonusGoodDays = goodDays * (config.pointPerGoodDay ?? 10);
    const bonusGoodWeeks = goodWeeks * (config.pointPerGoodWeek ?? 20);
    const bonusPoints = bonusGoodMarks + bonusGoodDays + bonusGoodWeeks;

    // Điểm trừ:
    // - Giờ khá: trừ 1đ/giờ
    // - Giờ TB: trừ 3đ/giờ
    // - Giờ yếu: trừ 5đ/giờ
    // - Học sinh có điểm < 5: trừ 2đ/lượt
    const deductFairLessons = fairLessons * Math.abs(config.pointPerFairLesson ?? 1);
    const deductAvgLessons = avgLessons * Math.abs(config.pointPerAvgLesson ?? 3);
    const deductWeakLessons = weakLessons * Math.abs(config.pointPerWeakLesson ?? 5);
    const deductLessonTotal = deductFairLessons + deductAvgLessons + deductWeakLessons;
    const deductBadMarks = badMarks * Math.abs(config.pointPerBadMark ?? 2);
    const deductionPoints = deductLessonTotal + deductBadMarks;

    // Tổng điểm thi đua = 100 (baseScore) + bonusPoints - deductionPoints
    const totalScore = (config.baseScore ?? 100) + bonusPoints - deductionPoints;

    let classification = 'Đạt';
    if (totalScore >= config.thresholdExcellent) classification = 'Tốt';
    else if (totalScore >= config.thresholdGood) classification = 'Khá';
    else if (totalScore >= config.thresholdPass) classification = 'Đạt';
    else classification = 'Chưa đạt';

    const payload: ClassAcademicEmulationRecord = {
      ...record,
      id,
      goodLessons,
      fairLessons,
      avgLessons,
      weakLessons,
      goodDays,
      goodWeeks,
      goodMarks,
      badMarks,
      bonusGoodMarks,
      bonusGoodDays,
      bonusGoodWeeks,
      bonusPoints,
      deductFairLessons,
      deductAvgLessons,
      deductWeakLessons,
      deductLessonTotal,
      deductBadMarks,
      deductionPoints,
      totalScore,
      classification,
      updatedAt: new Date().toISOString()
    };

    safeStorage.setItem(`${CACHE_KEY_RECORDS}_${id}`, JSON.stringify(payload));
    try {
      await setDoc(doc(db, COLLECTIONS.RECORDS, id), payload, { merge: true });
    } catch (e) {
      console.warn('Firestore saveRecord error:', e);
    }

    return payload;
  },

  async initializeWeekRecords(classes: ClassInfo[], schoolYear: string, weekNumber: number, config: AcademicEmulationConfig): Promise<ClassAcademicEmulationRecord[]> {
    const existing = await this.getRecords(schoolYear, weekNumber);
    const results: ClassAcademicEmulationRecord[] = [];

    for (const cls of classes) {
      const found = existing.find(r => r.classId === cls.id);
      if (found) {
        results.push(found);
      } else {
        const newRec: ClassAcademicEmulationRecord = {
          id: `${schoolYear.replace(/[^a-zA-Z0-9]/g, '_')}_w${weekNumber}_${cls.id}`,
          schoolYear,
          weekNumber,
          monthNumber: 10,
          classId: cls.id,
          className: cls.name,
          goodLessons: 0,
          fairLessons: 0,
          avgLessons: 0,
          weakLessons: 0,
          goodDays: 0,
          goodWeeks: 0,
          goodMarks: 0,
          badMarks: 0,
          updatedAt: new Date().toISOString()
        };
        const saved = await this.saveRecord(newRec, config);
        results.push(saved);
      }
    }

    return results;
  },

  calculateMonthlySummary(
    classes: ClassInfo[],
    allRecords: ClassAcademicEmulationRecord[],
    monthNumber: number,
    schoolYear: string,
    config: AcademicEmulationConfig,
    activeWeeks?: number[]
  ): MonthlyEmulationSummary[] {
    const targetWeeks = (activeWeeks && activeWeeks.length > 0)
      ? activeWeeks
      : getWeeksForMonth(monthNumber, schoolYear);

    const summaries: MonthlyEmulationSummary[] = classes.map(cls => {
      const clsRecords = allRecords.filter(r => r.classId === cls.id && r.schoolYear === schoolYear);
      const weekRecords: Record<number, ClassAcademicEmulationRecord | undefined> = {};
      
      let sumScores = 0;
      let recordedCount = 0;
      const weekScores: { weekNumber: number; score: number; hasRecord: boolean }[] = [];

      let totalGoodLessons = 0;
      let totalFairLessons = 0;
      let totalAvgLessons = 0;
      let totalWeakLessons = 0;
      let totalGoodDays = 0;
      let totalGoodWeeks = 0;
      let totalGoodMarks = 0;
      let totalBadMarks = 0;
      let totalBonusPoints = 0;
      let totalDeductionPoints = 0;

      targetWeeks.forEach(w => {
        const found = clsRecords.find(r => r.weekNumber === w);
        if (found) {
          weekRecords[w] = found;
          const score = typeof found.totalScore === 'number' ? found.totalScore : (config.baseScore ?? 100);
          weekScores.push({ weekNumber: w, score, hasRecord: true });
          sumScores += score;
          recordedCount++;

          totalGoodLessons += found.goodLessons || 0;
          totalFairLessons += found.fairLessons || 0;
          totalAvgLessons += found.avgLessons || 0;
          totalWeakLessons += found.weakLessons || 0;
          totalGoodDays += found.goodDays || 0;
          totalGoodWeeks += found.goodWeeks || 0;
          totalGoodMarks += found.goodMarks || 0;
          totalBadMarks += found.badMarks || 0;
          totalBonusPoints += found.bonusPoints || 0;
          totalDeductionPoints += found.deductionPoints || 0;
        } else {
          weekRecords[w] = undefined;
          weekScores.push({ weekNumber: w, score: config.baseScore ?? 100, hasRecord: false });
        }
      });

      // Số tuần chia bình quân: nếu có tuần đã ghi nhận dữ liệu thì chia cho số tuần đó, nếu chưa thì chia cho targetWeeks.length
      const divisor = recordedCount > 0 ? recordedCount : (targetWeeks.length > 0 ? targetWeeks.length : 1);
      const effectiveTotal = recordedCount > 0 ? sumScores : (config.baseScore ?? 100);
      const averageScore = Math.round((effectiveTotal / divisor) * 10) / 10;

      let classification = 'Đạt';
      if (averageScore >= config.thresholdExcellent) classification = 'Tốt';
      else if (averageScore >= config.thresholdGood) classification = 'Khá';
      else if (averageScore >= config.thresholdPass) classification = 'Đạt';
      else classification = 'Chưa đạt';

      return {
        classId: cls.id,
        className: cls.name,
        monthNumber,
        schoolYear,
        targetWeeks,
        weekRecords,
        weekScores,
        totalScore: effectiveTotal,
        weekCount: divisor,
        averageScore,
        classification,
        rank: 1,
        totalGoodLessons,
        totalFairLessons,
        totalAvgLessons,
        totalWeakLessons,
        totalGoodDays,
        totalGoodWeeks,
        totalGoodMarks,
        totalBadMarks,
        totalBonusPoints,
        totalDeductionPoints
      };
    });

    // Xếp hạng các lớp theo điểm bình quân tháng từ cao xuống thấp
    summaries.sort((a, b) => {
      if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
      if (b.totalGoodLessons !== a.totalGoodLessons) return b.totalGoodLessons - a.totalGoodLessons;
      return a.className.localeCompare(b.className);
    });

    summaries.forEach((s, idx) => {
      s.rank = idx + 1;
    });

    return summaries;
  }
};
