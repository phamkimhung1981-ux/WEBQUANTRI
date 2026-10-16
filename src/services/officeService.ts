import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  OfficeTask, 
  OfficeDocument, 
  OfficeJobStandard, 
  OfficeStaffMember 
} from '../types/officeDepartment';
import { getLocalCollectionCache, setLocalCollectionCache } from '../store/AppContext';

const CACHE_KEYS = {
  TASKS: 'office_tasks',
  DOCUMENTS: 'office_documents',
  STANDARDS: 'office_standards'
};

const sanitize = <T extends Record<string, any>>(data: T): T => {
  const result = { ...data };
  for (const key in result) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result;
};

// Initial Sample Office Tasks for THPT Sơn Lương
export const DEFAULT_OFFICE_TASKS: OfficeTask[] = [
  {
    id: 'ot_1',
    title: 'Lập Báo cáo quyết toán Ngân sách & Thu chi Quý 3/2026',
    category: 'Tài chính - Kế toán',
    assigneeId: 't4',
    assigneeName: 'Phạm Thị Dung',
    assigneePosition: 'Kế toán trưởng',
    startDate: '2026-09-01',
    dueDate: '2026-10-25',
    priority: 'Khẩn cấp',
    status: 'Đang thực hiện',
    progressPercent: 85,
    notes: 'Rà soát chứng từ chi hoạt động chuyên môn và lương cán bộ giáo viên',
    evidenceRequirement: 'Bảng cân đối tài khoản + File Excel quyết toán kho Bạc'
  },
  {
    id: 'ot_2',
    title: 'Tổ chức tiêm chủng & Khám sức khỏe định kỳ học sinh Khối 10',
    category: 'Y tế - BHYT Học sinh',
    assigneeId: 'ot_staff_yt',
    assigneeName: 'Nguyễn Thị Thu Hà',
    assigneePosition: 'Nhân viên Y tế học đường',
    startDate: '2026-09-15',
    dueDate: '2026-10-20',
    priority: 'Cao',
    status: 'Đang thực hiện',
    progressPercent: 70,
    notes: 'Phối hợp với Trạm Y tế Xã Sơn Lương và GVCN các lớp Khối 10',
    evidenceRequirement: 'Sổ theo dõi sức khỏe học sinh năm học 2026-2027'
  },
  {
    id: 'ot_3',
    title: 'Tiếp nhận, vào sổ Công văn đến & Phân loại văn bản chỉ đạo Sở GD&ĐT',
    category: 'Văn thư - Lưu trữ',
    assigneeId: 'ot_staff_vt',
    assigneeName: 'Trần Văn Hải',
    assigneePosition: 'Văn thư - Thủ quỹ',
    startDate: '2026-10-01',
    dueDate: '2026-10-30',
    priority: 'Bình thường',
    status: 'Đã hoàn thành',
    progressPercent: 100,
    notes: 'Đã vào sổ 42 công văn đến tháng 10 và chuyển BGH phê duyệt đúng quy trình',
    evidenceRequirement: 'Sổ công văn đến số 02/2026'
  },
  {
    id: 'ot_4',
    title: 'Kiểm kê ấn phẩm, sách giáo khoa Thư viện & Thiết bị dạy học đầu năm',
    category: 'Thư viện',
    assigneeId: 'ot_staff_tv',
    assigneeName: 'Lê Thị Mai',
    assigneePosition: 'Thư viện',
    startDate: '2026-09-05',
    dueDate: '2026-10-15',
    priority: 'Bình thường',
    status: 'Đã hoàn thành',
    progressPercent: 100,
    notes: 'Cấp phát 100% SGK và thiết bị dùng chung cho các Tổ chuyên môn',
    evidenceRequirement: 'Biên bản kiểm kê kho sách & danh mục thiết bị năm 2026'
  },
  {
    id: 'ot_5',
    title: 'Bảo trì hệ thống Mạng LAN, Server điểm danh & Máy tính phòng Lab',
    category: 'CNTT - Thiết bị số',
    assigneeId: 'ot_staff_it',
    assigneeName: 'Hoàng Quốc Việt',
    assigneePosition: 'Quản trị CNTT',
    startDate: '2026-10-05',
    dueDate: '2026-10-28',
    priority: 'Cao',
    status: 'Đang thực hiện',
    progressPercent: 60,
    notes: 'Kiểm tra đường truyền internet Viettel và thay dây cáp hỏng ở phòng tin học 2',
    evidenceRequirement: 'Nhật ký bảo trì thiết bị công nghệ thông tin'
  },
  {
    id: 'ot_6',
    title: 'Kiểm tra an toàn PCCC, Bảo vệ cổng trường & Trực ca đêm',
    category: 'Cơ sở vật chất - An ninh',
    assigneeId: 'ot_staff_bv',
    assigneeName: 'Bùi Văn Hùng',
    assigneePosition: 'Bảo vệ chuyên trách',
    startDate: '2026-10-01',
    dueDate: '2026-10-31',
    priority: 'Bình thường',
    status: 'Đang thực hiện',
    progressPercent: 50,
    notes: 'Đảm bảo an ninh trật tự khu vực trường học 24/7 và kiểm tra bình chữa cháy',
    evidenceRequirement: 'Sổ trực gác & theo dõi xe khách ra vào'
  }
];

