import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  where 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  KpiVcForm, 
  KpiVcPeriod, 
  KpiVcCriterion, 
  KpiVcCriteriaGroup, 
  KpiVcAuditLog,
  KpiVcRatingConfig,
  KpiVcRatingTier,
  KpiVcRatingConfigHistory
} from '../types/kpiVc';
import { 
  DEFAULT_VC_GROUPS, 
  DEFAULT_VC_CRITERIA, 
  DEFAULT_VC_PERIODS,
  DEFAULT_VC_RATING_TIERS,
  DEFAULT_VC_FALLBACK_FORMS
} from '../lib/kpiVcData';
import { canEditOrDelete, safeLocalStorageSet } from '../utils/envUtils';

/**
 * Hàm làm sạch dữ liệu Firestore (lọc sạch undefined và NaN ở mọi cấp độ)
 * TUYỆT ĐỐI KHÔNG GHI undefined VÀO FIRESTORE!
 */
export const cleanFirestoreData = <T extends Record<string, any>>(data: T): Record<string, any> => {
  const cleanDeep = (val: any): any => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    if (typeof val === 'number') {
      return Number.isNaN(val) ? 0 : val;
    }
    if (Array.isArray(val)) {
      return val
        .map(cleanDeep)
        .filter(item => item !== undefined);
    }
    if (typeof val === 'object' && !(val instanceof Date)) {
      const cleanedObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        if (v !== undefined) {
          const cv = cleanDeep(v);
          if (cv !== undefined) {
            cleanedObj[k] = cv;
          }
        }
      }
      return cleanedObj;
    }
    return val;
  };
  return (cleanDeep(data) || {}) as Record<string, any>;
};

// Collection references
export const VC_COLLECTIONS = {
  FORMS: 'kpi_vc_forms',
  PERIODS: 'kpi_vc_periods',
  CRITERIA: 'kpi_vc_criteria',
  GROUPS: 'kpi_vc_groups',
  AUDIT_LOGS: 'kpi_vc_audit_logs',
  RATING_CONFIGS: 'kpi_vc_rating_configs',
  RATING_CONFIG_HISTORY: 'kpi_vc_rating_config_history'
};

/**
 * Tự động khởi tạo dữ liệu mẫu nếu chưa có (Không ghi đè dữ liệu đang có)
 */
export const seedVcInitialDataIfNeeded = async () => {
  try {
    // 1. Groups - Upsert standard groups
    for (const grp of DEFAULT_VC_GROUPS) {
      await setDoc(doc(db, VC_COLLECTIONS.GROUPS, grp.id), cleanFirestoreData(grp), { merge: true });
    }

    // 2. Criteria - Ensure all 23 criteria are updated in Firestore
    const criteriaSnap = await getDocs(collection(db, VC_COLLECTIONS.CRITERIA));
    const defaultIds = new Set(DEFAULT_VC_CRITERIA.map(c => c.id));

    for (const crit of DEFAULT_VC_CRITERIA) {
      await setDoc(doc(db, VC_COLLECTIONS.CRITERIA, crit.id), cleanFirestoreData(crit), { merge: true });
    }

    // Clean up outdated criteria documents from earlier schema versions if present
    if (!criteriaSnap.empty) {
      for (const docSnap of criteriaSnap.docs) {
        if (!defaultIds.has(docSnap.id)) {
          await deleteDoc(doc(db, VC_COLLECTIONS.CRITERIA, docSnap.id));
        }
      }
    }

    // 3. Periods
    const periodsSnap = await getDocs(collection(db, VC_COLLECTIONS.PERIODS));
    if (periodsSnap.empty) {
      for (const p of DEFAULT_VC_PERIODS) {
        await setDoc(doc(db, VC_COLLECTIONS.PERIODS, p.id), cleanFirestoreData(p));
      }
    }

    // 4. Forms - Ensure default KPI forms are seeded in Firestore if empty
    const formsSnap = await getDocs(collection(db, VC_COLLECTIONS.FORMS));
    if (formsSnap.empty) {
      for (const form of DEFAULT_VC_FALLBACK_FORMS) {
        await setDoc(doc(db, VC_COLLECTIONS.FORMS, form.id), cleanFirestoreData(form), { merge: true });
      }
    }
  } catch (error) {
    console.error('Error seeding initial VC KPI data:', error);
  }
};

// Local Storage Cache Helpers
const VC_FORMS_CACHE_KEY = 'kpi_vc_forms_cache';

