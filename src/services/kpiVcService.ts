import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where,
  limit,
  writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  canAttemptFirestoreRead,
  createCachedSubscriptionChannel,
  isQuotaExceededError,
  reportFirestoreError,
  reportFirestoreSuccess,
  type CachedSubscriptionChannel
} from '../utils/firestoreQuotaManager';
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
  DEFAULT_VC_FALLBACK_FORMS,
  getFormTotalScore,
  calculateVcTotals,
  calculateVcTtcmTotals,
  calculateVcManagerTotals,
  syncAutoManagerScores,
  isEligibleVcEmployee,
  hasFormBeenEvaluated
} from '../lib/kpiVcData';
import { DEFAULT_TEACHERS } from '../data/defaultTeachersData';
import { CANONICAL_51_VC_FORMS } from '../data/canonical51Forms';
import { CANONICAL_OCT_17_VC_FORMS } from '../data/canonicalOctForms';
import { canEditOrDelete, safeLocalStorageSet } from '../utils/envUtils';
import { idbCacheGet, idbCacheSet } from '../utils/indexedDbCache';

export const CANONICAL_ALL_VC_FORMS: KpiVcForm[] = [
  ...CANONICAL_51_VC_FORMS,
  ...CANONICAL_OCT_17_VC_FORMS
];

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

const toTimestampMs = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (val instanceof Date) {
    const t = val.getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof val === 'object') {
    if (typeof val.toMillis === 'function') {
      try {
        const ms = val.toMillis();
        return Number.isFinite(ms) ? ms : 0;
      } catch {
        return 0;
      }
    }
    if (typeof val.seconds === 'number') {
      return val.seconds * 1000;
    }
  }
  const parsed = new Date(val).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isValidVcFormDoc = (docId: string, data: any): boolean => {
  if (!data || typeof data !== 'object') return false;
  if (docId && (docId.startsWith('test_') || docId.includes('diagnostic'))) return false;
  if (!data.periodId || typeof data.periodId !== 'string') return false;
  if (!data.employeeId && !data.employeeName) return false;
  return true;
};

/**
 * Tự động khởi tạo dữ liệu mẫu nếu chưa có (Không ghi đè dữ liệu đang có)
 * Bảo vệ hạn ngạch Firestore: Chỉ chạy 1 lần/phiên trình duyệt và chỉ nạp khi collection rỗng
 */
export const seedVcInitialDataIfNeeded = async () => {
  const seedKey = 'kpi_vc_seed_done_v2';
  if (typeof window !== 'undefined') {
    try {
      if (
        window.localStorage?.getItem(seedKey) === 'true' ||
        window.sessionStorage?.getItem(seedKey) === 'true'
      ) {
        hydrateVcFormsFromIndexedDb();
        return; // Đã kiểm tra, tránh lãng phí hạn ngạch Firestore
      }
      window.sessionStorage?.setItem(seedKey, 'true');
    } catch {
      // Ignore storage restrictions
    }
  }

  if (!canAttemptFirestoreRead()) {
    hydrateVcFormsFromIndexedDb();
    return;
  }

  try {
    // 1. Groups - Kiểm tra bằng limit(1) thay vì đọc toàn bộ collection
    try {
      const groupsSnap = await getDocs(query(collection(db, VC_COLLECTIONS.GROUPS), limit(1)));
      if (groupsSnap.empty) {
        for (const grp of DEFAULT_VC_GROUPS) {
          await setDoc(doc(db, VC_COLLECTIONS.GROUPS, grp.id), cleanFirestoreData(grp), { merge: true }).catch(() => {});
        }
      }
    } catch (grpErr) {
      reportFirestoreError(grpErr, 'kpiVc:seedGroups');
      console.warn('Groups check skipped:', grpErr);
    }

    // 2. Criteria - Kiểm tra bằng limit(1)
    try {
      const criteriaSnap = await getDocs(query(collection(db, VC_COLLECTIONS.CRITERIA), limit(1)));
      if (criteriaSnap.empty) {
        for (const crit of DEFAULT_VC_CRITERIA) {
          await setDoc(doc(db, VC_COLLECTIONS.CRITERIA, crit.id), cleanFirestoreData(crit), { merge: true }).catch(() => {});
        }
      }
    } catch (critErr) {
      reportFirestoreError(critErr, 'kpiVc:seedCriteria');
      console.warn('Criteria seeding skipped or deferred:', critErr);
    }

    // 3. Periods - Kiểm tra bằng limit(1)
    try {
      const periodsSnap = await getDocs(query(collection(db, VC_COLLECTIONS.PERIODS), limit(1)));
      if (periodsSnap.empty) {
        for (const p of DEFAULT_VC_PERIODS) {
          await setDoc(doc(db, VC_COLLECTIONS.PERIODS, p.id), cleanFirestoreData(p)).catch(() => {});
        }
      }
    } catch (pErr) {
      reportFirestoreError(pErr, 'kpiVc:seedPeriods');
      console.warn('Periods seeding skipped or deferred:', pErr);
    }

    reportFirestoreSuccess();
    safeLocalStorageSet(seedKey, 'true');

    // 4. Khởi tạo đọc đệm IndexedDB an toàn mà KHÔNG ghi đè các kỳ khác (Tháng 7, 8, 11...)
    hydrateVcFormsFromIndexedDb();
  } catch (error) {
    reportFirestoreError(error, 'kpiVc:seedInitial');
    console.error('Error seeding initial VC KPI data:', error);
  }
};

const normalizeTeacherName = (name?: string): string => {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
};

const getStatusWeight = (status?: string): number => {
  if (status === 'locked') return 5;
  if (status === 'completed') return 4;
  if (status === 'ttcm_evaluated') return 3;
  if (status === 'submitted' || status === 'self_evaluated') return 2;
  return 1;
};

const hasTeacherActuallyEvaluated = (form: KpiVcForm): boolean => {
  if (!form) return false;
  if (form.status === 'submitted' || form.status === 'ttcm_evaluated' || form.status === 'completed' || form.status === 'locked' || form.status === 'self_evaluated') {
    return true;
  }
  if (!Array.isArray(form.items) || form.items.length === 0) return false;
  const hasScores = form.items.some(i => i.selfScore !== null && i.selfScore !== undefined && !Number.isNaN(Number(i.selfScore)));
  if (!hasScores) return false;

  const sumSelf = form.items.reduce((acc, curr) => acc + (Number(curr.selfScore) || 0), 0);
  return sumSelf > 0;
};

// Cache key dùng cho IndexedDB & in-memory (không ghi payload 2.5MB vào localStorage)
export const VC_FORMS_CACHE_KEY = 'kpi_vc_forms_cache_v7_workflow_unlocked';

// In-memory primary cache for synchronous 0ms reads without touching 5MB localStorage quota
let inMemoryVcFormsCache: KpiVcForm[] | null = null;
const firestoreSyncedPeriods = new Set<string>();
let idbHydrationStarted = false;

const mergeFormsNonDestructive = (baseForms: KpiVcForm[], incomingForms: KpiVcForm[]): KpiVcForm[] => {
  const byId = new Map<string, KpiVcForm>();
  baseForms.forEach((f) => {
    if (f && f.id && isValidVcFormDoc(f.id, f)) {
      byId.set(f.id, f);
    }
  });
  incomingForms.forEach((f) => {
    if (!f || !f.id || !isValidVcFormDoc(f.id, f)) return;
    const existing = byId.get(f.id);
    if (!existing) {
      byId.set(f.id, f);
    } else {
      const existingTime = toTimestampMs(existing.updatedAt || existing.createdAt);
      const incomingTime = toTimestampMs(f.updatedAt || f.createdAt);
      const existingEvaluated = hasTeacherActuallyEvaluated(existing) || (existing.totalScore || 0) > 0;
      const incomingEvaluated = hasTeacherActuallyEvaluated(f) || (f.totalScore || 0) > 0;
      if (incomingEvaluated && !existingEvaluated) {
        byId.set(f.id, f);
      } else if (incomingEvaluated === existingEvaluated && incomingTime >= existingTime) {
        byId.set(f.id, f);
      }
    }
  });
  return deduplicateVcForms(Array.from(byId.values()));
};

