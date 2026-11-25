import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  query,
  where,
  setDoc,
  writeBatch,
  waitForPendingWrites
} from 'firebase/firestore';
import { addDays } from 'date-fns';
import { db, auth } from '../lib/firebase';
import {
  ClassAcademicEmulationRecord,
  AcademicEmulationConfig,
  DEFAULT_EMULATION_CONFIG,
  MonthlyEmulationSummary,
  AcademicEmulationEditorInfo,
  AcademicEmulationBatchSaveResult,
  AcademicEmulationSaveFailure
} from '../types/academicEmulation';
import { ClassInfo } from '../types/homeroom';
import { getWeekInfoByNumber, getWeeksForMonth } from '../utils/schoolWeekUtils';

const COLLECTIONS = {
  RECORDS: 'academic_emulation_records',
  CONFIG: 'academic_emulation_config'
} as const;

const FIRESTORE_BATCH_LIMIT = 400; // Safe margin below Firestore's 500-op batch limit
const FIRESTORE_READ_TIMEOUT_MS = 12000;
const FIRESTORE_WRITE_TIMEOUT_MS = 15000;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface AcademicEmulationErrorDetail {
  code: string;
  message: string;
  isOffline: boolean;
  isPermissionDenied: boolean;
  isQuotaExceeded: boolean;
  isTimeout: boolean;
}

export const normalizeAcademicYear = (yr?: string): string => {
  if (!yr) return '2026-2027';
  return yr.replace(/[\u2010-\u2015]/g, '-').trim();
};

export const buildEmulationConfigDocId = (schoolYear: string): string => {
  return normalizeAcademicYear(schoolYear).replace(/[^a-zA-Z0-9]/g, '_');
};

export const buildEmulationRecordId = (
  schoolYear: string,
  weekNumber: number,
  classId: string
): string => {
  const normYear = normalizeAcademicYear(schoolYear);
  return `${normYear.replace(/[^a-zA-Z0-9]/g, '_')}_w${Number(weekNumber)}_${classId}`;
};

export const getMonthForSchoolWeek = (weekNumber: number, schoolYear: string): number => {
  try {
    const info = getWeekInfoByNumber(Number(weekNumber) || 1, schoolYear);
    const midWeek = addDays(info.startDate, 3); // Thứ Năm
    return midWeek.getMonth() + 1;
  } catch {
    return 10;
  }
};

function stripUndefinedFields<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean;
}

function logStructuredFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

export function classifyAcademicFirestoreError(error: unknown): AcademicEmulationErrorDetail {
  const rawCode = String((error as any)?.code || '').toLowerCase();
  const rawMsg = error instanceof Error ? error.message : String(error || '');
  const lowerMsg = rawMsg.toLowerCase();

  const isOffline =
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    rawCode === 'unavailable' ||
    rawCode === 'offline' ||
    lowerMsg.includes('client is offline') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('failed to get document because the client is offline') ||
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('mất kết nối');

  const isPermissionDenied =
    rawCode === 'permission-denied' ||
    lowerMsg.includes('permission-denied') ||
    lowerMsg.includes('missing or insufficient permissions');

  const isQuotaExceeded =
    rawCode === 'resource-exhausted' ||
    lowerMsg.includes('quota') ||
    lowerMsg.includes('resource-exhausted');

  const isTimeout =
    rawCode === 'deadline-exceeded' ||
    rawCode === 'timeout' ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('hết thời gian chờ');

  if (isOffline) {
    return {
      code: 'offline',
      message:
        'Mất kết nối Internet hoặc không thể kết nối máy chủ Firestore. Dữ liệu bạn vừa nhập vẫn được giữ nguyên trên giao diện — hãy kiểm tra mạng và nhấn lưu lại.',
      isOffline: true,
      isPermissionDenied: false,
      isQuotaExceeded: false,
      isTimeout: false
    };
  }

  if (isPermissionDenied) {
    return {
      code: 'permission-denied',
      message:
        'Firestore từ chối quyền ghi dữ liệu (Permission Denied). Vui lòng kiểm tra tài khoản đăng nhập hoặc liên hệ quản trị hệ thống.',
      isOffline: false,
      isPermissionDenied: true,
      isQuotaExceeded: false,
      isTimeout: false
    };
  }

  if (isQuotaExceeded) {
    return {
      code: 'resource-exhausted',
      message:
        'Hệ thống đã vượt hạn ngạch ghi Firestore (Quota Exceeded). Dữ liệu của bạn vẫn được giữ nguyên trên giao diện — vui lòng thử lại sau hoặc liên hệ quản trị viên.',
      isOffline: false,
      isPermissionDenied: false,
      isQuotaExceeded: true,
      isTimeout: false
    };
  }

  if (isTimeout) {
    return {
      code: 'deadline-exceeded',
      message:
        'Hết thời gian chờ xác nhận từ máy chủ Firestore. Dữ liệu bạn nhập vẫn được giữ nguyên trên giao diện — vui lòng nhấn lưu lại.',
      isOffline: false,
      isPermissionDenied: false,
      isQuotaExceeded: false,
      isTimeout: true
    };
  }

  return {
    code: rawCode || 'unknown',
    message: `Lỗi ghi dữ liệu lên Firestore${rawMsg ? ` (${rawMsg})` : ''}. Dữ liệu bạn nhập vẫn được giữ nguyên trên giao diện — vui lòng nhấn lưu lại.`,
    isOffline: false,
    isPermissionDenied: false,
    isQuotaExceeded: false,
    isTimeout: false
  };
}

function withStrictTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(timeoutMessage);
      (err as any).code = 'deadline-exceeded';
      reject(err);
    }, timeoutMs);

    promise
      .then(val => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function assertBrowserOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const err = new Error('Trình duyệt đang ngoại tuyến (mất kết nối Internet).');
    (err as any).code = 'offline';
    throw err;
  }
}

/**
 * Pure score calculation helper — preserves the EXACT school emulation scoring formula
 * and ALL fields on ClassAcademicEmulationRecord.
 */
export function computeEmulationRecord(
  record: ClassAcademicEmulationRecord,
  config: AcademicEmulationConfig,
  editor?: AcademicEmulationEditorInfo,
  options?: { preserveUpdatedAt?: boolean; timestamp?: string }
): ClassAcademicEmulationRecord {
  const normYear = normalizeAcademicYear(record.schoolYear);
  const weekNumber = Number(record.weekNumber) || 1;
  const id = buildEmulationRecordId(normYear, weekNumber, record.classId);

  const goodLessons = Math.max(0, Math.floor(Number(record.goodLessons) || 0));
  const fairLessons = Math.max(0, Math.floor(Number(record.fairLessons) || 0));
  const avgLessons = Math.max(0, Math.floor(Number(record.avgLessons) || 0));
  const weakLessons = Math.max(0, Math.floor(Number(record.weakLessons) || 0));
  const goodDays = Math.max(0, Math.floor(Number(record.goodDays) || 0));
  const goodWeeks = Math.max(0, Math.floor(Number(record.goodWeeks) || 0));
  const goodMarks = Math.max(0, Math.floor(Number(record.goodMarks) || 0));
  const badMarks = Math.max(0, Math.floor(Number(record.badMarks) || 0));
  const disorderlyStudents = Math.max(0, Math.floor(Number(record.disorderlyStudents) || 0));

  // Điểm cộng (giữ nguyên 100% công thức hiện hành)
  const bonusGoodMarks = goodMarks * (config.pointPerGoodMark ?? 2);
  const bonusGoodDays = goodDays * (config.pointPerGoodDay ?? 10);
  const bonusGoodWeeks = goodWeeks * (config.pointPerGoodWeek ?? 20);
  const bonusPoints = bonusGoodMarks + bonusGoodDays + bonusGoodWeeks;

  // Điểm trừ (giữ nguyên 100% công thức hiện hành)
  const deductFairLessons = fairLessons * Math.abs(config.pointPerFairLesson ?? 1);
  const deductAvgLessons = avgLessons * Math.abs(config.pointPerAvgLesson ?? 3);
  const deductWeakLessons = weakLessons * Math.abs(config.pointPerWeakLesson ?? 5);
  const deductLessonTotal = deductFairLessons + deductAvgLessons + deductWeakLessons;
  const deductBadMarks = badMarks * Math.abs(config.pointPerBadMark ?? 2);
  const deductDisorderlyStudents = disorderlyStudents * Math.abs(config.pointPerDisorderlyStudent ?? 1);
  const deductionPoints = deductLessonTotal + deductBadMarks + deductDisorderlyStudents;

  // Tổng điểm thi đua = bonusPoints - deductionPoints
  const totalScore = bonusPoints - deductionPoints;

  let classification = 'Đạt';
  if (totalScore >= config.thresholdExcellent) classification = 'Tốt';
  else if (totalScore >= config.thresholdGood) classification = 'Khá';
  else if (totalScore >= config.thresholdPass) classification = 'Đạt';
  else classification = 'Chưa đạt';

  const computedMonth = getMonthForSchoolWeek(weekNumber, normYear);
  const resolvedUpdatedAt = options?.preserveUpdatedAt
    ? (record.updatedAt || '')
    : (options?.timestamp || new Date().toISOString());

  const resolvedUpdatedBy = editor
    ? (editor.username || editor.email || editor.uid || record.updatedBy || '')
    : record.updatedBy;
  const resolvedUpdatedByName = editor
    ? (editor.fullName || editor.username || record.updatedByName || '')
    : record.updatedByName;
  const resolvedUpdatedByUid = editor
    ? (editor.uid || auth.currentUser?.uid || record.updatedByUid || '')
    : record.updatedByUid;

  const payload: ClassAcademicEmulationRecord = {
    ...record,
    id,
    schoolYear: normYear,
    weekNumber,
    monthNumber: computedMonth,
    classId: record.classId,
    className: record.className,
    goodLessons,
    fairLessons,
    avgLessons,
    weakLessons,
    goodDays,
    goodWeeks,
    goodMarks,
    badMarks,
    disorderlyStudents,
    bonusGoodMarks,
    bonusGoodDays,
    bonusGoodWeeks,
    bonusPoints,
    deductFairLessons,
    deductAvgLessons,
    deductWeakLessons,
    deductLessonTotal,
    deductBadMarks,
    deductDisorderlyStudents,
    deductionPoints,
    totalScore,
    classification,
    updatedAt: resolvedUpdatedAt
  };

  if (resolvedUpdatedBy) payload.updatedBy = resolvedUpdatedBy;
  if (resolvedUpdatedByName) payload.updatedByName = resolvedUpdatedByName;
  if (resolvedUpdatedByUid) payload.updatedByUid = resolvedUpdatedByUid;

  return payload;
}