export const deduplicateVcForms = (forms: KpiVcForm[]): KpiVcForm[] => {
  if (!forms || forms.length === 0) return [];
  const map = new Map<string, KpiVcForm>();
  const sorted = [...forms].sort((a, b) => {
    const scoreA = Number(a.totalScore || 0);
    const scoreB = Number(b.totalScore || 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
  });
  
  sorted.forEach(f => {
    const canonicalKey = `${f.employeeId || f.employeeName || 'no_emp'}__${f.periodId || 'no_period'}`;
    if (!map.has(canonicalKey)) {
      map.set(canonicalKey, f);
    } else {
      const existing = map.get(canonicalKey)!;
      const existingHasScore = (existing.totalScore || 0) > 0;
      const currentHasScore = (f.totalScore || 0) > 0;
      if (currentHasScore && !existingHasScore) {
        map.set(canonicalKey, f);
      } else {
        const existingIsCanonicalId = existing.id && existing.id.startsWith('vc_');
        const currentIsCanonicalId = f.id && f.id.startsWith('vc_');
        if (currentIsCanonicalId && !existingIsCanonicalId) {
          map.set(canonicalKey, f);
        }
      }
    }
  });
  return Array.from(map.values());
};

const getVcFormsCache = (): KpiVcForm[] => {
  try {
    const raw = localStorage.getItem(VC_FORMS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length >= 40) {
      return deduplicateVcForms(parsed);
    }
  } catch (err) {
    console.warn('Error reading VC forms cache:', err);
  }
  return DEFAULT_VC_FALLBACK_FORMS;
};

const saveVcFormsCache = (forms: KpiVcForm[]) => {
  try {
    const uniqueForms = deduplicateVcForms(forms);
    safeLocalStorageSet(VC_FORMS_CACHE_KEY, JSON.stringify(uniqueForms));
  } catch (err) {
    console.warn('Error saving VC forms cache:', err);
  }
};

/**
 * Lắng nghe danh sách Phiếu đánh giá (kpi_vc_forms)
 */
export const subscribeVcForms = (callback: (forms: KpiVcForm[]) => void) => {
  // Load cache or fallback immediately so UI renders instantly with 47 forms
  const cached = getVcFormsCache();
  const initialList = cached && cached.length >= 40 ? cached : DEFAULT_VC_FALLBACK_FORMS;
  callback(initialList);

  const q = query(collection(db, VC_COLLECTIONS.FORMS));
  return onSnapshot(q, async (snapshot) => {
    const firestoreList: KpiVcForm[] = [];
    snapshot.forEach((docSnap) => {
      firestoreList.push({ id: docSnap.id, ...docSnap.data() } as KpiVcForm);
    });

    const currentCached = getVcFormsCache();

    // When Firestore returns data, it is the authoritative source of truth
    let finalList: KpiVcForm[] = firestoreList;
    if (finalList.length === 0 && currentCached.length > 0) {
      finalList = currentCached;
    } else if (finalList.length > 0 && currentCached.length > 0) {
      const firestoreMap = new Map<string, KpiVcForm>();
      firestoreList.forEach(f => firestoreMap.set(`${f.employeeId || f.employeeName}__${f.periodId}`, f));

      currentCached.forEach(cachedForm => {
        const key = `${cachedForm.employeeId || cachedForm.employeeName}__${cachedForm.periodId}`;
        const fsForm = firestoreMap.get(key);
        const cachedScore = Number(cachedForm.totalScore || 0);
        const fsScore = fsForm ? Number(fsForm.totalScore || 0) : 0;

        if (cachedScore > fsScore && fsForm) {
          const merged = { ...fsForm, ...cachedForm };
          firestoreMap.set(key, merged);
          setDoc(doc(db, VC_COLLECTIONS.FORMS, merged.id), cleanFirestoreData(merged), { merge: true }).catch(err => console.warn('Background sync error:', err));
        } else if (!fsForm && cachedScore > 0) {
          firestoreMap.set(key, cachedForm);
          setDoc(doc(db, VC_COLLECTIONS.FORMS, cachedForm.id), cleanFirestoreData(cachedForm), { merge: true }).catch(err => console.warn('Background sync error:', err));
        }
      });
      finalList = Array.from(firestoreMap.values());
    }

    finalList = deduplicateVcForms(finalList);
    finalList.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

    saveVcFormsCache(finalList);
    callback(finalList);
  }, (err) => {
    console.warn('Firestore subscription fallback for VC Forms, using cached data:', err);
    const fallbackList = getVcFormsCache();
    callback(fallbackList);
  });
};

/**
 * Lắng nghe danh sách Kỳ đánh giá (kpi_vc_periods)
 */
export const subscribeVcPeriods = (callback: (periods: KpiVcPeriod[]) => void) => {
  const q = query(collection(db, VC_COLLECTIONS.PERIODS));
  return onSnapshot(q, (snapshot) => {
    const list: KpiVcPeriod[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as KpiVcPeriod);
    });
    
    // Merge DEFAULT_VC_PERIODS to ensure all months (1-12) and semesters are present
    const existingIds = new Set(list.map(p => p.id));
    const combined = [...list];
    for (const defP of DEFAULT_VC_PERIODS) {
      if (!existingIds.has(defP.id)) {
        combined.push(defP);
      }
    }
    
    callback(combined.length > 0 ? combined : DEFAULT_VC_PERIODS);
  }, (err) => {
    console.error('Error subscribing to VC Periods:', err);
    callback(DEFAULT_VC_PERIODS);
  });
};