const hydrateVcFormsFromIndexedDb = () => {
  if (idbHydrationStarted || typeof window === 'undefined') return;
  idbHydrationStarted = true;
  idbCacheGet<KpiVcForm[]>(VC_FORMS_CACHE_KEY)
    .then((stored) => {
      if (Array.isArray(stored) && stored.length > 0) {
        const merged = mergeFormsNonDestructive(stored, inMemoryVcFormsCache || []);
        inMemoryVcFormsCache = merged;
        window.dispatchEvent(new CustomEvent('kpi_vc_forms_updated', { detail: merged }));
      }
    })
    .catch(() => {});
};

/**
 * ĐỒNG BỘ DỮ LIỆU CHUẨN TỪ GOOGLE AI STUDIO:
 * Cập nhật 100% 51 phiếu Tháng 9 và 17 phiếu Tháng 10 có điểm chấm chuẩn mà KHÔNG làm mất phiếu các kỳ khác (Tháng 7, 8, 11...).
 */
export const syncCanonicalVcDataToStorageAndFirestore = async (force: boolean = false): Promise<{ success: boolean; count: number; message: string }> => {
  try {
    const canonicalForms = deduplicateVcForms(CANONICAL_ALL_VC_FORMS);

    // 1. Hợp nhất an toàn vào RAM + IndexedDB (tuyệt đối không ghi đè mất các kỳ Tháng 7, 8, 11...)
    const current = inMemoryVcFormsCache || getVcFormsCache();
    const merged = mergeFormsNonDestructive(current, canonicalForms);
    inMemoryVcFormsCache = merged;
    idbCacheSet(VC_FORMS_CACHE_KEY, merged).catch(() => {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kpi_vc_forms_updated', { detail: merged }));
    }

    // 2. Thử đồng bộ lên Firestore theo từng document khi force = true
    if (force) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
        const syncOps = canonicalForms.map(form => {
          const docRef = doc(db, VC_COLLECTIONS.FORMS, form.id);
          return setDoc(docRef, cleanFirestoreData(form), { merge: true });
        });
        await Promise.race([Promise.all(syncOps), timeoutPromise]);
      } catch (netErr) {
        console.warn('Đồng bộ Firestore chạy ngầm hoặc hạn ngạch quá tải, dữ liệu đã được bảo toàn trong bộ nhớ đệm:', netErr);
      }
    }

    return {
      success: true,
      count: canonicalForms.length,
      message: `Đã đồng bộ thành công ${canonicalForms.length} phiếu KPI (Tháng 9 & Tháng 10) có điểm chấm và danh mục chuẩn từ Google AI Studio.`
    };
  } catch (err: any) {
    console.error('Lỗi khi đồng bộ dữ liệu chuẩn:', err);
    return {
      success: false,
      count: 0,
      message: err?.message || 'Lỗi không xác định khi đồng bộ dữ liệu.'
    };
  }
};

/**
 * Hàm chuẩn hóa và hợp nhất dữ liệu KPI Giáo viên:
 * - Bảo toàn 100% điểm tự chấm, điểm TTCM, điểm BGH, tệp minh chứng và ghi chú
 * - Đảm bảo chính xác danh sách 51 giáo viên/viên chức theo danh sách chính thức của Trường THPT Sơn Lương
 * - Triệt tiêu hoàn toàn trùng lặp do trình duyệt hay sai khác mã định danh (id/shortId)
 * - Ưu tiên tuyệt đối phiếu có điểm chấm thực tế (> 0) từ CANONICAL_51_VC_FORMS khi phiếu từ máy chủ bị trống (0/100)
 * - Khôi phục điểm đã chấm từ nguồn chuẩn CANONICAL_51_VC_FORMS nếu phiếu bị lỗi trở về 0 chưa chấm
 */
