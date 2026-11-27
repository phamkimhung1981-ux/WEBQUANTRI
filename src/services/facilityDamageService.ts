import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FacilityDamageReport, DamageReportStatus, FacilityDamageHistoryItem } from '../types/facilityDamage';
import { safeLocalStorageSet } from '../utils/envUtils';
import {
  createCachedSubscriptionChannel,
  reportFirestoreError,
  reportFirestoreSuccess
} from '../utils/firestoreQuotaManager';

const COLLECTION_NAME = 'facility_damage_reports';
const CACHE_STORAGE_KEY = 'thpt_sl_facility_reports_cache_v1';
const FACILITY_CACHE_TTL_MS = 3 * 60 * 1000;

function readCachedReports(): FacilityDamageReport[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedReports(reports: FacilityDamageReport[]): void {
  safeLocalStorageSet(CACHE_STORAGE_KEY, JSON.stringify(reports));
}

function sortReportsDesc(reports: FacilityDamageReport[]): FacilityDamageReport[] {
  return [...reports].sort((a, b) => {
    const timeA = new Date(a.reportedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.reportedAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

const facilityReportsChannel = createCachedSubscriptionChannel<FacilityDamageReport[]>({
  cacheKey: 'facility:reports',
  ttlMs: FACILITY_CACHE_TTL_MS,
  fetcher: async () => {
    const q = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(q);
    const reports: FacilityDamageReport[] = [];
    snapshot.forEach(docSnap => {
      reports.push({ id: docSnap.id, ...docSnap.data() } as FacilityDamageReport);
    });
    const sorted = sortReportsDesc(reports);
    writeCachedReports(sorted);
    return sorted;
  },
  getFallback: readCachedReports
});

export const facilityDamageService = {
  // Generate unique ticket code
  generateTicketCode(): string {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `VC-${dateStr}-${randomNum}`;
  },

  // TTL-cached synchronization across components (replaces permanent onSnapshot)
  subscribeReports(
    callback: (reports: FacilityDamageReport[]) => void,
    onError?: (error: Error) => void
  ) {
    return facilityReportsChannel.subscribe(callback, (err) => {
      console.error('Error fetching facility damage reports:', err);
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
    });
  },

  async getAllReports(forceRefresh: boolean = false): Promise<FacilityDamageReport[]> {
    try {
      const data = await facilityReportsChannel.refresh(forceRefresh, false);
      return data ?? readCachedReports();
    } catch (error: any) {
      reportFirestoreError(error);
      console.error('Error fetching facility damage reports from Firestore:', error);
      throw new Error(`Không thể lấy danh sách báo hỏng từ máy chủ: ${error?.message || error}`);
    }
  },

  async saveReport(reportData: Omit<FacilityDamageReport, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> {
    const id = reportData.id || doc(collection(db, COLLECTION_NAME)).id;
    const now = new Date().toISOString();
    
    const fullReport: FacilityDamageReport = {
      ...reportData,
      id,
      createdAt: reportData.id ? (reportData as any).createdAt || now : now,
      updatedAt: now
    };

    try {
      // Direct Firestore write as single source of truth
      await setDoc(doc(db, COLLECTION_NAME, id), fullReport, { merge: true });
      reportFirestoreSuccess();

      const current = facilityReportsChannel.getSnapshot() ?? [];
      const next = sortReportsDesc([
        fullReport,
        ...current.filter(r => r.id !== id)
      ]);
      writeCachedReports(next);
      facilityReportsChannel.publish(next);
      return id;
    } catch (error: any) {
      reportFirestoreError(error);
      console.error('Error saving facility damage report to Firestore:', error);
      throw new Error(`Không thể lưu phiếu báo hỏng lên máy chủ: ${error?.message || error}`);
    }
  },

  async updateReportStatus(
    id: string, 
    newStatus: DamageReportStatus, 
    user: { id: string; name: string },
    note?: string,
    extraData?: Partial<FacilityDamageReport>
  ): Promise<void> {
    try {
      const reportRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(reportRef);
      if (!docSnap.exists()) {
        throw new Error('Phiếu báo hỏng không tồn tại trên máy chủ.');
      }

      const current = docSnap.data() as FacilityDamageReport;
      const historyItem: FacilityDamageHistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        status: newStatus,
        updatedBy: user.id,
        updatedByName: user.name,
        timestamp: new Date().toISOString(),
        content: `Cập nhật trạng thái thành: "${newStatus}"`,
        note: note || ''
      };

      const updatedHistory = [...(current.history || []), historyItem];
      const updatedAt = new Date().toISOString();
      const updates: Record<string, any> = {
        status: newStatus,
        history: updatedHistory,
        updatedAt,
        ...(extraData || {})
      };

      await updateDoc(reportRef, updates);
      reportFirestoreSuccess();

      const updatedReport: FacilityDamageReport = {
        ...current,
        id,
        status: newStatus,
        history: updatedHistory,
        updatedAt,
        ...(extraData || {})
      };
      const cached = facilityReportsChannel.getSnapshot() ?? [];
      const next = sortReportsDesc(
        cached.some(r => r.id === id)
          ? cached.map(r => (r.id === id ? updatedReport : r))
          : [updatedReport, ...cached]
      );
      writeCachedReports(next);
      facilityReportsChannel.publish(next);
    } catch (error: any) {
      reportFirestoreError(error);
      console.error('Error updating facility damage report status:', error);
      throw new Error(`Không thể cập nhật trạng thái trên máy chủ: ${error?.message || error}`);
    }
  },

  async deleteReport(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      reportFirestoreSuccess();
      const next = (facilityReportsChannel.getSnapshot() ?? []).filter(r => r.id !== id);
      writeCachedReports(next);
      facilityReportsChannel.publish(next);
    } catch (error: any) {
      reportFirestoreError(error);
      console.error('Error deleting report from Firestore:', error);
      throw new Error(`Không thể xóa phiếu trên máy chủ: ${error?.message || error}`);
    }
  }
};
