import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { 
  X, 
  Home, 
  Users, 
  UserSquare2, 
  CalendarDays, 
  Calendar,
  CheckSquare, 
  Plane, 
  BarChart3, 
  Settings, 
  BookOpen, 
  GraduationCap, 
  Award,
  ShieldCheck,
  ShieldAlert,
  Layers,
  FileText,
  UserCheck,
  FileSpreadsheet,
  Briefcase,
  Wrench,
  UserCog
} from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import { ModuleCode } from '../../types/permission';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  hideOnDesktop?: boolean;
}

export default function Sidebar({ isOpen, setIsOpen, hideOnDesktop = false }: SidebarProps) {
  const location = useLocation();
  const { canAccessModule, isAdmin } = usePermission();

  const navigation: { name: string; href: string; icon: any; moduleCode?: ModuleCode }[] = [
    { name: 'Trang chủ', href: '/', icon: Home, moduleCode: 'home' },
    { name: 'Lịch công tác', href: '/calendar', icon: CalendarDays, moduleCode: 'calendar' },
    { name: 'Lịch công việc trường', href: '/school-work-schedule', icon: Calendar, moduleCode: 'school_work_schedule' },
    { name: 'Lịch giao việc tổ CM', href: '/department-schedule', icon: FileSpreadsheet, moduleCode: 'department_schedule' },
    { name: 'Đoàn TN - Nền nếp HS', href: '/youth-discipline', icon: ShieldAlert, moduleCode: 'youth_discipline' },
    { name: 'Lịch trực Đoàn TN', href: '/youth-duty-schedule', icon: CalendarDays, moduleCode: 'youth_duty_schedule' },
    { name: 'Theo dõi học tập', href: '/academic-tracking', icon: BookOpen, moduleCode: 'academic_tracking' },
    { name: 'KPI Cán bộ Quản lý', href: '/kpi-cbql', icon: Award, moduleCode: 'kpi_cbql' },
    { name: 'KPI Giáo viên', href: '/kpi-gvnv', icon: GraduationCap, moduleCode: 'kpi_gvnv' },
    { name: 'KPI Nhân viên', href: '/kpi-nv', icon: UserCheck, moduleCode: 'kpi_nv' },
    { name: 'Danh mục & Bảng điểm KPI', href: '/kpi-catalog', icon: Layers, moduleCode: 'kpi_catalog' },
    { name: 'Nền nếp & Nội quy CBGV', href: '/discipline', icon: ShieldCheck, moduleCode: 'youth_discipline' },
    { name: 'Công tác chủ nhiệm', href: '/homeroom', icon: Users, moduleCode: 'homeroom' },
    { name: 'Báo hỏng CSVC', href: '/facility-damage', icon: Wrench, moduleCode: 'facility_damage' },
    { name: 'Quản lý CBGVNV', href: '/teachers', icon: GraduationCap, moduleCode: 'teachers' },
    { name: 'Tổ chuyên môn', href: '/departments', icon: UserSquare2, moduleCode: 'departments' },
    { name: 'Tổ Văn phòng', href: '/van-phong', icon: Briefcase, moduleCode: 'departments' },
    { name: 'Nghỉ phép', href: '/leaves', icon: Plane, moduleCode: 'leaves' },
    { name: 'Thống kê - Báo cáo', href: '/reports', icon: BarChart3, moduleCode: 'reports' },
    { name: 'Quản lý tài khoản', href: '/accounts', icon: UserCog, moduleCode: 'accounts' },
    { name: 'Hệ thống', href: '/settings', icon: Settings, moduleCode: 'accounts' },
  ];

  const visibleNavigation = navigation.filter(item => {
    if (isAdmin) return true;
    if (!item.moduleCode) return true;
    return canAccessModule(item.moduleCode);
  });

  return (
    <>
      {/* Mobile overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-900 lg:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
      />

      <aside 
        className={cn(
          "sidebar border-r border-[#3B82F6]/10 flex flex-col bg-[#F4F8FF] transition-transform duration-300 ease-in-out shadow-lg lg:shadow-none select-none font-sans",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="relative flex flex-col items-center justify-center pt-6 pb-4 px-4 shrink-0">
          <button 
            type="button"
            className="absolute top-3 right-3 lg:hidden text-[#64748B] hover:text-[#123B78] bg-white p-1.5 rounded-lg shadow-xs cursor-pointer"
            onClick={() => setIsOpen(false)}
          >
            <X size={18} />
          </button>
          
          {/* LOGO TRƯỜNG */}
          <div 
            className="w-[68px] h-[68px] bg-white rounded-full shadow-xs border border-[#3B82F6]/20 mb-2 flex items-center justify-center overflow-hidden shrink-0 mx-auto p-1"
          >
            <img 
              src="/logo.jpg" 
              alt="Logo THPT Sơn Lương" 
              className="w-full h-full object-contain rounded-full"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          
          <div className="text-center w-full">
            <h2 className="text-[#123B78] font-bold text-base uppercase mb-0.5 flex flex-col items-center justify-center w-full tracking-tight">
              THPT SƠN LƯƠNG
            </h2>
            <p className="text-[#1457D9] text-[10.5px] uppercase whitespace-nowrap text-center w-full font-bold tracking-wider">
              Tri thức - Nhân cách - Tương lai
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
          {visibleNavigation.map((item) => {
            const isActive = item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href);
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13.5px] font-bold transition-all duration-150 group",
                  isActive 
                    ? "bg-[#1457D9] text-white shadow-md shadow-[#1457D9]/25 translate-x-1" 
                    : "text-[#0B3FA8] hover:bg-white hover:text-[#1457D9] hover:shadow-xs"
                )}
              >
                <item.icon 
                  size={19} 
                  strokeWidth={isActive ? 2.5 : 2}
                  className={cn(
                    "shrink-0 transition-colors duration-150",
                    isActive ? "text-white" : "text-[#1457D9]"
                  )} 
                />
                <span className="truncate">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-[#3B82F6]/10 shrink-0">
          <div className="text-center">
            <BookOpen className="w-6 h-6 text-[#3B82F6]/60 mx-auto mb-2" />
            <p className="text-[11.5px] text-[#0B3FA8] font-semibold leading-relaxed italic mb-2">
              “Vì một ngôi trường hạnh phúc, chất lượng và phát triển”
            </p>
            <div className="h-px w-10 bg-[#3B82F6]/30 mx-auto mb-1.5"></div>
            <p className="text-[11px] font-extrabold text-[#1457D9] uppercase tracking-wider">THPT SƠN LƯƠNG</p>
          </div>
        </div>
      </aside>
    </>
  );
}
