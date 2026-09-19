export interface ClassInfo {
  id: string;
  name: string; // e.g. 10A1, 10A2, 11A1, 12A1
  grade: number; // 10, 11, 12
  schoolYear: string; // e.g. 2026–2027
  homeroomTeacherId?: string;
  homeroomTeacherName?: string;
  room?: string;
  totalStudents: number;
  status?: 'active' | 'inactive';
}

export interface Student {
  id: string;
  classId: string;
  className: string;
  code: string;
  name: string;
  gender: 'Nam' | 'Nữ';
  dob: string;
  parentPhone?: string;
  parentName?: string;
  address?: string;
  avatar?: string;
}

export interface HomeroomAssignment {
  id: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  schoolYear: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'inactive';
}

export interface ConductCategory {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  status: 'active' | 'inactive';
}

export type PointType = 'minus' | 'plus';

export interface ConductCriterion {
  id: string;
  categoryId: string;
  categoryName: string;
  code: string;
  name: string;
  description?: string;
  pointType: PointType;
  defaultPoint: number;
  severity?: 'Nhẹ' | 'Vừa' | 'Nghiêm trọng' | 'Rất nghiêm trọng';
  status: 'active' | 'inactive';
  sortOrder: number;
}

export interface ConductRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  schoolYear: string;
  weekNumber: number; // 1..36
  monthNumber: number; // 1..12 or 9..12, 1..5
  criterionId: string;
  criterionName: string;
  categoryId: string;
  categoryName: string;
  pointType: PointType;
  point: number; // e.g. -2, +5
  level?: 'Nhẹ' | 'Vừa' | 'Nghiêm trọng' | 'Rất nghiêm trọng';
  note?: string;
  evidenceUrl?: string;
  recordedBy: string;
  recordedByName: string;
  recordDate: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt?: string;
}

export type ClassificationType = 'Tốt' | 'Khá' | 'Đạt' | 'Chưa đạt';

export type ConfirmationStatus = 'Chờ GVCN đánh giá' | 'Đã GVCN đánh giá' | 'Chờ BGH xác nhận' | 'Đã xác nhận' | 'Yêu cầu điều chỉnh';

export interface ConductEvaluation {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  schoolYear: string;
  period: string; // e.g. "Tháng 09", "Tháng 10", "Học kỳ I", "Học kỳ II", "Cả năm"
  totalPlus: number;
  totalMinus: number;
  totalScore: number;
  classification: ClassificationType;
  teacherComment?: string;
  teacherId: string;
  teacherName: string;
  principalComment?: string;
  confirmationStatus: ConfirmationStatus;
  confirmedBy?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ConductSettings {
  id: string;
  schoolYear: string;
  baseScore: number; // Default 100
  thresholds: {
    totMin: number; // Default 90
    khaMin: number; // Default 70
    datMin: number; // Default 50
  };
}
