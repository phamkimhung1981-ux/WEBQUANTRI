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

const normalizeYear = (yr?: string): string => {
  if (!yr) return '2026-2027';
  return yr.replace(/[\u2010-\u2015]/g, '-').trim();
};

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
    const normYear = normalizeYear(schoolYear);
    let localCfg: AcademicEmulationConfig = { ...DEFAULT_EMULATION_CONFIG, schoolYear: normYear };
    const cached = safeStorage.getItem(`${CACHE_KEY_CONFIG}_${normYear}`);
    if (cached) {
      try { localCfg = JSON.parse(cached); } catch (err) {}
    }

    try {
      const fetchPromise = async () => {
        const snap = await getDoc(doc(db, COLLECTIONS.CONFIG, normYear.replace(/[^a-zA-Z0-9]/g, '_')));
        if (snap.exists()) {
          const remoteCfg = snap.data() as AcademicEmulationConfig;
          const merged: AcademicEmulationConfig = {
            ...localCfg,
            ...remoteCfg,
            schoolYear: normYear,
            lockedWeeks: Array.from(new Set([...(remoteCfg.lockedWeeks || []), ...(localCfg.lockedWeeks || [])]))
          };
          safeStorage.setItem(`${CACHE_KEY_CONFIG}_${normYear}`, JSON.stringify(merged));
          return merged;
        }
        return localCfg;
      };
      const timeoutPromise = new Promise<AcademicEmulationConfig>((resolve) => setTimeout(() => resolve(localCfg), 1200));
      return await Promise.race([fetchPromise(), timeoutPromise]);
    } catch (e) {
      console.warn('Firestore getConfig warning:', e);
    }

    return localCfg;
  },

  async saveConfig(config: AcademicEmulationConfig): Promise<void> {
    const normYear = normalizeYear(config.schoolYear);
    const updatedCfg = { ...config, schoolYear: normYear };
    safeStorage.setItem(`${CACHE_KEY_CONFIG}_${normYear}`, JSON.stringify(updatedCfg));
    
    try {
      const savePromise = setDoc(doc(db, COLLECTIONS.CONFIG, normYear.replace(/[^a-zA-Z0-9]/g, '_')), updatedCfg, { merge: true });
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1200));
      await Promise.race([savePromise, timeoutPromise]);
    } catch (e) {
      console.warn('Firestore saveConfig error:', e);
    }
  },

  async getRecords(schoolYear: string, weekNumber: number): Promise<ClassAcademicEmulationRecord[]> {
    let list: ClassAcademicEmulationRecord[] = [];
    const normYear = normalizeYear(schoolYear);

    const cached = safeStorage.getItem(CACHE_KEY_RECORDS);
    if (cached) {
      try {
        list = JSON.parse(cached).map((r: ClassAcademicEmulationRecord) => {
          const bp = r.bonusPoints ?? 0;
          const dp = r.deductionPoints ?? 0;
          if (r.totalScore === 100 && bp === 0 && dp === 0) {
            r.totalScore = 0;
          }
          return r;
        });
      } catch (err) {}
    }

    try {
      const fetchPromise = async () => {
        const snap = await getDocs(collection(db, COLLECTIONS.RECORDS));
        if (!snap.empty) {
          const remoteList = snap.docs.map(d => {
            const r = d.data() as ClassAcademicEmulationRecord;
            const bp = r.bonusPoints ?? 0;
            const dp = r.deductionPoints ?? 0;
            if (r.totalScore === 100 && bp === 0 && dp === 0) {
              r.totalScore = 0;
            }
            return r;
          });

          // Merge local & remote so local unsaved/offline edits are retained
          const mergedMap = new Map<string, ClassAcademicEmulationRecord>();
          remoteList.forEach(r => { if (r.id) mergedMap.set(r.id, r); });
          list.forEach(r => { if (r.id) mergedMap.set(r.id, r); });
          const mergedList = Array.from(mergedMap.values());

          safeStorage.setItem(CACHE_KEY_RECORDS, JSON.stringify(mergedList));
          return mergedList;
        }
        return list;
      };

      const timeoutPromise = new Promise<ClassAcademicEmulationRecord[]>((resolve) => setTimeout(() => resolve(list), 1200));
      list = await Promise.race([fetchPromise(), timeoutPromise]);
    } catch (e) {
      console.warn('Firestore getRecords error, using cache:', e);
    }

    return list.filter(r => {
      const rYear = normalizeYear(r.schoolYear);
      return rYear === normYear && (weekNumber === 0 || Number(r.weekNumber) === Number(weekNumber));
    });
  },

  async saveRecord(record: ClassAcademicEmulationRecord, config: AcademicEmulationConfig): Promise<ClassAcademicEmulationRecord> {
    const normYear = normalizeYear(record.schoolYear);
    const id = record.id || `${normYear.replace(/[^a-zA-Z0-9]/g, '_')}_w${record.weekNumber}_${record.classId}`;

    // Values
    const goodLessons = Math.max(0, Number(record.goodLessons) || 0);
    const fairLessons = Math.max(0, Number(record.fairLessons) || 0);
    const avgLessons = Math.max(0, Number(record.avgLessons) || 0);
    const weakLessons = Math.max(0, Number(record.weakLessons) || 0);
    const goodDays = Math.max(0, Number(record.goodDays) || 0);
    const goodWeeks = Math.max(0, Number(record.goodWeeks) || 0);
    const goodMarks = Math.max(0, Number(record.goodMarks) || 0);
    const badMarks = Math.max(0, Number(record.badMarks) || 0);

    // Điểm cộng
    const bonusGoodMarks = goodMarks * (config.pointPerGoodMark ?? 2);
    const bonusGoodDays = goodDays * (config.pointPerGoodDay ?? 10);
    const bonusGoodWeeks = goodWeeks * (config.pointPerGoodWeek ?? 20);
    const bonusPoints = bonusGoodMarks + bonusGoodDays + bonusGoodWeeks;

    // Điểm trừ
    const deductFairLessons = fairLessons * Math.abs(config.pointPerFairLesson ?? 1);
    const deductAvgLessons = avgLessons * Math.abs(config.pointPerAvgLesson ?? 3);
    const deductWeakLessons = weakLessons * Math.abs(config.pointPerWeakLesson ?? 5);
    const deductLessonTotal = deductFairLessons + deductAvgLessons + deductWeakLessons;
    const deductBadMarks = badMarks * Math.abs(config.pointPerBadMark ?? 2);
    const deductionPoints = deductLessonTotal + deductBadMarks;

    // Tổng điểm thi đua = bonusPoints - deductionPoints
    const totalScore = bonusPoints - deductionPoints;

    let classification = 'Đạt';
    if (totalScore >= config.thresholdExcellent) classification = 'Tốt';
    else if (totalScore >= config.thresholdGood) classification = 'Khá';
    else if (totalScore >= config.thresholdPass) classification = 'Đạt';
    else classification = 'Chưa đạt';

    const payload: ClassAcademicEmulationRecord = {
      ...record,
      id,
      schoolYear: normYear,
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

    // Update CACHE_KEY_RECORDS in localStorage instantly (0ms)
    try {
      const raw = safeStorage.getItem(CACHE_KEY_RECORDS);
      let list: ClassAcademicEmulationRecord[] = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex(r => r.id === id || (r.classId === payload.classId && r.weekNumber === payload.weekNumber && normalizeYear(r.schoolYear) === normYear));
      if (idx >= 0) {
        list[idx] = payload;
      } else {
        list.push(payload);
      }
      safeStorage.setItem(CACHE_KEY_RECORDS, JSON.stringify(list));
      safeStorage.setItem(`${CACHE_KEY_RECORDS}_${id}`, JSON.stringify(payload));
    } catch (e) {}

    // Async non-blocking save to Firestore
    try {
      const savePromise = setDoc(doc(db, COLLECTIONS.RECORDS, id), payload, { merge: true });
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1000));
      await Promise.race([savePromise, timeoutPromise]);
    } catch (e) {
      console.warn('Firestore saveRecord error:', e);
    }

    return payload;
  },

  async initializeWeekRecords(classes: ClassInfo[], schoolYear: string, weekNumber: number, config: AcademicEmulationConfig): Promise<ClassAcademicEmulationRecord[]> {
    const existing = await this.getRecords(schoolYear, weekNumber);
    const results: ClassAcademicEmulationRecord[] = [];
    const normYear = normalizeYear(schoolYear);

    // Compute all records in-memory (0ms)
    for (const cls of classes) {
      const found = existing.find(r => r.classId === cls.id);
      if (found) {
        const goodLessons = Math.max(0, Number(found.goodLessons) || 0);
        const fairLessons = Math.max(0, Number(found.fairLessons) || 0);
        const avgLessons = Math.max(0, Number(found.avgLessons) || 0);
        const weakLessons = Math.max(0, Number(found.weakLessons) || 0);
        const goodDays = Math.max(0, Number(found.goodDays) || 0);
        const goodWeeks = Math.max(0, Number(found.goodWeeks) || 0);
        const goodMarks = Math.max(0, Number(found.goodMarks) || 0);
        const badMarks = Math.max(0, Number(found.badMarks) || 0);

        const bonusGoodMarks = goodMarks * (config.pointPerGoodMark ?? 2);
        const bonusGoodDays = goodDays * (config.pointPerGoodDay ?? 10);
        const bonusGoodWeeks = goodWeeks * (config.pointPerGoodWeek ?? 20);
        const bonusPoints = bonusGoodMarks + bonusGoodDays + bonusGoodWeeks;

        const deductFairLessons = fairLessons * Math.abs(config.pointPerFairLesson ?? 1);
        const deductAvgLessons = avgLessons * Math.abs(config.pointPerAvgLesson ?? 3);
        const deductWeakLessons = weakLessons * Math.abs(config.pointPerWeakLesson ?? 5);
        const deductLessonTotal = deductFairLessons + deductAvgLessons + deductWeakLessons;
        const deductBadMarks = badMarks * Math.abs(config.pointPerBadMark ?? 2);
        const deductionPoints = deductLessonTotal + deductBadMarks;

        const totalScore = bonusPoints - deductionPoints;

        let classification = 'Đạt';
        if (totalScore >= config.thresholdExcellent) classification = 'Tốt';
        else if (totalScore >= config.thresholdGood) classification = 'Khá';
        else if (totalScore >= config.thresholdPass) classification = 'Đạt';
        else classification = 'Chưa đạt';

        const updated: ClassAcademicEmulationRecord = {
          ...found,
          schoolYear: normYear,
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
        results.push(updated);
      } else {
        const id = `${normYear.replace(/[^a-zA-Z0-9]/g, '_')}_w${weekNumber}_${cls.id}`;
        const newRec: ClassAcademicEmulationRecord = {
          id,
          schoolYear: normYear,
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
          bonusGoodMarks: 0,
          bonusGoodDays: 0,
          bonusGoodWeeks: 0,
          bonusPoints: 0,
          deductFairLessons: 0,
          deductAvgLessons: 0,
          deductWeakLessons: 0,
          deductLessonTotal: 0,
          deductBadMarks: 0,
          deductionPoints: 0,
          totalScore: 0,
          classification: 'Đạt',
          updatedAt: new Date().toISOString()
        };
        results.push(newRec);
      }
    }

    // Bulk save to localStorage immediately (0ms)
    try {
      const raw = safeStorage.getItem(CACHE_KEY_RECORDS);
      let list: ClassAcademicEmulationRecord[] = raw ? JSON.parse(raw) : [];
      results.forEach(res => {
        const idx = list.findIndex(r => r.id === res.id);
        if (idx >= 0) list[idx] = res;
        else list.push(res);
      });
      safeStorage.setItem(CACHE_KEY_RECORDS, JSON.stringify(list));
    } catch (e) {}

    // Non-blocking parallel background sync to Firestore
    const syncFirestore = async () => {
      try {
        const promises = results.map(r => setDoc(doc(db, COLLECTIONS.RECORDS, r.id), r, { merge: true }));
        const timeoutP = new Promise((resolve) => setTimeout(resolve, 1500));
        await Promise.race([Promise.allSettled(promises), timeoutP]);
      } catch (e) {
        console.warn('Firestore initializeWeekRecords background sync warning:', e);
      }
    };
    syncFirestore();

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
    const normYear = normalizeYear(schoolYear);
    const targetWeeks = (activeWeeks && activeWeeks.length > 0)
      ? activeWeeks
      : getWeeksForMonth(monthNumber, normYear);

    const summaries: MonthlyEmulationSummary[] = classes.map(cls => {
      const clsRecords = allRecords.filter(r => r.classId === cls.id && normalizeYear(r.schoolYear) === normYear);
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
          const score = typeof found.totalScore === 'number' ? found.totalScore : ((found.bonusPoints || 0) - (found.deductionPoints || 0));
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
          weekScores.push({ weekNumber: w, score: 0, hasRecord: false });
        }
      });

      const divisor = recordedCount > 0 ? recordedCount : (targetWeeks.length > 0 ? targetWeeks.length : 1);
      const effectiveTotal = recordedCount > 0 ? sumScores : 0;
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
        schoolYear: normYear,
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

    summaries.sort((a, b) => {
      if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
      if (b.totalBonusPoints !== a.totalBonusPoints) return b.totalBonusPoints - a.totalBonusPoints;
      if (b.totalGoodLessons !== a.totalGoodLessons) return b.totalGoodLessons - a.totalGoodLessons;
      return a.className.localeCompare(b.className);
    });

    summaries.forEach((s, idx, arr) => {
      if (idx > 0 && s.averageScore === arr[idx - 1].averageScore) {
        s.rank = arr[idx - 1].rank;
      } else {
        s.rank = idx + 1;
      }
    });

    return summaries;
  }
};