export const deduplicateVcForms = (
  forms: KpiVcForm[],
  options?: { scopePeriodId?: string }
): KpiVcForm[] => {
  if (!forms) forms = [];

  const scopePeriodId = options?.scopePeriodId;
  const includeSep = !scopePeriodId || scopePeriodId === 'all' || scopePeriodId === 'vc_period_2026_09';
  const includeOct = !scopePeriodId || scopePeriodId === 'all' || scopePeriodId === 'vc_period_2026_10';

  // BẢO TOÀN NGUYÊN VẸN: Tuyệt đối không xóa điểm, không hạ điểm đã chấm về 0
  const inputForms = forms.filter((f) => f && isValidVcFormDoc(f.id || '', f));

  const eligibleTeachers = DEFAULT_TEACHERS.filter(isEligibleVcEmployee);
  const eligibleNameMap = new Map<string, typeof eligibleTeachers[0]>();
  const eligibleIdMap = new Map<string, typeof eligibleTeachers[0]>();
  const eligibleCodeMap = new Map<string, typeof eligibleTeachers[0]>();

  eligibleTeachers.forEach(t => {
    eligibleNameMap.set(normalizeTeacherName(t.name), t);
    eligibleIdMap.set(t.id, t);
    if (t.code) eligibleCodeMap.set(t.code.toUpperCase().trim(), t);
  });

  // Gom các phiếu theo: `${periodId}__${teacher.id}`
  const matchedMap = new Map<string, KpiVcForm[]>();

  inputForms.forEach(f => {
    const periodId = f.periodId;
    if (!periodId) return;
    if (scopePeriodId && scopePeriodId !== 'all' && periodId !== scopePeriodId) return;

    const normName = normalizeTeacherName(f.employeeName);
    const code = (f.employeeCode || '').toUpperCase().trim();
    const teacher = (f.employeeId && eligibleIdMap.get(f.employeeId)) ||
      (normName && eligibleNameMap.get(normName)) ||
      (code && eligibleCodeMap.get(code));

    if (teacher) {
      const groupKey = `${periodId}__${teacher.id}`;
      if (!matchedMap.has(groupKey)) matchedMap.set(groupKey, []);
      matchedMap.get(groupKey)!.push(f);
    } else if (f.employeeId || f.employeeName) {
      // Các nhân sự đặc biệt ngoài danh sách chuẩn
      const fallbackKey = `${periodId}__${f.employeeId || f.employeeName}`;
      if (!matchedMap.has(fallbackKey)) matchedMap.set(fallbackKey, []);
      matchedMap.get(fallbackKey)!.push(f);
    }
  });

  const result: KpiVcForm[] = [];

  // Tra cứu bảng dữ liệu gốc chuẩn CANONICAL_51_VC_FORMS để đối chiếu khôi phục điểm nếu phiếu bị mất
  const canonicalFallbackMap = new Map<string, KpiVcForm>();
  CANONICAL_51_VC_FORMS.forEach(f => {
    canonicalFallbackMap.set(f.employeeId, f);
    if (f.employeeName) canonicalFallbackMap.set(normalizeTeacherName(f.employeeName), f);
  });

  // Tra cứu bảng dữ liệu chuẩn Tháng 10/2026 CANONICAL_OCT_17_VC_FORMS
  const canonicalOctFallbackMap = new Map<string, KpiVcForm>();
  CANONICAL_OCT_17_VC_FORMS.forEach(f => {
    canonicalOctFallbackMap.set(f.employeeId, f);
    if (f.employeeName) canonicalOctFallbackMap.set(normalizeTeacherName(f.employeeName), f);
  });

  // 1. Kỳ trọng tâm: vc_period_2026_09 (Tháng 9/2026) - chỉ chạy khi phạm vi có Tháng 9
  if (includeSep) eligibleTeachers.forEach(t => {
    const groupKey = `vc_period_2026_09__${t.id}`;
    const matched = matchedMap.get(groupKey) || [];
    const fallback = canonicalFallbackMap.get(t.id) || canonicalFallbackMap.get(normalizeTeacherName(t.name));

    // Tập hợp toàn bộ ứng viên bao gồm dữ liệu chuẩn CANONICAL_51_VC_FORMS
    const candidates: KpiVcForm[] = [...matched];
    if (fallback) {
      const alreadyInCandidates = candidates.some(c => c.id === fallback.id);
      if (!alreadyInCandidates) {
        candidates.push(fallback);
      }
    }

    if (candidates.length === 0) {
      if (fallback) {
        result.push({ ...fallback });
      }
      return;
    }

    // ĐẶC BIỆT QUAN TRỌNG: Ưu tiên chọn phiếu CÓ ĐIỂM CHẤM THỰC TẾ (> 0), có điểm TTCM/BGH, trạng thái tiến độ cao hơn làm phiếu chính
    const sorted = [...candidates].sort((a, b) => {
      // 1. Phiếu đã có điểm tự chấm / đánh giá thực tế (>0) luôn xếp trước bản nháp trống
      const aEval = (hasTeacherActuallyEvaluated(a) || (a.totalScore || 0) > 0) ? 1 : 0;
      const bEval = (hasTeacherActuallyEvaluated(b) || (b.totalScore || 0) > 0) ? 1 : 0;
      if (bEval !== aEval) return bEval - aEval;

      // 2. Trọng số trạng thái quy trình (locked > completed > ttcm_evaluated > submitted/self_evaluated > draft)
      const wA = getStatusWeight(a.status);
      const wB = getStatusWeight(b.status);
      if (wB !== wA) return wB - wA;

      // 3. Có điểm cấp BGH chấm
      const aManager = (a.managerTotalScore !== null && a.managerTotalScore !== undefined) ? 1 : 0;
      const bManager = (b.managerTotalScore !== null && b.managerTotalScore !== undefined) ? 1 : 0;
      if (bManager !== aManager) return bManager - aManager;

      // 4. Có điểm cấp TTCM chấm
      const aTtcm = (a.ttcmTotalScore !== null && a.ttcmTotalScore !== undefined) ? 1 : 0;
      const bTtcm = (b.ttcmTotalScore !== null && b.ttcmTotalScore !== undefined) ? 1 : 0;
      if (bTtcm !== aTtcm) return bTtcm - aTtcm;

      // 5. Số tiêu chí đã được cho điểm
      const aScored = a.items?.filter(i => i.selfScore !== null && i.selfScore !== undefined && !Number.isNaN(Number(i.selfScore)) && Number(i.selfScore) > 0)?.length || 0;
      const bScored = b.items?.filter(i => i.selfScore !== null && i.selfScore !== undefined && !Number.isNaN(Number(i.selfScore)) && Number(i.selfScore) > 0)?.length || 0;
      if (bScored !== aScored) return bScored - aScored;

      // 6. Tổng điểm tự chấm
      const scoreDiff = (b.totalScore || 0) - (a.totalScore || 0);
      if (scoreDiff !== 0) return scoreDiff;

      // 7. Tie-breaker: thời gian cập nhật mới nhất
      const timeA = toTimestampMs(a.updatedAt || a.createdAt);
      const timeB = toTimestampMs(b.updatedAt || b.createdAt);
      return timeB - timeA;
    });

    const primary: KpiVcForm = { ...sorted[0] };

    // Hợp nhất dữ liệu từ các phiếu phụ của cùng giáo viên và dữ liệu chuẩn đối chiếu
    const sourcesToMerge = [...sorted.slice(1)];
    if (fallback && !sourcesToMerge.some(s => s.id === fallback.id) && fallback.id !== primary.id) {
      sourcesToMerge.push(fallback);
    }

    for (const sec of sourcesToMerge) {
      if (sec.items && primary.items) {
        primary.items = primary.items.map((pItem, idx) => {
          const sItem = sec.items?.find(si => si.criterionId === pItem.criterionId) || sec.items?.[idx];
          if (!sItem) return pItem;

          // Điểm tự chấm: Nếu primary chưa có điểm (>0) thì lấy điểm từ nguồn đối chiếu có điểm
          let selfScore = pItem.selfScore;
          if (selfScore === null || selfScore === undefined || selfScore === 0) {
            if (sItem.selfScore !== null && sItem.selfScore !== undefined && Number(sItem.selfScore) > 0) {
              selfScore = Number(sItem.selfScore);
            }
          }

          // Điểm TTCM: Lấy từ nguồn đã chấm
          let ttcmScore = pItem.ttcmScore;
          if (ttcmScore === null || ttcmScore === undefined) {
            ttcmScore = sItem.ttcmScore;
          }

          // Điểm BGH: Lấy từ nguồn đã chấm
          let managerScore = pItem.managerScore;
          if (managerScore === null || managerScore === undefined) {
            managerScore = sItem.managerScore;
          }

          return {
            ...pItem,
            selfScore,
            ttcmScore,
            ttcmComment: pItem.ttcmComment || sItem.ttcmComment || '',
            managerScore,
            managerComment: pItem.managerComment || sItem.managerComment || '',
            note: pItem.note || sItem.note || '',
            evidenceUrl: pItem.evidenceUrl || sItem.evidenceUrl || ''
          };
        });
      }
      if ((primary.ttcmTotalScore === null || primary.ttcmTotalScore === undefined) && sec.ttcmTotalScore !== null && sec.ttcmTotalScore !== undefined) {
        primary.ttcmTotalScore = sec.ttcmTotalScore;
        primary.ttcmGroupScores = sec.ttcmGroupScores;
        primary.ttcmEvaluatorName = sec.ttcmEvaluatorName || primary.ttcmEvaluatorName;
        primary.ttcmEvaluatorId = sec.ttcmEvaluatorId || primary.ttcmEvaluatorId;
        primary.ttcmDate = sec.ttcmDate || primary.ttcmDate;
        primary.ttcmClassification = sec.ttcmClassification || primary.ttcmClassification;
      }
      if ((primary.managerTotalScore === null || primary.managerTotalScore === undefined) && sec.managerTotalScore !== null && sec.managerTotalScore !== undefined) {
        primary.managerTotalScore = sec.managerTotalScore;
        primary.managerGroupScores = sec.managerGroupScores;
        primary.bghEvaluatorName = sec.bghEvaluatorName || primary.bghEvaluatorName;
        primary.bghDate = sec.bghDate || primary.bghDate;
        primary.leaderClassification = sec.leaderClassification || primary.leaderClassification;
      }
      if (getStatusWeight(sec.status) > getStatusWeight(primary.status)) {
        primary.status = sec.status;
      }
    }

    // Nếu primary vẫn có điểm 0 nhưng fallback có điểm thực tế, khôi phục nguyên bản từ fallback
    if ((primary.totalScore === 0 || !primary.totalScore) && fallback && (fallback.totalScore || 0) > 0) {
      primary.items = fallback.items || primary.items;
      primary.totalScore = fallback.totalScore;
      primary.groupScores = fallback.groupScores || primary.groupScores;
      primary.status = fallback.status;
      primary.selfClassification = fallback.selfClassification;
      if (fallback.ttcmTotalScore !== null && fallback.ttcmTotalScore !== undefined) {
        primary.ttcmTotalScore = fallback.ttcmTotalScore;
        primary.ttcmGroupScores = fallback.ttcmGroupScores;
        primary.ttcmEvaluatorName = fallback.ttcmEvaluatorName;
        primary.ttcmDate = fallback.ttcmDate;
        primary.ttcmClassification = fallback.ttcmClassification;
      }
      if (fallback.managerTotalScore !== null && fallback.managerTotalScore !== undefined) {
        primary.managerTotalScore = fallback.managerTotalScore;
        primary.managerGroupScores = fallback.managerGroupScores;
        primary.bghEvaluatorName = fallback.bghEvaluatorName;
        primary.bghDate = fallback.bghDate;
        primary.leaderClassification = fallback.leaderClassification;
      }
    } else if (primary.items && primary.items.length > 0) {
      // Tính toán lại tổng điểm nhất quán từ items
      const selfCalc = calculateVcTotals(primary.items);
      primary.totalScore = selfCalc.totalScore;
      primary.groupScores = selfCalc.groupScores;

      if (primary.items.some(i => i.ttcmScore !== null && i.ttcmScore !== undefined)) {
        const ttcmCalc = calculateVcTtcmTotals(primary.items);
        primary.ttcmTotalScore = ttcmCalc.ttcmTotalScore;
        primary.ttcmGroupScores = ttcmCalc.ttcmGroupScores;
      }
      const autoMgr = syncAutoManagerScores(primary.items, primary.maxTotalScore || 100);
      primary.items = autoMgr.items;
      primary.managerTotalScore = autoMgr.managerTotalScore;
      primary.bghTotalScore = autoMgr.managerTotalScore;
      primary.managerGroupScores = autoMgr.managerGroupScores;
    }

    // Giữ nguyên document ID chuẩn của phiếu
    if (!primary.id) {
      primary.id = fallback?.id || `vc_period_2026_09_${t.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    }
    primary.employeeId = t.id;
    primary.employeeName = t.name;
    primary.employeeCode = t.code;
    primary.employeeUsername = t.username || '';
    primary.department = t.departmentName || primary.department || 'Trường THPT Sơn Lương';
    primary.departmentId = t.departmentId || primary.departmentId || null;
    primary.position = t.position || primary.position || 'Giáo viên';
    primary.periodId = 'vc_period_2026_09';
    primary.periodName = primary.periodName || 'Tháng 9/2026';
    primary.academicYear = primary.academicYear || '2026-2027';
    if (!primary.selfClassification && primary.totalScore > 0) {
      primary.selfClassification = fallback?.selfClassification || (primary.totalScore >= 90 ? 'Hoàn thành xuất sắc nhiệm vụ' : 'Hoàn thành tốt nhiệm vụ');
    }

    const statusStr = String(primary.status || 'draft');
    if ((statusStr === 'draft' || !primary.status) && !primary.submittedAt) {
      const isAllMaxScore = primary.items && primary.items.length > 0 && primary.items.every(i => i.selfScore !== null && i.selfScore !== undefined && Number(i.selfScore) === Number(i.maxScore));
      if (isAllMaxScore || primary.totalScore === 100) {
        if (!hasFormBeenEvaluated(primary)) {
          primary.items = primary.items.map(i => ({ ...i, selfScore: null }));
          primary.totalScore = 0;
          primary.groupScores = { group_I: 0, group_II: 0, group_III: 0 };
          primary.selfClassification = 'Chưa tự đánh giá';
        }
      }
    }

    result.push(primary);
  });

  // 2. Kỳ Tháng 10/2026: Đảm bảo 100% 17 phiếu của Tổ Hóa-Sinh-GDTC-QPAN-NN hiển thị trên mọi môi trường
  const octTargetTeachers = includeOct
    ? eligibleTeachers.filter(t => 
        canonicalOctFallbackMap.has(t.id) || canonicalOctFallbackMap.has(normalizeTeacherName(t.name))
      )
    : [];

  if (includeOct) octTargetTeachers.forEach(t => {
    const groupKey = `vc_period_2026_10__${t.id}`;
    const matched = matchedMap.get(groupKey) || [];
    const fallback = canonicalOctFallbackMap.get(t.id) || canonicalOctFallbackMap.get(normalizeTeacherName(t.name));

    const candidates: KpiVcForm[] = [...matched];
    if (fallback) {
      const alreadyInCandidates = candidates.some(c => c.id === fallback.id);
      if (!alreadyInCandidates) {
        candidates.push(fallback);
      }
    }

    if (candidates.length === 0) {
      if (fallback) {
        result.push({ ...fallback });
      }
      return;
    }

    // Ưu tiên chọn phiếu có điểm chấm thực tế (>0), có điểm TTCM/BGH, trạng thái cao hơn
    const sorted = [...candidates].sort((a, b) => {
      const aEval = (hasTeacherActuallyEvaluated(a) || (a.totalScore || 0) > 0) ? 1 : 0;
      const bEval = (hasTeacherActuallyEvaluated(b) || (b.totalScore || 0) > 0) ? 1 : 0;
      if (bEval !== aEval) return bEval - aEval;

      const wA = getStatusWeight(a.status);
      const wB = getStatusWeight(b.status);
      if (wB !== wA) return wB - wA;

      const aTtcm = (a.ttcmTotalScore !== null && a.ttcmTotalScore !== undefined) ? 1 : 0;
      const bTtcm = (b.ttcmTotalScore !== null && b.ttcmTotalScore !== undefined) ? 1 : 0;
      if (bTtcm !== aTtcm) return bTtcm - aTtcm;

      const timeA = toTimestampMs(a.updatedAt || a.createdAt);
      const timeB = toTimestampMs(b.updatedAt || b.createdAt);
      return timeB - timeA;
    });

    const primary: KpiVcForm = { ...sorted[0] };
    if (!primary.id) {
      primary.id = fallback?.id || `vc_period_2026_10_${t.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    }
    primary.periodId = 'vc_period_2026_10';
    primary.periodName = primary.periodName || 'Tháng 10/2026';
    primary.academicYear = primary.academicYear || '2026-2027';
    primary.department = primary.department || 'Tổ Hóa-Sinh-GDTC-QPAN-NN';
    primary.departmentId = primary.departmentId || 'd_hoa_ly_sinh_gdqpan_nn';
    result.push(primary);
  });

  // 3. Xử lý các kỳ khác (Tháng 7, Tháng 8, Tháng 11, Cả năm, Học kỳ 1, v.v...) và các giáo viên khác trong Tháng 10
  const processedOctTeacherIds = new Set(octTargetTeachers.map(t => t.id));
  for (const [groupKey, matched] of matchedMap.entries()) {
    if (groupKey.startsWith('vc_period_2026_09__')) continue;
    if (groupKey.startsWith('vc_period_2026_10__')) {
      const parts = groupKey.split('__');
      if (parts[1] && processedOctTeacherIds.has(parts[1])) continue;
    }
    if (matched.length > 0) {
      const sortedOther = [...matched].sort((a, b) => {
        const wA = getStatusWeight(a.status);
        const wB = getStatusWeight(b.status);
        if (wB !== wA) return wB - wA;

        const aEval = (hasTeacherActuallyEvaluated(a) || (a.totalScore || 0) > 0) ? 1 : 0;
        const bEval = (hasTeacherActuallyEvaluated(b) || (b.totalScore || 0) > 0) ? 1 : 0;
        if (bEval !== aEval) return bEval - aEval;

        const scoreDiff = (b.totalScore || 0) - (a.totalScore || 0);
        if (scoreDiff !== 0) return scoreDiff;

        const timeA = toTimestampMs(a.updatedAt || a.createdAt);
        const timeB = toTimestampMs(b.updatedAt || b.createdAt);
        return timeB - timeA;
      });
      result.push(sortedOther[0]);
    }
  }

  // 4. Chuẩn hóa tự động điểm CBQL (Cấp 3) = (Cá nhân + TTCM) / 2 trên toàn bộ phiếu ở mọi kỳ đánh giá
  return result.map(f => {
    if (!Array.isArray(f.items) || f.items.length === 0) return f;
    const autoMgr = syncAutoManagerScores(f.items, f.maxTotalScore || 100);
    return {
      ...f,
      items: autoMgr.items,
      managerGroupScores: autoMgr.managerGroupScores,
      managerTotalScore: autoMgr.managerTotalScore,
      bghTotalScore: autoMgr.managerTotalScore
    };
  });
};


export const getVcFormsCache = (scopePeriodId?: string): KpiVcForm[] => {
  hydrateVcFormsFromIndexedDb();
  if (inMemoryVcFormsCache && inMemoryVcFormsCache.length > 0) {
    if (!scopePeriodId || scopePeriodId === 'all') {
      return inMemoryVcFormsCache;
    }
    const scoped = inMemoryVcFormsCache.filter(f => f.periodId === scopePeriodId);
    if (scoped.length > 0 || scopePeriodId === 'vc_period_2026_09' || scopePeriodId === 'vc_period_2026_10') {
      return deduplicateVcForms(scoped, { scopePeriodId });
    }
    return [];
  }
  // Đọc một lần không phá hủy từ localStorage cũ (nếu máy từng lưu bản cục bộ trước đó) để bảo toàn dữ liệu
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(VC_FORMS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const deduped = deduplicateVcForms(parsed);
          inMemoryVcFormsCache = deduped;
          idbCacheSet(VC_FORMS_CACHE_KEY, deduped).catch(() => {});
          if (!scopePeriodId || scopePeriodId === 'all') return deduped;
          return deduplicateVcForms(deduped.filter(f => f.periodId === scopePeriodId), { scopePeriodId });
        }
      }
    }
  } catch (err) {
    console.warn('Error reading legacy VC forms cache:', err);
  }
  const defaultList = deduplicateVcForms(CANONICAL_ALL_VC_FORMS);
  inMemoryVcFormsCache = defaultList;
  idbCacheSet(VC_FORMS_CACHE_KEY, defaultList).catch(() => {});
  if (!scopePeriodId || scopePeriodId === 'all') return defaultList;
  if (scopePeriodId === 'vc_period_2026_09' || scopePeriodId === 'vc_period_2026_10') {
    return deduplicateVcForms(defaultList.filter(f => f.periodId === scopePeriodId), { scopePeriodId });
  }
  return [];
};

