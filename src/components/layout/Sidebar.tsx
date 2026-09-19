import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { 
  X, 
  Home, 
  Users, 
  UserSquare2, 
  CalendarDays, 
  CheckSquare, 
  Plane, 
  BarChart3, 
  Settings, 
  BookOpen, 
  GraduationCap, 
  Award,
  ShieldCheck,
  Layers,
  FileCheck2,
  FileText
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  hideOnDesktop?: boolean;
}

export default function Sidebar({ isOpen, setIsOpen, hideOnDesktop = false }: SidebarProps) {
  const location = useLocation();

  const navigation = [
    { name: 'Trang chủ', href: '/', icon: Home },
    { name: 'KPI Cán bộ Quản lý', href: '/kpi-cbql', icon: Award },
    { name: 'KPI Giáo viên - Nhân viên', href: '/kpi-gvnv', icon: GraduationCap },
    { name: 'Danh mục & Bảng điểm KPI', href: '/kpi-catalog', icon: Layers },
    { name: 'Nền nếp & Nội quy', href: '/discipline', icon: ShieldCheck },
    { name: 'Công tác chủ nhiệm', href: '/homeroom', icon: Users },
    { name: 'Quản lý CBGVNV', href: '/teachers', icon: GraduationCap },
    { name: 'Quản lý Văn bản', href: '/documents', icon: FileText },
    { name: 'Tổ chuyên môn', href: '/departments', icon: UserSquare2 },
    { name: 'Giao việc', href: '/tasks', icon: CheckSquare },
    { name: 'Nghỉ phép', href: '/leaves', icon: Plane },
    { name: 'Thống kê - Báo cáo', href: '/reports', icon: BarChart3 },
    { name: 'Lịch công tác', href: '/calendar', icon: CalendarDays },
    { name: 'Hệ thống', href: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
      />

      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[300px] bg-[#F4F8FF] border-r border-[#3B82F6]/10 flex flex-col transition-transform duration-300 ease-in-out shadow-lg",
          hideOnDesktop
            ? (isOpen ? "translate-x-0" : "-translate-x-full")
            : (isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:static lg:shadow-none")
        )}
      >
        <div className="relative flex flex-col items-center justify-center pt-8 pb-6 px-4 shrink-0">
          <button 
            className="absolute top-4 right-4 lg:hidden text-[#64748B] hover:text-[#123B78] bg-white p-1.5 rounded-lg shadow-sm"
            onClick={() => setIsOpen(false)}
          >
            <X size={20} />
          </button>
          
          {/* LOGO TRƯỜNG */}
          <div 
            className="w-[80px] h-[80px] bg-white rounded-full shadow-sm border border-[#3B82F6]/20 mb-4 flex items-center justify-center overflow-hidden shrink-0 mx-auto p-1"
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
            <h2 className="text-[#123B78] font-bold text-[20px] uppercase mb-1.5 flex flex-col items-center justify-center w-full">
              THPT SƠN LƯƠNG
            </h2>
            <p className="text-[#1457D9] text-[11.5px] uppercase whitespace-nowrap text-center w-full font-medium">
              Tri thức - Nhân cách - Tương lai
            </p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navigation.map((item) => {
            const isActive = item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href);
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-semibold transition-all duration-200 group",
                  isActive 
                    ? "bg-[#1457D9] text-white shadow-md shadow-[#1457D9]/30" 
                    : "text-[#0B3FA8] hover:bg-white hover:shadow-sm"
                )}
              >
                <item.icon 
                  size={22} 
                  strokeWidth={isActive ? 2.5 : 2}
                  className={cn(
                    "transition-colors duration-200",
                    isActive ? "text-white" : "text-[#1457D9]"
                  )} 
                />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-6 mt-auto">
          <div className="text-center">
            <BookOpen className="w-8 h-8 text-[#3B82F6]/60 mx-auto mb-3" />
            <p className="text-[13px] text-[#0B3FA8] font-medium leading-relaxed italic mb-3">
              “Vì một ngôi trường<br/>hạnh phúc, chất lượng và<br/>phát triển bền vững”
            </p>
            <div className="h-px w-12 bg-[#3B82F6]/30 mx-auto mb-2"></div>
            <p className="text-[12px] font-bold text-[#1457D9] uppercase tracking-wider">THPT SƠN LƯƠNG</p>
          </div>
        </div>
      </aside>
    </>
  );
}
