import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { safeLocalStorageSet } from '../utils/envUtils';
import {
  canAttemptFirestoreRead,
  createCachedSubscriptionChannel,
  reportFirestoreError,
  reportFirestoreSuccess
} from '../utils/firestoreQuotaManager';
import { 
  KpiCbqlPeriod, 
  KpiCbqlCriteriaGroup, 
  KpiCbqlCriterion, 
  KpiCbqlForm, 
  KpiCbqlAssignment, 
  KpiCbqlEvidence, 
  KpiCbqlComment, 
  KpiCbqlAuditLog 
} from '../types/kpiCbql';
import { 
  DEFAULT_CBQL_CRITERIA_GROUPS, 
  DEFAULT_CBQL_CRITERIA, 
  DEFAULT_CBQL_PERIODS 
} from '../lib/kpiCbqlData';

// Firestore collection names
export const CBQL_COLLECTIONS = {
  PERIODS: 'kpi_cbql_periods',
  CRITERIA_GROUPS: 'kpi_cbql_criteria_groups',
  CRITERIA: 'kpi_cbql_criteria',
  FORMS: 'kpi_cbql_forms',
  ASSIGNMENTS: 'kpi_cbql_assignments',
  SCORES: 'kpi_cbql_scores',
  EVIDENCE: 'kpi_cbql_evidence',
  COMMENTS: 'kpi_cbql_comments',
  AUDIT_LOGS: 'kpi_cbql_audit_logs'
} as const;

/**
 * Recursively removes all `undefined` values from an object, array, or nested structure.
 * Guaranteed to prevent Firestore 'Unsupported field value: undefined' errors.
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === undefined) {
    return null as unknown as T;
  }
  if (obj === null) {
    return null as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (value === null) {
          cleaned[key] = null;
        } else if (typeof value === 'object') {
          cleaned[key] = cleanFirestoreData(value);
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned as T;
  }
  return obj;
}

export const removeUndefined = cleanFirestoreData;

const CBQL_SEEDED_KEY = 'thpt_sl_kpi_cbql_seeded_v1';
const CBQL_META_TTL_MS = 10 * 60 * 1000;
const CBQL_DATA_TTL_MS = 3 * 60 * 1000;

/**
 * 1. SEED INITIAL DATA IF FIRESTORE IS EMPTY (guarded by localStorage + limit(1))
 */
export async function seedCbqlInitialDataIfNeeded() {
  try {
    if (
      typeof window !== 'undefined' &&
      (window.localStorage.getItem(CBQL_SEEDED_KEY) === '1' ||
        window.sessionStorage.getItem(CBQL_SEEDED_KEY) === '1')
    ) {
      return;
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage?.setItem(CBQL_SEEDED_KEY, '1');
    }
  } catch {
    // ignore
  }
  if (!canAttemptFirestoreRead()) return;

  try {
    const groupsSnap = await getDocs(query(collection(db, CBQL_COLLECTIONS.CRITERIA_GROUPS), limit(1)));
    if (groupsSnap.empty) {
      for (const group of DEFAULT_CBQL_CRITERIA_GROUPS) {
        await setDoc(doc(db, CBQL_COLLECTIONS.CRITERIA_GROUPS, group.id), cleanFirestoreData(group));
      }
    }

    const criteriaSnap = await getDocs(query(collection(db, CBQL_COLLECTIONS.CRITERIA), limit(1)));
    if (criteriaSnap.empty) {
      for (const criterion of DEFAULT_CBQL_CRITERIA) {
        await setDoc(doc(db, CBQL_COLLECTIONS.CRITERIA, criterion.id), cleanFirestoreData(criterion));
      }
    }

    const periodsSnap = await getDocs(query(collection(db, CBQL_COLLECTIONS.PERIODS), limit(1)));
    if (periodsSnap.empty) {
      for (const period of DEFAULT_CBQL_PERIODS) {
        await setDoc(doc(db, CBQL_COLLECTIONS.PERIODS, period.id), cleanFirestoreData(period));
      }
    }

    reportFirestoreSuccess();
    safeLocalStorageSet(CBQL_SEEDED_KEY, '1');
  } catch (err) {
    reportFirestoreError(err, 'kpiCbql:seed');
    console.warn('Error during seeding initial CBQL data:', err);
  }
}

