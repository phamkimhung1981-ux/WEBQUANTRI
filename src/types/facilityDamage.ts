export type FacilityGroup = 
  | 'điều hòa'
  | 'bàn ghế học sinh' 
  | 'bàn ghế giáo viên' 
  | 'bảng lớp học' 
  | 'đèn chiếu sáng' 
  | 'quạt điện' 
  | 'cửa ra vào, cửa sổ' 
  | 'hệ thống điện' 
  | 'hệ thống nước' 
  | 'máy chiếu' 
  | 'máy tính' 
  | 'thiết bị dạy học' 
  | 'thiết bị vệ sinh' 
  | 'khác';

export type DamageSeverity = 'nhẹ' | 'trung bình' | 'nghiêm trọng' | 'khẩn cấp';

export type AcFailureStatus = 'không hoạt động' | 'không làm mát' | 'chảy nước' | 'phát tiếng ồn' | 'rò điện' | 'khác';

export type DamageReportStatus = 
  | 'Nháp' 
  | 'Đã gửi báo hỏng' 
  | 'Đã tiếp nhận' 
  | 'Đang xử lý' 
  | 'Chờ vật tư hoặc chờ sửa chữa' 
  | 'Đã khắc phục' 
  | 'GVCN xác nhận hoàn thành' 
  | 'Đóng phiếu'
  | 'Yêu cầu bổ sung'
  | 'Từ chối';

export interface FacilityDamageAttachment {
  id: string;
  url: string;
  name: string;
  type: 'before' | 'after' | 'general';
  uploadedAt: string;
  uploadedBy: string;
}

export interface FacilityDamageHistoryItem {
  id: string;
  status: DamageReportStatus;
  updatedBy: string;
  updatedByName: string;
  timestamp: string;
  content: string;
  note?: string;
}

export interface FacilityDamageAssignment {
  assignedToId?: string;
  assignedToName?: string;
  assignedRole?: string;
  assignedAt?: string;
  deadline?: string;
  estimatedCost?: number;
  actualCost?: number;
  replacementParts?: string;
  repairNotes?: string;
}

export interface FacilityDamageReport {
  id: string;
  ticketCode: string; // Mã phiếu tự động sinh
  reportedAt: string; // Ngày giờ báo hỏng (Asia/Ho_Chi_Minh formatted string or ISO)
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  classroom: string; // Phòng học (vd: Phòng 101 - Lớp 10A1)
  facilityGroup: FacilityGroup;
  assetName: string;
  assetCode?: string; // Mã thiết bị (đặc biệt cho điều hòa)
  quantity: number;
  acStatus?: AcFailureStatus; // Tình trạng hỏng riêng cho điều hòa
  description: string;
  cause?: string;
  severity: DamageSeverity;
  detectionTime: string;
  attachments: FacilityDamageAttachment[];
  proposedSolution?: string;
  notes?: string;
  status: DamageReportStatus;
  isUrgentSafetyRisk?: boolean; // Nguy cơ mất an toàn điện, cháy nổ, kính vỡ
  assignment?: FacilityDamageAssignment;
  history: FacilityDamageHistoryItem[];
  academicYear: string;
  month: string; // "01".."12"
  createdAt: string;
  updatedAt: string;
}