// Initial Office Documents
export const DEFAULT_OFFICE_DOCUMENTS: OfficeDocument[] = [
  {
    id: 'doc_1',
    dispatchCode: '1428/SGDDT-VP',
    type: 'Công văn đến',
    title: 'V/v Hướng dẫn thực hiện nhiệm vụ Công tác Văn thư, Lưu trữ & Chuyển đổi số năm học 2026-2027',
    issuingAgency: 'Sở GD&ĐT Yên Bái',
    receiptDate: '2026-09-12',
    category: 'Văn thư - Lưu trữ',
    handlerName: 'Trần Văn Hải',
    status: 'Đã hoàn thành',
    summary: 'Phổ biến quy trình ký số văn bản và lưu trữ hồ sơ điện tử'
  },
  {
    id: 'doc_2',
    dispatchCode: '85/TB-THPTSL',
    type: 'Thông báo nội bộ',
    title: 'Thông báo Lịch nộp BHYT Học sinh & Thu tiền học phí Học kỳ 1 năm học 2026-2027',
    issuingAgency: 'Trường THPT Sơn Lương',
    receiptDate: '2026-09-20',
    category: 'Tài chính - Kế toán',
    handlerName: 'Phạm Thị Dung',
    status: 'Đang xử lý',
    summary: 'Thu BHYT bắt buộc học sinh 12 tháng theo quy định mới'
  },
  {
    id: 'doc_3',
    dispatchCode: '42/QĐ-THPTSL',
    type: 'Quyết định',
    title: 'Quyết định Phân công nhiệm vụ Cán bộ, Nhân viên Tổ Văn phòng năm học 2026-2027',
    issuingAgency: 'Trường THPT Sơn Lương',
    receiptDate: '2026-09-05',
    category: 'Tài chính - Kế toán',
    handlerName: 'Phạm Thị Dung',
    status: 'Đã lưu trữ',
    summary: 'Quy định chức danh Kế toán, Văn thư, Y tế, Thư viện, CNTT, Bảo vệ'
  }
];