// Local storage cache for CBQL forms
const CBQL_FORMS_CACHE_KEY = 'kpi_cbql_forms_cache';

const getCbqlFormsCache = (): KpiCbqlForm[] => {
  try {
    const raw = localStorage.getItem(CBQL_FORMS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Error reading CBQL forms cache:', err);
    return [];
  }
};

const saveCbqlFormsCache = (forms: KpiCbqlForm[]) => {
  try {
    safeLocalStorageSet(CBQL_FORMS_CACHE_KEY, JSON.stringify(forms));
  } catch (err) {
    console.warn('Error saving CBQL forms cache:', err);
  }
};

const cbqlPeriodsChannel = createCachedSubscriptionChannel<KpiCbqlPeriod[]>({
  cacheKey: 'kpi_cbql:periods',
  ttlMs: CBQL_META_TTL_MS,
  fetcher: async () => {
    const snapshot = await getDocs(query(collection(db, CBQL_COLLECTIONS.PERIODS)));
    const list: KpiCbqlPeriod[] = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() } as KpiCbqlPeriod);
    });
    const existingIds = new Set(list.map(p => p.id));
    const combined = [...list];
    for (const defP of DEFAULT_CBQL_PERIODS) {
      if (!existingIds.has(defP.id)) combined.push(defP);
    }
    combined.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
    return combined.length > 0 ? combined : DEFAULT_CBQL_PERIODS;
  },
  getFallback: () => DEFAULT_CBQL_PERIODS
});

const cbqlCriteriaChannel = createCachedSubscriptionChannel<KpiCbqlCriterion[]>({
  cacheKey: 'kpi_cbql:criteria',
  ttlMs: CBQL_META_TTL_MS,
  fetcher: async () => {
    const snapshot = await getDocs(query(collection(db, CBQL_COLLECTIONS.CRITERIA)));
    const list: KpiCbqlCriterion[] = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() } as KpiCbqlCriterion);
    });
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    return list.length > 0 ? list : DEFAULT_CBQL_CRITERIA;
  },
  getFallback: () => DEFAULT_CBQL_CRITERIA
});

const cbqlFormsChannel = createCachedSubscriptionChannel<KpiCbqlForm[]>({
  cacheKey: 'kpi_cbql:forms',
  ttlMs: CBQL_DATA_TTL_MS,
  fetcher: async () => {
    const snapshot = await getDocs(query(collection(db, CBQL_COLLECTIONS.FORMS)));
    const firestoreList: KpiCbqlForm[] = [];
    snapshot.forEach(docSnap => {
      firestoreList.push({ id: docSnap.id, ...docSnap.data() } as KpiCbqlForm);
    });
    const currentCached = getCbqlFormsCache();
    const map = new Map<string, KpiCbqlForm>();
    currentCached.forEach(f => map.set(f.id, f));
    firestoreList.forEach(f => map.set(f.id, f));
    const mergedList = Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    saveCbqlFormsCache(mergedList);
    return mergedList;
  },
  getFallback: () => getCbqlFormsCache()
});

const cbqlAuditLogsChannel = createCachedSubscriptionChannel<KpiCbqlAuditLog[]>({
  cacheKey: 'kpi_cbql:audit_logs',
  ttlMs: CBQL_DATA_TTL_MS,
  fetcher: async () => {
    const q = query(
      collection(db, CBQL_COLLECTIONS.AUDIT_LOGS),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    const list: KpiCbqlAuditLog[] = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() } as KpiCbqlAuditLog);
    });
    list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return list;
  },
  getFallback: () => []
});

/**
 * 2. TTL-CACHED SUBSCRIPTION HELPERS
 */
export function subscribeCbqlPeriods(onUpdate: (periods: KpiCbqlPeriod[]) => void): Unsubscribe {
  return cbqlPeriodsChannel.subscribe(onUpdate);
}

