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
  getEligibleStaffMembers,
  createInitialStaffForm
} from '../lib/kpiStaffData';

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

export const loadStaffFormsFromCache = (): KpiStaffForm[] => {
  try {
    const raw = localStorage.getItem(STAFF_FORMS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return deduplicateStaffForms(parsed);
  } catch {
    return [];
  }
};

export const saveStaffFormsToCache = (forms: KpiStaffForm[]) => {
  try {
    const uniqueForms = deduplicateStaffForms(forms);
    localStorage.setItem(STAFF_FORMS_CACHE_KEY, JSON.stringify(uniqueForms));
  } catch (err) {
    console.error('Failed saving staff forms to localStorage cache:', err);
  }
};

export const subscribeStaffForms = (callback: (forms: KpiStaffForm[]) => void) => {
  try {
    const colRef = collection(db, STAFF_COLLECTIONS.FORMS);
    return onSnapshot(colRef, async (snapshot) => {
      const firestoreForms: KpiStaffForm[] = [];
      snapshot.forEach(docSnap => {
        firestoreForms.push(docSnap.data() as KpiStaffForm);
      });

      let localForms = loadStaffFormsFromCache();

      // If local cache has more forms than Firestore (e.g. 47 vs 4), automatically sync local forms to Firestore
      if (firestoreForms.length < localForms.length) {
        console.log(`[KPI Staff Sync] Firestore has ${firestoreForms.length} forms, local cache has ${localForms.length}. Syncing all local forms to Firestore...`);
        for (const f of localForms) {
          try {
            const docRef = doc(db, STAFF_COLLECTIONS.FORMS, f.id);
            await setDoc(docRef, cleanFirestoreData(f), { merge: true });
          } catch (e) {
            console.error('Error syncing local form to Firestore:', e);
          }
        }
      }

      let combined = deduplicateStaffForms([...firestoreForms, ...localForms]);

      // If combined forms count is below 40, attempt to auto-generate initial forms for September 2026 from cached teachers
      if (combined.length < 40) {
        try {
          const cachedTeachersRaw = localStorage.getItem('app_cached_teachers');
          if (cachedTeachersRaw) {
            const teachers = JSON.parse(cachedTeachersRaw);
            if (Array.isArray(teachers) && teachers.length > 0) {
              const period = DEFAULT_STAFF_PERIODS.find(p => p.id === 'period_staff_m09_2026') || DEFAULT_STAFF_PERIODS[0];
              const eligible = getEligibleStaffMembers(teachers);
              const generated = eligible.map(t => createInitialStaffForm(t, period));
              if (generated.length > 0) {
                combined = deduplicateStaffForms([...combined, ...generated]);
                for (const f of generated) {
                  try {
                    const docRef = doc(db, STAFF_COLLECTIONS.FORMS, f.id);
                    await setDoc(docRef, cleanFirestoreData(f), { merge: true });
                  } catch (e) {}
                }
              }
            }
          }
        } catch (genErr) {
          console.warn('Error auto-generating staff KPI forms:', genErr);
        }
      }

      saveStaffFormsToCache(combined);
      callback(combined);
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

    // Update localStorage cache immediately
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
    const snapshot = await getDocs(colRef);
    let deletedCount = 0;

    const deletePromises: Promise<void>[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as KpiStaffForm;
      if (!periodId || periodId === 'all' || data.periodId === periodId) {
        deletePromises.push(deleteDoc(docSnap.ref));
        deletedCount++;
      }
    });

    await Promise.all(deletePromises);

    // Update localStorage cache
    const currentForms = loadStaffFormsFromCache();
    const remainingForms = currentForms.filter(f => periodId && periodId !== 'all' ? f.periodId !== periodId : false);
    saveStaffFormsToCache(remainingForms);

    return deletedCount;
  } catch (err) {
    console.error('Error deleting all staff forms from Firestore:', err);
    return 0;
  }
};