function normalizeRemoteRecord(docId: string, raw: Record<string, any>): ClassAcademicEmulationRecord {
  const r = { ...raw, id: raw.id || docId } as ClassAcademicEmulationRecord;
  r.schoolYear = normalizeAcademicYear(r.schoolYear);
  r.weekNumber = Number(r.weekNumber) || 1;
  const bp = r.bonusPoints ?? 0;
  const dp = r.deductionPoints ?? 0;
  if (r.totalScore === 100 && bp === 0 && dp === 0) {
    r.totalScore = 0;
  }
  return r;
}

function deduplicateRecords(records: ClassAcademicEmulationRecord[]): ClassAcademicEmulationRecord[] {
  const map = new Map<string, ClassAcademicEmulationRecord>();
  for (const r of records) {
    const key = buildEmulationRecordId(r.schoolYear, r.weekNumber, r.classId);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
      continue;
    }
    const existingTime = existing.updatedAt ? Date.parse(existing.updatedAt) || 0 : 0;
    const candidateTime = r.updatedAt ? Date.parse(r.updatedAt) || 0 : 0;
    // Prefer canonical doc ID or newer timestamp
    if (candidateTime > existingTime || (candidateTime === existingTime && r.id === key)) {
      map.set(key, r);
    }
  }
  return Array.from(map.values());
}

/**
 * Verifies that a written document is actually persisted on the Firestore server
 * (not merely buffered in local persistent cache while offline).
 */