export function subscribeCbqlCriteria(onUpdate: (criteria: KpiCbqlCriterion[]) => void): Unsubscribe {
  return cbqlCriteriaChannel.subscribe(onUpdate);
}

export function subscribeCbqlForms(onUpdate: (forms: KpiCbqlForm[]) => void): Unsubscribe {
  return cbqlFormsChannel.subscribe(onUpdate);
}

export function subscribeCbqlAuditLogs(onUpdate: (logs: KpiCbqlAuditLog[]) => void): Unsubscribe {
  return cbqlAuditLogsChannel.subscribe(onUpdate);
}

/**
 * 3. AUDIT LOGGING HELPER
 */
export async function logCbqlAction(
  action: KpiCbqlAuditLog['action'],
  performedBy: string,
  performedByName: string,
  performedByRole: string,
  details: string,
  formId?: string,
  previousStatus?: string,
  newStatus?: string,
  metadata?: Record<string, any>
) {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logEntry: KpiCbqlAuditLog = {
      id: logId,
      formId: formId || undefined,
      action,
      performedBy,
      performedByName,
      performedByRole,
      timestamp: new Date().toISOString(),
      details,
      previousStatus: previousStatus || undefined,
      newStatus: newStatus || undefined,
      metadata: metadata || undefined
    };
    await setDoc(doc(db, CBQL_COLLECTIONS.AUDIT_LOGS, logId), cleanFirestoreData(logEntry));
    cbqlAuditLogsChannel.publish([logEntry, ...(cbqlAuditLogsChannel.getSnapshot() || [])].slice(0, 50));
  } catch (err) {
    console.warn('Could not record CBQL audit log:', err);
  }
}

/**
 * 4. UNIQUE CONSTRAINT CHECK
 * Kiểm tra xem CBQL đã có phiếu trong kỳ đánh giá này chưa
 */
export async function checkCbqlFormExists(evaluateeId: string, periodId: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, CBQL_COLLECTIONS.FORMS),
      where('evaluateeId', '==', evaluateeId),
      where('periodId', '==', periodId)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (err) {
    console.warn('Error checking existing form:', err);
    return false;
  }
}

/**
 * 5. FORM CRUD OPERATIONS
 */

// Tạo phiếu mới
export async function createCbqlForm(
  formData: Omit<KpiCbqlForm, 'id' | 'createdAt'>,
  user: { id: string; name: string; role?: string }
): Promise<string> {
  // Validate unique constraint
  const exists = await checkCbqlFormExists(formData.evaluateeId, formData.periodId);
  if (exists) {
    throw new Error(`Cán bộ quản lý ${formData.evaluateeName} đã có phiếu đánh giá cho ${formData.periodName}. Mỗi cán bộ chỉ được tạo 01 phiếu trong một kỳ!`);
  }

  const formId = `cbql_${formData.periodId}_${formData.evaluateeId}`;
  const now = new Date().toISOString();
  
  const newForm: KpiCbqlForm = {
    ...formData,
    id: formId,
    createdAt: now,
    updatedAt: now
  };

  const safeData = cleanFirestoreData(newForm);
  await setDoc(doc(db, CBQL_COLLECTIONS.FORMS, formId), safeData);

  // Update local cache & active subscribers immediately
  const cachedForms = getCbqlFormsCache();
  const existingIdx = cachedForms.findIndex(f => f.id === formId);
  if (existingIdx >= 0) {
    cachedForms[existingIdx] = newForm;
  } else {
    cachedForms.unshift(newForm);
  }
  saveCbqlFormsCache(cachedForms);
  cbqlFormsChannel.publish(cachedForms);

  // Ghi log
  await logCbqlAction(
    'create_form',
    user.id,
    user.name,
    user.role || 'CBQL',
    `Tạo phiếu đánh giá KPI CBQL cho ${formData.evaluateeName} - Kỳ: ${formData.periodName}`,
    formId,
    undefined,
    formData.status
  );

  return formId;
}