/**
 * Lắng nghe danh sách Tiêu chí (kpi_vc_criteria)
 */
export const subscribeVcCriteria = (callback: (criteria: KpiVcCriterion[]) => void) => {
  const q = query(collection(db, VC_COLLECTIONS.CRITERIA));
  const defaultMap = new Map(DEFAULT_VC_CRITERIA.map(c => [c.id, c]));

  return onSnapshot(q, (snapshot) => {
    const list: KpiVcCriterion[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as KpiVcCriterion;
      const def = defaultMap.get(docSnap.id);
      // Đồng bộ chuẩn điểm tối đa mục II (kết quả thực hiện nhiệm vụ được giao: 60 điểm)
      const maxScore = def && def.groupId === 'group_III' && def.subGroup === 'B' 
        ? def.maxScore 
        : (typeof data.maxScore === 'number' ? data.maxScore : (def?.maxScore ?? 2));

      list.push({ id: docSnap.id, ...data, maxScore } as KpiVcCriterion);
    });
    list.sort((a, b) => a.order - b.order);
    callback(list.length > 0 ? list : DEFAULT_VC_CRITERIA);
  }, (err) => {
    console.error('Error subscribing to VC Criteria:', err);
    callback(DEFAULT_VC_CRITERIA);
  });
};

/**
 * Lắng nghe danh sách Nhóm tiêu chí (kpi_vc_groups)
 */
export const subscribeVcGroups = (callback: (groups: KpiVcCriteriaGroup[]) => void) => {
  const q = query(collection(db, VC_COLLECTIONS.GROUPS));
  return onSnapshot(q, (snapshot) => {
    const list: KpiVcCriteriaGroup[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as KpiVcCriteriaGroup);
    });
    list.sort((a, b) => a.order - b.order);
    callback(list.length > 0 ? list : DEFAULT_VC_GROUPS);
  }, (err) => {
    console.error('Error subscribing to VC Groups:', err);
    callback(DEFAULT_VC_GROUPS);
  });
};

/**
 * Lắng nghe Audit Logs (kpi_vc_audit_logs)
 */
export const subscribeVcAuditLogs = (callback: (logs: KpiVcAuditLog[]) => void) => {
  const q = query(collection(db, VC_COLLECTIONS.AUDIT_LOGS));
  return onSnapshot(q, (snapshot) => {
    const list: KpiVcAuditLog[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as KpiVcAuditLog);
    });
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    callback(list);
  }, (err) => {
    console.error('Error subscribing to VC Audit Logs:', err);
  });
};

/**
 * Ghi Audit Log
 */
export const addVcAuditLog = async (logData: Omit<KpiVcAuditLog, 'id' | 'timestamp'>) => {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullLog: KpiVcAuditLog = {
      ...logData,
      id: logId,
      timestamp: new Date().toISOString()
    };
    try {
      const cached = localStorage.getItem('kpi_vc_audit_logs_cache');
      const list = cached ? JSON.parse(cached) : [];
      safeLocalStorageSet('kpi_vc_audit_logs_cache', JSON.stringify([fullLog, ...list].slice(0, 100)));
    } catch (e) {}

    await setDoc(doc(db, VC_COLLECTIONS.AUDIT_LOGS, logId), cleanFirestoreData(fullLog));
  } catch (error) {
    console.warn('Notice: Firestore audit log write skipped or deferred:', error);
  }
};

/**
 * TẠO PHIẾU ĐÁNH GIÁ MỚI
 * Ràng buộc: Một người + một kỳ = duy nhất 1 phiếu
 */
