import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import { AppProvider } from './store/AppContext';
import { UnsavedChangesProvider } from './store/UnsavedChangesContext';
import Login from './pages/Login';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';

import LeaveTracking from './pages/LeaveTracking';
import Tasks from './pages/Tasks';
import Reports from './pages/Reports';
import Teachers from './pages/Teachers';
import Departments from './pages/Departments';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Calendar from './pages/Calendar';
import KpiCbql from './pages/KpiCbql';
import KpiTeacherStaff from './pages/KpiTeacherStaff';
import KpiStaff from './pages/KpiStaff';
import Discipline from './pages/Discipline';
import KpiCatalog from './pages/KpiCatalog';
import Homeroom from './pages/Homeroom';
import DepartmentSchedule from './pages/DepartmentSchedule';
import SchoolWorkSchedule from './pages/SchoolWorkSchedule';
import YouthDiscipline from './pages/YouthDiscipline';
import YouthDutySchedule from './pages/YouthDutySchedule';
import OfficeDepartment from './pages/OfficeDepartment';
import FacilityDamagePage from './pages/FacilityDamage';
import AcademicTrackingPage from './pages/AcademicTracking';
import AccountManagement from './pages/AccountManagement';
import { usePermission } from './hooks/usePermission';
import { ModuleCode } from './types/permission';
import { ShieldAlert } from 'lucide-react';

