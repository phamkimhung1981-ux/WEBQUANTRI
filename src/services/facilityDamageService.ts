import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FacilityDamageReport, DamageReportStatus, FacilityDamageHistoryItem } from '../types/facilityDamage';

const COLLECTION_NAME = 'facility_damage_reports';

export const facilityDamageService = {
  // Generate unique ticket code
  generateTicketCode(): string {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `VC-${dateStr}-${randomNum}`;
  },

  // Real-time synchronization across all devices
  subscribeReports(
    callback: (reports: FacilityDamageReport[]) => void,
    onError?: (error: Error) => void
  ) {
    const q = query(collection(db, COLLECTION_NAME));
    return onSnapshot(q, (snapshot) => {
      const reports: FacilityDamageReport[] = [];
      snapshot.forEach(docSnap => {
        reports.push({ id: docSnap.id, ...docSnap.data() } as FacilityDamageReport);
      });
      reports.sort((a, b) => {
        const timeA = new Date(a.reportedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.reportedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      callback(reports);
    }, (error) => {
      console.error('Error subscribing to facility damage reports:', error);
      if (onError) onError(error);
    });
  },

  async getAllReports(): Promise<FacilityDamageReport[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const reports: FacilityDamageReport[] = [];
      snapshot.forEach(docSnap => {
        reports.push({ id: docSnap.id, ...docSnap.data() } as FacilityDamageReport);
      });
      return reports;
    } catch (error: any) {
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
      return id;
    } catch (error: any) {
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
      const updates: Record<string, any> = {
        status: newStatus,
        history: updatedHistory,
        updatedAt: new Date().toISOString(),
        ...(extraData || {})
      };

      await updateDoc(reportRef, updates);
    } catch (error: any) {
      console.error('Error updating facility damage report status:', error);
      throw new Error(`Không thể cập nhật trạng thái trên máy chủ: ${error?.message || error}`);
    }
  },

  async deleteReport(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      console.error('Error deleting report from Firestore:', error);
      throw new Error(`Không thể xóa phiếu trên máy chủ: ${error?.message || error}`);
    }
  }
};
