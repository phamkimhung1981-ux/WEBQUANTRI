import { Role } from '../types';

export type ModuleCode = 
  | 'home'
  | 'calendar'
  | 'school_work_schedule'
  | 'department_schedule'
  | 'departments'
  | 'teachers'
  | 'kpi_catalog'
  | 'kpi_cbql'
  | 'kpi_gvnv'
  | 'kpi_nv'
  | 'homeroom'
  | 'youth_discipline'
  | 'youth_duty_schedule'
  | 'academic_tracking'
  | 'facility_damage'
  | 'leaves'
  | 'reports'
  | 'accounts';

export type PermissionAction = 
  | 'view'      // Xem dữ liệu
  | 'create'    // Thêm mới
  | 'edit'      // Chỉnh sửa
  | 'delete'    // Xóa
  | 'approve'   // Phê duyệt
  | 'export'    // Xuất báo cáo (Excel, Word, PDF)
  | 'lock';     // Khóa dữ liệu

export interface ModuleActionPermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
  lock: boolean;
}

export type ModulePermissionsMap = Record<ModuleCode, ModuleActionPermissions>;

export type RoleGroupCode = 
  | 'ADMIN'
  | 'BGH'
  | 'TTCM'
  | 'TEACHER'
  | 'GVCN'
  | 'DOAN'
  | 'STAFF';

export interface RoleGroupConfig {
  code: RoleGroupCode;
  name: string;
  description: string;
  badgeColor: string;
  badgeBg: string;
  isSystem: boolean;
  permissions: ModulePermissionsMap;
}

export type AccountStatus = 'Đang hoạt động' | 'Đã khóa' | 'Vô hiệu hóa';

export interface AccountRecord {
  id: string; // Matches teacher id or 'admin'
  teacherId?: string;
  teacherCode?: string;
  fullName: string;
  username: string;
  password?: string;
  position: string;
  departmentId?: string;
  departmentName?: string;
  roleGroup: RoleGroupCode;
  status: AccountStatus;
  hasCustomPermissions: boolean;
  customPermissions?: Partial<ModulePermissionsMap>;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  avatar?: string;
  email?: string;
  phone?: string;
  lockReason?: string;
  deactivateReason?: string;
}

export interface AccountAuditLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'LOCK' | 'UNLOCK' | 'RESET_PASSWORD' | 'DEACTIVATE' | 'UPDATE_PERMISSIONS';
  targetUsername: string;
  targetFullName: string;
  performedBy: string;
  timestamp: string;
  details: string;
}

export interface ModuleMeta {
  code: ModuleCode;
  title: string;
  shortDesc: string;
  route: string;
  category: 'CHUNG' | 'CHUYEN_MON' | 'DANH_GIA_KPI' | 'CONG_TAC_HOC_SINH' | 'QUAN_TRI';
}

