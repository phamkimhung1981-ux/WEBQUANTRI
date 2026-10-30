import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  KpiStaffForm, 
  KpiStaffPeriod, 
  KpiStaffCriterion, 
  KpiStaffCriteriaGroup 
} from '../types/kpiStaff';
import { 
  DEFAULT_STAFF_GROUPS, 
  DEFAULT_STAFF_CRITERIA, 
  DEFAULT_STAFF_PERIODS,
  DEFAULT_STAFF_FALLBACK_FORMS,
  getClassificationByScore
} from '../lib/kpiStaffData';
import { canEditOrDelete, safeLocalStorageSet } from '../utils/envUtils';

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

export const deduplicateStaffForms = (forms: KpiStaffForm[]): KpiStaffForm[] => {
  if (!forms || forms.length === 0) return [];
  const map = new Map<string, KpiStaffForm>();
  const sorted = [...forms].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  
  sorted.forEach(f => {
    const uniqueKey = `${f.employeeId || f.employeeName || 'no_emp'}__${f.periodId || 'no_period'}`;
    const idKey = f.id || uniqueKey;
    if (!map.has(uniqueKey) && !map.has(idKey)) {
      map.set(uniqueKey, f);
    }
  });
  return Array.from(map.values());
};

export const sanitizeStaffForm = (form: KpiStaffForm): KpiStaffForm => {
  if (!form) return form;

  const isLocked = form.status === 'locked' || form.status === 'completed';
  const hasNoManagerEval = form.managerTotalScore === undefined || form.managerTotalScore === null;
  const hasNoTtcmEval = form.ttcmTotalScore === undefined || form.ttcmTotalScore === null;

  // Check if general items are all equal to maxScore (5, 5, 4, 4, 4, 4, 4)
  const allGeneralMax = (form.generalItems || []).length > 0 &&
    form.generalItems.every(item => item.selfScore !== null && item.selfScore !== undefined && Number(item.selfScore) === Number(item.maxScore));

  // Check if position items are all equal to maxScore
  const allPosMax = (form.positionItems || []).length > 0 &&
    form.positionItems.every(item => item.selfScore !== null && item.selfScore !== undefined && Number(item.selfScore) === Number(item.maxScore));

  const isLegacyFullDefault =
    (allGeneralMax && allPosMax) ||
    (form.generalTotalSelf === 30 && form.positionTotalSelf === 70) ||
    ((allGeneralMax || form.generalTotalSelf === 30) && form.totalScore === 100);

  // Bảo toàn 100% điểm số đã đánh giá, tuyệt đối không tự ý đưa điểm 100 về 0

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
    if (Array.isArray(parsed) && parsed.length > 0) {
      return deduplicateStaffForms(parsed.map(sanitizeStaffForm));
    }
  } catch {
    // Ignore read error
  }
  return DEFAULT_STAFF_FALLBACK_FORMS.map(sanitizeStaffForm);
};

export const saveStaffFormsToCache = (forms: KpiStaffForm[]) => {
  try {
    const uniqueForms = deduplicateStaffForms(forms.map(sanitizeStaffForm));
    safeLocalStorageSet(STAFF_FORMS_CACHE_KEY, JSON.stringify(uniqueForms));
  } catch (err) {
    console.error('Failed saving staff forms to localStorage cache:', err);
  }
};

export const subscribeStaffForms = (callback: (forms: KpiStaffForm[]) => void) => {
  // Callback cached immediately
  const initial = loadStaffFormsFromCache();
  if (initial && initial.length > 0) {
    callback(initial);
  }

  try {
    const colRef = collection(db, STAFF_COLLECTIONS.FORMS);
    return onSnapshot(colRef, (snapshot) => {
      const formsList: KpiStaffForm[] = [];
      snapshot.forEach(docSnap => {
        const raw = docSnap.data() as KpiStaffForm;
        const sanitized = sanitizeStaffForm(raw);
        formsList.push(sanitized);
        if (raw.totalScore === 100 && sanitized.totalScore === 0) {
          saveStaffFormToFirestore(sanitized).catch(() => {});
        }
      });
      const combined = formsList.length > 0 ? formsList : DEFAULT_STAFF_FALLBACK_FORMS;
      const uniqueForms = deduplicateStaffForms(combined.map(sanitizeStaffForm));
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

export const saveStaffFormToFirestore = async (form: KpiStaffForm) => {
  try {
    const docRef = doc(db, STAFF_COLLECTIONS.FORMS, form.id);
    await setDoc(docRef, cleanFirestoreData(form), { merge: true });
  } catch (err) {
    console.error('Error saving staff form to Firestore:', err);
  }
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