export const createVcForm = async (
  formData: Omit<KpiVcForm, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { id: string; name: string; role?: string }
): Promise<string> => {
  // Tạo form ID xác định theo kỳ và nhân viên
  const sanitizedEmployeeId = (formData.employeeId || 'emp').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedPeriodId = (formData.periodId || 'period').replace(/[^a-zA-Z0-9_-]/g, '_');
  const formId = `vc_${sanitizedPeriodId}_${sanitizedEmployeeId}`;

  const docRef = doc(db, VC_COLLECTIONS.FORMS, formId);
  const existing = await getDoc(docRef);

  const now = new Date().toISOString();
  const fullForm: KpiVcForm = {
    ...formData,
    id: formId,
    createdAt: existing.exists() && existing.data()?.createdAt ? existing.data().createdAt : now,
    updatedAt: now,
    createdBy: existing.exists() && existing.data()?.createdBy ? existing.data().createdBy : (actor.name || actor.id),
    updatedBy: actor.name || actor.id
  };

  await setDoc(docRef, cleanFirestoreData(fullForm), { merge: true });

  // Update local cache immediately
  const cachedForms = getVcFormsCache();
  const existingIdx = cachedForms.findIndex(f => f.id === formId);
  if (existingIdx >= 0) {
    cachedForms[existingIdx] = { ...cachedForms[existingIdx], ...fullForm };
  } else {
    cachedForms.unshift(fullForm);
  }
  saveVcFormsCache(cachedForms);

  await addVcAuditLog({
    formId,
    periodId: formData.periodId,
    action: existing.exists() ? 'update_form' : 'create_form',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    targetName: `Phiếu KPI của ${formData.employeeName}`,
    description: `${existing.exists() ? 'Cập nhật' : 'Tạo'} phiếu đánh giá KPI giáo viên/nhân viên: ${formData.employeeName} (${formData.periodName})`
  });

  return formId;
};

/**
 * CẬP NHẬT PHIẾU ĐÁNH GIÁ
 */
export const updateVcForm = async (
  formId: string,
  updateData: Partial<KpiVcForm>,
  actor: { id: string; name: string; role?: string }
): Promise<{ success: boolean; isOfflineQuota?: boolean }> => {
  const docRef = doc(db, VC_COLLECTIONS.FORMS, formId);
  const now = new Date().toISOString();

  // 1. Update local cache immediately so UI is always responsive & data is never lost
  const cachedForms = getVcFormsCache();
  const idx = cachedForms.findIndex(f => f.id === formId);
  let existingData: Partial<KpiVcForm> | undefined = idx >= 0 ? cachedForms[idx] : undefined;

  const payload: Record<string, any> = {
    ...updateData,
    updatedAt: now,
    updatedBy: actor.name || actor.id
  };

  if (idx >= 0) {
    cachedForms[idx] = { ...cachedForms[idx], ...payload };
  } else {
    cachedForms.unshift({ id: formId, ...payload } as KpiVcForm);
  }
  saveVcFormsCache(cachedForms);

  let quotaErrorOccurred = false;

  // 2. Try Firestore write with robust fallback if Quota Exceeded
  try {
    // If cache didn't have existingData, fetch doc
    if (!existingData) {
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          existingData = snap.data() as Partial<KpiVcForm>;
        }
      } catch (err) {}
    }

    await setDoc(docRef, cleanFirestoreData(payload), { merge: true });

    const empName = updateData.employeeName || existingData?.employeeName || formId;
    const pId = updateData.periodId || existingData?.periodId;

    try {
      await addVcAuditLog({
        formId,
        periodId: pId,
        action: 'update_form',
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        targetName: empName,
        description: `Cập nhật phiếu đánh giá KPI: ${empName}`
      });
    } catch (logErr) {}

  } catch (e: any) {
    console.warn('Could not write VC form to Firestore (Quota Exceeded or Network error):', e);
    if (e?.code === 'resource-exhausted' || (e?.message && e.message.toLowerCase().includes('quota'))) {
      quotaErrorOccurred = true;
    }
  }

  return { success: true, isOfflineQuota: quotaErrorOccurred };
};

/**
 * XÓA PHIẾU ĐÁNH GIÁ
 */
