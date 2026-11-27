import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Department, DisciplineRecord, DisciplineCriterion, Notification, Report, Task, Teacher, CalendarEvent, LeaveRecord, AttendanceRecord, KpiItem, KpiRecord, KpiGroup, KpiCategory, KpiMonthlySetting, GeneralKpi, WorkAssignment, EvaluationCategory, EvaluationCriterion, SchoolStats, KpiEvaluationForm, KpiEvaluationItem, SystemModule, User } from '../types';
import { Student, ClassInfo } from '../types/homeroom';
import { DEFAULT_SYSTEM_MODULES } from '../lib/moduleData';
import { KpiStaffForm, KpiStaffPeriod, KpiStaffCriterion } from '../types/kpiStaff';
import { DEFAULT_STAFF_CRITERIA } from '../lib/kpiStaffData';
import {
  fetchStaffFormsFromFirestore,
  saveStaffFormsToCache,
  saveStaffFormToFirestore,
  loadStaffFormsFromCache,
  ensureStaffPeriodsInFirestore,
  loadStaffPeriodsFromCache,
  saveStaffPeriodsToCache
} from '../services/kpiStaffService';
import { OFFICIAL_SCHOOL_TASKS_2026_2027 } from '../utils/sampleSchoolTasks';
import { DEFAULT_TEACHERS } from '../data/defaultTeachersData';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, writeBatch, getDocs, getDoc, query, limit } from 'firebase/firestore';
import { syncCanonicalVcDataToStorageAndFirestore } from '../services/kpiVcService';
import { useAuth } from './AuthContext';
import { safeLocalStorageSet } from '../utils/envUtils';
import { idbCacheSet } from '../utils/indexedDbCache';
import {
  cachedFirestoreFetch,
  canAttemptFirestoreRead,
  invalidateFirestoreCache,
  reportFirestoreError,
  subscribeQuotaManager
} from '../utils/firestoreQuotaManager';

export type LazyAppCollectionKey =
  | 'workAssignments'
  | 'reports'
  | 'tasks'
  | 'calendarEvents'
  | 'leaveRecords'
  | 'attendance'
  | 'kpiStaff';

interface AppState {
  teachers: Teacher[];
  departments: Department[];
  tasks: Task[];
  workAssignments: WorkAssignment[];
  reports: Report[];
  disciplineRecords: DisciplineRecord[];
  disciplineCriteria: DisciplineCriterion[];
  generalKpis: GeneralKpi[];
  kpiGroups: KpiGroup[];
  kpiCategories: KpiCategory[];
  kpis: KpiItem[];
  kpiRecords: KpiRecord[];
  kpiEvaluationForms: KpiEvaluationForm[];
  kpiMonthlySettings: KpiMonthlySetting[];
  evaluationCategories: EvaluationCategory[];
  evaluationCriteria: EvaluationCriterion[];
  notifications: Notification[];
  calendarEvents: CalendarEvent[];
  leaveRecords: LeaveRecord[];
  attendanceRecords: AttendanceRecord[];
  students: Student[];
  classes: ClassInfo[];
  schoolStats: SchoolStats;
  modules: SystemModule[];
  kpiStaffForms: KpiStaffForm[];
  kpiStaffPeriods: KpiStaffPeriod[];
  kpiStaffCriteria: KpiStaffCriterion[];
  loading: boolean;
  error: string | null;
}