async function confirmDocumentOnServer(
  collectionName: string,
  docId: string,
  expectedUpdatedAt?: string
): Promise<void> {
  assertBrowserOnline();

  const verifyViaServerRead = async (): Promise<void> => {
    const snap = await withStrictTimeout(
      getDocFromServer(doc(db, collectionName, docId)),
      FIRESTORE_WRITE_TIMEOUT_MS,
      'Hết thời gian chờ xác nhận ghi dữ liệu từ máy chủ Firestore.'
    );
    if (!snap.exists()) {
      throw new Error('Không xác nhận được bản ghi trên máy chủ Firestore.');
    }
    if (expectedUpdatedAt && snap.data()?.updatedAt !== expectedUpdatedAt) {
      throw new Error('Dữ liệu trên máy chủ Firestore chưa phản ánh phiên bản vừa lưu.');
    }
  };

  // First await waitForPendingWrites (resolves when Firestore backend ACKs the commit)
  try {
    await withStrictTimeout(
      waitForPendingWrites(db),
      FIRESTORE_WRITE_TIMEOUT_MS,
      'Hết thời gian chờ xác nhận ghi dữ liệu từ máy chủ Firestore.'
    );
    // Double-check directly against the server for the exact written document & timestamp
    await verifyViaServerRead();
  } catch (err) {
    // If waitForPendingWrites timed out due to an unrelated pending write elsewhere,
    // verify our exact document directly from server before failing
    await verifyViaServerRead();
  }
}

