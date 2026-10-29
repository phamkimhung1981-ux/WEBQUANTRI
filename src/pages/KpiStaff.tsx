import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import { canEditOrDelete, isProductionWeb } from '../utils/envUtils';
import { 
  KpiStaffPeriod, 
  KpiStaffForm, 
  StaffPositionKey 
} from '../types/kpiStaff';
import { 
  DEFAULT_STAFF_PERIODS, 
  POSITION_CONFIGS, 
  getEligibleStaffMembers,
  getClassificationByScore
} from '../lib/kpiStaffData';
import { exportStaffSummaryToExcel, exportStaffFormToWord } from '../utils/kpiStaffExport';
import { 
  deleteAllStaffFormsFromFirestore, 
  deleteStaffFormFromFirestore, 
  saveStaffFormsToCache 
} from '../services/kpiStaffService';

import KpiStaffPeriodManagerModal from '../components/kpiStaff/KpiStaffPeriodManagerModal';
import KpiStaffDocumentModal from '../components/kpiStaff/KpiStaffDocumentModal';
import KpiStaffFormModal from '../components/kpiStaff/KpiStaffFormModal';
import KpiStaffPrintModal from '../components/kpiStaff/KpiStaffPrintModal';

import { 
  UserCheck, Calendar, FileSpreadsheet, Plus, Search, 
  Award, Edit3, Printer, Trash2, 
  TrendingUp, Users, FileText, Lock
} from 'lucide-react';

const getTtcmEvaluationBadge = (f: KpiStaffForm) => {
  const hasScore = typeof f.ttcmTotalScore === 'number' && f.ttcmTotalScore !== null && !isNaN(f.ttcmTotalScore);
  if (hasScore) {
    const isConfirmed = f.status === 'completed' || f.status === 'locked' || f.ttcmStatus === 'Đã xác nhận';
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-block ${
          isConfirmed 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-purple-50 text-purple-800 border-purple-200'
        }`}>
          {isConfirmed ? 'Đã xác nhận' : 'Đã đánh giá'}
        </span>
        <span className="text-xs font-black text-purple-950">{f.ttcmTotalScore} / 100đ</span>
      </div>
    );
  }
  if (f.status === 'self_evaluated' || f.status === 'submitted') {
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-amber-50 text-amber-800 border-amber-200 inline-block">
        Đang đánh giá
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium border bg-slate-50 text-slate-400 border-slate-200 inline-block">
      Chưa đánh giá
    </span>
  );
};

const getBghEvaluationBadge = (f: KpiStaffForm) => {
  const hasScore = typeof f.managerTotalScore === 'number' && f.managerTotalScore !== null && !isNaN(f.managerTotalScore);
  if (hasScore) {
    const isConfirmed = f.status === 'completed' || f.status === 'locked' || f.bghStatus === 'Đã xác nhận';
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-block ${
          isConfirmed 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-indigo-50 text-indigo-800 border-indigo-200'
        }`}>
          {isConfirmed ? 'Đã xác nhận' : 'Đã đánh giá'}
        </span>
        <span className="text-xs font-black text-indigo-950">{f.managerTotalScore} / 100đ</span>
      </div>
    );
  }
  const hasTtcm = typeof f.ttcmTotalScore === 'number' && f.ttcmTotalScore !== null;
  if (hasTtcm || f.status === 'submitted') {
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-amber-50 text-amber-800 border-amber-200 inline-block">
        Đang đánh giá
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium border bg-slate-50 text-slate-400 border-slate-200 inline-block">
      Chưa đánh giá
    </span>
  );
};