// Initial Job Standards for Office Staff
export const DEFAULT_OFFICE_STANDARDS: OfficeJobStandard[] = [
  {
    id: 'std_kt',
    position: 'Kế toán trưởng / Kế toán viên',
    title: 'Quản lý Tài chính, Dự toán & Quyết toán Ngân sách',
    responsibilities: [
      'Lập dự toán thu chi ngân sách nhà nước và quỹ học phí',
      'Thực hiện thanh toán tiền lương, phụ cấp, BHXH cho CBGVNV',
      'Lập báo cáo tài chính hàng quý và quyết toán năm với Kho bạc',
      'Quản lý tài sản công, tài chính công đoàn và kiểm kê hàng năm'
    ],
    qualifications: 'Đại học chuyên ngành Kế toán / Tài chính, có chứng chỉ Kế toán trưởng',
    assignedStaffCount: 2
  },
  {
    id: 'std_vt',
    position: 'Văn thư - Lưu trữ & Thủ quỹ',
    title: 'Quản lý Công văn, Tiếp nhận Văn bản & Quản lý Quỹ tiền mặt',
    responsibilities: [
      'Tiếp nhận, đăng ký, chuyển giao công văn đi - đến đúng thẩm quyền',
      'Quản lý con dấu nhà trường, thực hiện đóng dấu và lưu trữ hồ sơ',
      'Quản lý quỹ tiền mặt, thực hiện thu chi theo phiếu chi kế toán',
      'Báo cáo số dư quỹ tiền mặt định kỳ cho BGH'
    ],
    qualifications: 'Cử nhân / Trung cấp Văn thư - Lưu trữ, nghiệp vụ Thủ quỹ',
    assignedStaffCount: 1
  },
  {
    id: 'std_yt',
    position: 'Nhân viên Y tế học đường',
    title: 'Chăm sóc Sức khỏe Học sinh & Vệ sinh An toàn Thực phẩm',
    responsibilities: [
      'Sơ cứu, cấp phát thuốc ban đầu cho học sinh và cán bộ giáo viên',
      'Quản lý hồ sơ sức khỏe học sinh và phối hợp tổ chức khám định kỳ',
      'Theo dõi BHYT học sinh, tuyên truyền phòng chống dịch bệnh',
      'Kiểm tra công tác vệ sinh trường học, nguồn nước và nhà ăn'
    ],
    qualifications: 'Y sĩ / Cử nhân Y tế công cộng / Điều dưỡng',
    assignedStaffCount: 1
  },
  {
    id: 'std_tv',
    position: 'Thư viện',
    title: 'Quản lý Thư viện, Kho sách & Văn hóa đọc',
    responsibilities: [
      'Quản lý kho sách giáo khoa, sách tham khảo, báo chí và tài liệu học tập',
      'Thực hiện thủ tục cho mượn - trả sách, cấp thẻ thư viện cho học sinh và GV',
      'Thống kê lượt mượn trả sách, giới thiệu sách mới định kỳ',
      'Thực hiện kiểm kê, phân loại và đề xuất bổ sung sách hằng năm'
    ],
    qualifications: 'Cử nhân / Trung cấp Thư viện - Thông tin',
    assignedStaffCount: 1
  },
  {
    id: 'std_tb',
    position: 'Thiết bị',
    title: 'Quản lý Thiết bị Giáo dục, Phòng học bộ môn & Phòng thí nghiệm',
    responsibilities: [
      'Quản lý, bảo quản trang thiết bị dạy học, hóa chất và đồ dùng thí nghiệm',
      'Cấp phát thiết bị dạy học cho giáo viên theo lịch giảng dạy',
      'Chuẩn bị phòng thí nghiệm, phòng thực hành theo lịch chuyên môn',
      'Thực hiện kiểm kê, bảo dưỡng và đề xuất mua sắm bổ sung thiết bị'
    ],
    qualifications: 'Cử nhân / Cao đẳng Thiết bị trường học / Sư phạm Kỹ thuật',
    assignedStaffCount: 1
  },
  {
    id: 'std_it',
    position: 'Quản trị CNTT & Kỹ thuật mạng',
    title: 'Quản trị Hệ thống Máy tính, Website & Phần mềm Quản lý',
    responsibilities: [
      'Bảo trì phòng máy vi tính tin học và hạ tầng mạng LAN/Wifi',
      'Quản trị website nhà trường, phần mềm CSDL Ngành và VNEDU',
      'Hỗ trợ kỹ thuật CNTT cho các hội nghị, hội thảo và giảng dạy',
      'Đảm bảo an toàn thông tin và sao lưu dữ liệu quản lý'
    ],
    qualifications: 'Cử nhân Công nghệ thông tin / Mạng máy tính',
    assignedStaffCount: 1
  },
  {
    id: 'std_bv',
    position: 'Bảo vệ & Phục vụ hành chính',
    title: 'Đảm bảo An ninh trật tự, Cơ sở vật chất & Trực ban 24/7',
    responsibilities: [
      'Trực bảo vệ cổng trường, hướng dẫn khách liên hệ công tác',
      'Kiểm tra niêm phong phòng học, hệ thống điện nước cuối ngày',
      'Phối hợp giữ gìn an ninh trật tự khu vực trường học',
      'Thực hiện các công việc phục vụ hậu cần theo phân công'
    ],
    qualifications: 'Bộ đội xuất ngũ / Có chứng chỉ nghiệp vụ Bảo vệ',
    assignedStaffCount: 2
  }
];