export const deleteVcForm = async (
  formId: string,
  actor: { id: string; name: string; role?: string }
) => {
  if (!canEditOrDelete()) {
    throw new Error('Chức năng xóa phiếu KPI hiện không khả dụng.');
  }

  // 1. Trích xuất thông tin giáo viên và kỳ đánh giá để ghi nhận nhật ký đối soát
  const currentForms = getVcFormsCache();
  const formToDelete = currentForms.find(f => f.id === formId);
  const employeeName = formToDelete?.employeeName || formId;
  const periodName = formToDelete?.periodName || 'Kỳ đánh giá';

  // 2. Xóa khỏi Firestore nếu kết nối được
  try {
    const docRef = doc(db, VC_COLLECTIONS.FORMS, formId);
    await deleteDoc(docRef);
  } catch (fsErr) {
    console.warn('Lưu ý: Firestore delete gặp lỗi hoặc vượt hạn mức (tiếp tục xóa trên bộ nhớ cục bộ):', fsErr);
  }

  // 3. Xóa chính xác phiếu theo ID khỏi bộ nhớ đệm (Local Cache) ngay lập tức
  const remainingForms = currentForms.filter(f => f.id !== formId);
  saveVcFormsCache(remainingForms);

  // 4. Lưu lịch sử thao tác xóa (người xóa, thời gian xóa, tên giáo viên, kỳ đánh giá)
  try {
    await addVcAuditLog({
      formId,
      action: 'delete_form',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetName: `${employeeName} - ${periodName}`,
      description: `Đã xóa phiếu đánh giá KPI của giáo viên: ${employeeName} (Kỳ: ${periodName})`
    });
  } catch (auditErr) {
    console.warn('Lỗi ghi audit log (bỏ qua để không chặn xóa):', auditErr);
  }
};

/**
 * XÓA HÀNG LOẠT PHIẾU ĐÁNH GIÁ (BULK DELETE)
 */
export const bulkDeleteVcForms = async (
  formIds: string[],
  actor: { id: string; name: string; role?: string },
  filterInfo?: { periodName?: string; deptName?: string }
) => {
  if (!canEditOrDelete()) {
    throw new Error('Chức năng xóa phiếu KPI đã bị vô hiệu hóa trên môi trường Production.');
  }
  if (!formIds || formIds.length === 0) return;
  console.log(`[KPI Delete] Starting bulk delete of ${formIds.length} forms...`);

  const formIdSet = new Set(formIds);
  const chunkSize = 10;

  for (let i = 0; i < formIds.length; i += chunkSize) {
    const chunk = formIds.slice(i, i + chunkSize);
    console.log(`[KPI Delete] Processing chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(formIds.length / chunkSize)} (${chunk.length} items)...`);
    
    const deletePromises = chunk.map(async (id) => {
      try {
        const docRef = doc(db, VC_COLLECTIONS.FORMS, id);
        await Promise.race([
          deleteDoc(docRef),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Delete timeout')), 6000))
        ]);
      } catch (err) {
        console.warn(`[KPI Delete] Warning deleting form ${id} (continuing):`, err);
      }
    });

    try {
      await Promise.all(deletePromises);
    } catch (chunkErr) {
      console.warn('[KPI Delete] Chunk delete warning:', chunkErr);
    }
  }

  console.log('[KPI Delete] Firestore deletions complete. Updating local cache...');
  // Update local cache immediately
  const cachedForms = getVcFormsCache().filter(f => !formIdSet.has(f.id));
  saveVcFormsCache(cachedForms);

  const contextStr = [
    filterInfo?.periodName ? `Kỳ: ${filterInfo.periodName}` : null,
    filterInfo?.deptName ? `Đơn vị: ${filterInfo.deptName}` : null
  ].filter(Boolean).join(' | ');

  try {
    await addVcAuditLog({
      action: 'bulk_delete_forms',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetName: `${formIds.length} phiếu KPI`,
      description: `Xóa hàng loạt ${formIds.length} phiếu đánh giá KPI. Người thực hiện: ${actor.name}${contextStr ? ` (${contextStr})` : ''}`
    });
  } catch (e) {
    console.warn('Audit log write error during bulk delete:', e);
  }

  console.log('[KPI Delete] Bulk delete completed successfully.');
};

/**
 * KHÓA / MỞ KHÓA PHIẾU ĐÁNH GIÁ
 */
export const toggleLockVcForm = async (
  formId: string,
  lock: boolean,
  actor: { id: string; name: string; role?: string }
) => {
  const docRef = doc(db, VC_COLLECTIONS.FORMS, formId);
  const now = new Date().toISOString();

  const payload: Partial<KpiVcForm> = {
    status: lock ? 'locked' : 'completed',
    lockedAt: lock ? now : null,
    lockedBy: lock ? actor.name : null,
    updatedAt: now,
    updatedBy: actor.name
  };

  await updateDoc(docRef, cleanFirestoreData(payload));

  await addVcAuditLog({
    formId,
    action: lock ? 'lock_form' : 'unlock_form',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    targetName: formId,
    description: `${lock ? 'Khóa' : 'Mở khóa'} phiếu đánh giá KPI: ${formId}`
  });
};