function PermissionGuard({ moduleCode, children }: { moduleCode: ModuleCode; children: React.ReactNode }) {
  const { canAccessModule, isAdmin } = usePermission();
  if (isAdmin || moduleCode === 'home' || canAccessModule(moduleCode)) {
    return <>{children}</>;
  }
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 text-center">
      <div className="bg-white p-8 sm:p-10 rounded-2xl border border-rose-200 shadow-xl max-w-lg w-full">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200 shadow-xs">
          <ShieldAlert size={34} />
        </div>
        <h3 className="text-base sm:text-lg font-black text-rose-700 mb-2 uppercase tracking-wide leading-snug">
          TÀI KHOẢN CỦA BẠN KHÔNG ĐƯỢC PHÂN QUYỀN TRUY CẬP CHỨC NĂNG NÀY
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed font-medium">
          Bạn không có quyền truy cập vào chức năng hoặc đường dẫn này. Vui lòng liên hệ Ban Giám hiệu hoặc Quản trị viên hệ thống để được phân quyền.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md hover:shadow-lg"
        >
          Quay lại Trang chủ
        </a>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-white font-black text-lg tracking-tight">Đang kiểm tra xác thực hệ thống...</h2>
        <p className="text-xs text-slate-400 mt-1">Trường THPT Sơn Lương</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PermissionGuard moduleCode="home"><Dashboard /></PermissionGuard>} />
        
        {/* KPI Modules */}
        <Route path="/kpi-cbql" element={<PermissionGuard moduleCode="kpi_cbql"><KpiCbql /></PermissionGuard>} />
        <Route path="/kpi-gvnv" element={<PermissionGuard moduleCode="kpi_gvnv"><KpiTeacherStaff /></PermissionGuard>} />
        <Route path="/kpi-nv" element={<PermissionGuard moduleCode="kpi_nv"><KpiStaff /></PermissionGuard>} />
        <Route path="/kpi-nhan-vien" element={<PermissionGuard moduleCode="kpi_nv"><KpiStaff /></PermissionGuard>} />
        <Route path="/kpi-staff" element={<PermissionGuard moduleCode="kpi_nv"><KpiStaff /></PermissionGuard>} />
        <Route path="/kpi-catalog" element={<PermissionGuard moduleCode="kpi_catalog"><KpiCatalog /></PermissionGuard>} />
        <Route path="/kpi" element={<PermissionGuard moduleCode="kpi_catalog"><KpiCatalog /></PermissionGuard>} />
        <Route path="/monthly-kpi" element={<PermissionGuard moduleCode="kpi_catalog"><KpiCatalog /></PermissionGuard>} />
        
        {/* Nền nếp & Đoàn Thanh niên */}
        <Route path="/discipline" element={<PermissionGuard moduleCode="youth_discipline"><Discipline /></PermissionGuard>} />
        <Route path="/nen-nep" element={<PermissionGuard moduleCode="youth_discipline"><Discipline /></PermissionGuard>} />
        <Route path="/youth-discipline" element={<PermissionGuard moduleCode="youth_discipline"><YouthDiscipline /></PermissionGuard>} />
        <Route path="/doan-tn/nen-nep-hoc-sinh" element={<PermissionGuard moduleCode="youth_discipline"><YouthDiscipline /></PermissionGuard>} />
        <Route path="/nen-nep-hoc-sinh" element={<PermissionGuard moduleCode="youth_discipline"><YouthDiscipline /></PermissionGuard>} />
        <Route path="/doan-thanh-nien" element={<PermissionGuard moduleCode="youth_discipline"><YouthDiscipline /></PermissionGuard>} />
        <Route path="/youth-duty-schedule" element={<PermissionGuard moduleCode="youth_duty_schedule"><YouthDutySchedule /></PermissionGuard>} />
        <Route path="/lich-truc-doan" element={<PermissionGuard moduleCode="youth_duty_schedule"><YouthDutySchedule /></PermissionGuard>} />
        <Route path="/lich-truc-doan-tn" element={<PermissionGuard moduleCode="youth_duty_schedule"><YouthDutySchedule /></PermissionGuard>} />
        <Route path="/doan-tn/lich-truc" element={<PermissionGuard moduleCode="youth_duty_schedule"><YouthDutySchedule /></PermissionGuard>} />
        
        {/* Chủ nhiệm & Học tập */}
        <Route path="/homeroom" element={<PermissionGuard moduleCode="homeroom"><Homeroom /></PermissionGuard>} />
        <Route path="/cong-tac-chu-nhiem" element={<PermissionGuard moduleCode="homeroom"><Homeroom /></PermissionGuard>} />
        <Route path="/chu-nhiem" element={<PermissionGuard moduleCode="homeroom"><Homeroom /></PermissionGuard>} />
        <Route path="/academic-tracking" element={<PermissionGuard moduleCode="academic_tracking"><AcademicTrackingPage /></PermissionGuard>} />
        <Route path="/hoc-tap" element={<PermissionGuard moduleCode="academic_tracking"><AcademicTrackingPage /></PermissionGuard>} />
        <Route path="/theo-doi-hoc-tap" element={<PermissionGuard moduleCode="academic_tracking"><AcademicTrackingPage /></PermissionGuard>} />
        
        {/* CSVC & Lịch công tác */}
        <Route path="/facility-damage" element={<PermissionGuard moduleCode="facility_damage"><FacilityDamagePage /></PermissionGuard>} />
        <Route path="/bao-hong-csvc" element={<PermissionGuard moduleCode="facility_damage"><FacilityDamagePage /></PermissionGuard>} />
        <Route path="/co-so-vat-chat" element={<PermissionGuard moduleCode="facility_damage"><FacilityDamagePage /></PermissionGuard>} />
        <Route path="/tasks" element={<Navigate to="/school-work-schedule" replace />} />
        <Route path="/tasks/:deptSlug" element={<Navigate to="/school-work-schedule" replace />} />
        <Route path="/school-work-schedule" element={<PermissionGuard moduleCode="school_work_schedule"><SchoolWorkSchedule /></PermissionGuard>} />
        <Route path="/lich-cong-viec" element={<PermissionGuard moduleCode="school_work_schedule"><SchoolWorkSchedule /></PermissionGuard>} />
        <Route path="/lich-cong-viec-truong" element={<PermissionGuard moduleCode="school_work_schedule"><SchoolWorkSchedule /></PermissionGuard>} />
        <Route path="/work-schedule" element={<PermissionGuard moduleCode="school_work_schedule"><SchoolWorkSchedule /></PermissionGuard>} />
        <Route path="/calendar" element={<PermissionGuard moduleCode="calendar"><Calendar /></PermissionGuard>} />
        <Route path="/department-schedule" element={<PermissionGuard moduleCode="department_schedule"><DepartmentSchedule /></PermissionGuard>} />
        <Route path="/department-schedules" element={<PermissionGuard moduleCode="department_schedule"><DepartmentSchedule /></PermissionGuard>} />
        <Route path="/lich-giao-viec-to" element={<PermissionGuard moduleCode="department_schedule"><DepartmentSchedule /></PermissionGuard>} />
        <Route path="/lich-to-chuyen-mon" element={<PermissionGuard moduleCode="department_schedule"><DepartmentSchedule /></PermissionGuard>} />
        
        {/* Nhân sự, Tổ chuyên môn & Văn phòng */}
        <Route path="/leaves" element={<PermissionGuard moduleCode="leaves"><LeaveTracking /></PermissionGuard>} />
        <Route path="/teachers" element={<PermissionGuard moduleCode="teachers"><Teachers /></PermissionGuard>} />
        <Route path="/departments" element={<PermissionGuard moduleCode="departments"><Departments /></PermissionGuard>} />
        <Route path="/van-phong" element={<PermissionGuard moduleCode="departments"><OfficeDepartment /></PermissionGuard>} />
        <Route path="/to-van-phong" element={<PermissionGuard moduleCode="departments"><OfficeDepartment /></PermissionGuard>} />
        <Route path="/office-department" element={<PermissionGuard moduleCode="departments"><OfficeDepartment /></PermissionGuard>} />
        <Route path="/office-staff" element={<PermissionGuard moduleCode="departments"><OfficeDepartment /></PermissionGuard>} />
        
        {/* Báo cáo & Tài khoản */}
        <Route path="/reports" element={<PermissionGuard moduleCode="reports"><Reports /></PermissionGuard>} />
        <Route path="/analytics" element={<PermissionGuard moduleCode="reports"><Analytics /></PermissionGuard>} />
        <Route path="/accounts" element={<PermissionGuard moduleCode="accounts"><AccountManagement /></PermissionGuard>} />
        <Route path="/account-management" element={<PermissionGuard moduleCode="accounts"><AccountManagement /></PermissionGuard>} />
        <Route path="/quan-ly-tai-khoan" element={<PermissionGuard moduleCode="accounts"><AccountManagement /></PermissionGuard>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  props: { children: React.ReactNode };
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center font-sans">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-md w-full">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">!</div>
            <h2 className="text-xl font-extrabold text-slate-800 mb-2">Đã xảy ra lỗi khi tải giao diện</h2>
            <p className="text-sm text-slate-600 mb-6">{this.state.error?.message || "Vui lòng thử lại sau hoặc tải lại trang."}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <UnsavedChangesProvider>
              <AppRoutes />
            </UnsavedChangesProvider>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}