interface AppContextType extends AppState {
  clearError: () => void;
  ensureCollectionsLoaded: (keys: LazyAppCollectionKey[], options?: { force?: boolean }) => Promise<void>;
  setKpiStaffForms: (forms: KpiStaffForm[], options?: { skipFirestoreSync?: boolean }) => void;
  setKpiStaffPeriods: (periods: KpiStaffPeriod[]) => void;
  setKpiStaffCriteria: (criteria: KpiStaffCriterion[]) => void;
  addModule: (module: SystemModule, currentUser?: User | null) => Promise<void>;
  updateModule: (id: string, data: Partial<SystemModule>, currentUser?: User | null) => Promise<void>;
  deleteModule: (id: string, currentUser?: User | null) => Promise<void>;
  toggleModule: (id: string, currentUser?: User | null) => Promise<void>;
  reorderModules: (newModules: SystemModule[], currentUser?: User | null) => Promise<void>;
  resetModulesToDefault: (currentUser?: User | null) => Promise<void>;
  updateTaskStatus: (taskId: string, status: Task['status'], progress?: number) => void;
  markNotificationRead: (id: string) => void;
  deleteTeacher: (id: string) => void;
  deleteAllTeachers: () => Promise<void>;
  importTeachers: (newTeachers: Teacher[], options?: { duplicateMode?: 'skip' | 'update' }) => Promise<{ success: boolean; added: number; updated: number; message?: string; isOfflineQuota?: boolean }>;
  updateTeacher: (id: string, data: Partial<Teacher>) => void;
  addTeacher: (teacher: Teacher) => void;
  updateDepartment: (id: string, data: Partial<Department>) => void;
  deleteDepartment: (id: string) => void;
  addDepartment: (dept: Department) => void;
  addDisciplineRecord: (record: DisciplineRecord) => void;
  updateDisciplineRecord: (id: string, data: Partial<DisciplineRecord>) => void;
  deleteDisciplineRecord: (id: string) => Promise<void>;
  deleteDisciplineRecords: (ids: string[]) => Promise<void>;
  addDisciplineCriterion: (criterion: DisciplineCriterion) => Promise<void>;
  updateDisciplineCriterion: (id: string, data: Partial<DisciplineCriterion>) => Promise<void>;
  deleteDisciplineCriterion: (id: string) => Promise<void>;
  addGeneralKpi: (kpi: GeneralKpi) => Promise<void>;
  updateGeneralKpi: (id: string, data: Partial<GeneralKpi>) => Promise<void>;
  deleteGeneralKpi: (id: string) => Promise<void>;
  addKpiGroup: (group: KpiGroup) => Promise<void>;
  updateKpiGroup: (id: string, data: Partial<KpiGroup>) => Promise<void>;
  deleteKpiGroup: (id: string, options?: { cascade?: boolean; targetGroupId?: string; deleteRecords?: boolean }) => Promise<void>;
  addKpiCategory: (category: KpiCategory) => Promise<void>;
  updateKpiCategory: (id: string, data: Partial<KpiCategory>) => Promise<void>;
  deleteKpiCategory: (id: string, options?: { cascade?: boolean; targetCategoryId?: string; deleteRecords?: boolean }) => Promise<void>;
  addKpi: (kpi: KpiItem) => Promise<void>;
  updateKpi: (id: string, data: Partial<KpiItem>) => Promise<void>;
  deleteKpi: (id: string, deleteAssociatedRecords?: boolean) => Promise<void>;
  addKpiRecord: (record: KpiRecord) => Promise<void>;
  updateKpiRecord: (id: string, data: Partial<KpiRecord>) => Promise<void>;
  deleteKpiRecord: (id: string) => Promise<void>;
  addKpiEvaluationForm: (form: KpiEvaluationForm) => Promise<void>;
  updateKpiEvaluationForm: (id: string, data: Partial<KpiEvaluationForm>) => Promise<void>;
  deleteKpiEvaluationForm: (id: string) => Promise<void>;
  saveKpiMonthlySetting: (setting: KpiMonthlySetting) => Promise<void>;
  addTask: (task: Task) => void;
  updateTask: (id: string, data: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addWorkAssignment: (assignment: WorkAssignment) => Promise<void>;
  updateWorkAssignment: (id: string, data: Partial<WorkAssignment>) => Promise<void>;
  deleteWorkAssignment: (id: string) => Promise<void>;
  importWorkAssignments: (assignments: WorkAssignment[]) => Promise<void>;
  seedOrResetSchoolTasks: () => Promise<void>;
  addCalendarEvent: (event: CalendarEvent) => void;
  updateCalendarEvent: (id: string, data: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;
  addNotification: (notification: Notification) => void;
  updateNotification: (id: string, data: Partial<Notification>) => void;
  deleteNotification: (id: string) => void;
  addReport: (report: Report) => Promise<void>;
  updateReport: (id: string, data: Partial<Report>) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  checkAndRepairKpiData: () => Promise<{ checkedGroups: number; checkedKpis: number; orphanedCount: number; repairedCount: number }>;
  updateSchoolStats: (stats: Partial<SchoolStats>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);


const sanitize = <T extends Record<string, any>>(data: T): T => {
  const cleanDeep = (obj: any): any => {
    if (obj === undefined) return undefined;
    if (obj === null) return null;
    if (typeof obj === 'number') {
      return Number.isNaN(obj) ? 0 : obj;
    }
    if (Array.isArray(obj)) {
      return obj
        .map(cleanDeep)
        .filter(item => item !== undefined);
    }
    if (typeof obj === 'object' && !(obj instanceof Date)) {
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          const cv = cleanDeep(value);
          if (cv !== undefined) {
            cleaned[key] = cv;
          }
        }
      }
      return cleaned;
    }
    return obj;
  };
  return (cleanDeep(data) || {}) as T;
};

const handleDbError = (e: any) => {
  reportFirestoreError(e, 'AppContext.write');
  console.error("Firebase error:", e);
};

const APP_CORE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for core collections
const APP_LAZY_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for on-demand module collections


const defaultEvalCategories: EvaluationCategory[] = [
  { id: 'cat_noiquy', name: 'THỰC HIỆN NỘI QUY CƠ QUAN', order: 1, status: 'active' },
  { id: 'cat_chuyenmon', name: 'THỰC HIỆN QUY CHẾ CHUYÊN MÔN', order: 2, status: 'active' },
  { id: 'cat_vanhoa', name: 'VĂN HÓA CÔNG SỞ', order: 3, status: 'active' },
  { id: 'cat_thongtin', name: 'THÔNG TIN, BÁO CÁO', order: 4, status: 'active' }
];

const defaultEvalCriteria: EvaluationCriterion[] = [
  { id: 'crit_nq_1', categoryId: 'cat_noiquy', name: 'Chấp hành thời gian làm việc', order: 1, status: 'active' },
  { id: 'crit_nq_2', categoryId: 'cat_noiquy', name: 'Thực hiện đúng giờ làm việc', order: 2, status: 'active' },
  { id: 'crit_nq_3', categoryId: 'cat_noiquy', name: 'Chấp hành quy định nghỉ phép, nghỉ việc', order: 3, status: 'active' },
  { id: 'crit_nq_4', categoryId: 'cat_noiquy', name: 'Chấp hành quy định của nhà trường', order: 4, status: 'active' },
  { id: 'crit_nq_5', categoryId: 'cat_noiquy', name: 'Thực hiện nhiệm vụ trực, trực cơ quan theo phân công', order: 5, status: 'active' },
  { id: 'crit_nq_6', categoryId: 'cat_noiquy', name: 'Chấp hành các quy định về bảo vệ tài sản công', order: 6, status: 'active' },
  { id: 'crit_nq_7', categoryId: 'cat_noiquy', name: 'Chấp hành quy định về an toàn, an ninh trường học', order: 7, status: 'active' },
  { id: 'crit_nq_8', categoryId: 'cat_noiquy', name: 'Thực hiện các quy định khác của cơ quan', order: 8, status: 'active' },
  
  { id: 'crit_cm_1', categoryId: 'cat_chuyenmon', name: 'Thực hiện đầy đủ hồ sơ chuyên môn', order: 1, status: 'active' },
  { id: 'crit_cm_2', categoryId: 'cat_chuyenmon', name: 'Thực hiện kế hoạch giáo dục', order: 2, status: 'active' },
  { id: 'crit_cm_3', categoryId: 'cat_chuyenmon', name: 'Thực hiện đúng tiến độ chương trình', order: 3, status: 'active' },
  { id: 'crit_cm_4', categoryId: 'cat_chuyenmon', name: 'Thực hiện kiểm tra, đánh giá học sinh', order: 4, status: 'active' },
  { id: 'crit_cm_5', categoryId: 'cat_chuyenmon', name: 'Thực hiện nhập điểm/cập nhật dữ liệu đúng thời hạn', order: 5, status: 'active' },
  { id: 'crit_cm_6', categoryId: 'cat_chuyenmon', name: 'Thực hiện các nhiệm vụ chuyên môn được phân công', order: 6, status: 'active' },
  { id: 'crit_cm_7', categoryId: 'cat_chuyenmon', name: 'Tham gia sinh hoạt tổ/nhóm chuyên môn', order: 7, status: 'active' },
  { id: 'crit_cm_8', categoryId: 'cat_chuyenmon', name: 'Thực hiện các quy định chuyên môn của nhà trường', order: 8, status: 'active' },
  { id: 'crit_cm_9', categoryId: 'cat_chuyenmon', name: 'Thực hiện nhiệm vụ bồi dưỡng chuyên môn', order: 9, status: 'active' },
  { id: 'crit_cm_10', categoryId: 'cat_chuyenmon', name: 'Thực hiện chế độ báo cáo chuyên môn', order: 10, status: 'active' },

  { id: 'crit_vh_1', categoryId: 'cat_vanhoa', name: 'Giao tiếp với đồng nghiệp', order: 1, status: 'active' },
  { id: 'crit_vh_2', categoryId: 'cat_vanhoa', name: 'Giao tiếp với học sinh, cha mẹ học sinh', order: 2, status: 'active' },
  { id: 'crit_vh_3', categoryId: 'cat_vanhoa', name: 'Tinh thần phối hợp, trách nhiệm', order: 3, status: 'active' },
  { id: 'crit_vh_4', categoryId: 'cat_vanhoa', name: 'Tác phong, trang phục làm việc', order: 4, status: 'active' },
  { id: 'crit_vh_5', categoryId: 'cat_vanhoa', name: 'Ứng xử văn minh, giữ gìn hình ảnh', order: 5, status: 'active' },

  { id: 'crit_tt_1', categoryId: 'cat_thongtin', name: 'Thực hiện báo cáo đúng thời hạn', order: 1, status: 'active' },
  { id: 'crit_tt_2', categoryId: 'cat_thongtin', name: 'Cung cấp thông tin đầy đủ, chính xác', order: 2, status: 'active' },
  { id: 'crit_tt_3', categoryId: 'cat_thongtin', name: 'Không để chậm trễ báo cáo', order: 3, status: 'active' },
  
  { id: 'crit_vh_1', categoryId: 'cat_vanhoa', name: 'Giao tiếp, ứng xử với đồng nghiệp', order: 1, status: 'active' },
  { id: 'crit_vh_2', categoryId: 'cat_vanhoa', name: 'Giao tiếp, ứng xử với học sinh', order: 2, status: 'active' },
  { id: 'crit_vh_3', categoryId: 'cat_vanhoa', name: 'Giao tiếp, ứng xử với phụ huynh', order: 3, status: 'active' },
  { id: 'crit_vh_4', categoryId: 'cat_vanhoa', name: 'Tinh thần phối hợp trong công việc', order: 4, status: 'active' },
  { id: 'crit_vh_5', categoryId: 'cat_vanhoa', name: 'Ý thức trách nhiệm', order: 5, status: 'active' },
  { id: 'crit_vh_6', categoryId: 'cat_vanhoa', name: 'Tác phong làm việc', order: 6, status: 'active' },
  { id: 'crit_vh_7', categoryId: 'cat_vanhoa', name: 'Trang phục, hình thức phù hợp môi trường giáo dục', order: 7, status: 'active' },
  { id: 'crit_vh_8', categoryId: 'cat_vanhoa', name: 'Giữ gìn môi trường làm việc', order: 8, status: 'active' },
  { id: 'crit_vh_9', categoryId: 'cat_vanhoa', name: 'Sử dụng ngôn ngữ, thái độ phù hợp', order: 9, status: 'active' },
  { id: 'crit_vh_10', categoryId: 'cat_vanhoa', name: 'Giữ gìn hình ảnh, uy tín của nhà trường', order: 10, status: 'active' }
];

export const DEFAULT_DEPARTMENTS: Department[] = [
  { id: 'd_toan_ly_tin_cn', name: 'Tổ Toán-Lý-Tin-CN', headId: 't1792151918417_l39r3d' }, // GV14 Hà Thị Thu Hương (Tổ trưởng)
  { id: 'd_van_su_dia_gdkt_pl_an', name: 'Tổ Văn-Sử-Địa-GDKT&PL-AN', headId: 't1792151918417_jhnv8l' }, // GV34 Đặng Xuân Thành (Tổ trưởng)
  { id: 'd_hoa_sinh_gdtc_qpan_nn', name: 'Tổ Hóa-Sinh-GDTC-QPAN-NN', headId: 't1792151918417_8odnav' }, // GV17 Nguyễn Trung Kiên (Tổ trưởng)
  { id: 'd_hoa_ly_sinh_gdqpan_nn', name: 'Tổ Hóa-Sinh-GDTC-QPAN-NN', headId: 't1792151918417_8odnav' }, // GV17 Nguyễn Trung Kiên (Tổ trưởng)
  { id: 'd_van_phong', name: 'Tổ Văn phòng', headId: 't1792151918417_4l9424' } // BGH 01 Nguyễn Quang Sáng (Hiệu trưởng)
];

const inMemoryCollectionCache = new Map<string, any>();

export const getLocalCollectionCache = <T,>(collectionKey: string, defaultValue: T): T => {
  if (inMemoryCollectionCache.has(collectionKey)) {
    return inMemoryCollectionCache.get(collectionKey) as T;
  }
  try {
    const raw = localStorage.getItem(`app_cache_${collectionKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as T;
      if (!Array.isArray(parsed) && parsed !== null && parsed !== undefined) return parsed as T;
    }
  } catch (e) {
    console.warn(`Error reading cache for ${collectionKey}:`, e);
  }
  return defaultValue;
};

export const setLocalCollectionCache = (collectionKey: string, data: any): void => {
  try {
    inMemoryCollectionCache.set(collectionKey, data);
    // Không ghi lặp toàn bộ các collection lớn vào localStorage để tránh vượt hạn mức 5MB của Firestore/trình duyệt
    // Lưu toàn bộ vào IndexedDB và chỉ lưu vào localStorage đối với dữ liệu nhỏ (< 120KB)
    idbCacheSet(`app_cache_${collectionKey}`, data).catch(() => {});
    const serialized = JSON.stringify(data);
    if (serialized.length <= 120_000) {
      safeLocalStorageSet(`app_cache_${collectionKey}`, serialized, { maxItemChars: 120_000 });
    }
  } catch (e) {
    // ignore quota
  }
};

export const getCachedDepartments = (): Department[] => {
  try {
    const cached = localStorage.getItem('app_cached_departments') || localStorage.getItem('app_cache_departments');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading cached departments:', e);
  }
  return DEFAULT_DEPARTMENTS;
};

export const getCachedTeachers = (): Teacher[] => {
  try {
    const cached = localStorage.getItem('app_cached_teachers') || localStorage.getItem('app_cache_teachers');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length >= 40) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading cached teachers:', e);
  }
  return DEFAULT_TEACHERS;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>({
    teachers: getCachedTeachers(),
    departments: getCachedDepartments(),
    tasks: getLocalCollectionCache<Task[]>('tasks', []),
    workAssignments: getLocalCollectionCache<WorkAssignment[]>('workAssignments', []),
    reports: getLocalCollectionCache<Report[]>('reports', []),
    disciplineRecords: getLocalCollectionCache<DisciplineRecord[]>('disciplineRecords', []),
    disciplineCriteria: getLocalCollectionCache<DisciplineCriterion[]>('disciplineCriteria', []),
    generalKpis: getLocalCollectionCache<GeneralKpi[]>('generalKpis', []),
    kpiGroups: getLocalCollectionCache<KpiGroup[]>('kpiGroups', []),
    kpiCategories: getLocalCollectionCache<KpiCategory[]>('kpiCategories', []),
    kpis: getLocalCollectionCache<KpiItem[]>('kpis', []),
    kpiRecords: getLocalCollectionCache<KpiRecord[]>('kpiRecords', []),
    kpiEvaluationForms: getLocalCollectionCache<KpiEvaluationForm[]>('kpi_evaluation_forms', []),
    kpiMonthlySettings: getLocalCollectionCache<KpiMonthlySetting[]>('kpiMonthlySettings', []),
    evaluationCategories: getLocalCollectionCache<EvaluationCategory[]>('evaluationCategories', defaultEvalCategories),
    evaluationCriteria: getLocalCollectionCache<EvaluationCriterion[]>('evaluationCriteria', defaultEvalCriteria),
    notifications: getLocalCollectionCache<Notification[]>('notifications', []),
    calendarEvents: getLocalCollectionCache<CalendarEvent[]>('calendarEvents', []),
    leaveRecords: getLocalCollectionCache<LeaveRecord[]>('leaveRecords', []),
    attendanceRecords: getLocalCollectionCache<AttendanceRecord[]>('attendance', []),
    students: getLocalCollectionCache<Student[]>('students', []),
    classes: getLocalCollectionCache<ClassInfo[]>('classes', []),
    schoolStats: getLocalCollectionCache<SchoolStats>('schoolStats', {
      totalTeachers: 42,
      totalStudents: 1236,
      totalClasses: 36,
      schoolYear: '2026 - 2027',
      motto: 'Nơi chắp cánh những ước mơ',
      welcomeMessage: 'Chào mừng bạn!'
    }),
    modules: (() => {
      try {
        const stored = localStorage.getItem('app_system_modules');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
      return DEFAULT_SYSTEM_MODULES;
    })(),
    kpiStaffForms: loadStaffFormsFromCache(),
    kpiStaffPeriods: loadStaffPeriodsFromCache(),
    kpiStaffCriteria: DEFAULT_STAFF_CRITERIA,
    loading: false,
    error: null,
  });

  const isAdminOrBghUser = Boolean(
    user && (
      user.id === 'admin' ||
      user.username === 'admin' ||
      user.role === 'admin' ||
      user.role === 'BGH' ||
      user.roleGroup === 'ADMIN' ||
      user.roleGroup === 'BGH'
    )
  );

  const schoolStatsLoadedFromDbRef = useRef<boolean>(false);
  const lastSyncedClassesCountRef = useRef<number | null>(null);
  const hasSeededSchoolStatsRef = useRef<boolean>(false);
  const hasSyncedGroupIdsRef = useRef<boolean>(false);
  const loadedLazyKeysRef = useRef<Set<LazyAppCollectionKey>>(new Set());
  const [quotaEpoch, setQuotaEpoch] = useState<number>(0);

  // Sync manual retry epoch from centralized quota manager
  useEffect(() => {
    return subscribeQuotaManager((qState) => {
      setQuotaEpoch(qState.epoch);
    });
  }, []);

  // One-time safe background cache sync of canonical VC data (does not open Firestore listeners)
  useEffect(() => {
    if (!user?.id) return;
    const vcSyncKey = 'thpt_sl_vc_cache_hydrated_v1';
    try {
      if (sessionStorage.getItem(vcSyncKey) === '1') return;
      sessionStorage.setItem(vcSyncKey, '1');
    } catch {
      // ignore
    }
    syncCanonicalVcDataToStorageAndFirestore(false).catch(err => {
      console.warn('Auto sync VC data notice:', err);
    });
  }, [user?.id]);

  // Helper to fetch a collection with 5-minute TTL cache & quota circuit breaker protection
  const fetchCollectionCached = useCallback(
    async <T,>(
      colName: string,
      stateKey: keyof AppState,
      options?: { force?: boolean; forceManual?: boolean; maxDocs?: number; transform?: (items: any[]) => T; fallback: () => T }
    ): Promise<T> => {
      const cacheKey = `appcol:${colName}`;
      return cachedFirestoreFetch<T>(
        cacheKey,
        APP_CORE_TTL_MS,
        async () => {
          const ref = options?.maxDocs
            ? query(collection(db, colName), limit(options.maxDocs))
            : collection(db, colName);
          const snap = await getDocs(ref);
          const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const transformed = options?.transform ? options.transform(raw) : (raw as unknown as T);
          if (stateKey === 'teachers') {
            safeLocalStorageSet('app_cached_teachers', JSON.stringify(transformed));
          } else if (stateKey === 'departments') {
            safeLocalStorageSet('app_cached_departments', JSON.stringify(transformed));
          } else if (stateKey === 'modules') {
            safeLocalStorageSet('app_system_modules', JSON.stringify(transformed));
          } else {
            setLocalCollectionCache(colName, transformed);
          }
          setState((prev) => ({ ...prev, [stateKey]: transformed, error: null }));
          return transformed;
        },
        {
          force: options?.force,
          forceManual: options?.forceManual,
          fallback: options?.fallback
        }
      );
    },
    []
  );

  // On-demand lazy loader for module-specific collections (0 reads until user actually visits the module!)
  const ensureCollectionsLoaded = useCallback(
    async (keys: LazyAppCollectionKey[], options?: { force?: boolean }) => {
      if (!user?.id || keys.length === 0) return;
      const force = Boolean(options?.force);
      const tasks: Promise<any>[] = [];

      for (const k of keys) {
        loadedLazyKeysRef.current.add(k);
        if (k === 'workAssignments') {
          tasks.push(
            fetchCollectionCached<WorkAssignment[]>('workAssignments', 'workAssignments', {
              force,
              forceManual: force,
              fallback: () => getLocalCollectionCache<WorkAssignment[]>('workAssignments', [])
            }).catch(() => {})
          );
        } else if (k === 'reports') {
          tasks.push(
            fetchCollectionCached<Report[]>('reports', 'reports', {
              force,
              forceManual: force,
              maxDocs: 200,
              fallback: () => getLocalCollectionCache<Report[]>('reports', [])
            }).catch(() => {})
          );
        } else if (k === 'tasks') {
          tasks.push(
            fetchCollectionCached<Task[]>('tasks', 'tasks', {
              force,
              forceManual: force,
              maxDocs: 200,
              fallback: () => getLocalCollectionCache<Task[]>('tasks', [])
            }).catch(() => {})
          );
        } else if (k === 'calendarEvents') {
          tasks.push(
            fetchCollectionCached<CalendarEvent[]>('calendarEvents', 'calendarEvents', {
              force,
              forceManual: force,
              maxDocs: 300,
              fallback: () => getLocalCollectionCache<CalendarEvent[]>('calendarEvents', [])
            }).catch(() => {})
          );
        } else if (k === 'leaveRecords') {
          tasks.push(
            fetchCollectionCached<LeaveRecord[]>('leaveRecords', 'leaveRecords', {
              force,
              forceManual: force,
              maxDocs: 300,
              fallback: () => getLocalCollectionCache<LeaveRecord[]>('leaveRecords', [])
            }).catch(() => {})
          );
        } else if (k === 'attendance') {
          tasks.push(
            fetchCollectionCached<AttendanceRecord[]>('attendance', 'attendanceRecords', {
              force,
              forceManual: force,
              maxDocs: 400,
              fallback: () => getLocalCollectionCache<AttendanceRecord[]>('attendance', [])
            }).catch(() => {})
          );
        } else if (k === 'kpiStaff') {
          tasks.push(
            cachedFirestoreFetch<KpiStaffForm[]>(
              'appcol:kpi_staff_forms',
              APP_LAZY_TTL_MS,
              async () => {
                const forms = await fetchStaffFormsFromFirestore();
                setState((prev) => ({ ...prev, kpiStaffForms: forms }));
                return forms;
              },
              {
                force,
                forceManual: force,
                fallback: () => loadStaffFormsFromCache()
              }
            ).catch(() => {})
          );
          tasks.push(
            cachedFirestoreFetch<KpiStaffPeriod[]>(
              'appcol:kpi_staff_periods',
              APP_LAZY_TTL_MS,
              async () => {
                const periods = await ensureStaffPeriodsInFirestore();
                setState((prev) => ({ ...prev, kpiStaffPeriods: periods }));
                return periods;
              },
              {
                force,
                forceManual: force,
                fallback: () => loadStaffPeriodsFromCache()
              }
            ).catch(() => {})
          );
        }
      }

      if (tasks.length > 0) {
        await Promise.allSettled(tasks);
      }
    },
    [user?.id, fetchCollectionCached]
  );

  const setKpiStaffForms = (forms: KpiStaffForm[], options?: { skipFirestoreSync?: boolean }) => {
    setState(prev => ({ ...prev, kpiStaffForms: forms }));
    saveStaffFormsToCache(forms);
    invalidateFirestoreCache('appcol:kpi_staff_forms');
    if (!options?.skipFirestoreSync) {
      forms.forEach(f => {
        saveStaffFormToFirestore(f).catch(err => {
          reportFirestoreError(err, 'AppContext.setKpiStaffForms');
          console.error('Error syncing staff form to Firestore:', err);
        });
      });
    }
  };

  const setKpiStaffPeriods = (periods: KpiStaffPeriod[]) => {
    setState(prev => ({ ...prev, kpiStaffPeriods: periods }));
    saveStaffPeriodsToCache(periods);
    invalidateFirestoreCache('appcol:kpi_staff_periods');
  };

  const setKpiStaffCriteria = (criteria: KpiStaffCriterion[]) => {
    setState(prev => ({ ...prev, kpiStaffCriteria: criteria }));
  };

  // Core lightweight data fetch on login (6 essential collections via 5-min TTL cache, ZERO permanent onSnapshot storms!)
  useEffect(() => {
    if (!user?.id) return;

    let isCancelled = false;
    const isManualRetry = quotaEpoch > 0;

    const loadCoreData = async () => {
      if (!canAttemptFirestoreRead({ forceManual: isManualRetry })) {
        return;
      }

      await Promise.allSettled([
        // 1. Teachers
        fetchCollectionCached<Teacher[]>('teachers', 'teachers', {
          force: isManualRetry,
          forceManual: isManualRetry,
          transform: (raw) => (raw.length > 0 ? (raw as Teacher[]) : DEFAULT_TEACHERS),
          fallback: () => getCachedTeachers()
        }),
        // 2. Departments (4 docs)
        fetchCollectionCached<Department[]>('departments', 'departments', {
          force: isManualRetry,
          forceManual: isManualRetry,
          transform: (raw) => {
            if (!raw || raw.length === 0) return DEFAULT_DEPARTMENTS;
            return raw.map((d: any) => {
              const lower = (d.name || '').toLowerCase();
              if (lower.includes('toán') || lower.includes('toan')) return { ...d, name: 'Tổ Toán-Lý-Tin-CN' };
              if (lower.includes('văn') && (lower.includes('sử') || lower.includes('địa') || lower.includes('gdkt'))) {
                return { ...d, name: 'Tổ Văn-Sử-Địa-GDKT&PL-AN' };
              }
              if (lower.includes('hóa') || lower.includes('sinh') || lower.includes('gdtc') || lower.includes('qpan')) {
                return { ...d, name: 'Tổ Hóa-Sinh-GDTC-QPAN-NN' };
              }
              return d;
            });
          },
          fallback: () => getCachedDepartments()
        }),
        // 3. Classes (36 docs)
        fetchCollectionCached<ClassInfo[]>('classes', 'classes', {
          force: isManualRetry,
          forceManual: isManualRetry,
          fallback: () => getLocalCollectionCache<ClassInfo[]>('classes', [])
        }),
        // 4. Notifications (bounded to 50 most recent docs)
        fetchCollectionCached<Notification[]>('notifications', 'notifications', {
          force: isManualRetry,
          forceManual: isManualRetry,
          maxDocs: 50,
          fallback: () => getLocalCollectionCache<Notification[]>('notifications', [])
        }),
        // 5. System modules
        fetchCollectionCached<SystemModule[]>('system_modules', 'modules', {
          force: isManualRetry,
          forceManual: isManualRetry,
          transform: (raw) => {
            if (!raw || raw.length === 0) return DEFAULT_SYSTEM_MODULES;
            const list = raw as SystemModule[];
            list.sort((a, b) => (a.order || 0) - (b.order || 0));
            return list;
          },
          fallback: () => DEFAULT_SYSTEM_MODULES
        }),
        // 6. School stats (1 single document)
        cachedFirestoreFetch<SchoolStats | null>(
          'appcol:schoolStats',
          APP_CORE_TTL_MS,
          async () => {
            const statsDocRef = doc(db, 'systemSettings', 'schoolStats');
            const snap = await getDoc(statsDocRef);
            if (isCancelled) return null;
            if (snap.exists()) {
              schoolStatsLoadedFromDbRef.current = true;
              const d = snap.data() as Partial<SchoolStats>;
              const merged: SchoolStats = {
                totalTeachers: d.totalTeachers ?? 42,
                totalStudents: d.totalStudents ?? 1236,
                totalClasses: d.totalClasses ?? 36,
                schoolYear: d.schoolYear ?? '2026 - 2027',
                motto: d.motto ?? 'Nơi chắp cánh những ước mơ',
                welcomeMessage: d.welcomeMessage ?? 'Chào mừng bạn!'
              };
              setLocalCollectionCache('schoolStats', merged);
              setState((prev) => ({
                ...prev,
                schoolStats: {
                  ...merged,
                  totalTeachers: d.totalTeachers ?? (prev.teachers.length > 0 ? prev.teachers.length : 42)
                }
              }));
              return merged;
            } else if (isAdminOrBghUser && !hasSeededSchoolStatsRef.current && navigator.onLine) {
              hasSeededSchoolStatsRef.current = true;
              const defaults: SchoolStats = {
                totalTeachers: 42,
                totalStudents: 1236,
                totalClasses: 36,
                schoolYear: '2026 - 2027',
                motto: 'Nơi chắp cánh những ước mơ',
                welcomeMessage: 'Chào mừng bạn!'
              };
              setDoc(statsDocRef, defaults, { merge: true }).catch(() => {});
              return defaults;
            }
            return null;
          },
          {
            force: isManualRetry,
            forceManual: isManualRetry,
            fallback: () => getLocalCollectionCache<SchoolStats | null>('schoolStats', null)
          }
        )
      ]);

      // If this was a manual retry ("Thử đồng bộ lại"), also refresh any lazy collections the user already visited
      if (isManualRetry && loadedLazyKeysRef.current.size > 0 && !isCancelled) {
        await ensureCollectionsLoaded(Array.from(loadedLazyKeysRef.current), { force: true });
      }

      if (!isCancelled) {
        setState((prev) => ({ ...prev, loading: false }));
      }
    };

    loadCoreData();

    return () => {
      isCancelled = true;
    };
  }, [user?.id, isAdminOrBghUser, quotaEpoch, fetchCollectionCached, ensureCollectionsLoaded]);

  // Auto-sync totalClasses from active classes collection (strictly outside setState updater, Admin/BGH only)
  useEffect(() => {
    if (!user?.id || !isAdminOrBghUser || !schoolStatsLoadedFromDbRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const activeClassesCount = state.classes ? state.classes.filter(c => c.status !== 'inactive').length : 0;
    if (
      activeClassesCount > 0 &&
      activeClassesCount !== state.schoolStats.totalClasses &&
      lastSyncedClassesCountRef.current !== activeClassesCount
    ) {
      lastSyncedClassesCountRef.current = activeClassesCount;
      const updatedStats = {
        ...state.schoolStats,
        totalClasses: activeClassesCount
      };
      setState(prev => ({ ...prev, schoolStats: updatedStats }));
      setDoc(doc(db, 'systemSettings', 'schoolStats'), sanitize(updatedStats), { merge: true }).catch(() => {});
    }
  }, [user?.id, isAdminOrBghUser, state.classes, state.schoolStats.totalClasses]);

  // Tự động kiểm tra và chuẩn hóa liên kết groupId cho kpis (chỉ chạy tối đa 1 lần mỗi phiên cho Admin/BGH)
  useEffect(() => {
    if (!user?.id || !isAdminOrBghUser || hasSyncedGroupIdsRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (state.kpiGroups.length === 0 || state.kpis.length === 0) return;

    hasSyncedGroupIdsRef.current = true;

    const autoSyncMissingGroupIds = async () => {
      try {
        const batch = writeBatch(db);
        let hasChanges = false;

        // 1. Đồng bộ groupId cho các tiêu chí KPI chưa có hoặc sai groupId
        state.kpis.forEach(kpi => {
          const targetGroupId = kpi.groupId;
          const groupExists = targetGroupId && state.kpiGroups.some(g => g.id === targetGroupId);

          if (!groupExists) {
            const matched = state.kpiGroups.find(
              g => g.id === targetGroupId ||
                   (kpi.group && g.name.trim().toLowerCase() === kpi.group.trim().toLowerCase()) ||
                   (kpi.group && g.code.trim().toLowerCase() === kpi.group.trim().toLowerCase())
            );
            if (matched) {
              const kpiRef = doc(db, 'kpis', kpi.id);
              batch.update(kpiRef, {
                groupId: matched.id,
                group_id: matched.id,
                updatedAt: new Date().toISOString()
              });
              hasChanges = true;
            }
          }

          // 2. Đồng bộ categoryId nếu tiêu chí chưa có categoryId nhưng có groupId và kpiCategories có dữ liệu
          if ((!kpi.categoryId || !kpi.category_id) && (kpi.groupId || kpi.group_id) && state.kpiCategories.length > 0) {
            const currentGroupId = kpi.groupId || kpi.group_id;
            const matchedCat = state.kpiCategories.find(c => c.groupId === currentGroupId || c.group_id === currentGroupId);
            if (matchedCat) {
              const kpiRef = doc(db, 'kpis', kpi.id);
              batch.update(kpiRef, {
                categoryId: matchedCat.id,
                category_id: matchedCat.id,
                categoryName: matchedCat.name,
                updatedAt: new Date().toISOString()
              });
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          await batch.commit();
        }
      } catch (err) {
        console.warn('Auto KPI group/category migration error:', err);
      }
    };

    autoSyncMissingGroupIds();
  }, [user?.id, isAdminOrBghUser, state.kpiGroups, state.kpiCategories, state.kpis]);

  const updateTaskStatus = async (taskId: string, status: Task['status'], progress?: number) => {
    try {
      const data: any = { status };
      if (progress !== undefined) data.progress = progress;
      setState(prev => {
        const updated = prev.tasks.map(t => t.id === taskId ? { ...t, ...data } : t);
        setLocalCollectionCache('tasks', updated);
        return { ...prev, tasks: updated };
      });
      await updateDoc(doc(db, 'tasks', taskId), data);
      invalidateFirestoreCache('appcol:tasks');
    } catch (e) { handleDbError(e); }
  };

  const markNotificationRead = async (id: string) => {
    try {
      setState(prev => {
        const updated = prev.notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
        setLocalCollectionCache('notifications', updated);
        return { ...prev, notifications: updated };
      });
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
      invalidateFirestoreCache('appcol:notifications');
    } catch (e) { handleDbError(e); }
  };

  const deleteTeacher = async (id: string) => {
    setState(prev => {
      const updated = prev.teachers.filter(t => t.id !== id);
      safeLocalStorageSet('app_cached_teachers', JSON.stringify(updated));
      return { ...prev, teachers: updated };
    });
    try {
      await deleteDoc(doc(db, 'teachers', id));
      await setDoc(doc(db, 'systemSettings', 'teachersState'), { initialized: true }, { merge: true });
      invalidateFirestoreCache('appcol:teachers');
    } catch (e) {
      handleDbError(e);
      throw e;
    }
  };

  const deleteAllTeachers = async () => {
    try {
      const snap = await getDocs(collection(db, 'teachers'));
      if (!snap.empty) {
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
      setState(prev => {
        safeLocalStorageSet('app_cached_teachers', JSON.stringify([]));
        return { ...prev, teachers: [] };
      });
      await setDoc(doc(db, 'systemSettings', 'teachersState'), { initialized: true, isEmpty: true }, { merge: true });
      invalidateFirestoreCache('appcol:teachers');
    } catch (e) {
      handleDbError(e);
      throw e;
    }
  };

  const importTeachers = async (
    newTeachers: Teacher[],
    options?: { duplicateMode?: 'skip' | 'update' }
  ): Promise<{ success: boolean; added: number; updated: number; message?: string; isOfflineQuota?: boolean }> => {
    const duplicateMode = options?.duplicateMode || 'skip';
    let addedCount = 0;
    let updatedCount = 0;

    let currentTeachers = [...state.teachers];
    const teachersToWrite: Teacher[] = [];

    for (const incoming of newTeachers) {
      const existingIdx = currentTeachers.findIndex(t => 
        (incoming.id && t.id === incoming.id) ||
        (incoming.code && t.code && t.code.trim().toLowerCase() === incoming.code.trim().toLowerCase())
      );

      if (existingIdx >= 0) {
        if (duplicateMode === 'update') {
          const merged: Teacher = {
            ...currentTeachers[existingIdx],
            ...incoming,
            id: currentTeachers[existingIdx].id
          };
          currentTeachers[existingIdx] = merged;
          teachersToWrite.push(merged);
          updatedCount++;
        }
      } else {
        const item: Teacher = {
          ...incoming,
          id: incoming.id || `t${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        };
        currentTeachers.push(item);
        teachersToWrite.push(item);
        addedCount++;
      }
    }

    // 1. Immediately update state & localStorage safely
    setState(prev => ({ ...prev, teachers: currentTeachers }));
    safeLocalStorageSet('app_cached_teachers', JSON.stringify(currentTeachers));

    // 2. Persist to Firestore in chunks of 200
    let quotaErrorOccurred = false;
    try {
      const CHUNK_SIZE = 200;
      for (let i = 0; i < teachersToWrite.length; i += CHUNK_SIZE) {
        const chunk = teachersToWrite.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(t => {
          const ref = doc(db, 'teachers', t.id);
          batch.set(ref, sanitize(t), { merge: true });
        });
        await batch.commit();
      }
      invalidateFirestoreCache('appcol:teachers');
    } catch (e: any) {
      console.warn("Could not write teachers chunk to Firestore:", e);
      if (e?.code === 'resource-exhausted' || (e?.message && e.message.toLowerCase().includes('quota'))) {
        quotaErrorOccurred = true;
      }
      handleDbError(e);
    }

    return {
      success: true,
      added: addedCount,
      updated: updatedCount,
      isOfflineQuota: quotaErrorOccurred,
      message: quotaErrorOccurred
        ? `Đã lưu thành công ${addedCount} bản ghi mới và cập nhật ${updatedCount} bản ghi vào bộ nhớ hệ thống (Firestore đang đạt hạn mức Quota Exceeded).`
        : `Đã lưu thành công ${addedCount} bản ghi mới và cập nhật ${updatedCount} bản ghi.`
    };
  };