// ==========================================
// QUẢN LÝ TIÊU CHÍ (CRITERIA MANAGEMENT)
// ==========================================

/**
 * THÊM TIÊU CHÍ MỚI
 */
export const createVcCriterion = async (
  criterionData: Omit<KpiVcCriterion, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { id: string; name: string; role?: string }
): Promise<string> => {
  const critId = criterionData.code ? `crit_${criterionData.code.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now().toString(36)}` : `crit_${Date.now()}`;
  const now = new Date().toISOString();

  const fullCrit: KpiVcCriterion = {
    ...criterionData,
    id: critId,
    createdAt: now,
    updatedAt: now
  };

  await setDoc(doc(db, VC_COLLECTIONS.CRITERIA, critId), cleanFirestoreData(fullCrit));

  await addVcAuditLog({
    criterionId: critId,
    action: 'create_criterion',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    targetName: criterionData.content.substring(0, 40),
    description: `Thêm tiêu chí KPI mới [${criterionData.code}]: ${criterionData.content.substring(0, 50)}...`
  });

  return critId;
};

/**
 * CẬP NHẬT TIÊU CHÍ
 */
export const updateVcCriterion = async (
  critId: string,
  updateData: Partial<KpiVcCriterion>,
  actor: { id: string; name: string; role?: string }
) => {
  const docRef = doc(db, VC_COLLECTIONS.CRITERIA, critId);
  const now = new Date().toISOString();

  const payload: Record<string, any> = {
    ...updateData,
    updatedAt: now
  };

  await updateDoc(docRef, cleanFirestoreData(payload));

  await addVcAuditLog({
    criterionId: critId,
    action: 'update_criterion',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    targetName: updateData.code || critId,
    description: `Chỉnh sửa tiêu chí KPI: ${updateData.code || critId}`
  });
};

/**
 * SOFT DELETE TIÊU CHÍ (isActive = false)
 * Không xóa cứng để đảm bảo phiếu cũ không bị lỗi!
 */
export const toggleActiveVcCriterion = async (
  critId: string,
  isActive: boolean,
  actor: { id: string; name: string; role?: string }
) => {
  const docRef = doc(db, VC_COLLECTIONS.CRITERIA, critId);
  const now = new Date().toISOString();

  await updateDoc(docRef, cleanFirestoreData({
    isActive,
    updatedAt: now
  }));

  await addVcAuditLog({
    criterionId: critId,
    action: 'delete_criterion',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    targetName: critId,
    description: `${isActive ? 'Kích hoạt lại' : 'Ngừng sử dụng'} tiêu chí KPI: ${critId}`
  });
};

// ==========================================
// QUẢN LÝ KỲ ĐÁNH GIÁ (PERIODS MANAGEMENT)
// ==========================================

export const createVcPeriod = async (
  periodData: Omit<KpiVcPeriod, 'id' | 'createdAt'>,
  actor: { id: string; name: string; role?: string }
): Promise<string> => {
  const periodId = `vc_period_${Date.now()}`;
  const now = new Date().toISOString();

  const fullPeriod: KpiVcPeriod = {
    ...periodData,
    id: periodId,
    createdAt: now
  };

  await setDoc(doc(db, VC_COLLECTIONS.PERIODS, periodId), cleanFirestoreData(fullPeriod));

  await addVcAuditLog({
    periodId,
    action: 'create_period',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    targetName: periodData.name,
    description: `Thêm kỳ đánh giá KPI: ${periodData.name} (${periodData.academicYear})`
  });

  return periodId;
};

export const updateVcPeriod = async (
  periodId: string,
  updateData: Partial<KpiVcPeriod>,
  actor: { id: string; name: string; role?: string }
) => {
  const docRef = doc(db, VC_COLLECTIONS.PERIODS, periodId);
  await updateDoc(docRef, cleanFirestoreData(updateData));

  await addVcAuditLog({
    periodId,
    action: 'update_period',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    targetName: updateData.name || periodId,
    description: `Cập nhật kỳ đánh giá KPI: ${updateData.name || periodId}`
  });
};

export const createVcGroup = async (
  groupData: Omit<KpiVcCriteriaGroup, 'id'>,
  actor: { id: string; name: string; role?: string }
): Promise<string> => {
  const grpId = groupData.code ? `group_${groupData.code}` : `group_${Date.now()}`;
  await setDoc(doc(db, VC_COLLECTIONS.GROUPS, grpId), cleanFirestoreData({ ...groupData, id: grpId }));
  return grpId;
};