const patchCachedCbqlForm = (formId: string, patch: Partial<KpiCbqlForm>) => {
  const current = cbqlFormsChannel.getSnapshot() || getCbqlFormsCache();
  const next = current.map(f => f.id === formId ? { ...f, ...patch } : f);
  saveCbqlFormsCache(next);
  cbqlFormsChannel.publish(next);
};

// Cập nhật phần tự đánh giá
export async function saveCbqlSelfEvaluation(
  formId: string,
  updates: Partial<KpiCbqlForm>,
  user: { id: string; name: string; role?: string }
) {
  const formRef = doc(db, CBQL_COLLECTIONS.FORMS, formId);
  const now = new Date().toISOString();
  
  const payload = {
    ...updates,
    updatedAt: now
  };

  const safeData = cleanFirestoreData(payload);
  await updateDoc(formRef, safeData);
  patchCachedCbqlForm(formId, payload);

  await logCbqlAction(
    'save_self_evaluation',
    user.id,
    user.name,
    user.role || 'CBQL',
    `Lưu bản tự đánh giá (Điểm tự chấm: ${updates.selfTotalScore ?? 'N/A'})`,
    formId
  );
}

// Gửi phiếu lên cấp trên đánh giá (Chuyển sang pending_evaluation)
export async function submitCbqlForm(
  formId: string,
  updates: Partial<KpiCbqlForm>,
  user: { id: string; name: string; role?: string }
) {
  const formRef = doc(db, CBQL_COLLECTIONS.FORMS, formId);
  const now = new Date().toISOString();
  
  const payload = {
    ...updates,
    status: 'pending_evaluation' as const,
    submittedAt: now,
    updatedAt: now
  };

  const safeData = cleanFirestoreData(payload);
  await updateDoc(formRef, safeData);
  patchCachedCbqlForm(formId, payload);

  await logCbqlAction(
    'submit_form',
    user.id,
    user.name,
    user.role || 'CBQL',
    `Gửi phiếu đánh giá cho thủ trưởng/người đánh giá: ${updates.evaluatorName || 'Cấp trên'} (Điểm tự chấm: ${updates.selfTotalScore ?? 'N/A'})`,
    formId,
    'draft',
    'pending_evaluation'
  );
}

// Thủ trưởng / Người đánh giá chấm điểm
export async function evaluateCbqlForm(
  formId: string,
  updates: Partial<KpiCbqlForm>,
  user: { id: string; name: string; role?: string }
) {
  const formRef = doc(db, CBQL_COLLECTIONS.FORMS, formId);
  const now = new Date().toISOString();
  
  const payload = {
    ...updates,
    status: 'evaluated' as const,
    evaluatedAt: now,
    updatedAt: now
  };

  const safeData = cleanFirestoreData(payload);
  await updateDoc(formRef, safeData);
  patchCachedCbqlForm(formId, payload);

  await logCbqlAction(
    'evaluate',
    user.id,
    user.name,
    user.role || 'Thủ trưởng',
    `Thủ trưởng đánh giá phiếu (Điểm đánh giá: ${updates.evaluatorTotalScore ?? 'N/A'}, Xếp loại: ${updates.grade ?? 'N/A'})`,
    formId,
    'pending_evaluation',
    'evaluated'
  );
}

// Chốt phiếu (Khóa hoàn thành)
export async function lockCbqlForm(
  formId: string,
  user: { id: string; name: string; role?: string }
) {
  const formRef = doc(db, CBQL_COLLECTIONS.FORMS, formId);
  const now = new Date().toISOString();
  
  const payload = {
    status: 'locked' as const,
    lockedAt: now,
    lockedBy: user.name,
    updatedAt: now
  };

  const safeData = cleanFirestoreData(payload);
  await updateDoc(formRef, safeData);
  patchCachedCbqlForm(formId, payload);

  await logCbqlAction(
    'lock_form',
    user.id,
    user.name,
    user.role || 'BGH',
    `Chốt kết quả đánh giá KPI CBQL, khóa phiếu không cho sửa đổi`,
    formId,
    'evaluated',
    'locked'
  );
}

