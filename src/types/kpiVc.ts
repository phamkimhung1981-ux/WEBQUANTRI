// Types for Module "ĐÁNH GIÁ KPI GIÁO VIÊN – NHÂN VIÊN TRƯỜNG THPT SƠN LƯƠNG"
// Căn cứ file: "Mẫu VC giáo viên, nhân viên tự chấm điểm.pdf"

export type KpiVcScoreType = 'input_score' | 'select_level' | 'fixed_score';

export interface KpiVcLevel {
  id: string;
  code: string; // e.g. '2.1', '2.2', '2.3', '2.4', '2.5'
  name: string; // e.g. 'MỨC 1', 'MỨC 2', ...
  score: number; // 60, 50, 30, 20, 10
  description: string; // Hoàn thành 100% công việc theo kế hoạch...
  order: number;
}

export interface KpiVcCriterion {
  id: string;
  code: string; // e.g. 'I.1', 'I.2', 'II.1', 'III.1', 'III.2'
  groupId: string; // 'group_I', 'group_II', 'group_III'
  groupName: string;
  order: number;
  content: string; // Nội dung đánh giá
  maxScore: number; // Điểm tối đa
  scoreType: KpiVcScoreType; // 'input_score' | 'select_level' | 'fixed_score'
  levels?: KpiVcLevel[]; // Dành cho III.2
  guideline?: string; // Hướng dẫn chấm
  isActive: boolean; // Soft delete flag
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface KpiVcCriteriaGroup {
  id: string;
  code: string; // 'I', 'II', 'III'
  name: string; // 'Chính trị tư tưởng, đạo đức lối sống', ...
  maxScore: number; // 15, 15, 70
  order: number;
  description?: string;
  isActive: boolean;
}

export interface KpiVcPeriod {
  id: string;
  name: string; // e.g. 'Kỳ đánh giá Học kỳ 1', 'Đánh giá Năm học 2025-2026'
  academicYear: string; // e.g. '2025-2026', '2026-2027'
  startDate: string;
  endDate: string;
  status: 'active' | 'locked' | 'draft';
  description?: string;
  periodType?: 'month' | 'term' | 'year';
  periodValue?: string;
  createdAt?: string;
  lockedAt?: string | null;
  lockedBy?: string | null;
}

export interface KpiVcScoreItem {
  criterionId: string;
  criterionCode: string;
  groupId: string;
  groupName: string;
  order: number;
  content: string;
  maxScore: number;
  scoreType: KpiVcScoreType;
  selectedLevelId?: string | null;
  selectedLevelName?: string | null;
  selectedLevelCode?: string | null;
  selfScore: number; // Điểm cá nhân tự chấm
  note?: string;
  managerScore?: number | null; // Điểm CBQL đánh giá độc lập
  managerComment?: string; // Nhận xét của CBQL cho tiêu chí này
}

export interface KpiVcCriteriaSnapshot {
  version: number;
  snapshotDate: string;
  groups: KpiVcCriteriaGroup[];
  criteria: KpiVcCriterion[];
}

export type KpiVcFormStatus = 'draft' | 'self_evaluated' | 'completed' | 'locked';

export interface KpiVcForm {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode?: string;
  employeeUsername?: string;
  employeeAvatar?: string | null;
  position: string; // e.g. 'Giáo viên Toán', 'Nhân viên Văn thư'
  department: string; // e.g. 'Tổ Toán - Tin', 'Tổ Văn phòng'
  departmentId?: string | null;

  periodId: string;
  periodName: string;
  academicYear: string;

  criteriaSnapshot: KpiVcCriteriaSnapshot;
  items: KpiVcScoreItem[];

  // Scores
  groupScores: Record<string, number>; // { 'group_I': 15, 'group_II': 14.5, 'group_III': 70 }
  managerGroupScores?: Record<string, number>; // Điểm CBQL theo nhóm
  totalScore: number; // 0 -> 100
  managerTotalScore?: number | null; // Tổng điểm CBQL đánh giá
  maxTotalScore: number; // 100

  // Self assessment
  selfClassification: string; // 'Hoàn thành xuất sắc nhiệm vụ' | 'Hoàn thành tốt nhiệm vụ' | ...
  selfDate: string;
  selfSignName: string;
  selfComment?: string;

  // Manager assessment (Phần dành cho người đứng đầu đơn vị / CBQL)
  leaderClassification?: string;
  leaderScore?: number;
  leaderComment?: string;
  leaderDate?: string;
  leaderSignName?: string;
  leaderSignRole?: string;
  managerGeneralComment?: string; // Nhận xét chung của CBQL (Ưu điểm, hạn chế, kết quả, kiến nghị)
  evaluatorId?: string;
  evaluatorName?: string;
  evaluatorRole?: string;
  managerEvaluatedAt?: string | null;

  // Status & Metadata
  status: KpiVcFormStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  lockedAt?: string | null;
  lockedBy?: string | null;
  createdBy: string;
  updatedBy?: string;
}

export interface KpiVcAuditLog {
  id: string;
  formId?: string;
  periodId?: string;
  criterionId?: string;
  action: 'create_form' | 'update_form' | 'submit_form' | 'lock_form' | 'unlock_form' | 'delete_form' | 'create_criterion' | 'update_criterion' | 'delete_criterion' | 'create_period' | 'update_period';
  actorId: string;
  actorName: string;
  actorRole?: string;
  targetName: string;
  description: string;
  timestamp: string;
}