export const updateVcGroup = async (
  groupId: string,
  updateData: Partial<KpiVcCriteriaGroup>,
  actor: { id: string; name: string; role?: string }
) => {
  const docRef = doc(db, VC_COLLECTIONS.GROUPS, groupId);
  await updateDoc(docRef, cleanFirestoreData(updateData));
};

// ==========================================
// QUẢN LÝ CẤU HÌNH ĐIỂM XẾP LOẠI (RATING CONFIGS)
// ==========================================

const VC_RATING_CONFIGS_CACHE_KEY = 'kpi_vc_rating_configs_cache';

const getVcRatingConfigsCache = (): KpiVcRatingConfig[] => {
  try {
    const raw = localStorage.getItem(VC_RATING_CONFIGS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Error reading VC rating configs cache:', err);
    return [];
  }
};

const saveVcRatingConfigsCache = (configs: KpiVcRatingConfig[]) => {
  try {
    localStorage.setItem(VC_RATING_CONFIGS_CACHE_KEY, JSON.stringify(configs));
  } catch (err) {
    console.warn('Error saving VC rating configs cache:', err);
  }
};

/**
 * Lắng nghe danh sách Cấu hình xếp loại (kpi_vc_rating_configs)
 */
export const subscribeVcRatingConfigs = (callback: (configs: KpiVcRatingConfig[]) => void) => {
  const cached = getVcRatingConfigsCache();
  if (cached.length > 0) {
    callback(cached);
  }

  const q = query(collection(db, VC_COLLECTIONS.RATING_CONFIGS));
  return onSnapshot(q, (snapshot) => {
    const list: KpiVcRatingConfig[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as KpiVcRatingConfig);
    });

    // Nếu chưa có cấu hình nào trong Firestore, tạo cấu hình mặc định toàn trường
    if (list.length === 0) {
      const defaultGlobalConfig: KpiVcRatingConfig = {
        id: 'vc_rating_default',
        periodId: 'all',
        periodName: 'Mặc định toàn trường',
        scaleMaxScore: 100,
        tiers: DEFAULT_VC_RATING_TIERS,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        note: 'Cấu hình xếp loại 4 mức mặc định của nhà trường'
      };
      saveVcRatingConfigsCache([defaultGlobalConfig]);
      callback([defaultGlobalConfig]);
      return;
    }

    saveVcRatingConfigsCache(list);
    callback(list);
  }, (err) => {
    console.error('Error subscribing to VC rating configs:', err);
    const fallbackList = getVcRatingConfigsCache();
    if (fallbackList.length > 0) {
      callback(fallbackList);
    } else {
      callback([{
        id: 'vc_rating_default',
        periodId: 'all',
        periodName: 'Mặc định toàn trường',
        scaleMaxScore: 100,
        tiers: DEFAULT_VC_RATING_TIERS,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]);
    }
  });
};

/**
 * Lắng nghe Lịch sử thay đổi cấu hình xếp loại (kpi_vc_rating_config_history)
 */
export const subscribeVcRatingConfigHistory = (callback: (history: KpiVcRatingConfigHistory[]) => void) => {
  const q = query(collection(db, VC_COLLECTIONS.RATING_CONFIG_HISTORY));
  return onSnapshot(q, (snapshot) => {
    const list: KpiVcRatingConfigHistory[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as KpiVcRatingConfigHistory);
    });
    list.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
    callback(list);
  }, (err) => {
    console.error('Error subscribing to VC rating config history:', err);
  });
};

/**
 * Lưu / Cập nhật cấu hình điểm xếp loại KPI
 */