  const updateTeacher = async (id: string, data: Partial<Teacher>) => {
    setState(prev => {
      const updated = prev.teachers.map(t => t.id === id ? { ...t, ...data } : t);
      safeLocalStorageSet('app_cached_teachers', JSON.stringify(updated));
      return { ...prev, teachers: updated };
    });
    try {
      await updateDoc(doc(db, 'teachers', id), sanitize(data));
      invalidateFirestoreCache('appcol:teachers');
    } catch (e) { handleDbError(e); }
  };

  const addTeacher = async (teacher: Teacher) => {
    if (!teacher.id) teacher.id = `t${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    setState(prev => {
      const updated = [...prev.teachers, teacher];
      safeLocalStorageSet('app_cached_teachers', JSON.stringify(updated));
      return { ...prev, teachers: updated };
    });
    try {
      await setDoc(doc(db, 'teachers', teacher.id), sanitize(teacher));
      invalidateFirestoreCache('appcol:teachers');
    } catch (e) { handleDbError(e); }
  };

  const updateDepartment = async (id: string, data: Partial<Department>) => {
    setState(prev => {
      const updated = prev.departments.map(d => d.id === id ? { ...d, ...data } : d);
      safeLocalStorageSet('app_cached_departments', JSON.stringify(updated));
      return { ...prev, departments: updated };
    });
    try {
      await updateDoc(doc(db, 'departments', id), sanitize(data));
      invalidateFirestoreCache('appcol:departments');
      if (data.headId) {
        await updateDoc(doc(db, 'teachers', data.headId), { departmentId: id });
        invalidateFirestoreCache('appcol:teachers');
      }
    } catch (e) { handleDbError(e); }
  };

  const deleteDepartment = async (id: string) => {
    setState(prev => {
      const updated = prev.departments.filter(d => d.id !== id);
      safeLocalStorageSet('app_cached_departments', JSON.stringify(updated));
      return { ...prev, departments: updated };
    });
    try {
      await deleteDoc(doc(db, 'departments', id));
      invalidateFirestoreCache('appcol:departments');
    } catch (e) { handleDbError(e); }
  };

  const addDepartment = async (dept: Department) => {
    if (!dept.id) dept.id = `d${Date.now()}_${Math.random()}`;
    setState(prev => {
      const exists = prev.departments.some(d => d.id === dept.id);
      const updated = exists ? prev.departments.map(d => d.id === dept.id ? dept : d) : [...prev.departments, dept];
      safeLocalStorageSet('app_cached_departments', JSON.stringify(updated));
      return { ...prev, departments: updated };
    });
    try {
      await setDoc(doc(db, 'departments', dept.id), sanitize(dept));
      invalidateFirestoreCache('appcol:departments');
    } catch (e) { handleDbError(e); }
  };

  
  const addDisciplineRecord = async (record: DisciplineRecord) => {
    try {
      if (!record.id) record.id = `dr${Date.now()}_${Math.random()}`;
      await setDoc(doc(db, 'disciplineRecords', record.id), sanitize(record));
    } catch (e) { handleDbError(e); }
  };

  const updateDisciplineRecord = async (id: string, data: Partial<DisciplineRecord>) => {
    try { await updateDoc(doc(db, 'disciplineRecords', id), sanitize(data)); } catch (e) { handleDbError(e); }
  };

  
  const addAttendanceRecord = async (record: Omit<AttendanceRecord, 'id'>) => {
    try {
      const id = `ar${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newRecord = { ...sanitize(record), id, createdAt: new Date().toISOString() } as AttendanceRecord;
      setState(prev => ({
        ...prev,
        attendanceRecords: [...prev.attendanceRecords.filter(a => !(a.teacherId === newRecord.teacherId && a.date === newRecord.date)), newRecord]
      }));
      await setDoc(doc(db, 'attendance', id), newRecord);
      invalidateFirestoreCache('appcol:attendance');
    } catch (err) {
      handleDbError(err);
      throw err;
    }
  };