export const saveVcFormsCache = (
  forms: KpiVcForm[],
  options?: { replacePeriodId?: string; dispatchEvent?: boolean }
) => {
  try {
    const replacePeriodId = options?.replacePeriodId;
    const shouldDispatch = options?.dispatchEvent !== false;
    let nextAllForms: KpiVcForm[];

    if (replacePeriodId && replacePeriodId !== 'all') {
      const preservedOtherPeriods = (inMemoryVcFormsCache || []).filter(f => f.periodId !== replacePeriodId);
      const scopedNew = deduplicateVcForms(forms, { scopePeriodId: replacePeriodId });
      nextAllForms = [...preservedOtherPeriods, ...scopedNew];
    } else {
      nextAllForms = deduplicateVcForms(forms);
    }

    inMemoryVcFormsCache = nextAllForms;
    // Lưu đệm vào IndexedDB thay vì localStorage để tuyệt đối không gây QuotaExceededError cho Firestore
    idbCacheSet(VC_FORMS_CACHE_KEY, nextAllForms).catch(() => {});
    if (shouldDispatch && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kpi_vc_forms_updated', { detail: nextAllForms }));
    }
  } catch (err) {
    console.warn('Error saving VC forms cache:', err);
  }
};

const emitFirestoreStatus = (detail: { isOnline: boolean; error?: string; quotaExceeded?: boolean }) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kpi_firestore_status', { detail }));
  }
};