export const SYSTEM_MODULES_LIST: ModuleMeta[] = [
  { code: 'home', title: '1. Trang chủ', shortDesc: 'Bảng điều khiển & tổng quan hệ thống', route: '/', category: 'CHUNG' },
  { code: 'calendar', title: '2. Lịch công tác', shortDesc: 'Lịch công tác tuần & sự kiện', route: '/calendar', category: 'CHUNG' },
  { code: 'school_work_schedule', title: '3. Lịch công việc trường', shortDesc: 'Phân công, trực ban & tiến độ toàn trường', route: '/school-work-schedule', category: 'CHUNG' },
  { code: 'department_schedule', title: '4. Lịch giao việc tổ CM', shortDesc: 'Kế hoạch công tác và nhiệm vụ tổ bộ môn', route: '/department-schedule', category: 'CHUYEN_MON' },
  { code: 'departments', title: '5. Tổ chuyên môn', shortDesc: 'Quản lý tổ bộ môn & tổ văn phòng', route: '/departments', category: 'CHUYEN_MON' },
  { code: 'teachers', title: '6. Hồ sơ giáo viên (CBGVNV)', shortDesc: 'Hồ sơ nhân sự, danh sách cán bộ giáo viên', route: '/teachers', category: 'QUAN_TRI' },
  { code: 'kpi_catalog', title: '7. Danh mục & Bảng điểm KPI', shortDesc: 'Khung tiêu chí đánh giá và bảng điểm tổng hợp', route: '/kpi-catalog', category: 'DANH_GIA_KPI' },
  { code: 'kpi_cbql', title: '8. KPI CBQL', shortDesc: 'Đánh giá Cán bộ quản lý trường', route: '/kpi-cbql', category: 'DANH_GIA_KPI' },
  { code: 'kpi_gvnv', title: '9. KPI Giáo viên', shortDesc: 'Đánh giá xếp loại giáo viên 3 cấp (100đ)', route: '/kpi-gvnv', category: 'DANH_GIA_KPI' },
  { code: 'kpi_nv', title: '10. KPI Nhân viên', shortDesc: 'Đánh giá xếp loại nhân viên hành chính', route: '/kpi-nv', category: 'DANH_GIA_KPI' },
  { code: 'homeroom', title: '11. Công tác chủ nhiệm', shortDesc: 'Sổ chủ nhiệm, quản lý lớp & sơ kết', route: '/homeroom', category: 'CONG_TAC_HOC_SINH' },
  { code: 'youth_discipline', title: '12. Đoàn Thanh niên – Nền nếp HS', shortDesc: 'Chấm điểm thi đua, ghi nhận học sinh vi phạm', route: '/youth-discipline', category: 'CONG_TAC_HOC_SINH' },
  { code: 'youth_duty_schedule', title: '13. Lịch trực Đoàn TN', shortDesc: 'Phân công trực ban nền nếp xung kích', route: '/youth-duty-schedule', category: 'CONG_TAC_HOC_SINH' },
  { code: 'academic_tracking', title: '14. Theo dõi học tập', shortDesc: 'Điểm số thi đua học tập các lớp tuần/tháng', route: '/academic-tracking', category: 'CONG_TAC_HOC_SINH' },
  { code: 'facility_damage', title: '15. Báo hỏng CSVC', shortDesc: 'Báo cáo hư hỏng thiết bị, cơ sở vật chất', route: '/facility-damage', category: 'QUAN_TRI' },
  { code: 'leaves', title: '16. Quản lý nghỉ phép', shortDesc: 'Đơn nghỉ phép, theo dõi nghỉ phép CBGVNV', route: '/leaves', category: 'QUAN_TRI' },
  { code: 'reports', title: '17. Báo cáo thống kê', shortDesc: 'Thống kê tổng hợp thi đua, KPI, chuyên môn', route: '/reports', category: 'QUAN_TRI' },
  { code: 'accounts', title: '18. Quản lý tài khoản & Phân quyền', shortDesc: 'Cấp phát tài khoản, phân quyền ma trận 7 cấp', route: '/accounts', category: 'QUAN_TRI' },
];

export const ACTION_LABELS: Record<PermissionAction, { label: string; desc: string }> = {
  view: { label: 'XEM', desc: 'Xem thông tin và dữ liệu module' },
  create: { label: 'TẠO MỚI', desc: 'Thêm mới bản ghi, nhiệm vụ, phiếu' },
  edit: { label: 'CHỈNH SỬA', desc: 'Chỉnh sửa dữ liệu được phân công' },
  delete: { label: 'XÓA', desc: 'Xóa bản ghi khỏi cơ sở dữ liệu' },
  approve: { label: 'PHÊ DUYỆT', desc: 'Phê duyệt đánh giá, KPI, kết quả' },
  export: { label: 'XUẤT BÁO CÁO', desc: 'Xuất file Excel, Word, PDF' },
  lock: { label: 'KHÓA DỮ LIỆU', desc: 'Khóa tuần, khóa kỳ đánh giá' }
};

export const createEmptyModulePermissions = (allTrue = false): ModuleActionPermissions => ({
  view: allTrue,
  create: allTrue,
  edit: allTrue,
  delete: allTrue,
  approve: allTrue,
  export: allTrue,
  lock: allTrue
});

export const createAllModulePermissions = (val = false): ModulePermissionsMap => {
  const result: Partial<ModulePermissionsMap> = {};
  SYSTEM_MODULES_LIST.forEach(m => {
    result[m.code] = createEmptyModulePermissions(val);
  });
  return result as ModulePermissionsMap;
};

