import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Filter, 
  FileText, 
  Plus, 
  Printer, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  Award, 
  Edit3, 
  Trash2, 
  Eye, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  RefreshCw,
  Sliders,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Calendar,
  AlertCircle,
  Building,
  UserCheck,
  Sparkles,
  Home,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import BackButton from '../components/ui/BackButton';
import { 
  KpiVcForm, 
  KpiVcPeriod, 
  KpiVcCriterion, 
  KpiVcCriteriaGroup, 
  KpiVcAuditLog 
} from '../types/kpiVc';
import { 
  subscribeVcForms, 
  subscribeVcPeriods, 
  subscribeVcCriteria, 
  subscribeVcGroups, 
  subscribeVcAuditLogs, 
  seedVcInitialDataIfNeeded,
  deleteVcForm,
  toggleLockVcForm
} from '../services/kpiVcService';
import { 
  getEligibleVcTeachers,
  resolveVcTeacherPosition,
  resolveVcTeacherDepartment,
  DEFAULT_VC_GROUPS,
  DEFAULT_VC_CRITERIA,
  DEFAULT_VC_PERIODS
} from '../lib/kpiVcData';
import KpiVcDocumentModal from '../components/kpiVc/KpiVcDocumentModal';
import KpiVcCriteriaManagerModal from '../components/kpiVc/KpiVcCriteriaManagerModal';
import KpiVcPeriodManagerModal from '../components/kpiVc/KpiVcPeriodManagerModal';
import KpiVcPrintModal from '../components/kpiVc/KpiVcPrintModal';
import { exportVcSummaryToExcel } from '../utils/kpiVcExport';
import { exportVcFormToWord } from '../utils/kpiWordExport';