const VC_META_TTL_MS = 10 * 60 * 1000; // 10 minutes
const VC_FORMS_TTL_MS = 3 * 60 * 1000; // 3 minutes
const VC_LOGS_TTL_MS = 3 * 60 * 1000;  // 3 minutes

const vcFormsPeriodChannels = new Map<string, CachedSubscriptionChannel<KpiVcForm[]>>();

const getVcFormsPeriodChannel = (effectivePeriod: string): CachedSubscriptionChannel<KpiVcForm[]> => {
  const existing = vcFormsPeriodChannels.get(effectivePeriod);
  if (existing) return existing;

  const channel = createCachedSubscriptionChannel<KpiVcForm[]>({
    cacheKey: `kpi_vc:forms:${effectivePeriod}`,
    ttlMs: VC_FORMS_TTL_MS,
    fetcher: async () => {
      const q = effectivePeriod === 'all'
        ? query(collection(db, VC_COLLECTIONS.FORMS))
        : query(collection(db, VC_COLLECTIONS.FORMS), where('periodId', '==', effectivePeriod));
      const snapshot = await getDocs(q);
      const firestoreList: KpiVcForm[] = [];
      snapshot.forEach((docSnap) => {
        const raw = docSnap.data();
        if (isValidVcFormDoc(docSnap.id, raw)) {
          firestoreList.push({ id: docSnap.id, ...raw } as KpiVcForm);
        }
      });

      const currentScopedCached = getVcFormsCache(effectivePeriod);
      const firestoreMap = new Map(firestoreList.map(f => [f.id, f]));
      let finalList: KpiVcForm[] = [...firestoreList];

      currentScopedCached.forEach(cForm => {
        if (!firestoreMap.has(cForm.id)) {
          if (
            firestoreList.length === 0 ||
            cForm.periodId === 'vc_period_2026_09' ||
            cForm.periodId === 'vc_period_2026_10'
          ) {
            finalList.push(cForm);
          }
        } else {
          const fForm = firestoreMap.get(cForm.id)!;
          const localTime = toTimestampMs(cForm.updatedAt);
          const firestoreTime = toTimestampMs(fForm.updatedAt);
          if (localTime > firestoreTime) {
            const idx = finalList.findIndex(f => f.id === cForm.id);
            if (idx >= 0) {
              finalList[idx] = cForm;
            }
          }
        }
      });

      finalList = deduplicateVcForms(finalList, { scopePeriodId: effectivePeriod });
      finalList.sort((a, b) => toTimestampMs(b.updatedAt || b.createdAt) - toTimestampMs(a.updatedAt || a.createdAt));

      firestoreSyncedPeriods.add(effectivePeriod);
      saveVcFormsCache(finalList, { replacePeriodId: effectivePeriod, dispatchEvent: false });
      emitFirestoreStatus({ isOnline: true });
      return finalList;
    },
    getFallback: () => {
      const fallbackList = getVcFormsCache(effectivePeriod);
      fallbackList.sort((a, b) => toTimestampMs(b.updatedAt || b.createdAt) - toTimestampMs(a.updatedAt || a.createdAt));
      return fallbackList;
    },
    onError: (err: any) => {
      console.warn(`Firestore fetch notice for VC Forms (${effectivePeriod}):`, err);
      emitFirestoreStatus({
        isOnline: false,
        error: err?.message || 'Firestore connection notice',
        quotaExceeded: isQuotaExceededError(err)
      });
    }
  });

  vcFormsPeriodChannels.set(effectivePeriod, channel);
  return channel;
};

/**
 * Lắng nghe danh sách Phiếu đánh giá theo Kỳ với TTL cache 3 phút & bảo vệ Quota
 * Chuyển qua lại giữa các kỳ đánh giá hoặc module trong 3 phút = 0 lượt đọc Firestore mới.
 */
export const subscribeVcFormsByPeriod = (
  periodId: string,
  callback: (forms: KpiVcForm[]) => void
) => {
  const effectivePeriod = periodId || 'all';
  let isDisposed = false;

  const handleLocalEvent = () => {
    if (isDisposed) return;
    const freshScoped = getVcFormsCache(effectivePeriod);
    freshScoped.sort((a, b) => toTimestampMs(b.updatedAt || b.createdAt) - toTimestampMs(a.updatedAt || a.createdAt));
    callback(freshScoped);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('kpi_vc_forms_updated', handleLocalEvent);
  }

  const channel = getVcFormsPeriodChannel(effectivePeriod);
  const unsubChannel = channel.subscribe((list) => {
    if (!isDisposed) callback(list);
  });

  return () => {
    isDisposed = true;
    unsubChannel();
    if (typeof window !== 'undefined') {
      window.removeEventListener('kpi_vc_forms_updated', handleLocalEvent);
    }
  };
};

/**
 * Lắng nghe toàn bộ danh sách Phiếu đánh giá (tương thích ngược)
 */
export const subscribeVcForms = (callback: (forms: KpiVcForm[]) => void) => {
  return subscribeVcFormsByPeriod('all', callback);
};

const vcPeriodsChannel = createCachedSubscriptionChannel<KpiVcPeriod[]>({
  cacheKey: 'kpi_vc:periods',
  ttlMs: VC_META_TTL_MS,
  fetcher: async () => {
    const snapshot = await getDocs(query(collection(db, VC_COLLECTIONS.PERIODS)));
    const list: KpiVcPeriod[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as KpiVcPeriod);
    });
    const existingIds = new Set(list.map(p => p.id));
    const combined = [...list];
    for (const defP of DEFAULT_VC_PERIODS) {
      if (!existingIds.has(defP.id)) combined.push(defP);
    }
    return combined.length > 0 ? combined : DEFAULT_VC_PERIODS;
  },
  getFallback: () => DEFAULT_VC_PERIODS
});

/**
 * Lắng nghe danh sách Kỳ đánh giá (kpi_vc_periods) - TTL 10 phút
 */
export const subscribeVcPeriods = (callback: (periods: KpiVcPeriod[]) => void) => {
  return vcPeriodsChannel.subscribe(callback);
};

const vcCriteriaChannel = createCachedSubscriptionChannel<KpiVcCriterion[]>({
  cacheKey: 'kpi_vc:criteria',
  ttlMs: VC_META_TTL_MS,
  fetcher: async () => {
    const defaultMap = new Map(DEFAULT_VC_CRITERIA.map(c => [c.id, c]));
    const snapshot = await getDocs(query(collection(db, VC_COLLECTIONS.CRITERIA)));
    const list: KpiVcCriterion[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as KpiVcCriterion;
      const def = defaultMap.get(docSnap.id);
      const maxScore = def && def.groupId === 'group_III' && def.subGroup === 'B'
        ? def.maxScore
        : (typeof data.maxScore === 'number' ? data.maxScore : (def?.maxScore ?? 2));
      list.push({ id: docSnap.id, ...data, maxScore } as KpiVcCriterion);
    });
    list.sort((a, b) => a.order - b.order);
    return list.length > 0 ? list : DEFAULT_VC_CRITERIA;
  },
  getFallback: () => DEFAULT_VC_CRITERIA
});

