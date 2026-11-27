import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import { AppProvider, useAppContext, LazyAppCollectionKey } from './store/AppContext';
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
import { ShieldAlert, AlertTriangle, RefreshCw, X } from 'lucide-react';
import {
  firestoreRuntimeState,
  enableFirestoreMemoryFallback,
  isFirestoreRuntimeStorageError
} from './lib/firebase';
import { logClientError, ClientErrorRecord } from './utils/errorLogger';
import {
  formatSyncTimestamp,
  getQuotaManagerState,
  subscribeQuotaManager,
  FirestoreQuotaState
} from './utils/firestoreQuotaManager';

function PermissionGuard({ moduleCode, children }: { moduleCode: ModuleCode; children: React.ReactNode }) {
  const { canAccessModule, isAdmin, permissionsReady } = usePermission();
  if (isAdmin || moduleCode === 'home') {
    return <>{children}</>;
  }
  if (!permissionsReady) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-700">Đang đồng bộ phân quyền tài khoản từ máy chủ...</p>
        <p className="text-xs text-slate-400 mt-1">Vui lòng chờ trong giây lát</p>
      </div>
    );
  }
  if (canAccessModule(moduleCode)) {
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
  const {
    user,
    authLoading,
    permissionSyncError,
    lastPermissionSyncedAt,
    isRefreshingPermissions,
    refreshPermissions
  } = useAuth();
  const { ensureCollectionsLoaded } = useAppContext();
  const location = useLocation();
  const [quotaState, setQuotaState] = React.useState<FirestoreQuotaState>(() => getQuotaManagerState());
  const [dismissedErrorKey, setDismissedErrorKey] = React.useState<string | null>(null);

  // Lazy-load ONLY the AppContext collections required by the active route (cached for 5 min -> 0 reads on revisit)
  React.useEffect(() => {
    if (!user?.id) return;
    const p = location.pathname.toLowerCase();
    const needed: LazyAppCollectionKey[] = [];
    if (p.startsWith('/kpi-nv') || p.startsWith('/kpi-nhan-vien') || p.startsWith('/kpi-staff')) {
      needed.push('kpiStaff');
    } else if (p.startsWith('/calendar')) {
      needed.push('calendarEvents');
    } else if (p.startsWith('/leaves')) {
      needed.push('leaveRecords', 'attendance');
    } else if (p.startsWith('/reports') || p.startsWith('/analytics')) {
      needed.push('reports');
    } else if (
      p.startsWith('/youth-discipline') ||
      p.startsWith('/doan-tn/nen-nep') ||
      p.startsWith('/nen-nep-hoc-sinh') ||
      p.startsWith('/doan-thanh-nien')
    ) {
      needed.push('workAssignments');
    } else if (p.startsWith('/departments')) {
      needed.push('tasks');
    }
    if (needed.length > 0) {
      ensureCollectionsLoaded(needed).catch(() => {});
    }
  }, [user?.id, location.pathname, ensureCollectionsLoaded]);

  React.useEffect(() => {
    return subscribeQuotaManager((nextState) => {
      setQuotaState(nextState);
      if (!nextState.quotaExceeded) {
        setDismissedErrorKey(null);
      }
    });
  }, []);

  // Auto-reset dismissal when sync succeeds and clears errors
  React.useEffect(() => {
    if (!quotaState.quotaExceeded && !permissionSyncError) {
      setDismissedErrorKey(null);
    }
  }, [quotaState.quotaExceeded, permissionSyncError]);

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

  const effectiveAlertMessage = quotaState.quotaExceeded
    ? 'Máy chủ đang tạm thời vượt hạn mức truy cập. Hệ thống đang duy trì phiên làm việc hiện tại.'
    : permissionSyncError;
  const activeErrorKey = effectiveAlertMessage
    ? `${quotaState.quotaExceeded ? 'quota' : 'perm'}:${quotaState.lastErrorAt || ''}:${effectiveAlertMessage}`
    : null;
  const showSyncAlert = Boolean(effectiveAlertMessage && activeErrorKey !== dismissedErrorKey);
  const effectiveLastSyncedAt = Math.max(lastPermissionSyncedAt || 0, quotaState.lastSyncedAt || 0) || null;
  const isRetrying = isRefreshingPermissions || quotaState.isRetrying;

  const handleManualRetry = async () => {
    setDismissedErrorKey(null);
    await refreshPermissions({ manual: true });
  };

  return (
    <Layout>
      {showSyncAlert && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-xs leading-relaxed">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">
                {effectiveAlertMessage}
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Đồng bộ thành công gần nhất:{' '}
                <span className="font-semibold">{formatSyncTimestamp(effectiveLastSyncedAt)}</span>
                {quotaState.quotaExceeded && (
                  <span className="ml-1.5 text-amber-700">
                    • Dữ liệu hiện tại được giữ nguyên từ bộ nhớ đệm, không mất phiên đăng nhập.
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              disabled={isRetrying}
              onClick={handleManualRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-[11px] font-bold cursor-pointer transition-colors"
            >
              <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
              {isRetrying ? 'Đang đồng bộ...' : 'Thử đồng bộ lại'}
            </button>
            <button
              type="button"
              onClick={() => setDismissedErrorKey(activeErrorKey)}
              aria-label="Đóng cảnh báo"
              className="p-1 rounded-lg text-amber-700 hover:bg-amber-100 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      <Routes>
        <Route path="/" element={<PermissionGuard moduleCode="home"><Dashboard /></PermissionGuard>} />
        
        {/* KPI Modules */}
        <Route path="/kpi-cbql" element={<PermissionGuard moduleCode="kpi_cbql"><KpiCbql /></PermissionGuard>} />
        <Route path="/kpi-gvnv" element={<PermissionGuard moduleCode="kpi_gvnv"><KpiTeacherStaff /></PermissionGuard>} />
        <Route path="/kpi-nv" element={<PermissionGuard moduleCode="kpi_nv"><KpiStaff /></PermissionGuard>} />
        <Route path="/kpi-nhan-vien" element={<PermissionGuard moduleCode="kpi_nv"><KpiStaff /></PermissionGuard>} />
        <Route path="/kpi-staff" element={<PermissionGuard moduleCode="kpi_nv"><KpiStaff /></PermissionGuard>} />
        
        {/* Nền nếp & Đoàn Thanh niên */}
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

function StorageHealthBanner() {
  const [notice, setNotice] = React.useState<{
    message: string;
    needsReloadToMemory: boolean;
  } | null>(() => {
    if (firestoreRuntimeState.isStorageConstrained && firestoreRuntimeState.warningMessage) {
      return {
        message: firestoreRuntimeState.warningMessage,
        needsReloadToMemory: false
      };
    }
    return null;
  });

  React.useEffect(() => {
    const handleFirestoreStorageError = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      setNotice({
        message:
          detail?.message ||
          'Bộ nhớ cục bộ trình duyệt đã đầy (QuotaExceededError). Dữ liệu máy chủ vẫn an toàn. Hãy chuyển sang chế độ bộ nhớ tạm để tiếp tục làm việc ổn định.',
        needsReloadToMemory: true
      });
    };

    const handleAppStorageWarning = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      setNotice((prev) =>
        prev?.needsReloadToMemory
          ? prev
          : {
              message:
                detail?.message ||
                'Bộ nhớ trình duyệt trên máy tính này gần đầy. Hệ thống đã chuyển sang chế độ an toàn để bảo toàn dữ liệu.',
              needsReloadToMemory: false
            }
      );
    };

    window.addEventListener('firestore_storage_error', handleFirestoreStorageError);
    window.addEventListener('app_storage_warning', handleAppStorageWarning);
    return () => {
      window.removeEventListener('firestore_storage_error', handleFirestoreStorageError);
      window.removeEventListener('app_storage_warning', handleAppStorageWarning);
    };
  }, []);

  if (!notice) return null;

  const handleSwitchToMemoryMode = () => {
    enableFirestoreMemoryFallback(
      'Hệ thống đang chạy ở chế độ bộ nhớ tạm an toàn do bộ nhớ cục bộ trình duyệt bị hạn chế. Dữ liệu vẫn đồng bộ trực tuyến bình thường.'
    );
    window.location.reload();
  };

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-[9999] max-w-md bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl shadow-xl p-4 font-sans"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-extrabold text-amber-900 mb-1">
            {notice.needsReloadToMemory
              ? 'Cảnh báo bộ nhớ lưu trữ trình duyệt'
              : 'Thông báo chế độ bộ nhớ tạm an toàn'}
          </p>
          <p className="text-xs text-amber-800 leading-relaxed">{notice.message}</p>
          {notice.needsReloadToMemory && (
            <button
              type="button"
              onClick={handleSwitchToMemoryMode}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw size={13} />
              Chuyển sang chế độ bộ nhớ tạm an toàn
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setNotice(null)}
          aria-label="Đóng thông báo"
          className="text-amber-700 hover:text-amber-900 p-1 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer shrink-0"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorRecord: ClientErrorRecord | null;
  isStorageError: boolean;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  declare props: { children: React.ReactNode };
  declare setState: (
    state:
      | Partial<ErrorBoundaryState>
      | ((prevState: Readonly<ErrorBoundaryState>) => Partial<ErrorBoundaryState> | null)
      | null,
    callback?: () => void
  ) => void;
  state: ErrorBoundaryState = { hasError: false, error: null, errorRecord: null, isStorageError: false };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorRecord: null, isStorageError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const isStorage = isFirestoreRuntimeStorageError(error);
    if (isStorage) {
      enableFirestoreMemoryFallback(
        'Hệ thống đã tự động chuyển sang chế độ bộ nhớ tạm an toàn do bộ nhớ lưu trữ trình duyệt đã đầy. Toàn bộ dữ liệu máy chủ vẫn được bảo toàn.'
      );
    }
    return { hasError: true, error, isStorageError: isStorage };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const record = logClientError({
      error,
      componentStack: errorInfo.componentStack,
      source: 'app_error_boundary'
    });
    this.setState({ errorRecord: record });
  }

  handleSafeRecovery = () => {
    if (this.state.isStorageError) {
      enableFirestoreMemoryFallback(
        'Hệ thống đang chạy ở chế độ bộ nhớ tạm an toàn do bộ nhớ cục bộ trình duyệt bị hạn chế.'
      );
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const rec = this.state.errorRecord;
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center font-sans">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-md w-full">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl ${
              this.state.isStorageError ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600'
            }`}>
              !
            </div>
            <h2 className="text-xl font-extrabold text-slate-800 mb-2">
              {this.state.isStorageError
                ? 'Bộ nhớ lưu trữ trình duyệt đã đầy'
                : 'Đã xảy ra lỗi khi tải giao diện'}
            </h2>
            {this.state.isStorageError ? (
              <div className="text-sm text-slate-600 mb-6 space-y-2 text-left bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                <p>
                  Trình duyệt trên máy tính này không còn đủ dung lượng bộ nhớ cục bộ (Local Storage) cho chế độ lưu ngoại tuyến của cơ sở dữ liệu.
                </p>
                <p className="font-semibold text-slate-700">
                  Toàn bộ dữ liệu nhà trường, tài khoản đăng nhập và dữ liệu đang chờ đồng bộ vẫn được giữ nguyên an toàn.
                </p>
                <p className="text-xs text-slate-500">
                  Nhấn nút bên dưới để mở lại hệ thống ở chế độ bộ nhớ tạm trực tuyến (không cần lưu ngoại tuyến).
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <p className="text-sm text-slate-600">
                  {this.state.error?.message || "Vui lòng thử lại sau hoặc tải lại trang."}
                </p>
                {rec && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-[11px] text-slate-600 space-y-1 font-mono">
                    <p><strong className="text-slate-800">Mã lỗi:</strong> {rec.errorName} ({rec.componentName})</p>
                    <p><strong className="text-slate-800">Phiên bản:</strong> {rec.appVersion}</p>
                    <p><strong className="text-slate-800">Trình duyệt:</strong> {rec.browserName} {rec.browserVersion}</p>
                  </div>
                )}
              </div>
            )}
            <button 
              onClick={this.handleSafeRecovery} 
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
            >
              {this.state.isStorageError
                ? 'Tiếp tục với chế độ bộ nhớ tạm an toàn'
                : 'Tải lại trang'}
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
              <StorageHealthBanner />
            </UnsavedChangesProvider>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}