// Mở khóa phiếu (Dành cho Admin / BGH)
export async function unlockCbqlForm(
  formId: string,
  user: { id: string; name: string; role?: string },
  reason?: string
) {
  const formRef = doc(db, CBQL_COLLECTIONS.FORMS, formId);
  const now = new Date().toISOString();
  
  const payload = {
    status: 'evaluated' as const,
    unlockedAt: now,
    unlockedBy: user.name,
    updatedAt: now
  };

  const safeData = cleanFirestoreData(payload);
  await updateDoc(formRef, safeData);
  patchCachedCbqlForm(formId, payload);

  await logCbqlAction(
    'unlock_form',
    user.id,
    user.name,
    user.role || 'Admin',
    `Mở khóa phiếu đánh giá để chỉnh sửa bổ sung. Lý do: ${reason || 'Yêu cầu điều chỉnh'}`,
    formId,
    'locked',
    'evaluated'
  );
}

// Xóa phiếu (Dành cho Admin hoặc bản nháp)
export async function deleteCbqlForm(
  formId: string,
  user: { id: string; name: string; role?: string }
) {
  await deleteDoc(doc(db, CBQL_COLLECTIONS.FORMS, formId));
  const next = (cbqlFormsChannel.getSnapshot() || getCbqlFormsCache()).filter(f => f.id !== formId);
  saveCbqlFormsCache(next);
  cbqlFormsChannel.publish(next);

  await logCbqlAction(
    'delete_form',
    user.id,
    user.name,
    user.role || 'Admin',
    `Xóa phiếu đánh giá ID: ${formId}`,
    formId
  );
}

/**
 * 6. QUẢN LÝ KỲ ĐÁNH GIÁ (PERIODS)
 */
export async function saveCbqlPeriod(
  period: KpiCbqlPeriod,
  user: { id: string; name: string; role?: string }
) {
  const isNew = !period.id;
  const id = period.id || `period_${Date.now()}`;
  const now = new Date().toISOString();
  
  const payload: KpiCbqlPeriod = {
    ...period,
    id,
    createdAt: period.createdAt || now,
    createdBy: period.createdBy || user.id,
    updatedAt: now
  };

  const safeData = cleanFirestoreData(payload);
  await setDoc(doc(db, CBQL_COLLECTIONS.PERIODS, id), safeData);
  cbqlPeriodsChannel.invalidate(true);

  await logCbqlAction(
    'update_period',
    user.id,
    user.name,
    user.role || 'Admin',
    `${isNew ? 'Thêm mới' : 'Cập nhật'} kỳ đánh giá: ${period.name} (${period.academicYear})`,
    undefined
  );
}

export async function deleteCbqlPeriod(
  periodId: string,
  user: { id: string; name: string; role?: string }
) {
  await deleteDoc(doc(db, CBQL_COLLECTIONS.PERIODS, periodId));
  cbqlPeriodsChannel.invalidate(true);

  await logCbqlAction(
    'update_period',
    user.id,
    user.name,
    user.role || 'Admin',
    `Xóa kỳ đánh giá ID: ${periodId}`,
    undefined
  );
}

/**
 * 7. QUẢN LÝ TIÊU CHÍ (CRITERIA)
 */
export async function saveCbqlCriterion(
  criterion: KpiCbqlCriterion,
  user: { id: string; name: string; role?: string }
) {
  const isNew = !criterion.id;
  const id = criterion.id || `cbql_${Date.now()}`;
  
  const safeData = cleanFirestoreData({
    ...criterion,
    id
  });
  await setDoc(doc(db, CBQL_COLLECTIONS.CRITERIA, id), safeData);
  cbqlCriteriaChannel.invalidate(true);

  await logCbqlAction(
    'update_criteria',
    user.id,
    user.name,
    user.role || 'Admin',
    `${isNew ? 'Thêm' : 'Sửa'} tiêu chí ${criterion.code}: ${criterion.name} (Tối đa: ${criterion.maxScore}đ)`
  );
}
