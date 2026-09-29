import { SystemModule, Role, User } from '../types';

export const DEFAULT_SYSTEM_MODULES: SystemModule[] = [
  {
    id: 'calendar',
    title: 'LỊCH CÔNG TÁC',
    desc: 'Lịch tuần & Sự kiện',
    icon: 'Calendar',
    route: '/calendar',
    gradient: 'from-blue-600 to-indigo-700',
    shadowColor: 'shadow-blue-500/30',
    order: 1,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'TTCM', 'GIAO_VU', 'NHAN_SU', 'GIAO_VIEN'],
    showOnHome: true,
    showOnSidebar: true,
    showOnHeader: true,
    isSystem: true
  },
  {
    id: 'school_work_schedule',
    title: 'LỊCH CÔNG VIỆC TRƯỜNG',
    desc: 'Phân công - Trực ban - Đánh giá',
    icon: 'CalendarCheck',
    route: '/school-work-schedule',
    gradient: 'from-blue-600 to-indigo-600',
    shadowColor: 'shadow-blue-500/30',
    order: 2,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'TTCM', 'GIAO_VU', 'NHAN_SU', 'GIAO_VIEN'],
    showOnHome: true,
    showOnSidebar: true,
    showOnHeader: false,
    isSystem: true
  },
  {
    id: 'department_schedule',
    title: 'LỊCH GIAO VIỆC TỔ CM',
    desc: 'Kế hoạch tuần & Giao việc tổ',
    icon: 'FileSpreadsheet',
    route: '/department-schedule',
    gradient: 'from-cyan-600 to-blue-700',
    shadowColor: 'shadow-cyan-500/30',
    order: 3,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'TTCM', 'GIAO_VIEN'],
    showOnHome: false,
    showOnSidebar: true,
    showOnHeader: false,
    isSystem: true
  },
  {
    id: 'kpi_cbql',
    title: 'KPI CBQL',
    desc: 'Đánh giá cán bộ QL',
    icon: 'Award',
    route: '/kpi-cbql',
    gradient: 'from-blue-700 to-indigo-800',
    shadowColor: 'shadow-blue-600/30',
    order: 4,
    enabled: true,
    allowedRoles: ['admin', 'BGH'],
    showOnHome: true,
    showOnSidebar: true,
    showOnHeader: false,
    isSystem: true
  },
  {
    id: 'kpi_gvnv',
    title: 'KPI GIÁO VIÊN',
    desc: 'Đánh giá Giáo viên',
    icon: 'GraduationCap',
    route: '/kpi-gvnv',
    gradient: 'from-emerald-600 to-teal-700',
    shadowColor: 'shadow-emerald-500/30',
    order: 5,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'TTCM', 'GIAO_VIEN'],
    showOnHome: true,
    showOnSidebar: true,
    showOnHeader: true,
    isSystem: true
  },
  {
    id: 'kpi_nv',
    title: 'KPI NHÂN VIÊN',
    desc: 'Đánh giá Nhân viên hành chính',
    icon: 'UserCheck',
    route: '/kpi-nv',
    gradient: 'from-teal-600 to-emerald-800',
    shadowColor: 'shadow-teal-500/30',
    order: 6,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'NHAN_SU', 'GIAO_VU'],
    showOnHome: true,
    showOnSidebar: true,
    showOnHeader: true,
    isSystem: true
  },
  {
    id: 'kpi_catalog',
    title: 'DANH MỤC KPI',
    desc: 'Bảng điểm & Tiêu chuẩn',
    icon: 'Layers',
    route: '/kpi-catalog',
    gradient: 'from-violet-600 to-purple-700',
    shadowColor: 'shadow-violet-500/30',
    order: 7,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'TTCM', 'GIAO_VU', 'NHAN_SU', 'GIAO_VIEN'],
    showOnHome: false,
    showOnSidebar: true,
    showOnHeader: false,
    isSystem: true
  },
  {
    id: 'discipline',
    title: 'NỀN NẾP',
    desc: 'Nền nếp & Nội quy',
    icon: 'ShieldCheck',
    route: '/discipline',
    gradient: 'from-amber-500 to-orange-600',
    shadowColor: 'shadow-amber-500/30',
    order: 8,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'TTCM', 'GIAO_VU', 'NHAN_SU', 'GIAO_VIEN'],
    showOnHome: true,
    showOnSidebar: true,
    showOnHeader: false,
    isSystem: true
  },
  {
    id: 'homeroom',
    title: 'CHỦ NHIỆM',
    desc: 'Công tác chủ nhiệm',
    icon: 'Users',
    route: '/homeroom',
    gradient: 'from-sky-600 to-blue-700',
    shadowColor: 'shadow-sky-500/30',
    order: 9,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'TTCM', 'GIAO_VIEN'],
    showOnHome: false,
    showOnSidebar: true,
    showOnHeader: false,
    isSystem: true
  },
  {
    id: 'teachers',
    title: 'CBGVNV',
    desc: 'Quản lý nhân sự',
    icon: 'Users',
    route: '/teachers',
    gradient: 'from-indigo-600 to-purple-600',
    shadowColor: 'shadow-indigo-500/30',
    order: 10,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'NHAN_SU', 'GIAO_VU', 'TTCM', 'GIAO_VIEN'],
    showOnHome: true,
    showOnSidebar: true,
    showOnHeader: true,
    isSystem: true
  },
  {
    id: 'documents',
    title: 'VĂN BẢN',
    desc: 'Hồ sơ & Công văn',
    icon: 'FileText',
    route: '/documents',
    gradient: 'from-rose-600 to-pink-600',
    shadowColor: 'shadow-rose-500/30',
    order: 11,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'TTCM', 'GIAO_VU', 'NHAN_SU', 'GIAO_VIEN'],
    showOnHome: false,
    showOnSidebar: true,
    showOnHeader: true,
    isSystem: true
  },
  {
    id: 'departments',
    title: 'TỔ CHUYÊN MÔN',
    desc: 'Tổ bộ môn & Sinh hoạt',
    icon: 'School',
    route: '/departments',
    gradient: 'from-purple-600 to-pink-600',
    shadowColor: 'shadow-purple-500/30',
    order: 12,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'TTCM', 'GIAO_VIEN'],
    showOnHome: true,
    showOnSidebar: true,
    showOnHeader: false,
    isSystem: true
  },
  {
    id: 'leaves',
    title: 'NGHỈ PHÉP',
    desc: 'Đơn xin nghỉ & Điểm danh',
    icon: 'Plane',
    route: '/leaves',
    gradient: 'from-amber-600 to-orange-700',
    shadowColor: 'shadow-amber-600/30',
    order: 13,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'TTCM', 'GIAO_VU', 'NHAN_SU', 'GIAO_VIEN'],
    showOnHome: false,
    showOnSidebar: true,
    showOnHeader: false,
    isSystem: true
  },
  {
    id: 'reports',
    title: 'THỐNG KÊ',
    desc: 'Báo cáo & Tổng hợp',
    icon: 'PieChart',
    route: '/reports',
    gradient: 'from-teal-500 to-emerald-600',
    shadowColor: 'shadow-teal-500/30',
    order: 14,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'TTCM', 'GIAO_VU', 'NHAN_SU', 'GIAO_VIEN'],
    showOnHome: true,
    showOnSidebar: true,
    showOnHeader: true,
    isSystem: true
  },
  {
    id: 'settings',
    title: 'HỆ THỐNG',
    desc: 'Cài đặt & Quản trị',
    icon: 'Settings',
    route: '/settings',
    gradient: 'from-slate-600 to-slate-800',
    shadowColor: 'shadow-slate-500/30',
    order: 15,
    enabled: true,
    allowedRoles: ['admin', 'BGH', 'TTCM', 'GIAO_VU', 'NHAN_SU', 'GIAO_VIEN'],
    showOnHome: false,
    showOnSidebar: true,
    showOnHeader: false,
    isSystem: true
  }
];

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase().trim();
  const username = String(user.username || '').toLowerCase().trim();
  const id = String(user.id || '').toLowerCase().trim();
  return role === 'ADMIN' || username === 'admin' || id === 'admin';
}

export function isUserAllowedForModule(module: SystemModule, user: User | null | undefined): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admin has full access to all modules
  if (!module.enabled) return false; // Disabled module is invisible/inaccessible to non-admin
  if (!module.allowedRoles || module.allowedRoles.length === 0) return true;
  
  const userRole = (user.role || 'GIAO_VIEN') as Role;
  return module.allowedRoles.includes(userRole) || 
         module.allowedRoles.map(r => String(r).toUpperCase()).includes(String(userRole).toUpperCase());
}
