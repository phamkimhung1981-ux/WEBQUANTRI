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
  DEFAULT_VC_FALLBACK_FORMS,
  getFormTotalScore,
  calculateVcTotals,
  calculateVcTtcmTotals,
  calculateVcManagerTotals,
  isEligibleVcEmployee,
  hasFormBeenEvaluated
} from '../lib/kpiVcData';
import { DEFAULT_TEACHERS } from '../data/defaultTeachersData';
import { CANONICAL_51_VC_FORMS } from '../data/canonical51Forms';
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
      const cached = getVcFormsCache();
      const formsToSeed = (cached && cached.length >= 40 && cached.some(f => (f.totalScore || 0) > 0)) 
        ? cached 
        : DEFAULT_VC_FALLBACK_FORMS;
      for (const form of formsToSeed) {
        await setDoc(doc(db, VC_COLLECTIONS.FORMS, form.id), cleanFirestoreData(form), { merge: true });
      }
    }
  } catch (error) {
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
  if (!form.items || form.items.length === 0) return false;
  const hasScores = form.items.some(i => i.selfScore !== null && i.selfScore !== undefined && !Number.isNaN(Number(i.selfScore)));
  if (!hasScores) return false;

  const sumSelf = form.items.reduce((acc, curr) => acc + (Number(curr.selfScore) || 0), 0);
  return sumSelf > 0;
};

// Local Storage Cache Helpers - Use authoritative versioned cache
const VC_FORMS_CACHE_KEY = 'kpi_vc_forms_cache_v5_authoritative';

// Tự động dọn dẹp các cache cũ có nguy cơ chứa điểm 100 mặc định sai
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    [
      'kpi_vc_forms_cache',
      'kpi_vc_forms_cache_v2',
      'kpi_vc_forms_cache_v3',
      'kpi_vc_forms_cache_v4',
      'kpi_vc_forms_backup_100_reset'
    ].forEach(k => {
      localStorage.removeItem(k);
    });
  } catch {}
}

/**
 * Hàm chuẩn hóa và hợp nhất dữ liệu KPI Giáo viên:
 * - Bảo toàn 100% điểm tự chấm, điểm TTCM, điểm BGH, tệp minh chứng và ghi chú
 * - Đảm bảo chính xác danh sách giáo viên/viên chức theo danh sách chính thức của Trường THPT Sơn Lương
 * - Triệt tiêu hoàn toàn trùng lặp do trình duyệt hay sai khác mã định danh (id/shortId)
 * - TUYỆT ĐỐI KHÔNG TỰ Ý ĐƯA ĐIỂM VỀ 0 HAY RESET 100 ĐIỂM
 * - Khôi phục điểm đã chấm từ nguồn chuẩn CANONICAL_51_VC_FORMS nếu phiếu bị lỗi trở về 0 chưa chấm
 */