  const updateAttendanceRecord = async (id: string, updates: Partial<AttendanceRecord>) => {
    try {
      const sanitizedUpdates = { ...sanitize(updates), updatedAt: new Date().toISOString() };
      setState(prev => ({
        ...prev,
        attendanceRecords: prev.attendanceRecords.map(a => a.id === id ? { ...a, ...sanitizedUpdates } : a)
      }));
      await setDoc(doc(db, 'attendance', id), sanitizedUpdates, { merge: true });
      invalidateFirestoreCache('appcol:attendance');
    } catch (err) {
      handleDbError(err);
      throw err;
    }
  };

  const deleteAttendanceRecord = async (id: string) => {
    try {
      setState(prev => ({
        ...prev,
        attendanceRecords: prev.attendanceRecords.filter(a => a.id !== id)
      }));
      await deleteDoc(doc(db, 'attendance', id));
      invalidateFirestoreCache('appcol:attendance');
    } catch (err) {
      handleDbError(err);
      throw err;
    }
  };

  const addLeaveRecord = async (record: Omit<LeaveRecord, 'id'>) => {
    try {
      const id = `lr${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newRecord = { ...sanitize(record), id } as LeaveRecord;
      setState(prev => ({
        ...prev,
        leaveRecords: [newRecord, ...prev.leaveRecords]
      }));
      await setDoc(doc(db, 'leaveRecords', id), newRecord);
      invalidateFirestoreCache('appcol:leaveRecords');
    } catch (e) { handleDbError(e); }
  };

  const updateLeaveRecord = async (id: string, updates: Partial<LeaveRecord>) => {
    try {
      const sanitizedUpdates = sanitize(updates);
      setState(prev => ({
        ...prev,
        leaveRecords: prev.leaveRecords.map(r => r.id === id ? { ...r, ...sanitizedUpdates } : r)
      }));
      await setDoc(doc(db, 'leaveRecords', id), sanitizedUpdates, { merge: true });
      invalidateFirestoreCache('appcol:leaveRecords');
    } catch (e) { handleDbError(e); }
  };

  const deleteLeaveRecord = async (id: string) => {
    try {
      setState(prev => ({
        ...prev,
        leaveRecords: prev.leaveRecords.filter(r => r.id !== id)
      }));
      await deleteDoc(doc(db, 'leaveRecords', id));
      invalidateFirestoreCache('appcol:leaveRecords');
    } catch (e) { handleDbError(e); }
  };


  const deleteDisciplineRecord = async (id: string) => {
    try {
      setState(prev => ({
        ...prev,
        disciplineRecords: prev.disciplineRecords.filter(r => r.id !== id)
      }));
      await deleteDoc(doc(db, 'disciplineRecords', id));
    } catch (e) {
      handleDbError(e);
    }
  };

  const deleteDisciplineRecords = async (ids: string[]) => {
    try {
      if (!ids || ids.length === 0) return;
      const idSet = new Set(ids);
      setState(prev => ({
        ...prev,
        disciplineRecords: prev.disciplineRecords.filter(r => !idSet.has(r.id))
      }));

      const chunkSize = 400;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, 'disciplineRecords', id));
        });
        await batch.commit();
      }
    } catch (e) {
      handleDbError(e);
    }
  };

  const addDisciplineCriterion = async (criterion: DisciplineCriterion) => {
    try {
      if (!criterion.id) criterion.id = `crit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await setDoc(doc(db, 'disciplineCriteria', criterion.id), sanitize(criterion));
    } catch (e) { handleDbError(e); }
  };