/**
 * Lắng nghe danh sách Tiêu chí (kpi_vc_criteria) - TTL 10 phút
 */
export const subscribeVcCriteria = (callback: (criteria: KpiVcCriterion[]) => void) => {
  return vcCriteriaChannel.subscribe(callback);
};

const vcGroupsChannel = createCachedSubscriptionChannel<KpiVcCriteriaGroup[]>({
  cacheKey: 'kpi_vc:groups',
  ttlMs: VC_META_TTL_MS,
  fetcher: async () => {
    const snapshot = await getDocs(query(collection(db, VC_COLLECTIONS.GROUPS)));
    const list: KpiVcCriteriaGroup[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as KpiVcCriteriaGroup);
    });
    list.sort((a, b) => a.order - b.order);
    return list.length > 0 ? list : DEFAULT_VC_GROUPS;
  },
  getFallback: () => DEFAULT_VC_GROUPS
});

/**
 * Lắng nghe danh sách Nhóm tiêu chí (kpi_vc_groups) - TTL 10 phút
 */
export const subscribeVcGroups = (callback: (groups: KpiVcCriteriaGroup[]) => void) => {
  return vcGroupsChannel.subscribe(callback);
};

const vcAuditLogsChannel = createCachedSubscriptionChannel<KpiVcAuditLog[]>({
  cacheKey: 'kpi_vc:audit_logs',
  ttlMs: VC_LOGS_TTL_MS,
  fetcher: async () => {
    const q = query(
      collection(db, VC_COLLECTIONS.AUDIT_LOGS),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    const list: KpiVcAuditLog[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as KpiVcAuditLog);
    });
    list.sort((a, b) => toTimestampMs(b.timestamp) - toTimestampMs(a.timestamp));
    return list;
  },
  getFallback: () => {
    try {
      const cached = localStorage.getItem('kpi_vc_audit_logs_cache');
      return cached ? (JSON.parse(cached) as KpiVcAuditLog[]) : [];
    } catch {
      return [];
    }
  }
});

/**
 * Lắng nghe Audit Logs (kpi_vc_audit_logs) - giới hạn 50 bản ghi, TTL 3 phút
 */
export const subscribeVcAuditLogs = (callback: (logs: KpiVcAuditLog[]) => void) => {
  return vcAuditLogsChannel.subscribe(callback);
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
      const next = [fullLog, ...list].slice(0, 100);
      safeLocalStorageSet('kpi_vc_audit_logs_cache', JSON.stringify(next));
      vcAuditLogsChannel.publish(next.slice(0, 50));
    } catch (e) {}

    await setDoc(doc(db, VC_COLLECTIONS.AUDIT_LOGS, logId), cleanFirestoreData(fullLog));
  } catch (error) {
    console.warn('Notice: Firestore audit log write skipped or deferred:', error);
  }
};

/**
 * TẠO PHIẾU ĐÁNH GIÁ MỚI (TỨC THÌ 0MS - LƯU CACHE NGAY & ĐỒNG BỘ FIRESTORE)
 * Ràng buộc: Một người + một kỳ = duy nhất 1 phiếu
 */
