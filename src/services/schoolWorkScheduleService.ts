import { collection, doc, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SchoolWorkSchedule, SchoolWorkDay, SchoolWorkItem } from '../types/schoolWorkSchedule';
import { getWeekInfoByNumber } from '../utils/schoolWeekUtils';

const COLLECTION_NAME = 'schoolWorkSchedules';
const STORAGE_KEY_PREFIX = 'thpt_son_luong_school_work_schedule_';

export const DEFAULT_DEPARTMENTS_CONFIG = [
  { id: 'all', name: 'TOÀN TRƯỜNG', label: 'Toàn trường' },
  { id: 'd_toan_ly_tin_cn', name: 'Tổ Toán - Lý - Tin - Công nghệ', label: 'Tổ Toán - Lý - Tin - CN' },
  { id: 'd_hoa_sinh_gdtc_qpan_nn', name: 'Tổ Hóa - Sinh - GDTC - QPAN - Ngoại ngữ', label: 'Tổ Hóa - Sinh - GDTC - QPAN - NN' },
  { id: 'd_van_su_dia_gdkt_pl_an', name: 'Tổ Văn - Sử - Địa - GDKT&PL - Âm nhạc', label: 'Tổ Văn - Sử - Địa - GDKT&PL - AN' },
  { id: 'd_van_phong', name: 'Tổ Văn phòng', label: 'Tổ Văn phòng' }
];

