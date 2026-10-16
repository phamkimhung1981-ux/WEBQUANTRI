export type OfficePosition = 
  | 'Kế toán trưởng'
  | 'Kế toán viên'
  | 'Văn thư - Lưu trữ'
  | 'Thủ quỹ'
  | 'Nhân viên Y tế học đường'
  | 'Thư viện'
  | 'Thiết bị'
  | 'Quản trị CNTT'
  | 'Bảo vệ chuyên trách'
  | 'Tạp vụ - Phục vụ'
  | 'Cán bộ Hành chính'
  | 'Nhân viên hành chính'
  | 'Thư viện - Thiết bị';

export interface OfficeStaffMember {
  id: string;
  teacherId?: string;
  code: string;
  name: string;
  position: OfficePosition | string;
  specificTasks: string;
  phone: string;
  email: string;
  status: 'Đang công tác' | 'Nghỉ phép' | 'Tạm nghỉ';
  joinDate?: string;
  avatar?: string;
  degree?: string;
}

export type OfficeTaskCategory = 
  | 'Tài chính - Kế toán'
  | 'Văn thư - Lưu trữ'
  | 'Y tế - BHYT Học sinh'
  | 'Thư viện'
  | 'Thiết bị'
  | 'CNTT - Thiết bị số'
  | 'Cơ sở vật chất - An ninh'
  | 'Thư viện - Thiết bị';

export type OfficeTaskPriority = 'Khẩn cấp' | 'Cao' | 'Bình thường' | 'Thấp';
export type OfficeTaskStatus = 'Chờ thực hiện' | 'Đang thực hiện' | 'Đã hoàn thành' | 'Chậm tiến độ';

export interface OfficeTask {
  id: string;
  title: string;
  category: OfficeTaskCategory | string;
  assigneeId: string;
  assigneeName: string;
  assigneePosition?: string;
  startDate: string;
  dueDate: string;
  priority: OfficeTaskPriority;
  status: OfficeTaskStatus;
  progressPercent: number;
  notes?: string;
  evidenceRequirement?: string;
  evidenceUrl?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface OfficeDocument {
  id: string;
  dispatchCode: string;
  type: 'Công văn đến' | 'Công văn đi' | 'Quyết định' | 'Tờ trình' | 'Thông báo nội bộ';
  title: string;
  issuingAgency: string;
  receiptDate: string;
  category: OfficeTaskCategory | string;
  handlerName: string;
  status: 'Chờ xử lý' | 'Đang xử lý' | 'Đã hoàn thành' | 'Đã lưu trữ';
  fileUrl?: string;
  summary?: string;
  notes?: string;
}

export interface OfficeJobStandard {
  id: string;
  position: OfficePosition | string;
  title: string;
  responsibilities: string[];
  qualifications: string;
  assignedStaffCount: number;
}
