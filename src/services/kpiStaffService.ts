import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  KpiStaffForm, 
  KpiStaffPeriod
} from '../types/kpiStaff';
import { 
  DEFAULT_STAFF_PERIODS,
  ensureCompleteStaffPeriods,
  getClassificationByScore,
  isActiveStaffKpiForm,
  normalizeAcademicYear
} from '../lib/kpiStaffData';
import { safeLocalStorageSet } from '../utils/envUtils';

export const cleanFirestoreData = <T extends Record<string, any>>(data: T): Record<string, any> => {
  const cleanDeep = (val: any): any => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    if (typeof val === 'number') {
      return Number.isNaN(val) ? 0 : val;
    }
    if (Array.isArray(val)) {
      return val.map(cleanDeep).filter(item => item !== undefined);
    }
    if (typeof val === 'object' && !(val instanceof Date)) {
      const cleanedObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        if (v !== undefined) {
          const cv = cleanDeep(v);
          if (cv !== undefined) cleanedObj[k] = cv;
        }
      }
      return cleanedObj;
    }
    return val;
  };
  return (cleanDeep(data) || {}) as Record<string, any>;
};

export const STAFF_COLLECTIONS = {
  FORMS: 'kpi_staff_forms',
  PERIODS: 'kpi_staff_periods',
  CRITERIA: 'kpi_staff_criteria',
  GROUPS: 'kpi_staff_groups'
};

const STAFF_FORMS_CACHE_KEY = 'kpi_staff_forms_cache';
const STAFF_PERIODS_CACHE_KEY = 'kpi_staff_periods_cache';

export const deduplicateStaffForms = (forms: KpiStaffForm[]): KpiStaffForm[] => {
  if (!forms || forms.length === 0) return [];
  const map = new Map<string, KpiStaffForm>();
  const seenIds = new Set<string>();
  const sorted = [...forms]
    .filter(f => isActiveStaffKpiForm(f))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  
  sorted.forEach(f => {
    const empKey = (f.employeeId || f.employeeCode || f.employeeName || 'no_emp').trim().toUpperCase();
    const periodKey = (f.periodId || 'no_period').trim();
    const yearKey = normalizeAcademicYear(f.academicYear || '');
    const uniqueKey = `${empKey}__${periodKey}__${yearKey}`;
    const idKey = (f.id || uniqueKey).trim();
    if (!map.has(uniqueKey) && !seenIds.has(idKey)) {
      map.set(uniqueKey, f);
      seenIds.add(idKey);
    }
  });
  return Array.from(map.values());
};

export const sanitizeStaffForm = (form: KpiStaffForm): KpiStaffForm => {
  if (!form) return form;

  // Ensure any item with null or undefined selfScore is normalized to 0
  const normalizedGeneral = (form.generalItems || []).map(item => ({
    ...item,
    selfScore: item.selfScore === null || item.selfScore === undefined ? 0 : Number(item.selfScore) || 0
  }));
  const normalizedPos = (form.positionItems || []).map(item => ({
    ...item,
    selfScore: item.selfScore === null || item.selfScore === undefined ? 0 : Number(item.selfScore) || 0
  }));

  const genSelf = normalizedGeneral.reduce((acc, curr) => acc + (typeof curr.selfScore === 'number' ? curr.selfScore : 0), 0);
  const posSelf = normalizedPos.reduce((acc, curr) => acc + (typeof curr.selfScore === 'number' ? curr.selfScore : 0), 0);
  const total = genSelf + posSelf;

  return {
    ...form,
    generalItems: normalizedGeneral,
    positionItems: normalizedPos,
    generalTotalSelf: genSelf,
    positionTotalSelf: posSelf,
    totalScore: (form.managerTotalScore ?? form.ttcmTotalScore ?? total),
    selfClassification: total > 0 ? getClassificationByScore(total) : 'Chưa tự đánh giá'
  };
};

export const loadStaffFormsFromCache = (): KpiStaffForm[] => {
  try {
    const raw = localStorage.getItem(STAFF_FORMS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      return deduplicateStaffForms(parsed.map(sanitizeStaffForm));
    }
  } catch {
    // Ignore read error
  }
  // Không tự ý bơm dữ liệu mẫu giả làm khóa checkbox "Đã có phiếu"
  return [];
};

export const saveStaffFormsToCache = (forms: KpiStaffForm[]) => {
  try {
    const uniqueForms = deduplicateStaffForms(forms.map(sanitizeStaffForm));
    safeLocalStorageSet(STAFF_FORMS_CACHE_KEY, JSON.stringify(uniqueForms));
  } catch (err) {
    console.error('Failed saving staff forms to localStorage cache:', err);
  }
};