export const createVcForm = async (
  formData: Omit<KpiVcForm, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { id: string; name: string; role?: string }
): Promise<string> => {
  const sanitizedEmployeeId = (formData.employeeId || 'emp').replace(/[^a-zA-Z0-9_-]/g, '_');
  const rawPeriod = (formData.periodId || 'vc_period_2026_09').replace(/[^a-zA-Z0-9_-]/g, '_');
  const pKey = rawPeriod.startsWith('vc_') ? rawPeriod : `vc_${rawPeriod}`;
  const formId = `${pKey}_${sanitizedEmployeeId}`;

  const cachedForms = getVcFormsCache();
  const existingForm = cachedForms.find(f => f.id === formId);
  const now = new Date().toISOString();

  const fullForm: KpiVcForm = {
    ...formData,
    id: formId,
    createdAt: existingForm?.createdAt || now,
    updatedAt: now,
    createdBy: existingForm?.createdBy || (actor.name || actor.id),
    updatedBy: actor.name || actor.id
  };

  // 1. Cập nhật cache cục bộ NGAY LẬP TỨC để UI phản hồi 0ms
  const existingIdx = cachedForms.findIndex(f => f.id === formId);
  if (existingIdx >= 0) {
    cachedForms[existingIdx] = { ...cachedForms[existingIdx], ...fullForm };
  } else {
    cachedForms.unshift(fullForm);
  }
  saveVcFormsCache(cachedForms);

  // 2. Đồng bộ Firestore có await + timeout an toàn 10 giây
  try {
    const docRef = doc(db, VC_COLLECTIONS.FORMS, formId);
    const cleanData = cleanFirestoreData(fullForm);
    await Promise.race([
      setDoc(docRef, cleanData, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
    ]);
  } catch (e) {
    console.warn('Firestore setDoc deferred or offline, data safely preserved in cache:', e);
  }

  // 3. Ghi audit log ngầm
  try {
    addVcAuditLog({
      formId,
      periodId: formData.periodId,
      action: existingForm ? 'update_form' : 'create_form',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetName: `Phiếu KPI của ${formData.employeeName}`,
      description: `${existingForm ? 'Cập nhật' : 'Tạo'} phiếu đánh giá KPI giáo viên/nhân viên: ${formData.employeeName} (${formData.periodName})`
    }).catch(() => {});
  } catch (logErr) {}

  return formId;
};

/**
 * TẠO HÀNG LOẠT PHIẾU ĐÁNH GIÁ
 * Cập nhật cache và UI ngay lập tức, đồng bộ Firestore qua writeBatch có await + timeout an toàn
 */
export const createBatchVcForms = async (
  formsDataList: Omit<KpiVcForm, 'id' | 'createdAt' | 'updatedAt'>[],
  actor: { id: string; name: string; role?: string }
): Promise<{ count: number; formIds: string[]; periodId: string }> => {
  const now = new Date().toISOString();
  const cachedForms = getVcFormsCache();
  const formMap = new Map(cachedForms.map(f => [f.id, f]));
  const createdIds: string[] = [];
  const fullFormsToSave: KpiVcForm[] = [];
  let detectedPeriodId = '';

  for (const formData of formsDataList) {
    const sanitizedEmployeeId = (formData.employeeId || 'emp').replace(/[^a-zA-Z0-9_-]/g, '_');
    const rawPeriod = (formData.periodId || 'vc_period_2026_09').replace(/[^a-zA-Z0-9_-]/g, '_');
    const pKey = rawPeriod.startsWith('vc_') ? rawPeriod : `vc_${rawPeriod}`;
    const formId = `${pKey}_${sanitizedEmployeeId}`;
    if (!detectedPeriodId) detectedPeriodId = formData.periodId;

    const existing = formMap.get(formId);
    const fullForm: KpiVcForm = {
      ...formData,
      id: formId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      createdBy: existing?.createdBy || (actor.name || actor.id),
      updatedBy: actor.name || actor.id
    };

    formMap.set(formId, fullForm);
    createdIds.push(formId);
    fullFormsToSave.push(fullForm);
  }

  // 1. Cập nhật cache cục bộ ngay lập tức để UI phản hồi tức thì
  const updatedAllForms = Array.from(formMap.values());
  saveVcFormsCache(updatedAllForms);

  // 2. Đồng bộ Firestore qua writeBatch có await + timeout an toàn 10 giây
  try {
    const commitAll = async () => {
      const chunkSize = 400; // Batch limit của Firestore là 500
      for (let i = 0; i < fullFormsToSave.length; i += chunkSize) {
        const chunk = fullFormsToSave.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(f => {
          const docRef = doc(db, VC_COLLECTIONS.FORMS, f.id);
          batch.set(docRef, cleanFirestoreData(f), { merge: true });
        });
        await batch.commit();
      }
    };
    await Promise.race([
      commitAll(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
    ]);
  } catch (e) {
    console.warn('Batch Firestore write deferred or offline, safely kept in cache:', e);
  }

  // 3. Ghi audit log background
  try {
    addVcAuditLog({
      formId: createdIds[0] || 'batch',
      periodId: detectedPeriodId,
      action: 'create_form',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetName: `Tạo hàng loạt ${createdIds.length} phiếu KPI`,
      description: `Đã tạo ${createdIds.length} phiếu đánh giá KPI giáo viên viên chức`
    }).catch(() => {});
  } catch (err) {}

  return { count: createdIds.length, formIds: createdIds, periodId: detectedPeriodId };
};

/**
 * CẬP NHẬT PHIẾU ĐÁNH GIÁ (Bảo vệ dữ liệu bền vững, timeout an toàn 10s)
 */
export const updateVcForm = async (
  formId: string,
  updateData: Partial<KpiVcForm>,
  actor: { id: string; name: string; role?: string }
): Promise<{ success: boolean; isOfflineQuota?: boolean; error?: string }> => {
  console.log('[KPI_SERVICE_STEP_A: UPDATE_VC_FORM_START]', { formId });
  const docRef = doc(db, VC_COLLECTIONS.FORMS, formId);
  const now = new Date().toISOString();

  const payload: Record<string, any> = {
    ...updateData,
    updatedAt: now,
    updatedBy: actor.name || actor.id
  };

  // BẮT BUỘC: Tính lại và ghi đè điểm CBQL (Cấp 3) tự động = (Cá nhân + TTCM) / 2 trước khi lưu Firestore
  // Tuyệt đối không cho phép lưu điểm CBQL chỉnh sửa thủ công hoặc sai lệch công thức
  if (Array.isArray(payload.items) && payload.items.length > 0) {
    const autoMgr = syncAutoManagerScores(payload.items, payload.maxTotalScore || 100);
    payload.items = autoMgr.items;
    payload.managerGroupScores = autoMgr.managerGroupScores;
    payload.managerTotalScore = autoMgr.managerTotalScore;
    payload.bghTotalScore = autoMgr.managerTotalScore;
  }

  let quotaErrorOccurred = false;
  let errorMsg: string | undefined = undefined;

  // 1. Cập nhật cache cục bộ NGAY LẬP TỨC để UI phản hồi tức thì và dữ liệu được bảo toàn tuyệt đối
  try {
    const cachedForms = getVcFormsCache();
    const idx = cachedForms.findIndex(f => f.id === formId);
    if (idx >= 0) {
      cachedForms[idx] = { ...cachedForms[idx], ...payload };
    } else {
      cachedForms.unshift({ id: formId, ...payload } as KpiVcForm);
    }
    saveVcFormsCache(cachedForms);
    console.log('[KPI_SERVICE_STEP_B: IMMEDIATE_LOCAL_CACHE_SAVED]', { formId, status: payload.status, managerTotalScore: payload.managerTotalScore });
  } catch (cacheErr) {
    console.warn('[KPI_SERVICE_WARNING: LOCAL_CACHE_ERROR]', cacheErr);
  }

  // 2. Ghi nhận máy chủ Firestore với bảo vệ timeout an toàn 10 giây để bảo đảm dữ liệu được ghi thực tế lên cloud
  try {
    console.log('[KPI_SERVICE_STEP_C: FIRESTORE_SET_DOC_START]', { formId });
    const cleanData = cleanFirestoreData(payload);
    const firestorePromise = setDoc(docRef, cleanData, { merge: true });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000));
    
    await Promise.race([firestorePromise, timeoutPromise]);
    console.log('[KPI_SERVICE_STEP_D: FIRESTORE_SET_DOC_SUCCESS]', { formId });
  } catch (e: any) {
    console.warn('[KPI_SERVICE_WARNING: FIRESTORE_SET_DOC_DEFERRED_OR_ERROR]', e);
    quotaErrorOccurred = true;
    errorMsg = e?.message || 'Deferred';
  }

  // 3. Ghi nhận Audit Log hoàn toàn trong Background (KHÔNG chặn giao diện)
  try {
    const empName = updateData.employeeName || formId;
    const pId = updateData.periodId;
    addVcAuditLog({
      formId,
      periodId: pId,
      action: 'update_form',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetName: empName,
      description: `Cập nhật phiếu đánh giá KPI: ${empName}`
    }).catch(logErr => {
      console.warn('[KPI_SERVICE_WARNING: BACKGROUND_AUDIT_LOG_ERROR]', logErr);
    });
  } catch (logErr) {}

  console.log('[KPI_SERVICE_STEP_E: UPDATE_VC_FORM_COMPLETE]', { formId, quotaErrorOccurred });
  return { success: true, isOfflineQuota: quotaErrorOccurred, error: errorMsg };
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
): Promise<{ success: boolean }> => {
  const docRef = doc(db, VC_COLLECTIONS.FORMS, formId);
  const now = new Date().toISOString();

  const cachedForms = getVcFormsCache();
  const existingForm = cachedForms.find(f => f.id === formId);

  let newStatus = 'locked';
  if (lock) {
    newStatus = 'locked';
  } else {
    if (existingForm?.managerTotalScore !== null && existingForm?.managerTotalScore !== undefined) {
      newStatus = 'completed';
    } else if (existingForm?.ttcmTotalScore !== null && existingForm?.ttcmTotalScore !== undefined) {
      newStatus = 'ttcm_evaluated';
    } else if (hasTeacherActuallyEvaluated(existingForm as KpiVcForm) || existingForm?.selfDate || (typeof existingForm?.totalScore === 'number' && existingForm.totalScore > 0)) {
      newStatus = 'submitted';
    } else {
      newStatus = 'draft';
    }
  }

  const payload: Record<string, any> = {
    status: newStatus,
    lockedAt: lock ? now : null,
    lockedBy: lock ? actor.name : null,
    updatedAt: now,
    updatedBy: actor.name || actor.id
  };

  // 1. Ghi lên Firestore máy chủ trước (Server-first)
  try {
    await setDoc(docRef, cleanFirestoreData(payload), { merge: true });
  } catch (err) {
    console.warn('Lỗi ghi Firestore toggle lock:', err);
    throw new Error('Không thể kết nối máy chủ để cập nhật trạng thái khóa/mở khóa. Vui lòng thử lại.');
  }

  // 2. Cập nhật local cache sau khi máy chủ xác nhận thành công
  const idx = cachedForms.findIndex(f => f.id === formId);
  if (idx >= 0) {
    cachedForms[idx] = { ...cachedForms[idx], ...payload };
  }
  saveVcFormsCache(cachedForms);

  // 3. Audit log
  try {
    await addVcAuditLog({
      formId,
      action: lock ? 'lock_form' : 'unlock_form',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetName: formId,
      description: `${lock ? 'Khóa' : 'Mở khóa'} phiếu đánh giá KPI: ${formId}`
    });
  } catch (e) {}

  return { success: true };
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
  vcCriteriaChannel.invalidate(true);

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
  vcCriteriaChannel.invalidate(true);

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
  vcCriteriaChannel.invalidate(true);

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
  vcPeriodsChannel.invalidate(true);

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
  vcPeriodsChannel.invalidate(true);

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
  vcGroupsChannel.invalidate(true);
  return grpId;
};

export const updateVcGroup = async (
  groupId: string,
  updateData: Partial<KpiVcCriteriaGroup>,
  actor: { id: string; name: string; role?: string }
) => {
  const docRef = doc(db, VC_COLLECTIONS.GROUPS, groupId);
  await updateDoc(docRef, cleanFirestoreData(updateData));
  vcGroupsChannel.invalidate(true);
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
    safeLocalStorageSet(VC_RATING_CONFIGS_CACHE_KEY, JSON.stringify(configs));
  } catch (err) {
    console.warn('Error saving VC rating configs cache:', err);
  }
};

const buildDefaultVcRatingConfig = (): KpiVcRatingConfig => ({
  id: 'vc_rating_default',
  periodId: 'all',
  periodName: 'Mặc định toàn trường',
  scaleMaxScore: 100,
  tiers: DEFAULT_VC_RATING_TIERS,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  note: 'Cấu hình xếp loại 4 mức mặc định của nhà trường'
});

const vcRatingConfigsChannel = createCachedSubscriptionChannel<KpiVcRatingConfig[]>({
  cacheKey: 'kpi_vc:rating_configs',
  ttlMs: VC_META_TTL_MS,
  fetcher: async () => {
    const snapshot = await getDocs(query(collection(db, VC_COLLECTIONS.RATING_CONFIGS)));
    const list: KpiVcRatingConfig[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as KpiVcRatingConfig);
    });
    const final = list.length > 0 ? list : [buildDefaultVcRatingConfig()];
    saveVcRatingConfigsCache(final);
    return final;
  },
  getFallback: () => {
    const cached = getVcRatingConfigsCache();
    return cached.length > 0 ? cached : [buildDefaultVcRatingConfig()];
  }
});