export const officeService = {
  // Subscriptions & Data Retrieval
  subscribeOfficeTasks(callback: (tasks: OfficeTask[]) => void) {
    const q = collection(db, 'office_tasks');
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OfficeTask[];
        setLocalCollectionCache(CACHE_KEYS.TASKS, loaded);
        callback(loaded);
      } else {
        const cached = getLocalCollectionCache<OfficeTask[]>(CACHE_KEYS.TASKS, DEFAULT_OFFICE_TASKS);
        callback(cached);
      }
    }, (err) => {
      console.warn('Error fetching office_tasks from Firestore:', err);
      const cached = getLocalCollectionCache<OfficeTask[]>(CACHE_KEYS.TASKS, DEFAULT_OFFICE_TASKS);
      callback(cached);
    });
    return unsub;
  },

  subscribeOfficeDocuments(callback: (docs: OfficeDocument[]) => void) {
    const q = collection(db, 'office_documents');
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OfficeDocument[];
        setLocalCollectionCache(CACHE_KEYS.DOCUMENTS, loaded);
        callback(loaded);
      } else {
        const cached = getLocalCollectionCache<OfficeDocument[]>(CACHE_KEYS.DOCUMENTS, DEFAULT_OFFICE_DOCUMENTS);
        callback(cached);
      }
    }, (err) => {
      console.warn('Error fetching office_documents from Firestore:', err);
      const cached = getLocalCollectionCache<OfficeDocument[]>(CACHE_KEYS.DOCUMENTS, DEFAULT_OFFICE_DOCUMENTS);
      callback(cached);
    });
    return unsub;
  },

  // Save / Update Task
  async saveOfficeTask(task: Partial<OfficeTask>): Promise<{ success: boolean; data: OfficeTask }> {
    const id = task.id || `ot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const updatedAt = new Date().toISOString();
    const payload: OfficeTask = {
      id,
      title: task.title || 'Nhiệm vụ Tổ Văn phòng',
      category: task.category || 'Tài chính - Kế toán',
      assigneeId: task.assigneeId || 'unknown',
      assigneeName: task.assigneeName || 'Nhân viên Tổ Văn phòng',
      assigneePosition: task.assigneePosition || 'Cán bộ Hành chính',
      startDate: task.startDate || new Date().toISOString().split('T')[0],
      dueDate: task.dueDate || new Date().toISOString().split('T')[0],
      priority: task.priority || 'Bình thường',
      status: task.status || 'Chờ thực hiện',
      progressPercent: task.progressPercent !== undefined ? task.progressPercent : 0,
      notes: task.notes || '',
      evidenceRequirement: task.evidenceRequirement || '',
      evidenceUrl: task.evidenceUrl || '',
      updatedAt
    };

    // 1. Local Cache Update
    const currentTasks = getLocalCollectionCache<OfficeTask[]>(CACHE_KEYS.TASKS, DEFAULT_OFFICE_TASKS);
    const existingIdx = currentTasks.findIndex(t => t.id === id);
    let updatedTasksList: OfficeTask[] = [];
    if (existingIdx >= 0) {
      currentTasks[existingIdx] = payload;
      updatedTasksList = [...currentTasks];
    } else {
      updatedTasksList = [payload, ...currentTasks];
    }
    setLocalCollectionCache(CACHE_KEYS.TASKS, updatedTasksList);

    // 2. Firestore Sync
    try {
      await setDoc(doc(db, 'office_tasks', id), sanitize(payload), { merge: true });
    } catch (e) {
      console.warn('Could not write office task to Firestore:', e);
    }

    return { success: true, data: payload };
  },

  // Delete Task
  async deleteOfficeTask(id: string): Promise<boolean> {
    const currentTasks = getLocalCollectionCache<OfficeTask[]>(CACHE_KEYS.TASKS, DEFAULT_OFFICE_TASKS);
    const updated = currentTasks.filter(t => t.id !== id);
    setLocalCollectionCache(CACHE_KEYS.TASKS, updated);

    try {
      await deleteDoc(doc(db, 'office_tasks', id));
    } catch (e) {
      console.warn('Could not delete office task from Firestore:', e);
    }
    return true;
  },

  // Save Document
  async saveOfficeDocument(docData: Partial<OfficeDocument>): Promise<{ success: boolean; data: OfficeDocument }> {
    const id = docData.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload: OfficeDocument = {
      id,
      dispatchCode: docData.dispatchCode || `CV-${Date.now().toString().slice(-4)}`,
      type: docData.type || 'Công văn đến',
      title: docData.title || 'Văn bản hành chính Tổ Văn phòng',
      issuingAgency: docData.issuingAgency || 'Trường THPT Sơn Lương',
      receiptDate: docData.receiptDate || new Date().toISOString().split('T')[0],
      category: docData.category || 'Văn thư - Lưu trữ',
      handlerName: docData.handlerName || 'Nhân viên Văn thư',
      status: docData.status || 'Chờ xử lý',
      fileUrl: docData.fileUrl || '',
      summary: docData.summary || '',
      notes: docData.notes || ''
    };

    const currentDocs = getLocalCollectionCache<OfficeDocument[]>(CACHE_KEYS.DOCUMENTS, DEFAULT_OFFICE_DOCUMENTS);
    const idx = currentDocs.findIndex(d => d.id === id);
    let updatedDocs: OfficeDocument[] = [];
    if (idx >= 0) {
      currentDocs[idx] = payload;
      updatedDocs = [...currentDocs];
    } else {
      updatedDocs = [payload, ...currentDocs];
    }
    setLocalCollectionCache(CACHE_KEYS.DOCUMENTS, updatedDocs);

    try {
      await setDoc(doc(db, 'office_documents', id), sanitize(payload), { merge: true });
    } catch (e) {
      console.warn('Could not write office document to Firestore:', e);
    }

    return { success: true, data: payload };
  },

  // Delete Document
  async deleteOfficeDocument(id: string): Promise<boolean> {
    const currentDocs = getLocalCollectionCache<OfficeDocument[]>(CACHE_KEYS.DOCUMENTS, DEFAULT_OFFICE_DOCUMENTS);
    const updated = currentDocs.filter(d => d.id !== id);
    setLocalCollectionCache(CACHE_KEYS.DOCUMENTS, updated);

    try {
      await deleteDoc(doc(db, 'office_documents', id));
    } catch (e) {
      console.warn('Could not delete office document from Firestore:', e);
    }
    return true;
  }
};