export default function KpiStaff() {
  const { user } = useAuth();
  const isAdmin = user?.id === 'admin' || user?.role === 'admin' || user?.role === 'BGH' || (user?.position || '').toLowerCase().includes('hiệu trưởng');
  const { teachers, kpiStaffForms, setKpiStaffForms, kpiStaffPeriods, setKpiStaffPeriods } = useAppContext();

  // Active period state
  const periods: KpiStaffPeriod[] = kpiStaffPeriods && kpiStaffPeriods.length > 0 ? kpiStaffPeriods : DEFAULT_STAFF_PERIODS;

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(periods[0]?.id || 'period_staff_2026_2027');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState<boolean>(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState<boolean>(false);
  const [selectedFormForEdit, setSelectedFormForEdit] = useState<KpiStaffForm | null>(null);
  const [selectedFormForPrint, setSelectedFormForPrint] = useState<KpiStaffForm | null>(null);

  // Bulk Delete Modal State
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState<boolean>(false);
  const [deleteAllScope, setDeleteAllScope] = useState<'period' | 'all'>('period');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Single Form Delete Modal State
  const [formToDelete, setFormToDelete] = useState<KpiStaffForm | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState<boolean>(false);
  const [deleteSingleErrorMsg, setDeleteSingleErrorMsg] = useState<string>('');

  // Eligible Staff Members
  const eligibleStaff = useMemo(() => getEligibleStaffMembers(teachers), [teachers]);

  const eligibleStaffIds = useMemo(() => new Set(eligibleStaff.map(s => s.id)), [eligibleStaff]);
  const eligibleStaffCodes = useMemo(() => new Set(eligibleStaff.map(s => (s.code || '').toUpperCase()).filter(Boolean)), [eligibleStaff]);

  // Active Period
  const activePeriod = periods.find(p => p.id === selectedPeriodId) || periods[0];

  // Forms for active period strictly belonging to the staff group
  const activePeriodForms = useMemo(() => {
    return (kpiStaffForms || []).filter(f => {
      if (f.periodId !== selectedPeriodId) return false;
      const isEligible = 
        eligibleStaffIds.has(f.employeeId) || 
        (f.employeeCode && eligibleStaffCodes.has(f.employeeCode.toUpperCase())) ||
        (f.departmentId === 'd_van_phong' || (f.department || '').toLowerCase().includes('văn phòng')) ||
        (f.employeeCode || '').toUpperCase().startsWith('NV');
      return isEligible;
    });
  }, [kpiStaffForms, selectedPeriodId, eligibleStaffIds, eligibleStaffCodes]);

  // Filtered Forms
  const filteredForms = useMemo(() => {
    return activePeriodForms.filter(f => {
      const matchSearch = 
        f.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.employeeCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.position || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchPosition = positionFilter === 'all' || f.positionKey === positionFilter || (f.position || '').toLowerCase().includes(positionFilter.toLowerCase());
      const matchStatus = statusFilter === 'all' || f.status === statusFilter;

      return matchSearch && matchPosition && matchStatus;
    });
  }, [activePeriodForms, searchQuery, positionFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalStaffCount = eligibleStaff.length;
    const totalForms = activePeriodForms.length;
    const completedForms = activePeriodForms.filter(f => f.status === 'completed' || f.status === 'locked').length;

    let totalPoints = 0;
    let excellentCount = 0;
    let goodCount = 0;

    activePeriodForms.forEach(f => {
      const score = f.managerTotalScore ?? f.totalScore;
      totalPoints += score;
      if (score >= 90) excellentCount++;
      else if (score >= 80) goodCount++;
    });

    const avgScore = totalForms > 0 ? Math.round((totalPoints / totalForms) * 10) / 10 : 0;

    return {
      totalStaffCount,
      totalForms,
      completedForms,
      avgScore,
      excellentCount,
      goodCount
    };
  }, [eligibleStaff, activePeriodForms]);

  // Handlers
  const handleSavePeriod = (periodToSave: KpiStaffPeriod) => {
    const exists = periods.some(p => p.id === periodToSave.id);
    let updated: KpiStaffPeriod[];
    if (exists) {
      updated = periods.map(p => p.id === periodToSave.id ? periodToSave : p);
    } else {
      updated = [periodToSave, ...periods];
    }
    setKpiStaffPeriods(updated);
  };

  const handleDeletePeriod = (id: string) => {
    const updated = periods.filter(p => p.id !== id);
    setKpiStaffPeriods(updated);
    if (selectedPeriodId === id && updated.length > 0) {
      setSelectedPeriodId(updated[0].id);
    }
  };

  const handleCreateForms = (newForms: KpiStaffForm[]) => {
    const currentForms = kpiStaffForms || [];
    const map = new Map<string, KpiStaffForm>();
    currentForms.forEach(f => map.set(f.id || `${f.employeeId}_${f.periodId}`, f));
    newForms.forEach(f => map.set(f.id || `${f.employeeId}_${f.periodId}`, f));
    const merged = Array.from(map.values());
    setKpiStaffForms(merged);
  };

  const handleSaveForm = (updatedForm: KpiStaffForm) => {
    const currentForms = kpiStaffForms || [];
    const updated = currentForms.map(f => f.id === updatedForm.id ? updatedForm : f);
    setKpiStaffForms(updated);
    if (selectedFormForEdit?.id === updatedForm.id) {
      setSelectedFormForEdit(updatedForm);
    }
  };

  const handleDeleteForm = (f: KpiStaffForm) => {
    if (isProductionWeb()) return;
    setDeleteSingleErrorMsg('');
    setFormToDelete(f);
  };

  const handleConfirmDeleteAllForms = async () => {
    setIsDeleting(true);
    try {
      const scopePeriodId = deleteAllScope === 'period' ? selectedPeriodId : 'all';
      await deleteAllStaffFormsFromFirestore(scopePeriodId);

      let remainingForms: KpiStaffForm[] = [];
      if (deleteAllScope === 'period') {
        remainingForms = (kpiStaffForms || []).filter(f => f.periodId !== selectedPeriodId);
      } else {
        remainingForms = [];
      }

      setKpiStaffForms(remainingForms);
      saveStaffFormsToCache(remainingForms);
      setIsDeleteAllModalOpen(false);
    } catch (err) {
      console.error('Lỗi khi xóa tất cả phiếu KPI nhân viên:', err);
      // Still update local state and close modal to avoid hanging UI
      let remainingForms: KpiStaffForm[] = [];
      if (deleteAllScope === 'period') {
        remainingForms = (kpiStaffForms || []).filter(f => f.periodId !== selectedPeriodId);
      } else {
        remainingForms = [];
      }
      setKpiStaffForms(remainingForms);
      saveStaffFormsToCache(remainingForms);
      setIsDeleteAllModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Banner Header */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-700/80 rounded-full text-xs font-extrabold text-emerald-200 border border-emerald-500/30">
              <UserCheck size={14} /> SỞ GD&ĐT PHÚ THỌ - THPT SƠN LƯƠNG
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              PHIẾU ĐÁNH GIÁ, CHẤM ĐIỂM KPI NHÂN VIÊN
            </h1>
            <p className="text-emerald-100/90 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Cấu trúc chuẩn: <strong>30 điểm KPI chung</strong> + <strong>70 điểm KPI vị trí việc làm</strong> (Kế toán, Văn thư, Thủ quỹ, Y tế, Bảo vệ, Phục vụ, Thư viện, Thiết bị).
            </p>
          </div>

          {/* Action Buttons Header */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsDocumentModalOpen(true)}
              className="px-4 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Khởi tạo phiếu KPI
            </button>

            <button
              onClick={() => setIsPeriodModalOpen(true)}
              className="px-3.5 py-2.5 bg-emerald-700/60 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl border border-emerald-500/40 transition-all flex items-center gap-2"
            >
              <Calendar size={15} /> Kỳ đánh giá
            </button>

            <button
              onClick={() => exportStaffSummaryToExcel(activePeriodForms, activePeriod?.name, activePeriod?.academicYear)}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <FileSpreadsheet size={15} /> Xuất Excel
            </button>

            {isAdmin && canEditOrDelete() && !isProductionWeb() && (
              <button
                onClick={() => {
                  setDeleteAllScope('period');
                  setIsDeleteAllModalOpen(true);
                }}
                className="px-3.5 py-2.5 bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs rounded-xl border border-rose-400/40 shadow-md transition-all flex items-center gap-2 cursor-pointer"
                title="Xóa tất cả phiếu đánh giá KPI Nhân viên"
              >
                <Trash2 size={15} /> Xóa tất cả phiếu
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
            <Users size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khối Nhân viên</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{stats.totalStaffCount} <span className="text-xs font-semibold text-slate-500">người</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số phiếu kỳ này</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{stats.totalForms} <span className="text-xs font-semibold text-slate-500">phiếu</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
            <TrendingUp size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Điểm trung bình</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{stats.avgScore} <span className="text-xs font-semibold text-slate-500">/ 100</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 border border-blue-200">
            <Award size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Xuất sắc & Tốt</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{stats.excellentCount + stats.goodCount} <span className="text-xs font-semibold text-slate-500">phiếu</span></p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Period Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Calendar size={14} className="text-emerald-700" /> Kỳ:
            </span>
            {periods.map(p => {
              const isSelected = p.id === selectedPeriodId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriodId(p.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-800 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.name}
                  {p.status === 'locked' && <Lock size={12} className="text-rose-300" />}
                </button>
              );
            })}
          </div>

          {/* Search & Select Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên nhân viên, mã NV..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <select
              value={positionFilter}
              onChange={e => setPositionFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">Tất cả vị trí việc làm</option>
              {Object.values(POSITION_CONFIGS).map(cfg => (
                <option key={cfg.key} value={cfg.key}>{cfg.positionName}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="draft">Bản nháp</option>
              <option value="completed">Đã nghiệm thu</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Staff Forms Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                <th className="p-4 w-12 text-center">STT</th>
                <th className="p-4">Nhân viên</th>
                <th className="p-4">Vị trí việc làm & Bộ KPI</th>
                <th className="p-4 text-center">KPI Chung (30đ)</th>
                <th className="p-4 text-center">KPI Vị trí (70đ)</th>
                <th className="p-4 text-center">Tổng điểm (100đ)</th>
                <th className="p-4 text-center">TT Văn phòng đánh giá</th>
                <th className="p-4 text-center">BGH đánh giá</th>
                <th className="p-4">Xếp loại</th>
                <th className="p-4 text-center">Trạng thái</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredForms.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <UserCheck size={36} className="mx-auto text-slate-300" />
                      <p className="font-bold text-slate-700">Chưa có phiếu đánh giá KPI Nhân viên nào</p>
                      <p className="text-xs text-slate-500">Bấm nút "Khởi tạo phiếu KPI" để tạo phiếu chấm theo mẫu SỞ GD&ĐT PHÚ THỌ</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredForms.map((f, idx) => {
                  const posConfig = POSITION_CONFIGS[f.positionKey] || POSITION_CONFIGS.KE_TOAN;
                  const finalScore = f.managerTotalScore ?? f.ttcmTotalScore ?? f.totalScore;
                  const finalClassification = f.bghClassification || f.leaderClassification || f.ttcmClassification || f.selfClassification || getClassificationByScore(finalScore);

                  return (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 text-center font-bold text-slate-500">{idx + 1}</td>
                      
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 border border-emerald-200">
                            {f.employeeName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{f.employeeName}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{f.employeeCode || '---'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <p className="font-bold text-emerald-900">{f.position || posConfig.positionName}</p>
                        <p className="text-[11px] text-slate-500 font-semibold">{posConfig.title.replace('B. KPI VỊ TRÍ VIỆC LÀM: ', '')}</p>
                      </td>

                      <td className="p-4 text-center">
                        <span className="font-bold text-emerald-800">{f.generalTotalSelf} / 30đ</span>
                      </td>

                      <td className="p-4 text-center">
                        <span className="font-bold text-teal-800">{f.positionTotalSelf} / 70đ</span>
                      </td>

                      <td className="p-4 text-center">
                        <span className="font-black text-slate-900 text-sm">{finalScore} / 100đ</span>
                      </td>

                      <td className="p-4 text-center">
                        {getTtcmEvaluationBadge(f)}
                      </td>

                      <td className="p-4 text-center">
                        {getBghEvaluationBadge(f)}
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border inline-block ${
                          finalScore === 0 || finalClassification === 'Chưa tự đánh giá'
                            ? 'bg-slate-100 text-slate-600 border-slate-300'
                            : finalScore >= 90
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : finalScore >= 80
                            ? 'bg-teal-50 text-teal-800 border-teal-200'
                            : finalScore >= 70
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : finalScore >= 50
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {finalClassification}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border inline-block ${
                          f.status === 'completed' || f.status === 'locked'
                            ? 'bg-slate-100 text-slate-700 border-slate-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          {f.status === 'completed' || f.status === 'locked' ? 'Nghiệm thu' : 'Bản nháp'}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedFormForEdit(f)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold text-xs transition-colors flex items-center gap-1"
                            title="Chấm điểm / Đánh giá"
                          >
                            <Edit3 size={14} /> Chấm điểm
                          </button>

                          <button
                            onClick={() => exportStaffFormToWord(f)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition-colors"
                            title="Xuất phiếu Word (.docx)"
                          >
                            Word
                          </button>

                          <button
                            onClick={() => setSelectedFormForPrint(f)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                            title="In phiếu"
                          >
                            <Printer size={14} />
                          </button>

                          {!isProductionWeb() && user && (
                            <button
                              onClick={() => handleDeleteForm(f)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Xóa phiếu"
                            >
                              <Trash2 size={14} />
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

      {/* Modals */}
      <KpiStaffPeriodManagerModal
        isOpen={isPeriodModalOpen}
        onClose={() => setIsPeriodModalOpen(false)}
        periods={periods}
        selectedPeriodId={selectedPeriodId}
        onSelectPeriod={setSelectedPeriodId}
        onSavePeriod={handleSavePeriod}
        onDeletePeriod={handleDeletePeriod}
      />

      <KpiStaffDocumentModal
        isOpen={isDocumentModalOpen}
        onClose={() => setIsDocumentModalOpen(false)}
        periods={periods}
        selectedPeriodId={selectedPeriodId}
        teachers={teachers}
        existingForms={kpiStaffForms || []}
        onCreateForms={handleCreateForms}
        currentUserId={user?.id || ''}
        currentUserName={user?.name || ''}
      />

      <KpiStaffFormModal
        isOpen={!!selectedFormForEdit}
        onClose={() => setSelectedFormForEdit(null)}
        form={selectedFormForEdit}
        onSaveForm={handleSaveForm}
        onPrintForm={f => setSelectedFormForPrint(f)}
      />

      <KpiStaffPrintModal
        isOpen={!!selectedFormForPrint}
        onClose={() => setSelectedFormForPrint(null)}
        form={selectedFormForPrint}
      />

      {/* Delete All Confirmation Modal */}
      {!isProductionWeb() && isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0 border border-rose-200">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Xóa tất cả phiếu KPI Nhân viên</h3>
                <p className="text-xs text-rose-600 font-semibold">Cảnh báo: Thao tác này không thể hoàn tác!</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p className="font-medium leading-relaxed">
                Vui lòng chọn phạm vi xóa phiếu chấm KPI Nhân viên:
              </p>

              <div className="space-y-2">
                <label className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  deleteAllScope === 'period'
                    ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 text-rose-950 font-bold'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}>
                  <input
                    type="radio"
                    name="deleteScope"
                    checked={deleteAllScope === 'period'}
                    onChange={() => setDeleteAllScope('period')}
                    className="w-4 h-4 text-rose-600 border-slate-300 focus:ring-rose-500"
                  />
                  <div>
                    <p className="font-bold">Xóa tất cả phiếu của kỳ hiện tại</p>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Kỳ: {activePeriod?.name} ({activePeriodForms.length} phiếu)
                    </p>
                  </div>
                </label>

                <label className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  deleteAllScope === 'all'
                    ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 text-rose-950 font-bold'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}>
                  <input
                    type="radio"
                    name="deleteScope"
                    checked={deleteAllScope === 'all'}
                    onChange={() => setDeleteAllScope('all')}
                    className="w-4 h-4 text-rose-600 border-slate-300 focus:ring-rose-500"
                  />
                  <div>
                    <p className="font-bold">Xóa toàn bộ phiếu trong TẤT CẢ các kỳ</p>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Tổng số: {(kpiStaffForms || []).length} phiếu trên toàn hệ thống
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setIsDeleteAllModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmDeleteAllForms}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa tất cả'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Delete Modal */}
      {!isProductionWeb() && formToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0 border border-rose-200">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác nhận xóa phiếu KPI cá nhân</h3>
                <p className="text-xs text-slate-500 font-medium">Hành động này sẽ xóa vĩnh viễn phiếu đánh giá khỏi hệ thống</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700 font-medium">
              <p><strong>Họ và tên nhân viên:</strong> <span className="font-bold text-slate-900">{formToDelete.employeeName}</span> ({formToDelete.employeeCode || '---'})</p>
              <p><strong>Vị trí việc làm:</strong> <span className="font-bold text-emerald-900">{formToDelete.position}</span></p>
              <p><strong>Kỳ đánh giá:</strong> <span className="font-bold text-slate-900">{formToDelete.periodName}</span> ({formToDelete.academicYear})</p>
              <p><strong>Điểm KPI hiện tại:</strong> <span className="font-black text-rose-700">{formToDelete.managerTotalScore ?? formToDelete.ttcmTotalScore ?? formToDelete.totalScore} / 100đ</span></p>
            </div>

            {deleteSingleErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                <span>{deleteSingleErrorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                disabled={isDeletingSingle}
                onClick={() => {
                  setFormToDelete(null);
                  setDeleteSingleErrorMsg('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Hủy bỏ
              </button>

              <button
                disabled={isDeletingSingle}
                onClick={async () => {
                  setIsDeletingSingle(true);
                  setDeleteSingleErrorMsg('');
                  try {
                    await deleteStaffFormFromFirestore(formToDelete.id);
                    const updated = (kpiStaffForms || []).filter(f => f.id !== formToDelete.id);
                    setKpiStaffForms(updated);
                    saveStaffFormsToCache(updated);
                    setFormToDelete(null);
                  } catch (err: any) {
                    console.error('Xóa phiếu KPI thất bại:', err);
                    setDeleteSingleErrorMsg('Xóa phiếu thất bại: ' + (err?.message || 'Không thể kết nối máy chủ Firestore. Vui lòng thử lại!'));
                  } finally {
                    setIsDeletingSingle(false);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
              >
                {isDeletingSingle ? (
                  <span>Đang xóa...</span>
                ) : (
                  <>
                    <Trash2 size={14} /> Đồng ý Xóa
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