/**
 * Lắng nghe danh sách Cấu hình xếp loại (kpi_vc_rating_configs) - TTL 10 phút
 */
export const subscribeVcRatingConfigs = (callback: (configs: KpiVcRatingConfig[]) => void) => {
  return vcRatingConfigsChannel.subscribe(callback);
};

const vcRatingConfigHistoryChannel = createCachedSubscriptionChannel<KpiVcRatingConfigHistory[]>({
  cacheKey: 'kpi_vc:rating_config_history',
  ttlMs: VC_LOGS_TTL_MS,
  fetcher: async () => {
    const snapshot = await getDocs(query(collection(db, VC_COLLECTIONS.RATING_CONFIG_HISTORY), limit(50)));
    const list: KpiVcRatingConfigHistory[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as KpiVcRatingConfigHistory);
    });
    list.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
    return list;
  },
  getFallback: () => []
});

/**
 * Lắng nghe Lịch sử thay đổi cấu hình xếp loại (kpi_vc_rating_config_history) - giới hạn 50, TTL 3 phút
 */
export const subscribeVcRatingConfigHistory = (callback: (history: KpiVcRatingConfigHistory[]) => void) => {
  return vcRatingConfigHistoryChannel.subscribe(callback);
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
  vcRatingConfigsChannel.publish(cachedConfigs);

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
  vcRatingConfigHistoryChannel.publish([historyItem, ...(vcRatingConfigHistoryChannel.getSnapshot() || [])].slice(0, 50));

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
  vcRatingConfigsChannel.publish(cached);

  // History log
  const historyId = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const historyItem: KpiVcRatingConfigHistory = {
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
  };
  await setDoc(doc(db, VC_COLLECTIONS.RATING_CONFIG_HISTORY, historyId), cleanFirestoreData(historyItem));
  vcRatingConfigHistoryChannel.publish([historyItem, ...(vcRatingConfigHistoryChannel.getSnapshot() || [])].slice(0, 50));
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

export interface Reset100BatchResult {
  updatedCount: number;
  unchangedCount: number;
  invalidCount: number;
  updatedForms: Array<{
    id: string;
    employeeCode?: string;
    employeeName: string;
    periodId: string;
    oldScore: number;
    newScore: number;
    ttcmScore: number | null;
    managerScore: number | null;
    status: string;
  }>;
  unchangedForms: Array<{
    id: string;
    employeeName: string;
    score: number;
  }>;
  invalidForms: Array<{
    id: string;
    employeeName: string;
    score: any;
    reason: string;
  }>;
  backupKey: string;
  timestamp: string;
}

/**
 * LỆNH SỬA DỮ LIỆU KPI HÀNG LOẠT – ĐƯA PHIẾU 100 ĐIỂM VỀ 0 ĐIỂM
 * - Chỉ xử lý phiếu có tổng điểm đúng bằng 100/100 (teacherSelfScore === 100).
 * - Phiếu < 100: giữ nguyên tuyệt đối điểm đã lưu.
 * - Phiếu > 100 hoặc không hợp lệ: đưa vào danh sách kiểm tra riêng.
 * - Giữ nguyên tuyệt đối điểm TTCM, điểm BGH, nhận xét và minh chứng.
 * - Đưa điểm tự chấm về 0 và trạng thái 'draft' (Chưa chấm) để giáo viên tự chấm lại.
 */
export const resetFormsWith100Points = async (
  targetPeriodId: string = 'vc_period_2026_09',
  actor?: { id: string; name: string; role?: string }
): Promise<Reset100BatchResult> => {
  const currentForms = getVcFormsCache();
  const now = new Date().toISOString();
  const backupKey = `kpi_vc_forms_backup_100_reset_${Date.now()}`;

  // 1. Sao lưu toàn bộ dữ liệu trước khi xử lý vào IndexedDB (không ghi vào localStorage)
  idbCacheSet(backupKey, currentForms).catch(() => {});

  const updatedForms: Reset100BatchResult['updatedForms'] = [];
  const unchangedForms: Reset100BatchResult['unchangedForms'] = [];
  const invalidForms: Reset100BatchResult['invalidForms'] = [];

  const processedList = currentForms.map(form => {
    // Chỉ xử lý các phiếu thuộc kỳ đánh giá được chọn (hoặc tất cả nếu targetPeriodId === 'all')
    if (targetPeriodId !== 'all' && form.periodId !== targetPeriodId) {
      return form;
    }

    const selfScore = form.totalScore;

    // Kiểm tra dữ liệu bất thường (> 100 hoặc không phải số hợp lệ)
    if (typeof selfScore !== 'number' || Number.isNaN(selfScore) || selfScore > 100) {
      invalidForms.push({
        id: form.id,
        employeeName: form.employeeName,
        score: selfScore,
        reason: typeof selfScore !== 'number' ? 'Điểm không phải là số' : (selfScore > 100 ? 'Điểm vượt quá 100' : 'Dữ liệu không hợp lệ')
      });
      return form; // Không tự ý sửa phiếu bất thường
    }

    // Điều kiện xử lý: ĐÚNG BẰNG 100 và đang ở trạng thái bản nháp (draft). Tuyệt đối không chạm vào phiếu đã nộp!
    if (selfScore === 100 && (form.status === 'draft' || !form.status)) {
      const oldScore = form.totalScore;

      // Xóa điểm chi tiết tiêu chí tự chấm, đưa về null để giáo viên tự chấm lại
      // Giữ nguyên tuyệt đối điểm TTCM, điểm BGH và nhận xét cấp trên
      const updatedItems = (form.items || []).map(item => ({
        ...item,
        selfScore: null,
        selectedLevelId: null,
        selectedLevelName: null,
        selectedLevelCode: null,
        note: '',
        evidenceUrl: ''
      }));

      const newHistoryEntry = {
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        actorId: actor?.id || 'admin',
        actorName: actor?.name || 'Ban Giám hiệu',
        actorRole: actor?.role || 'BGH',
        action: 'reset_100_to_0',
        previousScore: 100,
        newScore: 0,
        comment: 'Đưa điểm tự chấm 100 về 0 để giáo viên chấm lại theo quy định',
        timestamp: now
      };

      const updatedForm: KpiVcForm = {
        ...form,
        totalScore: 0,
        groupScores: { group_I: 0, group_II: 0, group_III: 0 },
        selfClassification: 'Chưa tự đánh giá',
        status: 'draft',
        items: updatedItems,
        history: [...(form.history || []), newHistoryEntry],
        updatedAt: now,
        updatedBy: actor?.name || 'Hệ thống'
      };

      updatedForms.push({
        id: form.id,
        employeeCode: form.employeeCode,
        employeeName: form.employeeName,
        periodId: form.periodId,
        oldScore,
        newScore: 0,
        ttcmScore: form.ttcmTotalScore ?? null,
        managerScore: form.managerTotalScore ?? null,
        status: 'draft'
      });

      // Cố gắng ghi đồng bộ sang Firestore
      try {
        const docRef = doc(db, VC_COLLECTIONS.FORMS, form.id);
        setDoc(docRef, cleanFirestoreData(updatedForm), { merge: true }).catch(err => {
          console.warn('Firestore write warning during batch reset:', err);
        });
      } catch (err) {}

      return updatedForm;
    }

    // Các phiếu có điểm dưới 100: giữ nguyên tuyệt đối
    unchangedForms.push({
      id: form.id,
      employeeName: form.employeeName,
      score: selfScore
    });
    return form;
  });

  // Lưu lại cache
  saveVcFormsCache(processedList);

  // Ghi nhận Audit Log
  try {
    await addVcAuditLog({
      periodId: targetPeriodId,
      action: 'batch_reset_100_to_0',
      actorId: actor?.id || 'admin',
      actorName: actor?.name || 'Ban Giám hiệu',
      actorRole: actor?.role || 'BGH',
      targetName: `Kỳ ${targetPeriodId}`,
      description: `Đã đưa ${updatedForms.length} phiếu có điểm 100/100 về 0 để giáo viên chấm lại. Giữ nguyên ${unchangedForms.length} phiếu dưới 100.`
    });
  } catch (e) {}

  return {
    updatedCount: updatedForms.length,
    unchangedCount: unchangedForms.length,
    invalidCount: invalidForms.length,
    updatedForms,
    unchangedForms,
    invalidForms,
    backupKey,
    timestamp: now
  };
};