export const fetchStaffFormsFromFirestore = async (): Promise<KpiStaffForm[]> => {
  const colRef = collection(db, STAFF_COLLECTIONS.FORMS);
  const snapshot = await getDocs(colRef);
  const formsList: KpiStaffForm[] = [];
  snapshot.forEach(docSnap => {
    const raw = docSnap.data() as KpiStaffForm;
    const withId: KpiStaffForm = { ...raw, id: raw.id || docSnap.id };
    if (isActiveStaffKpiForm(withId)) {
      formsList.push(sanitizeStaffForm(withId));
    }
  });
  const uniqueForms = deduplicateStaffForms(formsList);
  saveStaffFormsToCache(uniqueForms);
  return uniqueForms;
};

export const subscribeStaffForms = (callback: (forms: KpiStaffForm[]) => void) => {
  // Callback cached immediately (only real cached forms, never fake fallback forms)
  const initial = loadStaffFormsFromCache();
  callback(initial);

  try {
    const colRef = collection(db, STAFF_COLLECTIONS.FORMS);
    return onSnapshot(colRef, (snapshot) => {
      const formsList: KpiStaffForm[] = [];
      snapshot.forEach(docSnap => {
        const raw = docSnap.data() as KpiStaffForm;
        const withId: KpiStaffForm = { ...raw, id: raw.id || docSnap.id };
        if (isActiveStaffKpiForm(withId)) {
          formsList.push(sanitizeStaffForm(withId));
        }
      });
      // Luôn dùng dữ liệu thực tế từ Firestore (kể cả khi 0 phiếu) để không báo nhầm "Đã có phiếu"
      const uniqueForms = deduplicateStaffForms(formsList);
      saveStaffFormsToCache(uniqueForms);
      callback(uniqueForms);
    }, (err) => {
      console.warn('Firestore subscription warning for staff forms:', err);
      callback(loadStaffFormsFromCache());
    });
  } catch (err) {
    console.warn('Firestore subscription fallback for staff forms:', err);
    callback(loadStaffFormsFromCache());
    return () => {};
  }
};

export const saveStaffFormToFirestore = async (
  form: KpiStaffForm,
  options?: { overwrite?: boolean }
): Promise<KpiStaffForm> => {
  const sanitized = sanitizeStaffForm(form);
  const docRef = doc(db, STAFF_COLLECTIONS.FORMS, sanitized.id);
  const payload = cleanFirestoreData(sanitized);
  if (options?.overwrite) {
    await setDoc(docRef, payload);
  } else {
    await setDoc(docRef, payload, { merge: true });
  }
  return sanitized;
};

export const saveStaffFormsBatchToFirestore = async (
  forms: KpiStaffForm[],
  options?: { overwrite?: boolean }
): Promise<KpiStaffForm[]> => {
  if (!forms || forms.length === 0) return [];
  const saved = await Promise.all(
    forms.map(f => saveStaffFormToFirestore(f, options))
  );
  return saved;
};

export const deleteStaffFormFromFirestore = async (formId: string): Promise<boolean> => {
  try {
    const docRef = doc(db, STAFF_COLLECTIONS.FORMS, formId);
    await deleteDoc(docRef);

    // Update localStorage cache after successful Firestore deletion
    const currentForms = loadStaffFormsFromCache();
    const remainingForms = currentForms.filter(f => f.id !== formId);
    saveStaffFormsToCache(remainingForms);
    return true;
  } catch (err) {
    console.error('Error deleting staff form from Firestore:', err);
    throw err;
  }
};

export const deleteAllStaffFormsFromFirestore = async (periodId?: string): Promise<number> => {
  try {
    const colRef = collection(db, STAFF_COLLECTIONS.FORMS);
    const snapshotPromise = getDocs(colRef);
    const snapshot = await Promise.race([
      snapshotPromise,
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout fetching forms')), 5000))
    ]).catch(() => null);

    let deletedCount = 0;

    if (snapshot && !snapshot.empty) {
      const deletePromises: Promise<void>[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as KpiStaffForm;
        if (!isActiveStaffKpiForm({ ...data, id: data.id || docSnap.id })) return;
        if (!periodId || periodId === 'all' || data.periodId === periodId) {
          deletePromises.push(
            Promise.race([
              deleteDoc(docSnap.ref),
              new Promise<void>((resolve) => setTimeout(resolve, 5000))
            ]) as Promise<void>
          );
          deletedCount++;
        }
      });

      await Promise.allSettled(deletePromises);
    }

    // Update localStorage cache
    const currentForms = loadStaffFormsFromCache();
    const remainingForms = currentForms.filter(f => periodId && periodId !== 'all' ? f.periodId !== periodId : false);
    saveStaffFormsToCache(remainingForms);

    return deletedCount;
  } catch (err) {
    console.error('Error in deleteAllStaffFormsFromFirestore:', err);
    // Always clear local cache for the scope so UI unblocks
    const currentForms = loadStaffFormsFromCache();
    const remainingForms = currentForms.filter(f => periodId && periodId !== 'all' ? f.periodId !== periodId : false);
    saveStaffFormsToCache(remainingForms);
    return 0;
  }
};