  const updateDisciplineCriterion = async (id: string, data: Partial<DisciplineCriterion>) => {
    try {
      await updateDoc(doc(db, 'disciplineCriteria', id), sanitize(data));
    } catch (e) { handleDbError(e); }
  };

  const deleteDisciplineCriterion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'disciplineCriteria', id));
    } catch (e) { handleDbError(e); }
  };

  const addGeneralKpi = async (kpi: GeneralKpi) => {
    try {
      if (!kpi.id) kpi.id = `kpic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      kpi.createdAt = new Date().toISOString();
      kpi.updatedAt = new Date().toISOString();
      setState(prev => ({
        ...prev,
        generalKpis: [...prev.generalKpis, kpi]
      }));
      await setDoc(doc(db, 'generalKpis', kpi.id), sanitize(kpi));
    } catch (e) { handleDbError(e); throw e; }
  };

  const updateGeneralKpi = async (id: string, data: Partial<GeneralKpi>) => {
    try {
      const updateData = { ...data, updatedAt: new Date().toISOString() };
      setState(prev => ({
        ...prev,
        generalKpis: prev.generalKpis.map(g => g.id === id ? { ...g, ...updateData } : g)
      }));
      await updateDoc(doc(db, 'generalKpis', id), sanitize(updateData));
    } catch (e) { handleDbError(e); throw e; }
  };

  const deleteGeneralKpi = async (id: string) => {
    try {
      const dependentGroups = state.kpiGroups.filter(g => g.generalKpiId === id);
      const dependentKpis = state.kpis.filter(k => k.generalKpiId === id);
      if (dependentGroups.length > 0 || dependentKpis.length > 0) {
        throw new Error(`Không thể xóa KPI chung này vì đang có ${dependentGroups.length} nhóm KPI và ${dependentKpis.length} tiêu chí trực thuộc. Vui lòng di chuyển hoặc xóa dữ liệu phụ thuộc trước.`);
      }

      setState(prev => ({
        ...prev,
        generalKpis: prev.generalKpis.filter(g => g.id !== id)
      }));
      await deleteDoc(doc(db, 'generalKpis', id));
    } catch (e) { handleDbError(e); throw e; }
  };

  const addKpiGroup = async (group: KpiGroup) => {
    try {
      if (!group.id) group.id = `kpig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      group.createdAt = new Date().toISOString();
      group.updatedAt = new Date().toISOString();
      setState(prev => ({
        ...prev,
        kpiGroups: [...prev.kpiGroups, group]
      }));
      await setDoc(doc(db, 'kpiGroups', group.id), sanitize(group));
    } catch (e) { handleDbError(e); throw e; }
  };

  const updateKpiGroup = async (id: string, data: Partial<KpiGroup>) => {
    try {
      const updateData = { ...data, updatedAt: new Date().toISOString() };
      setState(prev => ({
        ...prev,
        kpiGroups: prev.kpiGroups.map(g => g.id === id ? { ...g, ...updateData } : g)
      }));
      await updateDoc(doc(db, 'kpiGroups', id), sanitize(updateData));
    } catch (e) { handleDbError(e); throw e; }
  };

  const deleteKpiGroup = async (
    id: string, 
    options?: { cascade?: boolean; targetGroupId?: string; deleteRecords?: boolean }
  ) => {
    try {
      const childCats = state.kpiCategories.filter(c => c.groupId === id || c.group_id === id);
      const childKpis = state.kpis.filter(k => k.groupId === id || k.group_id === id || childCats.some(c => c.id === (k.categoryId || k.category_id)));
      const hasChildren = childCats.length > 0 || childKpis.length > 0;

      const batch = writeBatch(db);

      if (options?.targetGroupId) {
        // Safe Migrate: chuyển category và kpi sang targetGroupId trước khi xóa nhóm cũ
        const targetGId = options.targetGroupId;
        childCats.forEach(c => {
          batch.update(doc(db, 'kpiCategories', c.id), { groupId: targetGId, group_id: targetGId, updatedAt: new Date().toISOString() });
        });
        childKpis.forEach(k => {
          batch.update(doc(db, 'kpis', k.id), { groupId: targetGId, group_id: targetGId, updatedAt: new Date().toISOString() });
        });
        batch.delete(doc(db, 'kpiGroups', id));

        setState(prev => ({
          ...prev,
          kpiGroups: prev.kpiGroups.filter(g => g.id !== id),
          kpiCategories: prev.kpiCategories.map(c => (c.groupId === id || c.group_id === id) ? { ...c, groupId: targetGId, group_id: targetGId } : c),
          kpis: prev.kpis.map(k => (k.groupId === id || k.group_id === id) ? { ...k, groupId: targetGId, group_id: targetGId } : k)
        }));
      } else if (options?.cascade || !hasChildren) {
        // Xóa cascade hoặc nhóm không có dữ liệu con
        batch.delete(doc(db, 'kpiGroups', id));
        childCats.forEach(c => {
          batch.delete(doc(db, 'kpiCategories', c.id));
        });
        childKpis.forEach(k => {
          batch.delete(doc(db, 'kpis', k.id));
        });

        const childKpiIds = new Set(childKpis.map(k => k.id));
        const recordsToDelete = state.kpiRecords.filter(r => childKpiIds.has(r.kpiId));
        if (options?.deleteRecords && recordsToDelete.length > 0) {
          recordsToDelete.forEach(r => {
            batch.delete(doc(db, 'kpiRecords', r.id));
          });
        }

        setState(prev => ({
          ...prev,
          kpiGroups: prev.kpiGroups.filter(g => g.id !== id),
          kpiCategories: prev.kpiCategories.filter(c => c.groupId !== id && c.group_id !== id),
          kpis: prev.kpis.filter(k => k.groupId !== id && k.group_id !== id && !childKpiIds.has(k.id)),
          kpiRecords: (options?.deleteRecords && recordsToDelete.length > 0)
            ? prev.kpiRecords.filter(r => !childKpiIds.has(r.kpiId))
            : prev.kpiRecords
        }));
      } else {
        throw new Error(`Nhóm KPI này đang chứa ${childCats.length} nhóm tiêu chí và ${childKpis.length} tiêu chí thành phần. Vui lòng chọn xóa kèm dữ liệu con hoặc chuyển sang nhóm khác.`);
      }

      await batch.commit();
    } catch (e) { handleDbError(e); throw e; }
  };

  const addKpiCategory = async (category: KpiCategory) => {
    try {
      if (!category.groupId && !category.group_id) {
        throw new Error('Bắt buộc phải chọn Nhóm KPI cha!');
      }
      const parentGroupId = category.groupId || category.group_id!;
      if (!category.id) category.id = `kpicat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      category.groupId = parentGroupId;
      category.group_id = parentGroupId;
      category.createdAt = new Date().toISOString();
      category.updatedAt = new Date().toISOString();
      setState(prev => ({
        ...prev,
        kpiCategories: [...prev.kpiCategories, category]
      }));
      await setDoc(doc(db, 'kpiCategories', category.id), sanitize(category));
    } catch (e) { handleDbError(e); throw e; }
  };

  const updateKpiCategory = async (id: string, data: Partial<KpiCategory>) => {
    try {
      const updateData: any = { ...data, updatedAt: new Date().toISOString() };
      if (updateData.groupId) updateData.group_id = updateData.groupId;
      setState(prev => ({
        ...prev,
        kpiCategories: prev.kpiCategories.map(c => c.id === id ? { ...c, ...updateData } : c)
      }));
      await updateDoc(doc(db, 'kpiCategories', id), sanitize(updateData));
    } catch (e) { handleDbError(e); throw e; }
  };

  const deleteKpiCategory = async (
    id: string, 
    options?: { cascade?: boolean; targetCategoryId?: string; deleteRecords?: boolean }
  ) => {
    try {
      const childKpis = state.kpis.filter(k => k.categoryId === id || k.category_id === id);
      const hasChildren = childKpis.length > 0;
      const batch = writeBatch(db);

      if (options?.targetCategoryId) {
        // Safe Migrate: chuyển các tiêu chí con sang targetCategoryId trước khi xóa nhóm tiêu chí này
        const targetCatId = options.targetCategoryId;
        const targetCat = state.kpiCategories.find(c => c.id === targetCatId);
        const targetGroupId = targetCat?.groupId || targetCat?.group_id;

        childKpis.forEach(k => {
          const updates: any = { 
            categoryId: targetCatId, 
            category_id: targetCatId, 
            updatedAt: new Date().toISOString() 
          };
          if (targetGroupId) {
            updates.groupId = targetGroupId;
            updates.group_id = targetGroupId;
          }
          batch.update(doc(db, 'kpis', k.id), updates);
        });
        batch.delete(doc(db, 'kpiCategories', id));

        setState(prev => ({
          ...prev,
          kpiCategories: prev.kpiCategories.filter(c => c.id !== id),
          kpis: prev.kpis.map(k => (k.categoryId === id || k.category_id === id) ? {
            ...k,
            categoryId: targetCatId,
            category_id: targetCatId,
            ...(targetGroupId ? { groupId: targetGroupId, group_id: targetGroupId } : {})
          } : k)
        }));
      } else if (options?.cascade || !hasChildren) {
        // Cascade delete: xóa nhóm tiêu chí và toàn bộ tiêu chí con bên trong
        batch.delete(doc(db, 'kpiCategories', id));
        childKpis.forEach(k => {
          batch.delete(doc(db, 'kpis', k.id));
        });

        const childKpiIds = new Set(childKpis.map(k => k.id));
        const recordsToDelete = state.kpiRecords.filter(r => childKpiIds.has(r.kpiId));
        if (options?.deleteRecords && recordsToDelete.length > 0) {
          recordsToDelete.forEach(r => {
            batch.delete(doc(db, 'kpiRecords', r.id));
          });
        }

        setState(prev => ({
          ...prev,
          kpiCategories: prev.kpiCategories.filter(c => c.id !== id),
          kpis: prev.kpis.filter(k => k.categoryId !== id && k.category_id !== id),
          kpiRecords: (options?.deleteRecords && recordsToDelete.length > 0)
            ? prev.kpiRecords.filter(r => !childKpiIds.has(r.kpiId))
            : prev.kpiRecords
        }));
      } else {
        throw new Error(`Nhóm tiêu chí này đang chứa ${childKpis.length} tiêu chí con. Vui lòng chọn xóa kèm tiêu chí con hoặc chuyển sang nhóm tiêu chí khác.`);
      }

      await batch.commit();
    } catch (e) { handleDbError(e); throw e; }
  };

  const addKpi = async (kpi: KpiItem) => {
    try {
      if (!kpi.groupId && !kpi.group_id) {
        throw new Error('Bắt buộc phải chọn Nhóm KPI!');
      }
      if (!kpi.categoryId && !kpi.category_id) {
        throw new Error('Bắt buộc phải chọn Nhóm tiêu chí KPI!');
      }
      if (!kpi.id) kpi.id = `kpi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      kpi.groupId = kpi.groupId || kpi.group_id!;
      kpi.group_id = kpi.groupId;
      kpi.categoryId = kpi.categoryId || kpi.category_id!;
      kpi.category_id = kpi.categoryId;
      kpi.createdAt = new Date().toISOString();
      kpi.updatedAt = new Date().toISOString();
      setState(prev => ({
        ...prev,
        kpis: [...prev.kpis, kpi]
      }));
      await setDoc(doc(db, 'kpis', kpi.id), sanitize(kpi));
    } catch (e) { handleDbError(e); throw e; }
  };

  const updateKpi = async (id: string, data: Partial<KpiItem>) => {
    try {
      const updateData: any = { ...data, updatedAt: new Date().toISOString() };
      if (updateData.groupId) updateData.group_id = updateData.groupId;
      if (updateData.categoryId) updateData.category_id = updateData.categoryId;
      setState(prev => ({
        ...prev,
        kpis: prev.kpis.map(k => k.id === id ? { ...k, ...updateData } : k)
      }));
      await updateDoc(doc(db, 'kpis', id), sanitize(updateData));
    } catch (e) { handleDbError(e); throw e; }
  };

  const deleteKpi = async (id: string, deleteAssociatedRecords: boolean = false) => {
    try {
      // Optimistic update
      setState(prev => ({
        ...prev,
        kpis: prev.kpis.filter(k => k.id !== id),
        kpiRecords: deleteAssociatedRecords 
          ? prev.kpiRecords.filter(r => r.kpiId !== id)
          : prev.kpiRecords
      }));

      const batch = writeBatch(db);
      batch.delete(doc(db, 'kpis', id));

      if (deleteAssociatedRecords) {
        const recordsToDelete = state.kpiRecords.filter(r => r.kpiId === id);
        recordsToDelete.forEach(r => {
          batch.delete(doc(db, 'kpiRecords', r.id));
        });
      }

      await batch.commit();
    } catch (e) { 
      handleDbError(e); 
      throw e; 
    }
  };

  const addKpiRecord = async (record: KpiRecord) => {
    try {
      if (!record.id) record.id = `kpir_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      record.createdAt = new Date().toISOString();
      record.updatedAt = new Date().toISOString();
      await setDoc(doc(db, 'kpiRecords', record.id), sanitize(record));
    } catch (e) { handleDbError(e); throw e; }
  };

  const updateKpiRecord = async (id: string, data: Partial<KpiRecord>) => {
    try {
      const updateData = { ...data, updatedAt: new Date().toISOString() };
      await updateDoc(doc(db, 'kpiRecords', id), sanitize(updateData));
    } catch (e) { handleDbError(e); throw e; }
  };

  const deleteKpiRecord = async (id: string) => {
    try {
      setState(prev => ({
        ...prev,
        kpiRecords: prev.kpiRecords.filter(r => r.id !== id)
      }));
      await deleteDoc(doc(db, 'kpiRecords', id));
    } catch (e) { handleDbError(e); throw e; }
  };

  const addKpiEvaluationForm = async (form: KpiEvaluationForm) => {
    try {
      const teacherId = form.teacherId || form.employee_id;
      const month = form.month;
      const academicYear = form.academicYear || form.academic_year;

      // Tìm xem đã tồn tại phiếu cho CBGVNV này trong cùng tháng + năm học chưa
      const existingForm = state.kpiEvaluationForms.find(f => 
        (f.teacherId === teacherId || f.employee_id === teacherId) &&
        f.month === month &&
        (f.academicYear === academicYear || f.academic_year === academicYear)
      );

      const safeYear = (academicYear || '2026-2027').replace(/[^a-zA-Z0-9]/g, '_');
      const safeMonth = String(month || '09').padStart(2, '0');
      const safeEmp = teacherId || 'unknown';
      const targetId = existingForm ? existingForm.id : (form.id || `kpif_${safeYear}_m${safeMonth}_${safeEmp}`);

      form.id = targetId;
      form.teacherId = teacherId || '';
      form.employee_id = teacherId || '';
      form.month = month;
      form.academicYear = academicYear || '2026-2027';
      form.academic_year = academicYear || '2026-2027';
      form.createdAt = existingForm?.createdAt || form.createdAt || new Date().toISOString();
      form.updatedAt = new Date().toISOString();

      setState(prev => ({
        ...prev,
        kpiEvaluationForms: [form, ...prev.kpiEvaluationForms.filter(f => f.id !== targetId)]
      }));
      await setDoc(doc(db, 'kpi_evaluation_forms', targetId), sanitize(form), { merge: true });
    } catch (e) { handleDbError(e); throw e; }
  };

  const updateKpiEvaluationForm = async (id: string, data: Partial<KpiEvaluationForm>) => {
    try {
      const updateData = { ...data, updatedAt: new Date().toISOString() };
      setState(prev => ({
        ...prev,
        kpiEvaluationForms: prev.kpiEvaluationForms.map(f => f.id === id ? { ...f, ...updateData } : f)
      }));
      await setDoc(doc(db, 'kpi_evaluation_forms', id), sanitize(updateData), { merge: true });
    } catch (e) { handleDbError(e); throw e; }
  };

  const deleteKpiEvaluationForm = async (id: string) => {
    try {
      setState(prev => ({
        ...prev,
        kpiEvaluationForms: prev.kpiEvaluationForms.filter(f => f.id !== id)
      }));
      await deleteDoc(doc(db, 'kpi_evaluation_forms', id));
    } catch (e) { handleDbError(e); throw e; }
  };

  const saveKpiMonthlySetting = async (setting: KpiMonthlySetting) => {
    try {
      const settingId = setting.id || `setting_${setting.academicYear}_${setting.month || 'all'}`;
      const dataToSave = {
        ...setting,
        id: settingId,
        updatedAt: new Date().toISOString()
      };
      setState(prev => {
        const existing = prev.kpiMonthlySettings.filter(s => s.id !== settingId);
        return {
          ...prev,
          kpiMonthlySettings: [...existing, dataToSave]
        };
      });
      await setDoc(doc(db, 'kpiMonthlySettings', settingId), sanitize(dataToSave));
    } catch (e) {
      handleDbError(e);
      throw e;
    }
  };

  const addTask = async (task: Task) => {
    try {
      if (!task.id) task.id = `task${Date.now()}_${Math.random()}`;
      setState(prev => {
        const updated = [task, ...prev.tasks.filter(t => t.id !== task.id)];
        setLocalCollectionCache('tasks', updated);
        return { ...prev, tasks: updated };
      });
      await setDoc(doc(db, 'tasks', task.id), sanitize(task));
      invalidateFirestoreCache('appcol:tasks');
    } catch (e) { handleDbError(e); }
  };

  const updateTask = async (id: string, data: Partial<Task>) => {
    try {
      setState(prev => {
        const updated = prev.tasks.map(t => t.id === id ? { ...t, ...data } : t);
        setLocalCollectionCache('tasks', updated);
        return { ...prev, tasks: updated };
      });
      await updateDoc(doc(db, 'tasks', id), sanitize(data));
      invalidateFirestoreCache('appcol:tasks');
    } catch (e) { handleDbError(e); }
  };

  const deleteTask = async (id: string) => {
    try {
      setState(prev => {
        const updated = prev.tasks.filter(t => t.id !== id);
        setLocalCollectionCache('tasks', updated);
        return { ...prev, tasks: updated };
      });
      await deleteDoc(doc(db, 'tasks', id));
      invalidateFirestoreCache('appcol:tasks');
    } catch (e) { handleDbError(e); }
  };

  const addWorkAssignment = async (assignment: WorkAssignment) => {
    try {
      if (!assignment.id) assignment.id = `wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      setState(prev => {
        const updated = [assignment, ...prev.workAssignments];
        setLocalCollectionCache('workAssignments', updated);
        return { ...prev, workAssignments: updated };
      });
      await setDoc(doc(db, 'workAssignments', assignment.id), sanitize(assignment));
      invalidateFirestoreCache('appcol:workAssignments');
    } catch (e) { handleDbError(e); }
  };

  const updateWorkAssignment = async (id: string, data: Partial<WorkAssignment>) => {
    try {
      setState(prev => {
        const updated = prev.workAssignments.map(w => w.id === id ? { ...w, ...data, updatedAt: new Date().toISOString() } : w);
        setLocalCollectionCache('workAssignments', updated);
        return { ...prev, workAssignments: updated };
      });
      await updateDoc(doc(db, 'workAssignments', id), sanitize(data));
      invalidateFirestoreCache('appcol:workAssignments');
    } catch (e) { handleDbError(e); }
  };

  const deleteWorkAssignment = async (id: string) => {
    try {
      setState(prev => {
        const updated = prev.workAssignments.filter(w => w.id !== id);
        setLocalCollectionCache('workAssignments', updated);
        return { ...prev, workAssignments: updated };
      });
      await deleteDoc(doc(db, 'workAssignments', id));
      invalidateFirestoreCache('appcol:workAssignments');
    } catch (e) { handleDbError(e); }
  };

  const importWorkAssignments = async (assignments: WorkAssignment[]) => {
    try {
      const batch = writeBatch(db);
      assignments.forEach(wa => {
        if (!wa.id) wa.id = `wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        batch.set(doc(db, 'workAssignments', wa.id), sanitize(wa));
      });
      await batch.commit();
      setState(prev => {
        const updated = [...assignments, ...prev.workAssignments.filter(w => !assignments.some(a => a.id === w.id))];
        setLocalCollectionCache('workAssignments', updated);
        return { ...prev, workAssignments: updated };
      });
      invalidateFirestoreCache('appcol:workAssignments');
    } catch (e) {
      handleDbError(e);
      throw e;
    }
  };

  const seedOrResetSchoolTasks = async () => {
    try {
      const batch = writeBatch(db);
      OFFICIAL_SCHOOL_TASKS_2026_2027.forEach(wa => {
        batch.set(doc(db, 'workAssignments', wa.id), sanitize(wa));
      });
      await batch.commit();
      setState(prev => {
        const updated = [...OFFICIAL_SCHOOL_TASKS_2026_2027, ...prev.workAssignments.filter(w => !OFFICIAL_SCHOOL_TASKS_2026_2027.some(o => o.id === w.id))];
        setLocalCollectionCache('workAssignments', updated);
        return { ...prev, workAssignments: updated };
      });
      invalidateFirestoreCache('appcol:workAssignments');
    } catch (e) {
      handleDbError(e);
      throw e;
    }
  };

  const addCalendarEvent = async (event: CalendarEvent) => {
    try {
      if (!event.id) event.id = `ev${Date.now()}_${Math.random()}`;
      setState(prev => {
        const updated = [event, ...prev.calendarEvents.filter(ev => ev.id !== event.id)];
        setLocalCollectionCache('calendarEvents', updated);
        return { ...prev, calendarEvents: updated };
      });
      await setDoc(doc(db, 'calendarEvents', event.id), sanitize(event));
      invalidateFirestoreCache('appcol:calendarEvents');
    } catch (e) { handleDbError(e); }
  };

  const updateCalendarEvent = async (id: string, data: Partial<CalendarEvent>) => {
    try {
      setState(prev => {
        const updated = prev.calendarEvents.map(ev => ev.id === id ? { ...ev, ...data } : ev);
        setLocalCollectionCache('calendarEvents', updated);
        return { ...prev, calendarEvents: updated };
      });
      await updateDoc(doc(db, 'calendarEvents', id), sanitize(data));
      invalidateFirestoreCache('appcol:calendarEvents');
    } catch (e) { handleDbError(e); }
  };

  const deleteCalendarEvent = async (id: string) => {
    try {
      setState(prev => {
        const updated = prev.calendarEvents.filter(ev => ev.id !== id);
        setLocalCollectionCache('calendarEvents', updated);
        return { ...prev, calendarEvents: updated };
      });
      await deleteDoc(doc(db, 'calendarEvents', id));
      invalidateFirestoreCache('appcol:calendarEvents');
    } catch (e) { handleDbError(e); }
  };

  const addNotification = async (notification: Notification) => {
    try {
      if (!notification.id) notification.id = `notif${Date.now()}_${Math.random()}`;
      setState(prev => {
        const updated = [notification, ...prev.notifications.filter(n => n.id !== notification.id)];
        setLocalCollectionCache('notifications', updated);
        return { ...prev, notifications: updated };
      });
      await setDoc(doc(db, 'notifications', notification.id), sanitize(notification));
      invalidateFirestoreCache('appcol:notifications');
    } catch (e) { handleDbError(e); }
  };

  const updateNotification = async (id: string, data: Partial<Notification>) => {
    try {
      setState(prev => {
        const updated = prev.notifications.map(n => n.id === id ? { ...n, ...data } : n);
        setLocalCollectionCache('notifications', updated);
        return { ...prev, notifications: updated };
      });
      await updateDoc(doc(db, 'notifications', id), sanitize(data));
      invalidateFirestoreCache('appcol:notifications');
    } catch (e) { handleDbError(e); }
  };

  const deleteNotification = async (id: string) => {
    try {
      setState(prev => {
        const updated = prev.notifications.filter(n => n.id !== id);
        setLocalCollectionCache('notifications', updated);
        return { ...prev, notifications: updated };
      });
      await deleteDoc(doc(db, 'notifications', id));
      invalidateFirestoreCache('appcol:notifications');
    } catch (e) { handleDbError(e); }
  };

  const addReport = async (report: Report) => {
    try {
      if (!report.id) report.id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      setState(prev => {
        const updated = [report, ...prev.reports.filter(r => r.id !== report.id)];
        setLocalCollectionCache('reports', updated);
        return { ...prev, reports: updated };
      });
      await setDoc(doc(db, 'reports', report.id), sanitize(report));
      invalidateFirestoreCache('appcol:reports');
    } catch (e) { handleDbError(e); }
  };

  const updateReport = async (id: string, data: Partial<Report>) => {
    try {
      setState(prev => {
        const updated = prev.reports.map(r => r.id === id ? { ...r, ...data } : r);
        setLocalCollectionCache('reports', updated);
        return { ...prev, reports: updated };
      });
      await updateDoc(doc(db, 'reports', id), sanitize(data));
      invalidateFirestoreCache('appcol:reports');
    } catch (e) { handleDbError(e); }
  };

  const deleteReport = async (id: string) => {
    try {
      setState(prev => {
        const updated = prev.reports.filter(r => r.id !== id);
        setLocalCollectionCache('reports', updated);
        return { ...prev, reports: updated };
      });
      await deleteDoc(doc(db, 'reports', id));
      invalidateFirestoreCache('appcol:reports');
    } catch (e) { handleDbError(e); }
  };

  const checkAndRepairKpiData = async () => {
    try {
      const batch = writeBatch(db);
      const groups = state.kpiGroups;
      const kpisList = state.kpis;
      
      let unassignedGroup = groups.find(g => g.id === 'kpig_unassigned');
      
      if (!unassignedGroup) {
        const defaultGenId = state.generalKpis[0]?.id || 'kpic_thpt';
        const newGroup: KpiGroup = {
          id: 'kpig_unassigned',
          generalKpiId: defaultGenId,
          code: 'DL_CHO_XL',
          name: 'Dữ liệu cần xử lý',
          description: 'Các tiêu chí chuyển tiếp hoặc mồ côi cần phân loại lại để đảm bảo liên kết ID chuẩn',
          groupScore: 0,
          order: 99,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        batch.set(doc(db, 'kpiGroups', newGroup.id), sanitize(newGroup));
        unassignedGroup = newGroup;
      } else if (unassignedGroup.code !== 'DL_CHO_XL' || unassignedGroup.name !== 'Dữ liệu cần xử lý') {
        batch.update(doc(db, 'kpiGroups', 'kpig_unassigned'), {
          code: 'DL_CHO_XL',
          name: 'Dữ liệu cần xử lý',
          updatedAt: new Date().toISOString()
        });
      }

      let unassignedCategory = state.kpiCategories.find(c => c.id === 'kpicat_unassigned');
      if (!unassignedCategory) {
        const newCat: KpiCategory = {
          id: 'kpicat_unassigned',
          groupId: 'kpig_unassigned',
          group_id: 'kpig_unassigned',
          code: 'DL_CHO_XL.01',
          name: 'Tiêu chí cần xử lý',
          description: 'Nhóm tiêu chí mặc định để xử lý liên kết',
          order: 1,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        batch.set(doc(db, 'kpiCategories', newCat.id), sanitize(newCat));
      }

      let orphanedCount = 0;
      let repairedCount = 0;

      kpisList.forEach(kpi => {
        const targetGroupId = kpi.groupId || kpi.group_id;
        const groupExists = targetGroupId && groups.some(g => g.id === targetGroupId);

        if (!groupExists) {
          orphanedCount++;
          const kpiRef = doc(db, 'kpis', kpi.id);
          batch.update(kpiRef, {
            groupId: 'kpig_unassigned',
            group_id: 'kpig_unassigned',
            group: 'Dữ liệu cần xử lý',
            categoryId: 'kpicat_unassigned',
            category_id: 'kpicat_unassigned',
            categoryName: 'Tiêu chí cần xử lý',
            updatedAt: new Date().toISOString()
          });
          repairedCount++;
        }
      });

      await batch.commit();

      return {
        checkedGroups: groups.length,
        checkedKpis: kpisList.length,
        orphanedCount,
        repairedCount
      };
    } catch (err) {
      console.error('Error during KPI data check and repair:', err);
      throw err;
    }
  };

  const clearError = () => setState(prev => ({ ...prev, error: null }));

  const addModule = async (module: SystemModule, _currentUser?: User | null) => {
    try {
      const id = module.id || `mod_${Date.now()}`;
      await setDoc(doc(db, 'system_modules', id), sanitize({ ...module, id }));
      invalidateFirestoreCache('appcol:system_modules');
      setState(prev => ({ ...prev, modules: [...prev.modules.filter(m => m.id !== id), { ...module, id }] }));
    } catch (e) {
      handleDbError(e);
    }
  };

  const updateModule = async (id: string, data: Partial<SystemModule>, _currentUser?: User | null) => {
    try {
      await updateDoc(doc(db, 'system_modules', id), sanitize(data));
      invalidateFirestoreCache('appcol:system_modules');
      setState(prev => ({
        ...prev,
        modules: prev.modules.map(m => m.id === id ? { ...m, ...data } : m)
      }));
    } catch (e) {
      handleDbError(e);
    }
  };

  const deleteModule = async (id: string, _currentUser?: User | null) => {
    try {
      await deleteDoc(doc(db, 'system_modules', id));
      invalidateFirestoreCache('appcol:system_modules');
      setState(prev => ({
        ...prev,
        modules: prev.modules.filter(m => m.id !== id)
      }));
    } catch (e) {
      handleDbError(e);
    }
  };

  const toggleModule = async (id: string, _currentUser?: User | null) => {
    const mod = state.modules.find(m => m.id === id);
    if (!mod) return;
    await updateModule(id, { enabled: !mod.enabled });
  };

  const reorderModules = async (newModules: SystemModule[], _currentUser?: User | null) => {
    try {
      setState(prev => ({ ...prev, modules: newModules }));
      const batch = writeBatch(db);
      newModules.forEach((m, idx) => {
        batch.set(doc(db, 'system_modules', m.id), sanitize({ ...m, order: idx + 1 }), { merge: true });
      });
      await batch.commit();
      invalidateFirestoreCache('appcol:system_modules');
    } catch (e) {
      handleDbError(e);
    }
  };

  const resetModulesToDefault = async (_currentUser?: User | null) => {
    try {
      setState(prev => ({ ...prev, modules: DEFAULT_SYSTEM_MODULES }));
      const batch = writeBatch(db);
      DEFAULT_SYSTEM_MODULES.forEach((m, idx) => {
        batch.set(doc(db, 'system_modules', m.id), sanitize({ ...m, order: idx + 1 }), { merge: true });
      });
      await batch.commit();
      invalidateFirestoreCache('appcol:system_modules');
    } catch (e) {
      handleDbError(e);
    }
  };

  const updateSchoolStats = async (data: Partial<SchoolStats>) => {
    try {
      const statsDocRef = doc(db, 'systemSettings', 'schoolStats');
      await setDoc(statsDocRef, sanitize(data), { merge: true });
      invalidateFirestoreCache('appcol:schoolStats');
      setState(prev => ({
        ...prev,
        schoolStats: { ...prev.schoolStats, ...data }
      }));
    } catch (e) {
      handleDbError(e);
    }
  };

  return (
    <AppContext.Provider value={{
      ...state,
      clearError,
      ensureCollectionsLoaded,
      addModule,
      updateModule,
      deleteModule,
      toggleModule,
      reorderModules,
      resetModulesToDefault,
      updateTaskStatus,
      markNotificationRead,
      deleteTeacher,
      deleteAllTeachers,
      importTeachers,
      updateTeacher,
      addTeacher,
      updateDepartment,
      deleteDepartment,
      addDepartment,
      addDisciplineRecord,
      updateDisciplineRecord,
      deleteDisciplineRecord,
      deleteDisciplineRecords,
      addDisciplineCriterion,
      updateDisciplineCriterion,
      deleteDisciplineCriterion,
      addGeneralKpi,
      updateGeneralKpi,
      deleteGeneralKpi,
      addKpiGroup,
      updateKpiGroup,
      deleteKpiGroup,
      addKpiCategory,
      updateKpiCategory,
      deleteKpiCategory,
      addKpi,
      updateKpi,
      deleteKpi,
      addKpiRecord,
      updateKpiRecord,
      deleteKpiRecord,
      addKpiEvaluationForm,
      updateKpiEvaluationForm,
      deleteKpiEvaluationForm,
      saveKpiMonthlySetting,
      addAttendanceRecord,
      updateAttendanceRecord,
      deleteAttendanceRecord,
      addLeaveRecord,
      updateLeaveRecord,
      deleteLeaveRecord,
      addTask,
      updateTask,
      deleteTask,
      addWorkAssignment,
      updateWorkAssignment,
      deleteWorkAssignment,
      importWorkAssignments,
      seedOrResetSchoolTasks,
      addCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
      addNotification,
      updateNotification,
      deleteNotification,
      addReport,
      updateReport,
      deleteReport,
      checkAndRepairKpiData,
      updateSchoolStats,
      setKpiStaffForms,
      setKpiStaffPeriods,
      setKpiStaffCriteria
    }}>
      {state.error && user && !state.error.includes('resource-exhausted') && !state.error.includes('Hạn ngạch') && (
        <div className="fixed top-0 left-0 right-0 z-50 shadow-md py-2 px-4 transition-all duration-300 bg-rose-600/95 text-white backdrop-blur-sm border-b border-rose-500">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs sm:text-sm font-medium">
            <div className="flex items-center space-x-2">
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/20 uppercase tracking-wider">
                {state.error.includes('resource-exhausted') || state.error.includes('Hạn ngạch') ? 'Bộ nhớ đệm an toàn' : 'Thông báo CSDL'}
              </span>
              <span className="line-clamp-1">{state.error}</span>
            </div>
            <div className="flex items-center space-x-3 ml-4 shrink-0">
              {(state.error.includes('resource-exhausted') || state.error.includes('Hạn ngạch')) && (
                <a
                  href="https://console.firebase.google.com/project/windy-system-q9v0l/firestore/databases/ai-studio-hthngqunlgiovint-0d69b880-7502-4902-b08f-94cb8fcead53/data?openUpgradeDialog=true"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:inline-flex items-center px-2 py-0.5 rounded bg-white text-amber-900 font-semibold text-xs hover:bg-amber-50 transition shadow-sm"
                >
                  Nâng cấp Blaze
                </a>
              )}
              <button
                onClick={clearError}
                aria-label="Đóng thông báo"
                className="p-1 rounded-full hover:bg-white/20 transition text-white font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