// Default matrices for each role group
export const DEFAULT_ROLE_GROUPS: Record<RoleGroupCode, RoleGroupConfig> = {
  ADMIN: {
    code: 'ADMIN',
    name: 'Quản trị hệ thống (ADMIN)',
    description: 'Toàn quyền cấu hình, quản trị người dùng, hệ thống và mọi module nghiệp vụ',
    badgeColor: 'text-rose-700 border-rose-300',
    badgeBg: 'bg-rose-50',
    isSystem: true,
    permissions: createAllModulePermissions(true)
  },
  BGH: {
    code: 'BGH',
    name: 'Ban Giám hiệu (BGH)',
    description: 'Chỉ đạo toàn diện, xem và duyệt tất cả các module, đánh giá KPI Cấp 3, quản lý tài khoản',
    badgeColor: 'text-indigo-700 border-indigo-300',
    badgeBg: 'bg-indigo-50',
    isSystem: true,
    permissions: {
      home: { view: true, create: true, edit: true, delete: true, approve: true, export: true, lock: true },
      calendar: { view: true, create: true, edit: true, delete: true, approve: true, export: true, lock: true },
      school_work_schedule: { view: true, create: true, edit: true, delete: true, approve: true, export: true, lock: true },
      department_schedule: { view: true, create: false, edit: false, delete: false, approve: true, export: true, lock: true },
      departments: { view: true, create: true, edit: true, delete: true, approve: true, export: true, lock: true },
      teachers: { view: true, create: true, edit: true, delete: true, approve: true, export: true, lock: true },
      kpi_catalog: { view: true, create: true, edit: true, delete: true, approve: true, export: true, lock: true },
      kpi_cbql: { view: true, create: true, edit: true, delete: true, approve: true, export: true, lock: true },
      kpi_gvnv: { view: true, create: false, edit: true, delete: false, approve: true, export: true, lock: true },
      kpi_nv: { view: true, create: false, edit: true, delete: false, approve: true, export: true, lock: true },
      homeroom: { view: true, create: true, edit: true, delete: false, approve: true, export: true, lock: true },
      youth_discipline: { view: true, create: true, edit: true, delete: false, approve: true, export: true, lock: true },
      youth_duty_schedule: { view: true, create: true, edit: true, delete: false, approve: true, export: true, lock: true },
      academic_tracking: { view: true, create: true, edit: true, delete: false, approve: true, export: true, lock: true },
      facility_damage: { view: true, create: true, edit: true, delete: false, approve: true, export: true, lock: true },
      leaves: { view: true, create: true, edit: true, delete: true, approve: true, export: true, lock: true },
      reports: { view: true, create: true, edit: true, delete: true, approve: true, export: true, lock: true },
      accounts: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
    }
  },
  TTCM: {
    code: 'TTCM',
    name: 'Tổ trưởng chuyên môn (TTCM)',
    description: 'Chỉ đạo tổ bộ môn, giao việc tổ, chấm KPI Cấp 2 cho thành viên trong tổ',
    badgeColor: 'text-purple-700 border-purple-300',
    badgeBg: 'bg-purple-50',
    isSystem: true,
    permissions: {
      home: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      calendar: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      school_work_schedule: { view: true, create: false, edit: true, delete: false, approve: false, export: true, lock: false },
      department_schedule: { view: true, create: true, edit: true, delete: true, approve: true, export: true, lock: true },
      departments: { view: true, create: false, edit: true, delete: false, approve: false, export: true, lock: false },
      teachers: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      kpi_catalog: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      kpi_cbql: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_gvnv: { view: true, create: false, edit: true, delete: false, approve: true, export: true, lock: false },
      kpi_nv: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      homeroom: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      youth_discipline: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      youth_duty_schedule: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      academic_tracking: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      facility_damage: { view: true, create: true, edit: true, delete: false, approve: false, export: true, lock: false },
      leaves: { view: true, create: true, edit: true, delete: false, approve: true, export: true, lock: false },
      reports: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      accounts: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
    }
  },
  TEACHER: {
    code: 'TEACHER',
    name: 'Giáo viên bộ môn (TEACHER)',
    description: 'Xem lịch công tác, lịch làm việc trường, lịch giao việc tổ CM, nề nếp HS, báo hỏng CSVC, xin nghỉ phép',
    badgeColor: 'text-emerald-700 border-emerald-300',
    badgeBg: 'bg-emerald-50',
    isSystem: true,
    permissions: {
      home: { view: true, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      calendar: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      school_work_schedule: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      department_schedule: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      departments: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      teachers: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_catalog: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_cbql: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_gvnv: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_nv: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      homeroom: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      youth_discipline: { view: true, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      youth_duty_schedule: { view: true, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      academic_tracking: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      facility_damage: { view: true, create: true, edit: false, delete: false, approve: false, export: false, lock: false },
      leaves: { view: true, create: true, edit: true, delete: false, approve: false, export: false, lock: false },
      reports: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      accounts: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
    }
  },
  GVCN: {
    code: 'GVCN',
    name: 'Giáo viên chủ nhiệm (GVCN)',
    description: 'Quyền Giáo viên cộng với quản lý lớp chủ nhiệm, theo dõi nền nếp lớp, nhập điểm thi đua học tập',
    badgeColor: 'text-cyan-700 border-cyan-300',
    badgeBg: 'bg-cyan-50',
    isSystem: true,
    permissions: {
      home: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      calendar: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      school_work_schedule: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      department_schedule: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      departments: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      teachers: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_catalog: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_cbql: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_gvnv: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_nv: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      homeroom: { view: true, create: true, edit: true, delete: false, approve: false, export: true, lock: false },
      youth_discipline: { view: true, create: true, edit: false, delete: false, approve: false, export: true, lock: false },
      youth_duty_schedule: { view: true, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      academic_tracking: { view: true, create: true, edit: true, delete: false, approve: false, export: true, lock: false },
      facility_damage: { view: true, create: true, edit: true, delete: false, approve: false, export: false, lock: false },
      leaves: { view: true, create: true, edit: true, delete: false, approve: false, export: false, lock: false },
      reports: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      accounts: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
    }
  },
  DOAN: {
    code: 'DOAN',
    name: 'Đoàn Thanh niên (DOAN)',
    description: 'Quản lý nền nếp học sinh toàn trường, lịch trực tuần, chấm điểm thi đua, ghi nhận học sinh vi phạm',
    badgeColor: 'text-blue-700 border-blue-300',
    badgeBg: 'bg-blue-50',
    isSystem: true,
    permissions: {
      home: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      calendar: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      school_work_schedule: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      department_schedule: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      departments: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      teachers: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_catalog: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_cbql: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_gvnv: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_nv: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      homeroom: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      youth_discipline: { view: true, create: true, edit: true, delete: true, approve: true, export: true, lock: true },
      youth_duty_schedule: { view: true, create: true, edit: true, delete: true, approve: true, export: true, lock: true },
      academic_tracking: { view: true, create: true, edit: true, delete: true, approve: true, export: true, lock: true },
      facility_damage: { view: true, create: true, edit: true, delete: false, approve: false, export: true, lock: false },
      leaves: { view: true, create: true, edit: true, delete: false, approve: false, export: false, lock: false },
      reports: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      accounts: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
    }
  },
  STAFF: {
    code: 'STAFF',
    name: 'Nhân viên hành chính (STAFF)',
    description: 'Văn thư, Kế toán, Y tế, Thư viện, Thiết bị; báo hỏng CSVC, xin nghỉ phép',
    badgeColor: 'text-amber-700 border-amber-300',
    badgeBg: 'bg-amber-50',
    isSystem: true,
    permissions: {
      home: { view: true, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      calendar: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      school_work_schedule: { view: true, create: false, edit: false, delete: false, approve: false, export: true, lock: false },
      department_schedule: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      departments: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      teachers: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_catalog: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_cbql: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_gvnv: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      kpi_nv: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      homeroom: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      youth_discipline: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      youth_duty_schedule: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      academic_tracking: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      facility_damage: { view: true, create: true, edit: false, delete: false, approve: false, export: false, lock: false },
      leaves: { view: true, create: true, edit: true, delete: false, approve: false, export: false, lock: false },
      reports: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
      accounts: { view: false, create: false, edit: false, delete: false, approve: false, export: false, lock: false },
    }
  }
};