export const saveVcRatingConfig = async (
  config: KpiVcRatingConfig,
  actor: { id: string; name: string; role?: string },
  previousTiers?: KpiVcRatingTier[] | null,
  note?: string
): Promise<string> => {
  const sanitizedPeriodId = (config.periodId || 'all').replace(/[^a-zA-Z0-9_-]/g, '_');
  const configId = config.id || `vc_rating_${sanitizedPeriodId}`;
  const now = new Date().toISOString();

  const docRef = doc(db, VC_COLLECTIONS.RATING_CONFIGS, configId);
  const existing = await getDoc(docRef);

  const fullConfig: KpiVcRatingConfig = {
    ...config,
    id: configId,
    scaleMaxScore: 100,
    createdAt: existing.exists() && existing.data()?.createdAt ? existing.data().createdAt : now,
    createdBy: existing.exists() && existing.data()?.createdBy ? existing.data().createdBy : (actor.name || actor.id),
    updatedAt: now,
    updatedBy: actor.name || actor.id
  };

  await setDoc(docRef, cleanFirestoreData(fullConfig), { merge: true });

  // Update local cache
  const cachedConfigs = getVcRatingConfigsCache();
  const idx = cachedConfigs.findIndex(c => c.id === configId);
  if (idx >= 0) {
    cachedConfigs[idx] = fullConfig;
  } else {
    cachedConfigs.push(fullConfig);
  }
  saveVcRatingConfigsCache(cachedConfigs);

  // Ghi Lịch sử cấu hình
  const historyId = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const historyItem: KpiVcRatingConfigHistory = {
    id: historyId,
    configId,
    periodId: config.periodId,
    periodName: config.periodName || (config.periodId === 'all' ? 'Mặc định toàn trường' : config.periodId),
    changedBy: actor.id,
    changedByName: actor.name,
    changedAt: now,
    action: existing.exists() ? 'update' : 'create',
    tiers: config.tiers,
    note: note || (existing.exists() ? 'Cập nhật cấu hình xếp loại' : 'Tạo mới cấu hình xếp loại')
  };

  await setDoc(doc(db, VC_COLLECTIONS.RATING_CONFIG_HISTORY, historyId), cleanFirestoreData(historyItem));

  // Ghi Audit Log chung
  await addVcAuditLog({
    action: 'update_criterion' as any,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    targetName: config.periodName || config.periodId,
    description: `Cấu hình điểm xếp loại KPI: ${config.tiers.length} mức (${config.periodName || config.periodId})`
  });

  return configId;
};

/**
 * Khôi phục cấu hình xếp loại về mặc định
 */
export const restoreDefaultVcRatingConfig = async (
  periodId: string,
  actor: { id: string; name: string; role?: string },
  periodName?: string
): Promise<void> => {
  const sanitizedPeriodId = (periodId || 'all').replace(/[^a-zA-Z0-9_-]/g, '_');
  const configId = `vc_rating_${sanitizedPeriodId}`;
  const now = new Date().toISOString();

  const restoredConfig: KpiVcRatingConfig = {
    id: configId,
    periodId,
    periodName: periodName || (periodId === 'all' ? 'Mặc định toàn trường' : periodId),
    scaleMaxScore: 100,
    tiers: DEFAULT_VC_RATING_TIERS,
    isLockedWhenPeriodCompleted: false,
    isActive: true,
    createdAt: now,
    createdBy: actor.name || actor.id,
    updatedAt: now,
    updatedBy: actor.name || actor.id,
    note: 'Khôi phục về 4 mức xếp loại mặc định'
  };

  const docRef = doc(db, VC_COLLECTIONS.RATING_CONFIGS, configId);
  await setDoc(docRef, cleanFirestoreData(restoredConfig), { merge: true });

  // Update local cache
  const cached = getVcRatingConfigsCache().filter(c => c.id !== configId);
  cached.push(restoredConfig);
  saveVcRatingConfigsCache(cached);

  // History log
  const historyId = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await setDoc(doc(db, VC_COLLECTIONS.RATING_CONFIG_HISTORY, historyId), cleanFirestoreData({
    id: historyId,
    configId,
    periodId,
    periodName: restoredConfig.periodName,
    changedBy: actor.id,
    changedByName: actor.name,
    changedAt: now,
    action: 'restore_default',
    tiers: DEFAULT_VC_RATING_TIERS,
    note: 'Khôi phục về cấu hình xếp loại mặc định ban đầu'
  }));
};

/**
 * Sao chép cấu hình xếp loại từ một kỳ khác
 */
export const copyVcRatingConfig = async (
  fromPeriodId: string,
  toPeriodId: string,
  toPeriodName: string,
  actor: { id: string; name: string; role?: string }
): Promise<void> => {
  const cached = getVcRatingConfigsCache();
  const sourceConfig = cached.find(c => c.periodId === fromPeriodId) || {
    tiers: DEFAULT_VC_RATING_TIERS,
    scaleMaxScore: 100
  };

  const newConfig: KpiVcRatingConfig = {
    id: `vc_rating_${toPeriodId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    periodId: toPeriodId,
    periodName: toPeriodName,
    scaleMaxScore: 100,
    tiers: JSON.parse(JSON.stringify(sourceConfig.tiers)),
    isActive: true,
    createdBy: actor.name || actor.id,
    createdAt: new Date().toISOString(),
    updatedBy: actor.name || actor.id,
    updatedAt: new Date().toISOString(),
    note: `Sao chép cấu hình từ kỳ: ${fromPeriodId}`
  };

  await saveVcRatingConfig(newConfig, actor, null, `Sao chép cấu hình từ kỳ ${fromPeriodId}`);
};