export const academicEmulationService = {
  /**
   * Read emulation config directly from Firestore (single source of truth).
   * Never merges stale local lockedWeeks over remote lockedWeeks so unlock always persists.
   */
  async getConfig(schoolYear: string = '2026–2027'): Promise<AcademicEmulationConfig> {
    const normYear = normalizeAcademicYear(schoolYear);
    const docId = buildEmulationConfigDocId(normYear);
    const docRef = doc(db, COLLECTIONS.CONFIG, docId);
    const fallbackCfg: AcademicEmulationConfig = {
      ...DEFAULT_EMULATION_CONFIG,
      id: docId,
      schoolYear: normYear,
      lockedWeeks: []
    };

    try {
      let snap;
      try {
        snap = await withStrictTimeout(
          getDocFromServer(docRef),
          FIRESTORE_READ_TIMEOUT_MS,
          'Hết thời gian tải cấu hình thi đua từ Firestore.'
        );
      } catch {
        snap = await withStrictTimeout(
          getDoc(docRef),
          FIRESTORE_READ_TIMEOUT_MS,
          'Hết thời gian tải cấu hình thi đua.'
        );
      }

      if (snap.exists()) {
        const remoteCfg = snap.data() as AcademicEmulationConfig;
        return {
          ...fallbackCfg,
          ...remoteCfg,
          id: docId,
          schoolYear: normYear,
          lockedWeeks: Array.isArray(remoteCfg.lockedWeeks)
            ? Array.from(new Set(remoteCfg.lockedWeeks.map(w => Number(w)).filter(w => !isNaN(w))))
            : []
        };
      }
      return fallbackCfg;
    } catch (e) {
      logStructuredFirestoreError(e, OperationType.GET, `${COLLECTIONS.CONFIG}/${docId}`);
      throw e;
    }
  },

  /**
   * Persist emulation config (including lockedWeeks) to Firestore with real server confirmation.
   */
  async saveConfig(
    config: AcademicEmulationConfig,
    editor?: AcademicEmulationEditorInfo
  ): Promise<AcademicEmulationConfig> {
    assertBrowserOnline();
    const normYear = normalizeAcademicYear(config.schoolYear);
    const docId = buildEmulationConfigDocId(normYear);
    const docRef = doc(db, COLLECTIONS.CONFIG, docId);

    const updatedCfg: AcademicEmulationConfig = {
      ...config,
      id: docId,
      schoolYear: normYear,
      lockedWeeks: Array.isArray(config.lockedWeeks)
        ? Array.from(new Set(config.lockedWeeks.map(w => Number(w)).filter(w => !isNaN(w))))
        : [],
      updatedAt: new Date().toISOString(),
      ...(editor?.username || editor?.email ? { updatedBy: editor.username || editor.email } : {}),
      ...(editor?.fullName ? { updatedByName: editor.fullName } : {})
    };

    try {
      await withStrictTimeout(
        setDoc(docRef, stripUndefinedFields(updatedCfg), { merge: true }),
        FIRESTORE_WRITE_TIMEOUT_MS,
        'Hết thời gian chờ lưu cấu hình thi đua lên Firestore.'
      );
      await confirmDocumentOnServer(COLLECTIONS.CONFIG, docId, updatedCfg.updatedAt);
      return updatedCfg;
    } catch (e) {
      logStructuredFirestoreError(e, OperationType.WRITE, `${COLLECTIONS.CONFIG}/${docId}`);
      throw e;
    }
  },

  /**
   * Read emulation records directly from Firestore (single source of truth).
   * Supports both hyphen ("2026-2027") and legacy en-dash ("2026–2027") year formats.
   */
  async getRecords(schoolYear: string, weekNumber: number): Promise<ClassAcademicEmulationRecord[]> {
    const normYear = normalizeAcademicYear(schoolYear);
    const enDashYear = normYear.replace('-', '–');
    const colRef = collection(db, COLLECTIONS.RECORDS);

    try {
      const targetQuery =
        weekNumber > 0
          ? query(colRef, where('weekNumber', '==', Number(weekNumber)))
          : query(colRef, where('schoolYear', 'in', Array.from(new Set([normYear, enDashYear]))));

      let snap;
      try {
        snap = await withStrictTimeout(
          getDocsFromServer(targetQuery),
          FIRESTORE_READ_TIMEOUT_MS,
          'Hết thời gian tải dữ liệu thi đua từ máy chủ Firestore.'
        );
      } catch {
        snap = await withStrictTimeout(
          getDocs(targetQuery),
          FIRESTORE_READ_TIMEOUT_MS,
          'Hết thời gian tải dữ liệu thi đua.'
        );
      }

      const rawList = snap.docs.map(d => normalizeRemoteRecord(d.id, d.data()));
      const filtered = rawList.filter(r => {
        const rYear = normalizeAcademicYear(r.schoolYear);
        return rYear === normYear && (weekNumber === 0 || Number(r.weekNumber) === Number(weekNumber));
      });

      return deduplicateRecords(filtered);
    } catch (e) {
      logStructuredFirestoreError(e, OperationType.LIST, COLLECTIONS.RECORDS);
      throw e;
    }
  },

  /**
   * Load records for a week WITHOUT writing default zeros to Firestore.
   * Existing server documents are restored verbatim; classes without a saved record yet
   * are rendered in memory with 0s until the user edits or saves.
   */
  async loadWeekRecords(
    classes: ClassInfo[],
    schoolYear: string,
    weekNumber: number,
    config: AcademicEmulationConfig
  ): Promise<{ records: ClassAcademicEmulationRecord[]; persistedIds: Set<string>; latestSavedAt: string | null; latestSavedBy: string | null }> {
    const existing = await this.getRecords(schoolYear, weekNumber);
    const normYear = normalizeAcademicYear(schoolYear);
    const persistedIds = new Set<string>();
    const results: ClassAcademicEmulationRecord[] = [];
    let latestSavedAt: string | null = null;
    let latestSavedBy: string | null = null;

    for (const cls of classes) {
      const canonicalId = buildEmulationRecordId(normYear, weekNumber, cls.id);
      const found =
        existing.find(r => r.id === canonicalId) ||
        existing.find(r => r.classId === cls.id) ||
        existing.find(r => r.className?.trim().toLowerCase() === cls.name?.trim().toLowerCase());

      if (found) {
        persistedIds.add(cls.id);
        const normalized = computeEmulationRecord(
          {
            ...found,
            id: canonicalId,
            classId: cls.id,
            className: cls.name,
            schoolYear: normYear,
            weekNumber: Number(weekNumber)
          },
          config,
          undefined,
          { preserveUpdatedAt: true }
        );
        if (normalized.updatedAt) {
          if (!latestSavedAt || Date.parse(normalized.updatedAt) > Date.parse(latestSavedAt)) {
            latestSavedAt = normalized.updatedAt;
            latestSavedBy = normalized.updatedByName || normalized.updatedBy || null;
          }
        }
        results.push(normalized);
      } else {
        const template: ClassAcademicEmulationRecord = computeEmulationRecord(
          {
            id: canonicalId,
            schoolYear: normYear,
            weekNumber: Number(weekNumber),
            monthNumber: getMonthForSchoolWeek(weekNumber, normYear),
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
            disorderlyStudents: 0,
            updatedAt: ''
          },
          config,
          undefined,
          { preserveUpdatedAt: true }
        );
        results.push(template);
      }
    }

    return { records: results, persistedIds, latestSavedAt, latestSavedBy };
  },

  /**
   * Backward-compatible read-only wrapper (never wipes server data with zeros).
   */
  async initializeWeekRecords(
    classes: ClassInfo[],
    schoolYear: string,
    weekNumber: number,
    config: AcademicEmulationConfig
  ): Promise<ClassAcademicEmulationRecord[]> {
    const { records } = await this.loadWeekRecords(classes, schoolYear, weekNumber, config);
    return records;
  },

  /**
   * Save a single class record to Firestore with real confirmation.
   */
  async saveRecord(
    record: ClassAcademicEmulationRecord,
    config: AcademicEmulationConfig,
    editor?: AcademicEmulationEditorInfo
  ): Promise<ClassAcademicEmulationRecord> {
    assertBrowserOnline();
    const payload = computeEmulationRecord(record, config, editor);
    const docRef = doc(db, COLLECTIONS.RECORDS, payload.id);

    try {
      await withStrictTimeout(
        setDoc(docRef, stripUndefinedFields(payload), { merge: true }),
        FIRESTORE_WRITE_TIMEOUT_MS,
        `Hết thời gian chờ lưu dữ liệu lớp ${payload.className}.`
      );
      await confirmDocumentOnServer(COLLECTIONS.RECORDS, payload.id, payload.updatedAt);
      return payload;
    } catch (e) {
      logStructuredFirestoreError(e, OperationType.WRITE, `${COLLECTIONS.RECORDS}/${payload.id}`);
      throw e;
    }
  },

  /**
   * Save multiple (or all) class records of a week to Firestore using chunked writeBatch.
   * Only reports success after Firestore confirms the write.
   * Reports exact savedCount, failedCount, and per-class failures.
   */
  async saveWeekRecordsBatch(
    records: ClassAcademicEmulationRecord[],
    config: AcademicEmulationConfig,
    editor?: AcademicEmulationEditorInfo
  ): Promise<AcademicEmulationBatchSaveResult> {
    const savedAt = new Date().toISOString();

    if (!records || records.length === 0) {
      return {
        savedRecords: [],
        savedCount: 0,
        failedCount: 0,
        failures: [],
        savedAt
      };
    }

    const prepared = records.map(rec =>
      computeEmulationRecord(rec, config, editor, { timestamp: savedAt })
    );

    // Check online status before writing so we never return false success while offline
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const offlineDetail = classifyAcademicFirestoreError({ code: 'offline' });
      return {
        savedRecords: [],
        savedCount: 0,
        failedCount: prepared.length,
        failures: prepared.map(r => ({
          classId: r.classId,
          className: r.className,
          recordId: r.id,
          reason: offlineDetail.message,
          code: offlineDetail.code
        })),
        savedAt,
        errorSummary: offlineDetail.message
      };
    }

    const savedRecords: ClassAcademicEmulationRecord[] = [];
    const failures: AcademicEmulationSaveFailure[] = [];

    for (let i = 0; i < prepared.length; i += FIRESTORE_BATCH_LIMIT) {
      const chunk = prepared.slice(i, i + FIRESTORE_BATCH_LIMIT);
      try {
        const batch = writeBatch(db);
        for (const item of chunk) {
          const ref = doc(db, COLLECTIONS.RECORDS, item.id);
          batch.set(ref, stripUndefinedFields(item), { merge: true });
        }

        await withStrictTimeout(
          batch.commit(),
          FIRESTORE_WRITE_TIMEOUT_MS,
          'Hết thời gian chờ ghi hàng loạt lên Firestore.'
        );

        // Confirm persistence on the actual Firestore server
        const verifyItem = chunk[chunk.length - 1];
        await confirmDocumentOnServer(COLLECTIONS.RECORDS, verifyItem.id, verifyItem.updatedAt);

        savedRecords.push(...chunk);
      } catch (batchErr) {
        logStructuredFirestoreError(batchErr, OperationType.WRITE, COLLECTIONS.RECORDS);
        const errDetail = classifyAcademicFirestoreError(batchErr);

        // For fatal transport/permission/quota errors, fail fast without hammering Firestore
        if (
          errDetail.isOffline ||
          errDetail.isPermissionDenied ||
          errDetail.isQuotaExceeded ||
          errDetail.isTimeout
        ) {
          for (const item of chunk) {
            failures.push({
              classId: item.classId,
              className: item.className,
              recordId: item.id,
              reason: errDetail.message,
              code: errDetail.code
            });
          }
          // Skip remaining chunks too if fatal transport/permission/quota error
          const remaining = prepared.slice(i + FIRESTORE_BATCH_LIMIT);
          for (const item of remaining) {
            failures.push({
              classId: item.classId,
              className: item.className,
              recordId: item.id,
              reason: errDetail.message,
              code: errDetail.code
            });
          }
          return {
            savedRecords,
            savedCount: savedRecords.length,
            failedCount: failures.length,
            failures,
            savedAt,
            errorSummary: errDetail.message
          };
        }

        // Otherwise isolate per-class errors cleanly
        for (const item of chunk) {
          try {
            const ref = doc(db, COLLECTIONS.RECORDS, item.id);
            await withStrictTimeout(
              setDoc(ref, stripUndefinedFields(item), { merge: true }),
              FIRESTORE_WRITE_TIMEOUT_MS,
              `Hết thời gian chờ lưu lớp ${item.className}.`
            );
            await confirmDocumentOnServer(COLLECTIONS.RECORDS, item.id, item.updatedAt);
            savedRecords.push(item);
          } catch (singleErr) {
            logStructuredFirestoreError(
              singleErr,
              OperationType.WRITE,
              `${COLLECTIONS.RECORDS}/${item.id}`
            );
            const singleDetail = classifyAcademicFirestoreError(singleErr);
            failures.push({
              classId: item.classId,
              className: item.className,
              recordId: item.id,
              reason: singleDetail.message,
              code: singleDetail.code
            });
          }
        }
      }
    }

    return {
      savedRecords,
      savedCount: savedRecords.length,
      failedCount: failures.length,
      failures,
      savedAt,
      errorSummary: failures.length > 0 ? failures[0].reason : undefined
    };
  },

  calculateMonthlySummary(
    classes: ClassInfo[],
    allRecords: ClassAcademicEmulationRecord[],
    monthNumber: number,
    schoolYear: string,
    config: AcademicEmulationConfig,
    activeWeeks?: number[]
  ): MonthlyEmulationSummary[] {
    const normYear = normalizeAcademicYear(schoolYear);
    const targetWeeks =
      activeWeeks && activeWeeks.length > 0
        ? activeWeeks
        : getWeeksForMonth(monthNumber, normYear);

    const summaries: MonthlyEmulationSummary[] = classes.map(cls => {
      const clsRecords = allRecords.filter(
        r => r.classId === cls.id && normalizeAcademicYear(r.schoolYear) === normYear
      );
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
      let totalDisorderlyStudents = 0;
      let totalBonusPoints = 0;
      let totalDeductionPoints = 0;

      targetWeeks.forEach(w => {
        const found = clsRecords.find(r => Number(r.weekNumber) === Number(w));
        if (found) {
          weekRecords[w] = found;
          const score =
            typeof found.totalScore === 'number'
              ? found.totalScore
              : (found.bonusPoints || 0) - (found.deductionPoints || 0);
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
          totalDisorderlyStudents += found.disorderlyStudents || 0;
          totalBonusPoints += found.bonusPoints || 0;
          totalDeductionPoints += found.deductionPoints || 0;
        } else {
          weekRecords[w] = undefined;
          weekScores.push({ weekNumber: w, score: 0, hasRecord: false });
        }
      });

      const divisor =
        recordedCount > 0 ? recordedCount : targetWeeks.length > 0 ? targetWeeks.length : 1;
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
        totalDisorderlyStudents,
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