export default function KpiTeacherStaff() {
  const navigate = useNavigate();
  const { teachers, departments } = useAppContext();
  const { user } = useAuth();

  // Permissions
  const isAdmin = user?.id === 'admin' || user?.role === 'admin' || user?.role === 'BGH' || (user?.position || '').toLowerCase().includes('hiệu trưởng');

  const canDeleteForm = (form: KpiVcForm) => {
    if (!user) return false;
    if (user.id === 'admin' || user.role === 'admin' || user.role === 'BGH' || user.role === 'TTCM' || user.role === 'CBQL' || user.role === 'manager') return true;
    const pos = (user.position || '').toLowerCase();
    if (pos.includes('hiệu trưởng') || pos.includes('tổ trưởng') || pos.includes('quản lý') || pos.includes('bgh')) return true;
    if (form.employeeId === user.id && (form.status === 'self_evaluated' || !form.status)) return true;
    return false;
  };

  // Delete modal state
  const [formToDelete, setFormToDelete] = useState<KpiVcForm | null>(null);
  const [isDeletingForm, setIsDeletingForm] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Firestore Data State
  const [forms, setForms] = useState<KpiVcForm[]>([]);
  const [periods, setPeriods] = useState<KpiVcPeriod[]>([]);
  const [criteria, setCriteria] = useState<KpiVcCriterion[]>([]);
  const [groups, setGroups] = useState<KpiVcCriteriaGroup[]>([]);
  const [auditLogs, setAuditLogs] = useState<KpiVcAuditLog[]>([]);

  // Filters & Search
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('all');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isDocModalOpen, setIsDocModalOpen] = useState<boolean>(false);
  const [docModalMode, setDocModalMode] = useState<'create' | 'edit' | 'self_eval' | 'leader_eval' | 'view'>('create');
  const [selectedFormForDoc, setSelectedFormForDoc] = useState<KpiVcForm | null>(null);

  const [isCriteriaManagerOpen, setIsCriteriaManagerOpen] = useState<boolean>(false);
  const [isPeriodManagerOpen, setIsPeriodManagerOpen] = useState<boolean>(false);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [selectedFormForPrint, setSelectedFormForPrint] = useState<KpiVcForm | null>(null);

  const [exportingWordId, setExportingWordId] = useState<string | null>(null);

  const handleExportWord = async (form: KpiVcForm) => {
    if (!form || !form.id) {
      alert('Vui lòng lưu phiếu trước khi xuất Word.');
      return;
    }
    setExportingWordId(form.id);
    try {
      await exportVcFormToWord(form);
    } catch (err) {
      alert('Lỗi xuất file Word: ' + (err instanceof Error ? err.message : 'Không xác định'));
    } finally {
      setExportingWordId(null);
    }
  };

  // Eligible teacher list (Teachers & Staff, excluding BGH/Principal)
  const eligibleTeachers = useMemo(() => {
    return getEligibleVcTeachers(teachers);
  }, [teachers]);

  // Initial Firestore subscriptions
  useEffect(() => {
    seedVcInitialDataIfNeeded();

    const unsubForms = subscribeVcForms(setForms);
    const unsubPeriods = subscribeVcPeriods((pList) => {
      setPeriods(pList);
    });
    const unsubCriteria = subscribeVcCriteria(setCriteria);
    const unsubGroups = subscribeVcGroups(setGroups);
    const unsubLogs = subscribeVcAuditLogs(setAuditLogs);

    return () => {
      unsubForms();
      unsubPeriods();
      unsubCriteria();
      unsubGroups();
      unsubLogs();
    };
  }, []);

  // Filtered forms
  const filteredForms = useMemo(() => {
    return forms.filter(f => {
      const matchPeriod = selectedPeriodId === 'all' || f.periodId === selectedPeriodId;
      const matchStatus = statusFilter === 'all' || 
        (statusFilter === 'completed' ? (f.status === 'completed' || f.status === 'self_evaluated') : f.status === statusFilter);
      const matchClass = classificationFilter === 'all' || (
        f.leaderClassification === classificationFilter || 
        (!f.leaderClassification && f.selfClassification === classificationFilter)
      );
      
      let matchDept = true;
      if (selectedDeptId !== 'all') {
        const teacher = teachers.find(t => t.id === f.employeeId);
        matchDept = teacher?.departmentId === selectedDeptId || f.departmentId === selectedDeptId;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || (
        (f.employeeName || '').toLowerCase().includes(q) ||
        (f.employeeCode || '').toLowerCase().includes(q) ||
        (f.position || '').toLowerCase().includes(q) ||
        (f.department || '').toLowerCase().includes(q)
      );

      return matchPeriod && matchStatus && matchClass && matchDept && matchSearch;
    });
  }, [forms, selectedPeriodId, statusFilter, classificationFilter, selectedDeptId, searchQuery, teachers]);

  // Statistics
  const stats = useMemo(() => {
    const totalForms = filteredForms.length;
    const completedCount = filteredForms.filter(f => f.status === 'completed' || f.status === 'locked').length;
    const evaluatingCount = filteredForms.filter(f => f.status === 'draft' || f.status === 'self_evaluated').length;
    
    let sumScore = 0;
    filteredForms.forEach(f => {
      sumScore += Number(f.totalScore) || 0;
    });
    const avgScore = totalForms > 0 ? (Math.round((sumScore / totalForms) * 10) / 10) : 0;

    const excellentCount = filteredForms.filter(f => (f.leaderClassification || f.selfClassification)?.includes('xuất sắc')).length;
    const goodCount = filteredForms.filter(f => (f.leaderClassification || f.selfClassification)?.includes('tốt')).length;
    const passCount = filteredForms.filter(f => (f.leaderClassification || f.selfClassification) === 'Hoàn thành nhiệm vụ').length;
    const failCount = filteredForms.filter(f => (f.leaderClassification || f.selfClassification)?.includes('Không')).length;

    return {
      totalForms,
      completedCount,
      evaluatingCount,
      avgScore,
      excellentCount,
      goodCount,
      passCount,
      failCount
    };
  }, [filteredForms]);

  // Check if current user has a form in the selected period
  const myFormInPeriod = useMemo(() => {
    if (!user) return null;
    return forms.find(f => f.employeeId === user.id && (selectedPeriodId === 'all' || f.periodId === selectedPeriodId));
  }, [user, forms, selectedPeriodId]);

  // Open Document Handlers
  const handleOpenCreateModal = () => {
    setSelectedFormForDoc(null);
    setDocModalMode('create');
    setIsDocModalOpen(true);
  };

  const handleOpenDoc = (form: KpiVcForm, mode: 'edit' | 'self_eval' | 'leader_eval' | 'view') => {
    setSelectedFormForDoc(form);
    setDocModalMode(mode);
    setIsDocModalOpen(true);
  };

  const handleOpenPrint = (form: KpiVcForm) => {
    setSelectedFormForPrint(form);
    setIsPrintModalOpen(true);
  };

  const handleRequestDeleteForm = (form: KpiVcForm) => {
    setDeleteError(null);
    setFormToDelete(form);
  };

  const handleConfirmDeleteForm = async () => {
    if (!formToDelete) return;
    setIsDeletingForm(true);
    setDeleteError(null);
    try {
      await deleteVcForm(formToDelete.id, {
        id: user?.id || 'admin',
        name: user?.name || 'Admin',
        role: user?.role
      });
      // Update local state immediately
      setForms(prev => prev.filter(f => f.id !== formToDelete.id));
      setFormToDelete(null);
    } catch (err: any) {
      console.error('Lỗi khi xóa phiếu KPI:', err);
      setDeleteError(err.message || 'Không thể xóa phiếu đánh giá. Vui lòng thử lại.');
    } finally {
      setIsDeletingForm(false);
    }
  };

  const handleToggleLock = async (form: KpiVcForm) => {
    const isLocked = form.status === 'locked';
    try {
      await toggleLockVcForm(form.id, !isLocked, {
        id: user?.id || 'admin',
        name: user?.name || 'Admin',
        role: user?.role
      });
      setForms(prev => prev.map(f => f.id === form.id ? { ...f, status: isLocked ? 'completed' : 'locked' } : f));
    } catch (err: any) {
      alert(err.message || 'Lỗi khi thay đổi trạng thái khóa');
    }
  };

  const activePeriodObj = periods.find(p => p.id === selectedPeriodId) || periods[0];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-12">
      
      {/* 0. NAVIGATION / BREADCRUMB ROW */}
      <div className="flex items-center gap-4">
        <BackButton />
      </div>

      {/* 1. TOP HEADER BANNER */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-blue-800/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
              <Award size={14} /> Mẫu chuẩn Viên chức Giáo viên & Nhân viên (PDF 15-15-70)
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
              ĐÁNH GIÁ KPI GIÁO VIÊN – NHÂN VIÊN
            </h1>
            <p className="text-blue-200 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Trường THPT Sơn Lương • Áp dụng đối với viên chức không giữ chức vụ lãnh đạo, quản lý. Cấu trúc thang điểm 100 gồm Nhóm I (15đ), Nhóm II (15đ), Nhóm III (70đ với 5 mức thực hiện nhiệm vụ).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Nút Quay lại Trang chủ */}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold rounded-xl border border-white/20 transition-all cursor-pointer backdrop-blur-xs"
              title="Trở về Trang chủ Dashboard"
            >
              <Home size={16} /> Trang chủ
            </button>

            {/* Tạo phiếu mới */}
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg shadow-blue-500/30 transition-all cursor-pointer"
            >
              <Plus size={18} /> Tạo phiếu đánh giá mới
            </button>

            {/* Quản lý tiêu chí (Admin only) */}
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setIsCriteriaManagerOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold rounded-xl border border-white/20 transition-all cursor-pointer backdrop-blur-xs"
                >
                  <Sliders size={16} /> Quản lý tiêu chí KPI
                </button>
                <button
                  type="button"
                  onClick={() => setIsPeriodManagerOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold rounded-xl border border-white/20 transition-all cursor-pointer backdrop-blur-xs"
                >
                  <Calendar size={16} /> Quản lý kỳ đánh giá
                </button>
              </>
            )}

            {/* Xuất Excel */}
            <button
              type="button"
              onClick={() => exportVcSummaryToExcel(filteredForms, activePeriodObj?.name, activePeriodObj?.academicYear)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-md"
            >
              <FileSpreadsheet size={16} /> Xuất Excel tổng hợp
            </button>
          </div>
        </div>

        {/* Trang trí background */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/2 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* 2. CARD NHẮC NHỞ TỰ ĐÁNH GIÁ (NẾU LÀ GIÁO VIÊN ĐĂNG NHẬP) */}
      {!isAdmin && user && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
              <UserCheck size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                Hồ sơ tự đánh giá của bạn: <span className="text-blue-700 underline">{user.name}</span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {myFormInPeriod 
                  ? `Bạn đã có phiếu đánh giá trong ${myFormInPeriod.periodName}. Tổng điểm hiện tại: ${myFormInPeriod.totalScore}/100 (${myFormInPeriod.selfClassification}).`
                  : `Bạn chưa hoàn thành tự chấm điểm cho kỳ ${activePeriodObj?.name || 'này'}. Vui lòng tạo phiếu để hoàn thành.`}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {myFormInPeriod ? (
              <button
                type="button"
                onClick={() => handleOpenDoc(myFormInPeriod, 'self_eval')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Edit3 size={15} /> Mở phiếu tự chấm điểm
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus size={15} /> Bắt đầu tự chấm điểm ngay
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. THỐNG KÊ METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Tổng số phiếu */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số phiếu</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900">{stats.totalForms}</span>
              <span className="text-xs text-slate-500 font-medium">/ {eligibleTeachers.length} GV-NV</span>
            </div>
          </div>
        </div>

        {/* Đã hoàn thành */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đã hoàn thành</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-600">{stats.completedCount}</span>
              <span className="text-xs text-slate-500 font-medium">phiếu</span>
            </div>
          </div>
        </div>

        {/* Điểm TB toàn trường */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Điểm TB tự chấm</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-indigo-600">{stats.avgScore}</span>
              <span className="text-xs text-slate-400 font-medium">/ 100</span>
            </div>
          </div>
        </div>

        {/* Xuất sắc & Tốt */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Xuất sắc & Tốt</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-amber-600">
                {stats.excellentCount + stats.goodCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">cán bộ</span>
            </div>
          </div>
        </div>

      </div>

      {/* 4. THANH CÔNG CỤ TÌM KIẾM & BỘ LỌC */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Chọn Kỳ đánh giá */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Kỳ đánh giá:
            </label>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">Tất cả kỳ đánh giá</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.academicYear})
                </option>
              ))}
            </select>
          </div>

          {/* Chọn Tổ / Đơn vị */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Tổ / Bộ môn:
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">Tất cả tổ / đơn vị</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn Xếp loại */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Xếp loại:
            </label>
            <select
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">Tất cả xếp loại</option>
              <option value="Hoàn thành xuất sắc nhiệm vụ">Hoàn thành xuất sắc nhiệm vụ</option>
              <option value="Hoàn thành tốt nhiệm vụ">Hoàn thành tốt nhiệm vụ</option>
              <option value="Hoàn thành nhiệm vụ">Hoàn thành nhiệm vụ</option>
              <option value="Không hoàn thành nhiệm vụ">Không hoàn thành nhiệm vụ</option>
            </select>
          </div>

          {/* Trạng thái phiếu */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Trạng thái:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="completed">Đã hoàn thành</option>
              <option value="draft">Bản nháp</option>
              <option value="locked">Đã khóa</option>
            </select>
          </div>

          {/* Tìm kiếm */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Tìm kiếm:
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Họ tên, mã, chức vụ..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

        </div>
      </div>

      {/* 5. BẢNG DANH SÁCH PHIẾU ĐÁNH GIÁ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">
              Danh sách Phiếu đánh giá KPI Viên chức ({filteredForms.length})
            </h2>
          </div>

          <span className="text-xs text-slate-500">
            Hiển thị theo thứ tự cập nhật mới nhất
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3.5 w-12 text-center">STT</th>
                <th className="p-3.5 min-w-[200px]">Cán bộ / Giáo viên / Nhân viên</th>
                <th className="p-3.5 min-w-[150px]">Đơn vị công tác</th>
                <th className="p-3.5 min-w-[140px]">Kỳ đánh giá</th>
                <th className="p-3.5 text-center w-32 bg-blue-50/70 text-blue-900 font-bold">
                  Điểm tự đánh giá
                </th>
                <th className="p-3.5 text-center w-36 bg-indigo-50/70 text-indigo-900 font-bold">
                  Điểm lãnh đạo đánh giá
                </th>
                <th className="p-3.5 text-center min-w-[180px]">Xếp loại</th>
                <th className="p-3.5 text-center w-28">Trạng thái</th>
                <th className="p-3.5 text-center w-36">Thao tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredForms.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText size={32} className="text-slate-300" />
                      <p className="font-semibold text-slate-600">Chưa có phiếu đánh giá nào phù hợp với bộ lọc.</p>
                      <p className="text-xs text-slate-400">Nhấn nút "+ Tạo phiếu đánh giá mới" để bắt đầu.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredForms.map((form, idx) => {
                  const groupI = form.groupScores?.group_I ?? 0;
                  const groupII = form.groupScores?.group_II ?? 0;
                  const groupIII = form.groupScores?.group_III ?? 0;
                  const isLocked = form.status === 'locked';

                  // Colors for classifications
                  const finalClassification = form.leaderClassification || form.selfClassification || 'Hoàn thành tốt nhiệm vụ';
                  let classColor = 'bg-blue-50 text-blue-800 border-blue-200';
                  if (finalClassification.includes('xuất sắc')) classColor = 'bg-purple-50 text-purple-800 border-purple-200 font-bold';
                  if (finalClassification.includes('Không')) classColor = 'bg-rose-50 text-rose-800 border-rose-200';

                  return (
                    <tr key={form.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-center font-bold text-slate-500">
                        {idx + 1}
                      </td>

                      {/* Thông tin nhân sự */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {form.employeeName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer"
                               onClick={() => handleOpenDoc(form, 'view')}>
                              {form.employeeName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {form.position} {form.employeeCode ? `• ${form.employeeCode}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Đơn vị */}
                      <td className="p-3.5 text-slate-700 font-medium">
                        {form.department}
                      </td>

                      {/* Kỳ */}
                      <td className="p-3.5">
                        <span className="font-semibold text-slate-900 block">{form.periodName}</span>
                        <span className="text-[11px] text-slate-500">{form.academicYear}</span>
                      </td>

                      {/* Điểm tự đánh giá */}
                      <td className="p-3.5 text-center font-extrabold text-blue-800 bg-blue-50/30 text-sm">
                        {form.totalScore}<span className="text-[10px] font-normal text-slate-400">/100</span>
                      </td>

                      {/* Điểm lãnh đạo đánh giá */}
                      <td className="p-3.5 text-center font-extrabold text-indigo-800 bg-indigo-50/30 text-sm">
                        {form.managerTotalScore !== null && form.managerTotalScore !== undefined ? (
                          <>
                            {form.managerTotalScore}<span className="text-[10px] font-normal text-slate-400">/100</span>
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs font-normal">Chưa chấm</span>
                        )}
                      </td>

                      {/* Xếp loại */}
                      <td className="p-3.5 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] border ${classColor}`}>
                          {finalClassification}
                        </span>
                      </td>

                      {/* Trạng thái */}
                      <td className="p-3.5 text-center">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <Lock size={12} /> Đã khóa
                          </span>
                        ) : (form.status === 'completed' || form.status === 'self_evaluated') ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} /> Hoàn thành
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            <Clock size={12} /> Bản nháp
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          
                          {/* Xem / Chi tiết */}
                          <button
                            type="button"
                            onClick={() => handleOpenDoc(form, 'view')}
                            title="Xem chi tiết phiếu"
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Sửa / Chấm điểm */}
                          {(!isLocked || isAdmin) && (
                            <button
                              type="button"
                              onClick={() => handleOpenDoc(form, 'edit')}
                              title="Chỉnh sửa / Tự chấm"
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit3 size={15} />
                            </button>
                          )}

                          {/* In phiếu A4 */}
                          <button
                            type="button"
                            onClick={() => handleOpenPrint(form)}
                            title="In phiếu A4 chuẩn"
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer size={15} />
                          </button>

                          {/* Xuất Word (.doc) */}
                          <button
                            type="button"
                            onClick={() => handleExportWord(form)}
                            disabled={exportingWordId === form.id}
                            title="Xuất Word (.doc)"
                            className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {exportingWordId === form.id ? (
                              <Loader2 size={15} className="animate-spin text-blue-600" />
                            ) : (
                              <FileText size={15} />
                            )}
                          </button>

                          {/* Khóa / Mở khóa (Admin) */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleToggleLock(form)}
                              title={isLocked ? "Mở khóa phiếu" : "Khóa phiếu"}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isLocked ? 'text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {isLocked ? <Unlock size={15} /> : <Lock size={15} />}
                            </button>
                          )}

                          {/* Xóa phiếu */}
                          {canDeleteForm(form) && (
                            <button
                              type="button"
                              onClick={() => handleRequestDeleteForm(form)}
                              title="Xóa phiếu đánh giá"
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* MODAL VĂN BẢN ĐÁNH GIÁ (DOCUMENT MODAL) */}
      <KpiVcDocumentModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        form={selectedFormForDoc}
        mode={docModalMode}
        teachers={teachers}
        departments={departments}
        periods={periods}
        criteria={criteria}
        groups={groups}
        onSaved={(formId) => {
          setIsDocModalOpen(false);
          setSelectedPeriodId('all');
          setStatusFilter('all');
          setClassificationFilter('all');
          setSelectedDeptId('all');
          setSearchQuery('');
        }}
        onPrintRequest={(f) => {
          setIsDocModalOpen(false);
          setSelectedFormForPrint(f);
          setIsPrintModalOpen(true);
        }}
      />

      {/* MODAL QUẢN LÝ TIÊU CHÍ (CRITERIA MANAGER MODAL) */}
      <KpiVcCriteriaManagerModal
        isOpen={isCriteriaManagerOpen}
        onClose={() => setIsCriteriaManagerOpen(false)}
        criteria={criteria}
        groups={groups}
        onRefresh={() => {}}
      />

      {/* MODAL QUẢN LÝ KỲ ĐÁNH GIÁ (PERIOD MANAGER MODAL) */}
      <KpiVcPeriodManagerModal
        isOpen={isPeriodManagerOpen}
        onClose={() => setIsPeriodManagerOpen(false)}
        periods={periods}
      />

      {/* MODAL IN PHIẾU A4 (PRINT MODAL) */}
      <KpiVcPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        form={selectedFormForPrint}
      />

      {/* MODAL XÁC NHẬN XÓA PHIẾU */}
      {formToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Xác nhận xóa phiếu KPI</h3>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-1">
              <p className="font-semibold">
                Bạn có chắc chắn muốn xóa phiếu đánh giá KPI của:
              </p>
              <p className="text-sm font-bold text-rose-700">
                👤 {formToDelete.employeeName}
              </p>
              <p className="text-slate-600">
                Kỳ đánh giá: <span className="font-medium text-slate-800">{formToDelete.periodName}</span>
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-xs text-red-800 font-medium">
                ⚠️ {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingForm}
                onClick={() => setFormToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeletingForm}
                onClick={handleConfirmDeleteForm}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingForm ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Xác nhận xóa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