// ===== KPI STAFF PERIODS PERSISTENCE =====

export const mergeWithDefaultStaffPeriods = (customPeriods: KpiStaffPeriod[]): KpiStaffPeriod[] => {
  return ensureCompleteStaffPeriods(customPeriods || [], ['2026–2027']);
};

export const loadStaffPeriodsFromCache = (): KpiStaffPeriod[] => {
  try {
    const raw = localStorage.getItem(STAFF_PERIODS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return mergeWithDefaultStaffPeriods(parsed);
    }
  } catch {
    // Ignore read error
  }
  return ensureCompleteStaffPeriods(DEFAULT_STAFF_PERIODS, ['2026–2027']);
};

export const saveStaffPeriodsToCache = (periods: KpiStaffPeriod[]) => {
  try {
    safeLocalStorageSet(STAFF_PERIODS_CACHE_KEY, JSON.stringify(ensureCompleteStaffPeriods(periods, ['2026–2027'])));
  } catch (err) {
    console.error('Failed saving staff periods to cache:', err);
  }
};

export const saveStaffPeriodToFirestore = async (period: KpiStaffPeriod): Promise<void> => {
  const docRef = doc(db, STAFF_COLLECTIONS.PERIODS, period.id);
  await setDoc(docRef, cleanFirestoreData(period), { merge: true });
};

export const saveStaffPeriodsBatchToFirestore = async (periods: KpiStaffPeriod[]): Promise<void> => {
  if (!periods || periods.length === 0) return;
  await Promise.all(periods.map(p => saveStaffPeriodToFirestore(p)));
};

export const ensureStaffPeriodsInFirestore = async (
  extraAcademicYears: string[] = []
): Promise<KpiStaffPeriod[]> => {
  const colRef = collection(db, STAFF_COLLECTIONS.PERIODS);
  const snapshot = await getDocs(colRef);
  const remotePeriods: KpiStaffPeriod[] = [];
  const existingIds = new Set<string>();

  snapshot.forEach(docSnap => {
    const raw = docSnap.data() as KpiStaffPeriod;
    const withId: KpiStaffPeriod = { ...raw, id: raw.id || docSnap.id };
    remotePeriods.push(withId);
    existingIds.add(withId.id);
  });

  const completePeriods = ensureCompleteStaffPeriods(remotePeriods, [
    '2026–2027',
    ...extraAcademicYears
  ]);

  const missingPeriods = completePeriods.filter(p => !existingIds.has(p.id));
  if (missingPeriods.length > 0) {
    await saveStaffPeriodsBatchToFirestore(missingPeriods);
  }

  saveStaffPeriodsToCache(completePeriods);
  return completePeriods;
};

let hasSyncedDefaultStaffPeriodsToFirestore = false;

export const subscribeStaffPeriods = (callback: (periods: KpiStaffPeriod[]) => void) => {
  callback(loadStaffPeriodsFromCache());
  try {
    const colRef = collection(db, STAFF_COLLECTIONS.PERIODS);
    return onSnapshot(colRef, (snapshot) => {
      const remotePeriods: KpiStaffPeriod[] = [];
      const remoteIds = new Set<string>();
      snapshot.forEach(docSnap => {
        const raw = docSnap.data() as KpiStaffPeriod;
        const withId: KpiStaffPeriod = { ...raw, id: raw.id || docSnap.id };
        remotePeriods.push(withId);
        remoteIds.add(withId.id);
      });
      const merged = mergeWithDefaultStaffPeriods(remotePeriods);
      saveStaffPeriodsToCache(merged);
      callback(merged);

      // Tự động lưu các kỳ chuẩn còn thiếu (gồm Tháng 7/2026 và Tháng 6/2027) vào Firestore 1 lần/phiên
      if (!hasSyncedDefaultStaffPeriodsToFirestore) {
        const missing = merged.filter(p => !remoteIds.has(p.id));
        if (missing.length > 0) {
          hasSyncedDefaultStaffPeriodsToFirestore = true;
          saveStaffPeriodsBatchToFirestore(missing).catch(err => {
            hasSyncedDefaultStaffPeriodsToFirestore = false;
            console.warn('Notice syncing missing staff KPI periods to Firestore:', err);
          });
        } else {
          hasSyncedDefaultStaffPeriodsToFirestore = true;
        }
      }
    }, (err) => {
      console.warn('Firestore subscription warning for staff periods:', err);
      callback(loadStaffPeriodsFromCache());
    });
  } catch (err) {
    console.warn('Firestore subscription fallback for staff periods:', err);
    callback(loadStaffPeriodsFromCache());
    return () => {};
  }
};

export const deleteStaffPeriodFromFirestore = async (periodId: string): Promise<void> => {
  const docRef = doc(db, STAFF_COLLECTIONS.PERIODS, periodId);
  await deleteDoc(docRef);
};
