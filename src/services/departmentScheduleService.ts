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
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DepartmentWeeklySchedule, DepartmentScheduleDayItem } from '../types/departmentSchedule';
import { getWeekInfoByNumber, getCurrentSchoolWeekInfo } from '../utils/schoolWeekUtils';

const COLLECTION_NAME = 'department_weekly_schedules';
const LOCAL_STORAGE_KEY = 'school_department_weekly_schedules';

export const departmentScheduleService = {
  /**
   * Fetch all department weekly schedules with fallback to localStorage
   */
  async getSchedules(filter?: {
    departmentId?: string;
    departmentName?: string;
    weekNumber?: number;
  }): Promise<DepartmentWeeklySchedule[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const list: DepartmentWeeklySchedule[] = [];
      querySnapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as DepartmentWeeklySchedule);
      });

      if (list.length === 0) {
        // Fallback to localStorage or seed sample
        return this.getLocalOrSeedSchedules(filter);
      }

      // Update local cache
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));

      return this.applyFilter(list, filter);
    } catch (error) {
      console.warn('Error querying Firestore for department schedules, falling back to LocalStorage:', error);
      return this.getLocalOrSeedSchedules(filter);
    }
  },

  /**
   * Helper to filter list
   */
  applyFilter(
    list: DepartmentWeeklySchedule[],
    filter?: { departmentId?: string; departmentName?: string; weekNumber?: number }
  ): DepartmentWeeklySchedule[] {
    if (!filter) return list;
    return list.filter((item) => {
      if (filter.departmentId && item.departmentId !== filter.departmentId && !item.departmentName.toLowerCase().includes(filter.departmentId.toLowerCase())) {
        return false;
      }
      if (filter.departmentName && !item.departmentName.toLowerCase().includes(filter.departmentName.toLowerCase())) {
        return false;
      }
      if (filter.weekNumber && item.weekNumber !== filter.weekNumber) {
        return false;
      }
      return true;
    });
  },

  /**
   * Get single schedule by ID
   */
  async getScheduleById(id: string): Promise<DepartmentWeeklySchedule | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() } as DepartmentWeeklySchedule;
      }
    } catch (e) {
      console.warn('Cannot fetch from Firestore, searching local storage:', e);
    }

    const localList = this.getLocalSchedules();
    return localList.find((s) => s.id === id) || null;
  },

  /**
   * Save or update a schedule
   */
  async saveSchedule(schedule: DepartmentWeeklySchedule): Promise<void> {
    const now = new Date().toISOString();
    const dataToSave: DepartmentWeeklySchedule = {
      ...schedule,
      updatedAt: now,
      createdAt: schedule.createdAt || now
    };

    // 1. Save to localStorage immediately
    const localList = this.getLocalSchedules();
    const existingIdx = localList.findIndex((s) => s.id === schedule.id);
    if (existingIdx >= 0) {
      localList[existingIdx] = dataToSave;
    } else {
      localList.unshift(dataToSave);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localList));

    // 2. Persist to Firestore
    try {
      const docRef = doc(db, COLLECTION_NAME, schedule.id);
      await setDoc(docRef, dataToSave, { merge: true });
    } catch (error) {
      console.error('Error saving schedule to Firestore (saved to localStorage cache):', error);
    }
  },

  /**
   * Delete schedule
   */
  async deleteSchedule(id: string): Promise<void> {
    // 1. Remove from local storage
    const localList = this.getLocalSchedules().filter((s) => s.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localList));

    // 2. Remove from Firestore
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting schedule from Firestore:', error);
    }
  },

  /**
   * Approve a schedule
   */
  async approveSchedule(
    id: string,
    approverName: string,
    approvalComment?: string
  ): Promise<DepartmentWeeklySchedule | null> {
    const schedule = await this.getScheduleById(id);
    if (!schedule) return null;

    const updated: DepartmentWeeklySchedule = {
      ...schedule,
      status: 'approved',
      approvedBy: approverName,
      approvalDate: new Date().toISOString(),
      approvalComment: approvalComment || 'Đã duyệt theo kế hoạch tuần của tổ chuyên môn.',
      updatedAt: new Date().toISOString()
    };

    await this.saveSchedule(updated);
    return updated;
  },

  /**
   * Internal localStorage getter
   */
  getLocalSchedules(): DepartmentWeeklySchedule[] {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error('Parse error localStorage', e);
      }
    }
    return [];
  },

  /**
   * Get or Seed realistic schedules
   */
  getLocalOrSeedSchedules(filter?: {
    departmentId?: string;
    departmentName?: string;
    weekNumber?: number;
  }): DepartmentWeeklySchedule[] {
    let list = this.getLocalSchedules();
    if (list.length === 0) {
      list = this.createDefaultSeedSchedules();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    }
    return this.applyFilter(list, filter);
  },

  /**
   * Creates a blank structured schedule for a specific week and department
   */
  createBlankSchedule(
    departmentId: string,
    departmentName: string,
    weekNum = 5,
    year = 2026
  ): DepartmentWeeklySchedule {
    const weekInfo = getWeekInfoByNumber(weekNum, '2026-2027');
    const startDate = weekInfo ? weekInfo.startDateStr : '2026-09-28';
    const endDate = weekInfo ? weekInfo.endDateStr : '2026-10-04';

    const dayLabels = [
      'Thứ Hai',
      'Thứ Ba',
      'Thứ Tư',
      'Thứ Năm',
      'Thứ Sáu',
      'Thứ Bảy',
      'Chủ Nhật'
    ];

    const days: DepartmentScheduleDayItem[] = dayLabels.map((dayLabel, idx) => {
      let dayDate = '';
      let dateDisplay = dayLabel;
      try {
        const d = new Date(startDate);
        d.setDate(d.getDate() + idx);
        dayDate = d.toISOString().split('T')[0];
        dateDisplay = `${dayLabel}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      } catch {
        // ignore
      }

      return {
        id: `day_${idx}_${Date.now()}`,
        dayOfWeek: dayLabel,
        date: dayDate,
        dateDisplay,
        morningTasks: '',
        afternoonTasks: '',
        dutyLeaderOrEvaluation: '',
        notes: '',
        assignedTeachers: [],
        status: 'pending'
      };
    });

    return {
      id: `dept_sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      schoolName: 'TRƯỜNG THPT SƠN LƯƠNG',
      departmentId,
      departmentName,
      weekNumber: weekNum,
      startDate,
      endDate,
      year,
      academicYear: '2026-2027',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      days
    };
  },

  /**
   * Generates default seed data matching the real school context
   */
  createDefaultSeedSchedules(): DepartmentWeeklySchedule[] {
    const sampleToan: DepartmentWeeklySchedule = {
      id: 'sched_sample_toan_tuan5',
      schoolName: 'TRƯỜNG THPT SƠN LƯƠNG',
      departmentId: 'd_toan_ly_tin_cn',
      departmentName: 'TỔ TOÁN - LÝ - TIN - CN',
      weekNumber: 5,
      startDate: '2026-09-28',
      endDate: '2026-10-04',
      year: 2026,
      academicYear: '2026-2027',
      status: 'approved',
      approvedBy: 'Hiệu trưởng - Nguyễn Quang Sáng',
      approvalDate: '2026-09-27T08:30:00.000Z',
      approvalComment: 'Kế hoạch chi tiết, phân công rõ ràng. Đề nghị tổ triển khai nghiêm túc sinh hoạt chuyên môn theo NCBH.',
      createdAt: '2026-09-26T10:00:00.000Z',
      updatedAt: '2026-09-27T08:30:00.000Z',
      days: [
        {
          id: 'day_toan_0',
          dayOfWeek: 'Thứ Hai',
          date: '2026-09-28',
          dateDisplay: 'Thứ Hai, 28/09/2026',
          morningTasks: '- Chào cờ đầu tuần, phổ biến trọng tâm công tác chuyên môn tháng 10.\n- Dạy học theo TKB khối 10, 11, 12.\n- Kiểm tra giáo án tuần 5 các nhóm môn Toán, Tin học.',
          afternoonTasks: '- Bồi dưỡng học sinh giỏi Toán 12 (thầy Hùng phụ trách).\n- Ôn tập củng cố kiến thức môn Tin học 11.',
          dutyLeaderOrEvaluation: 'Thầy Sáng (HT) trực - Đạt yêu cầu',
          notes: 'Nộp sổ báo giảng trước 11h'
        },
        {
          id: 'day_toan_1',
          dayOfWeek: 'Thứ Ba',
          date: '2026-09-29',
          dateDisplay: 'Thứ Ba, 29/09/2026',
          morningTasks: '- Giảng dạy chính khóa theo phân phối chương trình.\n- Dự giờ thao giảng môn Vật lý 10 (tiết 3, cô Trang).',
          afternoonTasks: '- Giáo viên tự nghiên cứu bài học, chuẩn bị đồ dùng dạy học thực hành môn Vật lý.',
          dutyLeaderOrEvaluation: 'Cô Hoa (PHT)',
          notes: 'Phòng thực hành Lý'
        },
        {
          id: 'day_toan_2',
          dayOfWeek: 'Thứ Tư',
          date: '2026-09-30',
          dateDisplay: 'Thứ Tư, 30/09/2026',
          morningTasks: '- Giảng dạy chính khóa.\n- Khảo sát chất lượng đầu năm môn Toán khối 10 (theo đề chung của tổ).',
          afternoonTasks: '- Sinh hoạt tổ chuyên môn định kỳ: Rút kinh nghiệm bài dạy minh họa, thống nhất ma trận đề kiểm tra giữa kỳ 1.',
          dutyLeaderOrEvaluation: 'Tổ trưởng Toán - Tin',
          notes: 'Văn phòng tổ lúc 14h00'
        },
        {
          id: 'day_toan_3',
          dayOfWeek: 'Thứ Năm',
          date: '2026-10-01',
          dateDisplay: 'Thứ Năm, 01/10/2026',
          morningTasks: '- Giảng dạy chính khóa các lớp.\n- Kiểm tra hồ sơ sổ điểm điện tử của giáo viên trong tổ.',
          afternoonTasks: '- Chấm bài khảo sát chất lượng môn Toán 10 và nhập điểm vào hệ thống.\n- Hướng dẫn HS tham gia cuộc thi KHKT cấp trường môn Tin học.',
          dutyLeaderOrEvaluation: 'Thầy Hưng (TTCM)',
          notes: 'Hoàn thành nhập điểm trước 17h'
        },
        {
          id: 'day_toan_4',
          dayOfWeek: 'Thứ Sáu',
          date: '2026-10-02',
          dateDisplay: 'Thứ Sáu, 02/10/2026',
          morningTasks: '- Dạy học theo thời khóa biểu.\n- Dự giờ rút kinh nghiệm tiết dạy ứng dụng CNTT môn Công nghệ (thầy Bình).',
          afternoonTasks: '- Bồi dưỡng HSG môn Vật lý 12 (thầy Tuấn).\n- Sinh hoạt cụm nhóm chuyên môn Toán 12.',
          dutyLeaderOrEvaluation: 'Thầy Tuấn (PHT)',
          notes: ''
        },
        {
          id: 'day_toan_5',
          dayOfWeek: 'Thứ Bảy',
          date: '2026-10-03',
          dateDisplay: 'Thứ Bảy, 03/10/2026',
          morningTasks: '- Giảng dạy chính khóa tiết 1-4.\n- Họp hội đồng sư phạm nhà trường tổng kết tháng 9 (tiết 5).',
          afternoonTasks: '- Nghỉ theo quy định / Giáo viên trực theo dõi hoạt động ngoại khóa CLB STEM.',
          dutyLeaderOrEvaluation: 'BGH trực',
          notes: 'Hội trường lớn'
        },
        {
          id: 'day_toan_6',
          dayOfWeek: 'Chủ Nhật',
          date: '2026-10-04',
          dateDisplay: 'Chủ Nhật, 04/10/2026',
          morningTasks: 'Nghỉ theo chế độ.',
          afternoonTasks: 'Soạn giáo án, lập kế hoạch dạy học tuần 6 và nộp duyệt trực tuyến.',
          dutyLeaderOrEvaluation: '',
          notes: ''
        }
      ]
    };

    const sampleVan: DepartmentWeeklySchedule = {
      id: 'sched_sample_van_tuan5',
      schoolName: 'TRƯỜNG THPT SƠN LƯƠNG',
      departmentId: 'd_van_su_dia_gdkt_pl_an',
      departmentName: 'TỔ VĂN - SỬ - ĐỊA - GDKT&PL - AN',
      weekNumber: 5,
      startDate: '2026-09-28',
      endDate: '2026-10-04',
      year: 2026,
      academicYear: '2026-2027',
      status: 'submitted',
      createdAt: '2026-09-26T14:00:00.000Z',
      updatedAt: '2026-09-26T14:00:00.000Z',
      days: [
        {
          id: 'day_van_0',
          dayOfWeek: 'Thứ Hai',
          date: '2026-09-28',
          dateDisplay: 'Thứ Hai, 28/09/2026',
          morningTasks: '- Chào cờ toàn trường.\n- Dạy học chính khóa các lớp Văn 10, 11, 12.\n- Kiểm tra nề nếp soạn giảng đầu tuần.',
          afternoonTasks: '- Bồi dưỡng đội tuyển HSG môn Ngữ văn 12 (cô Mai phụ trách).',
          dutyLeaderOrEvaluation: 'BGH trực',
          notes: 'Phòng học 12A1'
        },
        {
          id: 'day_van_1',
          dayOfWeek: 'Thứ Ba',
          date: '2026-09-29',
          dateDisplay: 'Thứ Ba, 29/09/2026',
          morningTasks: '- Giảng dạy chính khóa.\n- Dự giờ chuyên đề môn Lịch sử 11 (thầy Nam).',
          afternoonTasks: '- Ôn tập học sinh đội tuyển Lịch sử, Địa lí.',
          dutyLeaderOrEvaluation: 'Tổ phó chuyên môn',
          notes: ''
        },
        {
          id: 'day_van_2',
          dayOfWeek: 'Thứ Tư',
          date: '2026-09-30',
          dateDisplay: 'Thứ Tư, 30/09/2026',
          morningTasks: '- Giảng dạy chính khóa.',
          afternoonTasks: '- Sinh hoạt chuyên môn tổ: Đổi mới phương pháp dạy học Ngữ văn theo chương trình GDPT 2018; Đánh giá năng lực đọc hiểu.',
          dutyLeaderOrEvaluation: 'Tổ trưởng chuyên môn',
          notes: 'Phòng họp tổ 14h'
        },
        {
          id: 'day_van_3',
          dayOfWeek: 'Thứ Năm',
          date: '2026-10-01',
          dateDisplay: 'Thứ Năm, 01/10/2026',
          morningTasks: '- Dạy học theo thời khóa biểu.',
          afternoonTasks: '- Ra đề kiểm tra giữa kỳ 1 môn GDKT&PL và Ngữ văn 10, 11, 12.',
          dutyLeaderOrEvaluation: 'BGH trực',
          notes: ''
        },
        {
          id: 'day_van_4',
          dayOfWeek: 'Thứ Sáu',
          date: '2026-10-02',
          dateDisplay: 'Thứ Sáu, 02/10/2026',
          morningTasks: '- Giảng dạy theo phân công.',
          afternoonTasks: '- Chuẩn bị hoạt động ngoại khóa "Em yêu lịch sử quê hương Sơn Lương".',
          dutyLeaderOrEvaluation: '',
          notes: ''
        },
        {
          id: 'day_van_5',
          dayOfWeek: 'Thứ Bảy',
          date: '2026-10-03',
          dateDisplay: 'Thứ Bảy, 03/10/2026',
          morningTasks: '- Dạy học chính khóa.\n- Họp hội đồng trường.',
          afternoonTasks: 'Nghỉ.',
          dutyLeaderOrEvaluation: 'BGH',
          notes: ''
        },
        {
          id: 'day_van_6',
          dayOfWeek: 'Chủ Nhật',
          date: '2026-10-04',
          dateDisplay: 'Chủ Nhật, 04/10/2026',
          morningTasks: 'Nghỉ theo quy định.',
          afternoonTasks: 'Chuẩn bị kế hoạch dạy học tuần sau.',
          dutyLeaderOrEvaluation: '',
          notes: ''
        }
      ]
    };

    return [sampleToan, sampleVan];
  }
};