export function generateEmptySchoolWorkSchedule(
  weekNumber: number,
  academicYear: string = '2026–2027',
  departmentId: string = 'all'
): SchoolWorkSchedule {
  const weekInfo = getWeekInfoByNumber(weekNumber, academicYear);
  const deptObj = DEFAULT_DEPARTMENTS_CONFIG.find(d => d.id === departmentId) || { name: 'TOÀN TRƯỜNG' };
  
  const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const startDate = new Date(weekInfo.startDateIso);

  const days: SchoolWorkDay[] = dayNames.map((dName, idx) => {
    const curDate = new Date(startDate);
    curDate.setDate(startDate.getDate() + idx);
    const dateStr = `${String(curDate.getDate()).padStart(2, '0')}/${String(curDate.getMonth() + 1).padStart(2, '0')}`;
    const isoDate = curDate.toISOString().split('T')[0];

    return {
      id: `day_${weekNumber}_${idx}`,
      day_of_week: dName,
      date: isoDate,
      date_str: dateStr,
      morning_tasks: [],
      afternoon_tasks: [],
      completion_date: dateStr,
      duty_evaluator: ''
    };
  });

  return {
    id: `sws_${academicYear.replace(/[^a-zA-Z0-9]/g, '_')}_w${String(weekNumber).padStart(2, '0')}_${departmentId}`,
    department_id: departmentId,
    department_name: deptObj.name,
    week_number: weekNumber,
    week_start_date: weekInfo.startDateIso,
    week_end_date: weekInfo.endDateIso,
    school_year: academicYear,
    title: `LỊCH CÔNG VIỆC TUẦN ${weekNumber}`,
    days,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function generateSampleSchoolWorkSchedule(
  weekNumber: number = 3,
  academicYear: string = '2026–2027',
  departmentId: string = 'all'
): SchoolWorkSchedule {
  const base = generateEmptySchoolWorkSchedule(weekNumber, academicYear, departmentId);

  // Seed Tuần 3 standard THPT Sơn Lương data
  if (weekNumber === 3) {
    // Thứ 2
    base.days[0].morning_tasks = [
      {
        id: 'm_1',
        timeSlot: 'morning',
        content: 'Tiết 1 (TN-HN): Sinh hoạt tập thể tại nhà vòm (Lớp trực tuần: 12C)',
        assignee: 'BGH, Đoàn trường, GVCN, Lớp 12C',
        status: 'Hoàn thành tốt'
      },
      {
        id: 'm_2',
        timeSlot: 'morning',
        content: 'Tiết 2-5: Dạy và học theo Thời khóa biểu',
        assignee: 'Toàn thể giáo viên',
        status: 'Hoàn thành'
      }
    ];
    base.days[0].afternoon_tasks = [
      {
        id: 'a_1',
        timeSlot: 'afternoon',
        content: '14h00–17h00: Đại hội Chi đoàn Giáo viên năm học 2026-2027 tại phòng Hội đồng',
        assignee: 'BCH Chi đoàn, Toàn thể đoàn viên GV',
        status: 'Hoàn thành tốt'
      }
    ];
    base.days[0].completion_date = '21/09/2026';
    base.days[0].duty_evaluator = 'Nền nếp trang nghiêm; Đại hội Chi đoàn GV tổ chức tốt.';

    // Thứ 3
    base.days[1].morning_tasks = [
      {
        id: 'm_3',
        timeSlot: 'morning',
        content: 'Dạy và học theo TKB. Kiểm tra nền nếp học sinh đầu giờ',
        assignee: 'GV giảng dạy, Đoàn TN',
        status: 'Hoàn thành'
      }
    ];
    base.days[1].afternoon_tasks = [
      {
        id: 'a_2',
        timeSlot: 'afternoon',
        content: '14h00: Bồi dưỡng học sinh giỏi các môn văn hóa khối 10, 11, 12 theo kế hoạch ôn thi tỉnh',
        assignee: 'GV bồi dưỡng HSG các bộ môn',
        status: 'Đang thực hiện'
      }
    ];
    base.days[1].completion_date = '22/09/2026';
    base.days[1].duty_evaluator = 'Bồi dưỡng HSG đúng kế hoạch; học sinh đi học chuyên cần.';

    // Thứ 4
    base.days[2].morning_tasks = [
      {
        id: 'm_4',
        timeSlot: 'morning',
        content: 'Dạy và học theo TKB. Dự giờ thao giảng Tổ Tự nhiên (Toán & Vật lý)',
        assignee: 'Tổ Toán-Lý-Tin-CN, Tổ Hóa-Sinh',
        status: 'Hoàn thành tốt'
      }
    ];
    base.days[2].afternoon_tasks = [
      {
        id: 'a_3',
        timeSlot: 'afternoon',
        content: 'Sinh hoạt chuyên môn tổ KHTN và KHXH theo nghiên cứu bài học',
        assignee: 'Tổ trưởng & GV các tổ CM',
        status: 'Hoàn thành'
      }
    ];
    base.days[2].completion_date = '23/09/2026';
    base.days[2].duty_evaluator = 'Thao giảng đạt chất lượng tốt, áp dụng phương pháp tích cực.';

    // Thứ 5
    base.days[3].morning_tasks = [
      {
        id: 'm_5',
        timeSlot: 'morning',
        content: 'Dạy và học theo TKB. BGH kiểm tra hồ sơ giáo án, kế hoạch bài dạy đầu năm học',
        assignee: 'BGH, TTCM các tổ',
        status: 'Đang thực hiện'
      }
    ];
    base.days[3].afternoon_tasks = [
      {
        id: 'a_4',
        timeSlot: 'afternoon',
        content: 'Kiểm tra cơ sở vật chất phòng máy vi tính, phòng thực hành Lý - Hóa - Sinh',
        assignee: 'Tổ Văn phòng & Cán bộ thiết bị',
        status: 'Hoàn thành'
      }
    ];
    base.days[3].completion_date = '24/09/2026';
    base.days[3].duty_evaluator = 'Đã kiểm tra 100% hồ sơ giáo án, giáo viên thực hiện nghiêm túc.';

    // Thứ 6
    base.days[4].morning_tasks = [
      {
        id: 'm_6',
        timeSlot: 'morning',
        content: 'Dạy và học theo TKB',
        assignee: 'Toàn thể giáo viên',
        status: 'Hoàn thành'
      }
    ];
    base.days[4].afternoon_tasks = [
      {
        id: 'a_5',
        timeSlot: 'afternoon',
        content: '14h00: Họp Hội đồng sư phạm tháng 9 năm học 2026-2027',
        assignee: 'Toàn thể CBGVNV nhà trường',
        status: 'Chưa thực hiện'
      }
    ];
    base.days[4].completion_date = '25/09/2026';
    base.days[4].duty_evaluator = 'Triển khai đầy đủ các nhiệm vụ trọng tâm tháng 10.';

    // Thứ 7
    base.days[5].morning_tasks = [
      {
        id: 'm_7',
        timeSlot: 'morning',
        content: 'Lao động vệ sinh khuôn viên trường, các phòng học bộ môn (12C trực)',
        assignee: 'Đoàn trường, GVCN 12C, Tổ Văn phòng',
        status: 'Chưa thực hiện'
      }
    ];
    base.days[5].afternoon_tasks = [
      {
        id: 'a_6',
        timeSlot: 'afternoon',
        content: 'Trực ban chuyên môn và rà soát tiến độ giảng dạy tuần 3',
        assignee: 'BGH, TTCM',
        status: 'Chưa thực hiện'
      }
    ];
    base.days[5].completion_date = '26/09/2026';
    base.days[5].duty_evaluator = 'Khuôn viên trường sạch sẽ, trực ban đúng quy định.';

    // Chủ nhật
    base.days[6].morning_tasks = [
      {
        id: 'm_8',
        timeSlot: 'morning',
        content: 'Nghỉ. Trực cơ quan, an ninh trật tự và phòng chống cháy nổ',
        assignee: 'Tổ Bảo vệ, Lãnh đạo trực ban',
        status: 'Chưa thực hiện'
      }
    ];
    base.days[6].afternoon_tasks = [];
    base.days[6].completion_date = '27/09/2026';
    base.days[6].duty_evaluator = 'An ninh trật tự đảm bảo tuyệt đối, ghi chép nhật ký trực đầy đủ.';
  } else if (weekNumber === 8) {
    // Thứ 2 (26/10)
    base.days[0].morning_tasks = [
      {
        id: 'task_w8_m_1',
        timeSlot: 'morning',
        content: '- CBGVN nhân viên thực hiện nghiêm túc nền nếp, nội quy nhà trường, quy chế chuyên môn, văn hóa công sở.\n- Đoàn trường chỉ đạo đội cờ đỏ, TNXK kiểm tra nền nếp học sinh và cập nhật hàng ngày lên phần mềm để GVCN năm bắt, giáo dục',
        deadlineDate: '26/10',
        completionDate: '26/10',
        status: 'Chưa thực hiện'
      }
    ];
    base.days[0].completion_date = '26/10';
  }

  return base;
}

export const schoolWorkScheduleService = {
  async getSchedule(
    weekNumber: number,
    academicYear: string = '2026–2027',
    departmentId: string = 'all'
  ): Promise<SchoolWorkSchedule> {
    const docId = `sws_${academicYear.replace(/[^a-zA-Z0-9]/g, '_')}_w${String(weekNumber).padStart(2, '0')}_${departmentId}`;
    
    // 1. Read cached schedule from localStorage first
    let cachedSchedule: SchoolWorkSchedule | null = null;
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(STORAGE_KEY_PREFIX + docId);
      if (cached) {
        try {
          cachedSchedule = JSON.parse(cached);
        } catch (e) {
          console.error('Error parsing cached schedule:', e);
        }
      }
    }

    // 2. Try Firestore with a 1500ms timeout guard
    let firestoreSchedule: SchoolWorkSchedule | null = null;
    try {
      const docRef = doc(db, COLLECTION_NAME, docId);
      const fetchPromise = getDoc(docRef);
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore read timeout')), 1500)
      );
      const snapshot: any = await Promise.race([fetchPromise, timeoutPromise]);
      if (snapshot && typeof snapshot.exists === 'function' && snapshot.exists()) {
        firestoreSchedule = snapshot.data() as SchoolWorkSchedule;
      }
    } catch (e) {
      console.warn('Firestore getSchedule warning / timeout, fallback to cache:', e);
    }

    // 3. Smart resolution between Cache and Firestore:
    // If we have both, compare timestamps and non-empty tasks so user edits are NEVER wiped out by stale/empty Firestore docs
    if (cachedSchedule && firestoreSchedule) {
      const cachedTime = new Date(cachedSchedule.updated_at || 0).getTime();
      const firestoreTime = new Date(firestoreSchedule.updated_at || 0).getTime();
      const cachedTasks = cachedSchedule.days?.reduce((acc, d) => acc + (d.morning_tasks?.length || 0) + (d.afternoon_tasks?.length || 0), 0) || 0;
      const firestoreTasks = firestoreSchedule.days?.reduce((acc, d) => acc + (d.morning_tasks?.length || 0) + (d.afternoon_tasks?.length || 0), 0) || 0;

      if (cachedTime > firestoreTime || (cachedTasks > 0 && firestoreTasks === 0)) {
        return cachedSchedule;
      }

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_PREFIX + docId, JSON.stringify(firestoreSchedule));
        } catch (err) {
          console.warn('localStorage setItem error:', err);
        }
      }
      return firestoreSchedule;
    }

    if (cachedSchedule) {
      return cachedSchedule;
    }

    if (firestoreSchedule) {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_PREFIX + docId, JSON.stringify(firestoreSchedule));
        } catch (err) {
          console.warn('localStorage setItem error:', err);
        }
      }
      return firestoreSchedule;
    }

    // 4. Fallback: generate sample if week 3 or 8 or empty
    const sample = (weekNumber === 3 || weekNumber === 8)
      ? generateSampleSchoolWorkSchedule(weekNumber, academicYear, departmentId)
      : generateEmptySchoolWorkSchedule(weekNumber, academicYear, departmentId);

    // Auto save asynchronously
    this.saveSchedule(sample).catch(() => {});
    return sample;
  },

  async saveSchedule(schedule: SchoolWorkSchedule): Promise<void> {
    const docId = schedule.id || `sws_${(schedule.school_year || '2026_2027').replace(/[^a-zA-Z0-9]/g, '_')}_w${String(schedule.week_number).padStart(2, '0')}_${schedule.department_id || 'all'}`;
    schedule.id = docId;
    schedule.updated_at = new Date().toISOString();

    // 1. Save to localStorage immediately and synchronously
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + docId, JSON.stringify(schedule));
      } catch (err) {
        console.warn('localStorage setItem quota or error:', err);
      }
    }

    // 2. Save to Firestore with timeout guard (2000ms max) to prevent freezing when quota is exceeded
    try {
      const cleanData = JSON.parse(JSON.stringify(schedule));
      const docRef = doc(db, COLLECTION_NAME, docId);
      const firestorePromise = setDoc(docRef, cleanData);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore save timeout')), 2000)
      );
      await Promise.race([firestorePromise, timeoutPromise]);
    } catch (e) {
      console.warn('Firestore saveSchedule error / quota / timeout, saved in local cache:', e);
    }
  },

  async deleteTaskItem(
    schedule: SchoolWorkSchedule,
    dayId: string,
    timeSlot: 'morning' | 'afternoon',
    itemId: string,
    taskContent?: string
  ): Promise<SchoolWorkSchedule> {
    const newDays = schedule.days.map(d => {
      if (d.id !== dayId) return d;
      const tasks = timeSlot === 'morning' ? d.morning_tasks : d.afternoon_tasks;
      const filtered = tasks.filter(t => {
        if (itemId && t.id) {
          return t.id !== itemId;
        }
        if (taskContent) {
          return t.content !== taskContent;
        }
        return false;
      });

      return {
        ...d,
        [timeSlot === 'morning' ? 'morning_tasks' : 'afternoon_tasks']: filtered
      };
    });

    const updated: SchoolWorkSchedule = {
      ...schedule,
      days: newDays,
      updated_at: new Date().toISOString()
    };

    await this.saveSchedule(updated);
    return updated;
  },

  async updateTaskItem(
    schedule: SchoolWorkSchedule,
    dayId: string,
    timeSlot: 'morning' | 'afternoon',
    taskItem: SchoolWorkItem
  ): Promise<SchoolWorkSchedule> {
    const newDays = schedule.days.map(day => {
      if (day.id !== dayId) return day;

      const tasks = timeSlot === 'morning' ? [...day.morning_tasks] : [...day.afternoon_tasks];
      const existingIdx = tasks.findIndex(t => t.id === taskItem.id);

      if (existingIdx >= 0) {
        tasks[existingIdx] = { ...tasks[existingIdx], ...taskItem };
      } else {
        tasks.push(taskItem);
      }

      return {
        ...day,
        [timeSlot === 'morning' ? 'morning_tasks' : 'afternoon_tasks']: tasks,
        ...(taskItem.completionDate ? { completion_date: taskItem.completionDate } : {}),
        ...(taskItem.leaderInCharge && !day.duty_evaluator ? { duty_evaluator: taskItem.leaderInCharge } : {})
      };
    });

    const updated: SchoolWorkSchedule = {
      ...schedule,
      days: newDays,
      updated_at: new Date().toISOString()
    };

    await this.saveSchedule(updated);
    return updated;
  },

  async getAllSchedules(): Promise<SchoolWorkSchedule[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTION_NAME));
      if (!snap.empty) {
        return snap.docs.map(d => d.data() as SchoolWorkSchedule);
      }
    } catch (e) {
      console.warn('Could not list all from Firestore:', e);
    }
    return [];
  }
};