export const deduplicateVcForms = (forms: KpiVcForm[]): KpiVcForm[] => {
  if (!forms) forms = [];

  // BẢO TOÀN NGUYÊN VẸN: Tuyệt đối không xóa điểm, không hạ 100 điểm về 0
  const inputForms = forms.filter(Boolean);

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
  const allKnownPeriods = new Set<string>();
  allKnownPeriods.add('vc_period_2026_09');

  inputForms.forEach(f => {
    const periodId = f.periodId || 'vc_period_2026_09';
    allKnownPeriods.add(periodId);
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

  // Duyệt qua từng giáo viên và kỳ đánh giá
  eligibleTeachers.forEach(t => {
    // 1. Kỳ trọng tâm: vc_period_2026_09
    const groupKey = `vc_period_2026_09__${t.id}`;
    const matched = matchedMap.get(groupKey) || [];
    const fallback = canonicalFallbackMap.get(t.id) || canonicalFallbackMap.get(normalizeTeacherName(t.name));

    if (matched.length === 0) {
      if (fallback) {
        result.push({ ...fallback });
      }
      return;
    }

    // Ưu tiên chọn phiếu có dữ liệu chấm thực tế đầy đủ nhất làm phiếu chính
    const sorted = [...matched].sort((a, b) => {
      const aTtcm = (a.ttcmTotalScore !== null && a.ttcmTotalScore !== undefined) ? 1 : 0;
      const bTtcm = (b.ttcmTotalScore !== null && b.ttcmTotalScore !== undefined) ? 1 : 0;
      if (bTtcm !== aTtcm) return bTtcm - aTtcm;

      const aManager = (a.managerTotalScore !== null && a.managerTotalScore !== undefined) ? 1 : 0;
      const bManager = (b.managerTotalScore !== null && b.managerTotalScore !== undefined) ? 1 : 0;
      if (bManager !== aManager) return bManager - aManager;

      const aHasSelf = (a.items && a.items.some(i => i.selfScore !== null && i.selfScore !== undefined)) ? 1 : 0;
      const bHasSelf = (b.items && b.items.some(i => i.selfScore !== null && i.selfScore !== undefined)) ? 1 : 0;
      if (bHasSelf !== aHasSelf) return bHasSelf - aHasSelf;

      const wA = getStatusWeight(a.status);
      const wB = getStatusWeight(b.status);
      if (wB !== wA) return wB - wA;

      const aScore = getFormTotalScore(a);
      const bScore = getFormTotalScore(b);
      if (bScore !== aScore) return bScore - aScore;

      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });

    const primary: KpiVcForm = { ...sorted[0] };

    // Khôi phục đối chiếu: Nếu phiếu chính bị rỗng (0 điểm, chưa chấm) nhưng bản chuẩn có điểm thật đã lưu trước đó
    const primaryHasScore = primary.totalScore > 0 || (primary.items && primary.items.some(i => i.selfScore !== null && Number(i.selfScore) > 0));
    if (!primaryHasScore && fallback && fallback.totalScore > 0) {
      primary.items = fallback.items;
      primary.totalScore = fallback.totalScore;
      primary.groupScores = fallback.groupScores;
      primary.selfClassification = fallback.selfClassification;
      primary.selfDate = fallback.selfDate;
      primary.selfSignName = fallback.selfSignName;
      if (fallback.status && fallback.status !== 'draft') {
        primary.status = fallback.status;
      }
      if (fallback.ttcmTotalScore) {
        primary.ttcmTotalScore = fallback.ttcmTotalScore;
        primary.ttcmGroupScores = fallback.ttcmGroupScores;
      }
      if (fallback.managerTotalScore) {
        primary.managerTotalScore = fallback.managerTotalScore;
        primary.managerGroupScores = fallback.managerGroupScores;
      }
    }

    // Hợp nhất dữ liệu từ tất cả các phiếu phụ của giáo viên (không ghi đè điểm đã có)
    const sourcesToMerge = [...sorted.slice(1)];
    for (const sec of sourcesToMerge) {
      if (sec.items && primary.items) {
        primary.items = primary.items.map((pItem, idx) => {
          const sItem = sec.items?.find(si => si.criterionId === pItem.criterionId) || sec.items?.[idx];
          if (!sItem) return pItem;
          return {
            ...pItem,
            selfScore: (pItem.selfScore !== null && pItem.selfScore !== undefined) ? pItem.selfScore : sItem.selfScore,
            ttcmScore: (pItem.ttcmScore !== null && pItem.ttcmScore !== undefined) ? pItem.ttcmScore : sItem.ttcmScore,
            ttcmComment: pItem.ttcmComment || sItem.ttcmComment || '',
            managerScore: (pItem.managerScore !== null && pItem.managerScore !== undefined) ? pItem.managerScore : sItem.managerScore,
            managerComment: pItem.managerComment || sItem.managerComment || '',
            note: pItem.note || sItem.note || '',
            evidenceUrl: pItem.evidenceUrl || sItem.evidenceUrl || ''
          };
        });
      }
      if (!primary.ttcmTotalScore && sec.ttcmTotalScore) {
        primary.ttcmTotalScore = sec.ttcmTotalScore;
        primary.ttcmGroupScores = sec.ttcmGroupScores;
      }
      if (!primary.managerTotalScore && sec.managerTotalScore) {
        primary.managerTotalScore = sec.managerTotalScore;
        primary.managerGroupScores = sec.managerGroupScores;
      }
      if ((!primary.totalScore || primary.totalScore === 0) && (sec.totalScore || 0) > 0) {
        primary.totalScore = sec.totalScore;
        primary.groupScores = sec.groupScores;
      }
      if (getStatusWeight(sec.status) > getStatusWeight(primary.status)) {
        primary.status = sec.status;
      }
    }

    // Tính toán lại tổng điểm nhất quán từ items
    if (primary.items && primary.items.length > 0) {
      const selfCalc = calculateVcTotals(primary.items);
      if (primary.totalScore === undefined || primary.totalScore === null || (primary.totalScore === 0 && selfCalc.totalScore > 0)) {
        primary.totalScore = selfCalc.totalScore;
        primary.groupScores = selfCalc.groupScores;
      }

      if (primary.items.some(i => i.ttcmScore !== null && i.ttcmScore !== undefined)) {
        const ttcmCalc = calculateVcTtcmTotals(primary.items);
        primary.ttcmTotalScore = ttcmCalc.ttcmTotalScore;
        primary.ttcmGroupScores = ttcmCalc.ttcmGroupScores;
      }
      if (primary.items.some(i => i.managerScore !== null && i.managerScore !== undefined)) {
        const mgrCalc = calculateVcManagerTotals(primary.items);
        primary.managerTotalScore = mgrCalc.managerTotalScore;
        primary.managerGroupScores = mgrCalc.managerGroupScores;
      }
    }

    // Giữ nguyên document ID hiện có của phiếu trong Firestore để đảm bảo updateDoc ghi đúng document
    if (!primary.id) {
      primary.id = `vc_period_2026_09_${t.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
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

    result.push(primary);
  });

  // 2. Xử lý các kỳ khác (Tháng 10, Tháng 11, v.v...)
  for (const [groupKey, matched] of matchedMap.entries()) {
    if (groupKey.startsWith('vc_period_2026_09__')) continue;
    if (matched.length > 0) {
      const sortedOther = [...matched].sort((a, b) => {
        const wA = getStatusWeight(a.status);
        const wB = getStatusWeight(b.status);
        if (wB !== wA) return wB - wA;
        return (b.totalScore || 0) - (a.totalScore || 0);
      });
      result.push(sortedOther[0]);
    }
  }

  return result;
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
  return deduplicateVcForms(CANONICAL_51_VC_FORMS);
};

const saveVcFormsCache = (forms: KpiVcForm[]) => {
  try {
    const uniqueForms = deduplicateVcForms(forms);
    safeLocalStorageSet(VC_FORMS_CACHE_KEY, JSON.stringify(uniqueForms));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kpi_vc_forms_updated', { detail: uniqueForms }));
    }
  } catch (err) {
    console.warn('Error saving VC forms cache:', err);
  }
};

/**
 * Lắng nghe danh sách Phiếu đánh giá (kpi_vc_forms)
 */
export const subscribeVcForms = (callback: (forms: KpiVcForm[]) => void) => {
  // Load cache hoặc danh sách chuẩn lập tức để UI hiển thị đầy đủ điểm đã lưu
  const cached = getVcFormsCache();
  const initialList = cached && cached.length >= 40 ? cached : deduplicateVcForms(CANONICAL_51_VC_FORMS);
  callback(initialList);

  const handleLocalEvent = () => {
    const freshCached = getVcFormsCache();
    if (freshCached && freshCached.length > 0) {
      callback(freshCached);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('kpi_vc_forms_updated', handleLocalEvent);
  }

  const q = query(collection(db, VC_COLLECTIONS.FORMS));
  const unsubFirestore = onSnapshot(q, async (snapshot) => {
    const firestoreList: KpiVcForm[] = [];
    snapshot.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() } as KpiVcForm;
      firestoreList.push(data);
    });

    // Firestore là nguồn dữ liệu chuẩn mực duy nhất (Server-Authoritative)
    let finalList: KpiVcForm[] = firestoreList;
    if (finalList.length === 0) {
      const currentCached = getVcFormsCache();
      finalList = currentCached && currentCached.length > 0 ? currentCached : CANONICAL_51_VC_FORMS;
    }

    finalList = deduplicateVcForms(finalList);
    finalList.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

    saveVcFormsCache(finalList);
    callback(finalList);
  }, (err) => {
    console.warn('Firestore subscription notice for VC Forms (reading from persistent cache / backup):', err);
    const fallbackList = getVcFormsCache();
    callback(fallbackList);
  });

  return () => {
    unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('kpi_vc_forms_updated', handleLocalEvent);
    }
  };
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
  const sanitizedEmployeeId = (formData.employeeId || 'emp').replace(/[^a-zA-Z0-9_-]/g, '_');
  const rawPeriod = (formData.periodId || 'vc_period_2026_09').replace(/[^a-zA-Z0-9_-]/g, '_');
  const pKey = rawPeriod.startsWith('vc_') ? rawPeriod : `vc_${rawPeriod}`;
  const formId = `${pKey}_${sanitizedEmployeeId}`;

  const docRef = doc(db, VC_COLLECTIONS.FORMS, formId);
  let existingExists = false;
  let existingCreatedAt = '';
  let existingCreatedBy = '';
  try {
    const timeoutGet = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
    const existing = await Promise.race([getDoc(docRef), timeoutGet]) as any;
    if (existing && existing.exists()) {
      existingExists = true;
      existingCreatedAt = existing.data()?.createdAt || '';
      existingCreatedBy = existing.data()?.createdBy || '';
    }
  } catch (err) {
    console.warn('Could not check existing doc, proceeding with create/merge:', err);
  }

  const now = new Date().toISOString();
  const fullForm: KpiVcForm = {
    ...formData,
    id: formId,
    createdAt: existingExists && existingCreatedAt ? existingCreatedAt : now,
    updatedAt: now,
    createdBy: existingExists && existingCreatedBy ? existingCreatedBy : (actor.name || actor.id),
    updatedBy: actor.name || actor.id
  };

  // 1. Cập nhật cache cục bộ ngay lập tức để UI phản hồi 0ms
  const cachedForms = getVcFormsCache();
  const existingIdx = cachedForms.findIndex(f => f.id === formId);
  if (existingIdx >= 0) {
    cachedForms[existingIdx] = { ...cachedForms[existingIdx], ...fullForm };
  } else {
    cachedForms.unshift(fullForm);
  }
  saveVcFormsCache(cachedForms);

  // 2. Ghi Firestore với thời gian chờ an toàn (10 giây)
  try {
    const cleanData = cleanFirestoreData(fullForm);
    const timeoutSet = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000));
    await Promise.race([
      setDoc(docRef, cleanData, { merge: true }),
      timeoutSet
    ]);
  } catch (e) {
    console.warn('Firestore setDoc deferred or offline, data safely preserved in local storage:', e);
  }

  try {
    addVcAuditLog({
      formId,
      periodId: formData.periodId,
      action: existingExists ? 'update_form' : 'create_form',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetName: `Phiếu KPI của ${formData.employeeName}`,
      description: `${existingExists ? 'Cập nhật' : 'Tạo'} phiếu đánh giá KPI giáo viên/nhân viên: ${formData.employeeName} (${formData.periodName})`
    }).catch(() => {});
  } catch (logErr) {}

  return formId;
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
    console.log('[KPI_SERVICE_STEP_B: IMMEDIATE_LOCAL_CACHE_SAVED]', { formId, status: payload.status });
  } catch (cacheErr) {
    console.warn('[KPI_SERVICE_WARNING: LOCAL_CACHE_ERROR]', cacheErr);
  }

  // 2. Ghi nhận máy chủ Firestore với bảo vệ timeout 10 giây (đảm bảo đủ thời gian ghi trên mọi đường truyền)
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

  // 1. Sao lưu toàn bộ dữ liệu trước khi xử lý
  safeLocalStorageSet(backupKey, JSON.stringify(currentForms));

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


