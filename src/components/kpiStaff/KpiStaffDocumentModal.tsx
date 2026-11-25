import React, { useState, useEffect, useMemo } from 'react';
import { KpiStaffPeriod, KpiStaffForm, StaffPositionKey } from '../../types/kpiStaff';
import { Teacher } from '../../types';
import {
  getEligibleStaffMembers,
  createInitialStaffForm,
  POSITION_CONFIGS,
  detectPositionKey,
  findExistingStaffFormForPeriod,
  formatStaffPeriodLabel
} from '../../lib/kpiStaffData';
import { fetchStaffFormsFromFirestore } from '../../services/kpiStaffService';
import {
  FileText,
  Users,
  CheckCircle2,
  User,
  Search,
  AlertCircle,
  Sparkles,
  X,
  Eye,
  Edit3,
  RotateCcw,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  periods: KpiStaffPeriod[];
  selectedPeriodId: string;
  teachers: Teacher[];
  existingForms: KpiStaffForm[];
  onCreateForms: (newForms: KpiStaffForm[], targetPeriodId: string) => Promise<void>;
  onViewForm?: (form: KpiStaffForm) => void;
  onEditForm?: (form: KpiStaffForm) => void;
  onRecreateForm?: (existingForm: KpiStaffForm, replacementForm: KpiStaffForm) => Promise<void>;
  canEditForm?: (form: KpiStaffForm) => boolean;
  isAdmin?: boolean;
  onRefreshForms?: (forms: KpiStaffForm[]) => void;
  currentUserId: string;
  currentUserName: string;
}

export default function KpiStaffDocumentModal({
  isOpen,
  onClose,
  periods,
  selectedPeriodId,
  teachers,
  existingForms,
  onCreateForms,
  onViewForm,
  onEditForm,
  onRecreateForm,
  canEditForm,
  isAdmin = false,
  onRefreshForms,
  currentUserId
}: Props) {
  const [targetPeriodId, setTargetPeriodId] = useState<string>(selectedPeriodId || periods[0]?.id || '');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [overridePositionKey, setOverridePositionKey] = useState<StaffPositionKey | 'AUTO'>('AUTO');
  const [mode, setMode] = useState<'all' | 'custom'>('custom');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSyncingFirestore, setIsSyncingFirestore] = useState<boolean>(false);
  const [recreateConfirm, setRecreateConfirm] = useState<{ staff: Teacher; existingForm: KpiStaffForm } | null>(null);
  const [isRecreating, setIsRecreating] = useState<boolean>(false);

  // Đồng bộ kỳ đánh giá hiện tại mỗi khi mở modal hoặc khi kỳ đang chọn trên trang chính thay đổi
  useEffect(() => {
    if (!isOpen) return;

    const validPeriodId = periods.some(p => p.id === selectedPeriodId)
      ? selectedPeriodId
      : (periods[0]?.id || '');

    setTargetPeriodId(validPeriodId);
    setSelectedStaffIds([]);
    setSearchQuery('');
    setSuccessMessage('');
    setErrorMessage('');
    setRecreateConfirm(null);

    // Đồng bộ trực tiếp dữ liệu mới nhất từ Firestore khi mở modal để tránh cache cũ
    let cancelled = false;
    setIsSyncingFirestore(true);
    fetchStaffFormsFromFirestore()
      .then(liveForms => {
        if (!cancelled && onRefreshForms) {
          onRefreshForms(liveForms);
        }
      })
      .catch(err => {
        console.warn('Không thể tải lại danh sách phiếu KPI nhân viên từ Firestore:', err);
      })
      .finally(() => {
        if (!cancelled) setIsSyncingFirestore(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedPeriodId]);

  // Xóa lựa chọn cũ khi chuyển sang kỳ đánh giá khác
  const handlePeriodChange = (newPeriodId: string) => {
    setTargetPeriodId(newPeriodId);
    setSelectedStaffIds([]);
    setErrorMessage('');
    setSuccessMessage('');
    setRecreateConfirm(null);
  };

  const eligibleStaff = useMemo(() => getEligibleStaffMembers(teachers), [teachers]);
  const selectedPeriod = useMemo(
    () => periods.find(p => p.id === targetPeriodId) || periods[0],
    [periods, targetPeriodId]
  );

  // Ánh xạ phiếu đã tồn tại theo ĐÚNG nhân viên + kỳ đánh giá + năm học (chỉ phiếu đang hoạt động)
  const existingFormByStaffId = useMemo(() => {
    const map = new Map<string, KpiStaffForm>();
    if (!selectedPeriod) return map;
    eligibleStaff.forEach(staff => {
      const found = findExistingStaffFormForPeriod(existingForms, staff, selectedPeriod);
      if (found) {
        map.set(staff.id, found);
      }
    });
    return map;
  }, [eligibleStaff, existingForms, selectedPeriod]);

  // Danh sách nhân viên ĐỦ ĐIỀU KIỆN tạo mới (chưa có phiếu đang hoạt động trong kỳ + năm học này)
  const selectableStaff = useMemo(
    () => eligibleStaff.filter(s => !existingFormByStaffId.has(s.id)),
    [eligibleStaff, existingFormByStaffId]
  );

  const existingCount = eligibleStaff.length - selectableStaff.length;

  // Tìm nhanh một kỳ khác còn nhân viên chưa có phiếu để hỗ trợ chuyển nhanh
  const nextAvailablePeriod = useMemo(() => {
    if (selectableStaff.length > 0) return null;
    return periods.find(p => {
      if (p.id === selectedPeriod?.id) return false;
      return eligibleStaff.some(s => !findExistingStaffFormForPeriod(existingForms, s, p));
    }) || null;
  }, [periods, selectedPeriod, eligibleStaff, existingForms, selectableStaff.length]);

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligibleStaff;
    return eligibleStaff.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        (s.code || '').toLowerCase().includes(q) ||
        (s.position || '').toLowerCase().includes(q)
    );
  }, [eligibleStaff, searchQuery]);

  const filteredSelectableStaff = useMemo(
    () => filteredStaff.filter(s => !existingFormByStaffId.has(s.id)),
    [filteredStaff, existingFormByStaffId]
  );

  // Luôn loại trừ mọi ID đã có phiếu ra khỏi danh sách đang chọn
  const validSelectedStaffIds = useMemo(() => {
    const selectableIdSet = new Set(selectableStaff.map(s => s.id));
    return selectedStaffIds.filter(id => selectableIdSet.has(id));
  }, [selectedStaffIds, selectableStaff]);

  const allFilteredSelectableChecked =
    filteredSelectableStaff.length > 0 &&
    filteredSelectableStaff.every(s => validSelectedStaffIds.includes(s.id));

  if (!isOpen) return null;

  const handleSelectAll = () => {
    if (filteredSelectableStaff.length === 0) return;

    if (allFilteredSelectableChecked) {
      const filteredIds = new Set(filteredSelectableStaff.map(s => s.id));
      setSelectedStaffIds(prev => prev.filter(id => !filteredIds.has(id)));
    } else {
      const merged = new Set(validSelectedStaffIds);
      filteredSelectableStaff.forEach(s => merged.add(s.id));
      setSelectedStaffIds(Array.from(merged));
    }
  };

  const handleToggleStaff = (id: string) => {
    if (existingFormByStaffId.has(id)) return;
    setErrorMessage('');
    setSelectedStaffIds(prev => {
      const selectableIdSet = new Set(selectableStaff.map(s => s.id));
      const cleanPrev = prev.filter(item => selectableIdSet.has(item));
      if (cleanPrev.includes(id)) {
        return cleanPrev.filter(i => i !== id);
      }
      return [...cleanPrev, id];
    });
  };

  const targetCount = mode === 'all' ? selectableStaff.length : validSelectedStaffIds.length;

  const handleGenerateForms = async () => {
    setSuccessMessage('');
    setErrorMessage('');

    if (!selectedPeriod) {
      setErrorMessage('Vui lòng chọn kỳ đánh giá hợp lệ.');
      return;
    }

    const targetStaffList =
      mode === 'all'
        ? selectableStaff
        : eligibleStaff.filter(s => validSelectedStaffIds.includes(s.id));

    if (targetStaffList.length === 0) {
      setErrorMessage(
        selectableStaff.length === 0
          ? `Tất cả ${eligibleStaff.length} nhân viên đều đã có phiếu trong kỳ "${selectedPeriod.name}". Hãy chọn kỳ đánh giá khác hoặc dùng thao tác Xem / Chỉnh sửa / Tạo lại.`
          : 'Vui lòng tích chọn ít nhất 1 nhân viên chưa có phiếu để khởi tạo.'
      );
      return;
    }

    const createdForms: KpiStaffForm[] = [];

    targetStaffList.forEach(staff => {
      const exists = findExistingStaffFormForPeriod(existingForms, staff, selectedPeriod);
      if (exists) return;

      const activeKey =
        overridePositionKey === 'AUTO'
          ? detectPositionKey(staff.position || '')
          : overridePositionKey;
      const newForm = createInitialStaffForm(
        staff,
        selectedPeriod,
        activeKey,
        currentUserId || staff.id
      );

      createdForms.push(newForm);
    });

    if (createdForms.length === 0) {
      setErrorMessage('Tất cả nhân viên được chọn đều đã có phiếu trong kỳ này.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateForms(createdForms, selectedPeriod.id);
      setSelectedStaffIds([]);
      setSuccessMessage(
        `Đã khởi tạo và lưu thành công ${createdForms.length} phiếu đánh giá KPI Nhân viên cho kỳ "${selectedPeriod.name}"!`
      );
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Lỗi khi khởi tạo phiếu KPI nhân viên:', err);
      setErrorMessage(
        'Không thể lưu phiếu lên cơ sở dữ liệu Firestore: ' +
          (err?.message || 'Vui lòng kiểm tra kết nối mạng và thử lại.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRecreate = async () => {
    if (!recreateConfirm || !selectedPeriod || !onRecreateForm) return;
    const { staff, existingForm } = recreateConfirm;
    const activeKey =
      overridePositionKey === 'AUTO'
        ? detectPositionKey(staff.position || '')
        : overridePositionKey;

    const freshForm = createInitialStaffForm(
      staff,
      selectedPeriod,
      activeKey,
      currentUserId || staff.id
    );
    // Giữ nguyên document ID của phiếu cũ để thay thế sạch sẽ, tuyệt đối không tạo bản ghi trùng
    const replacementForm: KpiStaffForm = {
      ...freshForm,
      id: existingForm.id,
      updatedBy: currentUserId || staff.id
    };

    setIsRecreating(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await onRecreateForm(existingForm, replacementForm);
      setRecreateConfirm(null);
      setSuccessMessage(
        `Đã tạo lại phiếu KPI cho nhân viên ${staff.name} (${staff.code || '---'}) theo bộ vị trí "${POSITION_CONFIGS[activeKey].positionName}" trong kỳ "${selectedPeriod.name}".`
      );
    } catch (err: any) {
      console.error('Lỗi khi tạo lại phiếu KPI nhân viên:', err);
      setErrorMessage(
        'Không thể tạo lại phiếu KPI: ' +
          (err?.message || 'Lỗi kết nối Firestore. Vui lòng thử lại.')
      );
    } finally {
      setIsRecreating(false);
    }
  };

  const getStatusSummaryText = (form: KpiStaffForm) => {
    const posName = POSITION_CONFIGS[form.positionKey]?.positionName || form.position;
    const score = form.managerTotalScore ?? form.ttcmTotalScore ?? form.totalScore ?? 0;
    const statusLabel =
      form.status === 'completed' || form.status === 'locked'
        ? `Nghiệm thu • ${score}đ`
        : form.status === 'submitted'
        ? `Đã gửi • ${score}đ`
        : score > 0
        ? `Đang chấm • ${score}đ`
        : 'Bản nháp';
    return `${posName} • ${statusLabel}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <FileText className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Khởi tạo Phiếu Đánh giá KPI Nhân viên</h2>
              <p className="text-xs text-emerald-200/80">
                Khung 30đ KPI chung + 70đ KPI vị trí việc làm theo dự thảo THPT Sơn Lương
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg text-emerald-200 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Select Period & Position config */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. Chọn kỳ đánh giá
                </label>
                {isSyncingFirestore && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                    <RefreshCw size={11} className="animate-spin" /> Đang đồng bộ...
                  </span>
                )}
              </div>
              <select
                value={targetPeriodId}
                onChange={e => handlePeriodChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {periods.map(p => {
                  const createdInPeriod = eligibleStaff.filter(s =>
                    Boolean(findExistingStaffFormForPeriod(existingForms, s, p))
                  ).length;
                  const statusSuffix =
                    createdInPeriod === 0
                      ? 'Chưa có phiếu'
                      : `${createdInPeriod}/${eligibleStaff.length} đã có phiếu`;
                  return (
                    <option key={p.id} value={p.id}>
                      {formatStaffPeriodLabel(p)} ({statusSuffix})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                2. Bộ KPI Vị trí việc làm (70đ)
              </label>
              <select
                value={overridePositionKey}
                onChange={e => setOverridePositionKey(e.target.value as StaffPositionKey | 'AUTO')}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="AUTO">Tự động nhận diện theo chức danh nhân viên</option>
                {Object.values(POSITION_CONFIGS).map(cfg => (
                  <option key={cfg.key} value={cfg.key}>
                    {cfg.positionName} (70 điểm)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary Status Banner for Selected Period */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-600">
              <span>
                Kỳ đang chọn: <strong className="text-slate-900">{selectedPeriod?.name}</strong> ({selectedPeriod?.academicYear})
              </span>
              <span>
                Chưa có phiếu: <strong className="text-emerald-700">{selectableStaff.length}/{eligibleStaff.length}</strong>
              </span>
              <span>
                Đã có phiếu: <strong className="text-slate-800">{existingCount}/{eligibleStaff.length}</strong>
              </span>
              {mode === 'custom' && (
                <span>
                  Đang chọn: <strong className="text-emerald-700">{validSelectedStaffIds.length}</strong>
                </span>
              )}
            </div>

            {selectableStaff.length === 0 && nextAvailablePeriod && (
              <button
                type="button"
                onClick={() => handlePeriodChange(nextAvailablePeriod.id)}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-[11px] transition-colors shrink-0"
              >
                Chuyển sang {nextAvailablePeriod.name}
              </button>
            )}
          </div>

          {selectableStaff.length === 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  Tất cả {eligibleStaff.length} nhân viên đều đã có phiếu KPI trong kỳ "{selectedPeriod?.name}".
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Để tránh tạo trùng phiếu trong cùng kỳ, ô tích chọn của các nhân viên đã có phiếu được khóa. Bạn có thể chọn <strong>kỳ đánh giá / năm học khác</strong> ở mục 1 để tạo phiếu mới, hoặc dùng nút <strong>Xem phiếu / Chỉnh sửa{isAdmin ? ' / Tạo lại' : ''}</strong> ở từng dòng nhân viên bên dưới.
                </p>
              </div>
            </div>
          )}

          {/* 3. Scope selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              3. Chọn danh sách nhân viên
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('all')}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  mode === 'all'
                    ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 text-emerald-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <Users className={mode === 'all' ? 'text-emerald-700 shrink-0' : 'text-slate-400 shrink-0'} size={20} />
                <div>
                  <p className="font-bold">
                    Tất cả chưa có phiếu ({selectableStaff.length}/{eligibleStaff.length})
                  </p>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Tự động tạo phiếu cho toàn bộ nhân viên chưa có phiếu kỳ này
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('custom')}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  mode === 'custom'
                    ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 text-emerald-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <User className={mode === 'custom' ? 'text-emerald-700 shrink-0' : 'text-slate-400 shrink-0'} size={20} />
                <div>
                  <p className="font-bold">
                    Lựa chọn nhân viên ({validSelectedStaffIds.length} đã chọn)
                  </p>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Chọn từng nhân viên kế toán, văn thư, thư viện, thiết bị...
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Inline Admin Recreate Confirmation Panel */}
          {recreateConfirm && isAdmin && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-amber-950">
                  <p className="font-bold text-xs">
                    Xác nhận tạo lại phiếu KPI cho {recreateConfirm.staff.name} ({recreateConfirm.staff.code || '---'})
                  </p>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Thao tác này sẽ <strong>thay thế trực tiếp</strong> phiếu cũ trong kỳ <strong>{selectedPeriod?.name}</strong> (hiện tại: {getStatusSummaryText(recreateConfirm.existingForm)}) bằng phiếu mới theo bộ KPI{' '}
                    <strong>
                      {POSITION_CONFIGS[
                        overridePositionKey === 'AUTO'
                          ? detectPositionKey(recreateConfirm.staff.position || '')
                          : overridePositionKey
                      ].positionName}
                    </strong>{' '}
                    và đặt lại điểm về bản nháp (không tạo bản ghi trùng).
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isRecreating}
                  onClick={() => setRecreateConfirm(null)}
                  className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isRecreating}
                  onClick={handleConfirmRecreate}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  {isRecreating ? 'Đang tạo lại...' : 'Xác nhận tạo lại phiếu'}
                </button>
              </div>
            </div>
          )}

          {/* Staff Selection & Status List */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên, mã NV, vị trí..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {mode === 'custom' && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={filteredSelectableStaff.length === 0}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold text-xs rounded-xl transition-colors shrink-0"
                >
                  {allFilteredSelectableChecked
                    ? `Bỏ chọn tất cả (${filteredSelectableStaff.length})`
                    : `Chọn tất cả (${filteredSelectableStaff.length})`}
                </button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {filteredStaff.length === 0 ? (
                <div className="p-6 text-center text-slate-500 font-medium">
                  Không tìm thấy nhân viên phù hợp với từ khóa "{searchQuery}".
                </div>
              ) : (
                filteredStaff.map(staff => {
                  const existingForm = existingFormByStaffId.get(staff.id);
                  const hasForm = Boolean(existingForm);
                  const isChecked =
                    !hasForm && (mode === 'all' || validSelectedStaffIds.includes(staff.id));
                  const resolvedPosKey =
                    overridePositionKey === 'AUTO'
                      ? detectPositionKey(staff.position || '')
                      : overridePositionKey;
                  const resolvedPosConfig = POSITION_CONFIGS[resolvedPosKey];
                  const editable = existingForm && canEditForm ? canEditForm(existingForm) : false;

                  return (
                    <div
                      key={staff.id}
                      onClick={() => {
                        if (!hasForm && mode === 'custom') {
                          handleToggleStaff(staff.id);
                        }
                      }}
                      className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
                        hasForm
                          ? 'bg-slate-50/90'
                          : isChecked
                          ? 'bg-emerald-50/70 cursor-pointer'
                          : mode === 'custom'
                          ? 'hover:bg-slate-50 cursor-pointer'
                          : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={hasForm || mode === 'all'}
                          onClick={e => e.stopPropagation()}
                          onChange={() => handleToggleStaff(staff.id)}
                          aria-label={`Chọn nhân viên ${staff.name}`}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-bold truncate ${hasForm ? 'text-slate-600' : 'text-slate-900'}`}>
                              {staff.name}
                            </p>
                            {hasForm ? (
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold shrink-0">
                                Đã có phiếu
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold shrink-0">
                                Chưa có phiếu
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {staff.position || resolvedPosConfig.positionName} • {staff.code || '---'}
                            {existingForm
                              ? ` • ${getStatusSummaryText(existingForm)}`
                              : ` • Bộ KPI: ${resolvedPosConfig.positionName}`}
                          </p>
                        </div>
                      </div>

                      {existingForm && (
                        <div
                          className="flex items-center gap-1.5 shrink-0 pl-7 sm:pl-0"
                          onClick={e => e.stopPropagation()}
                        >
                          {onViewForm && (
                            <button
                              type="button"
                              onClick={() => onViewForm(existingForm)}
                              className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1"
                              title="Xem phiếu KPI hiện có"
                            >
                              <Eye size={12} /> Xem phiếu
                            </button>
                          )}
                          {onEditForm && editable && (
                            <button
                              type="button"
                              onClick={() => onEditForm(existingForm)}
                              className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1"
                              title="Mở và chỉnh sửa phiếu KPI"
                            >
                              <Edit3 size={12} /> Chỉnh sửa
                            </button>
                          )}
                          {isAdmin && onRecreateForm && (
                            <button
                              type="button"
                              onClick={() => {
                                setErrorMessage('');
                                setSuccessMessage('');
                                setRecreateConfirm({ staff, existingForm });
                              }}
                              className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1"
                              title="Tạo lại phiếu KPI (Admin)"
                            >
                              <RotateCcw size={12} /> Tạo lại
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] font-semibold text-slate-600">
            {targetCount > 0 ? (
              <>
                Sẽ khởi tạo <strong className="text-emerald-800">{targetCount} phiếu KPI</strong> cho kỳ{' '}
                <strong className="text-slate-900">{selectedPeriod?.name}</strong>
              </>
            ) : (
              <span>Chưa có nhân viên nào được chọn để tạo phiếu mới</span>
            )}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleGenerateForms}
              disabled={targetCount === 0 || isSubmitting}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Sparkles size={16} />
              {isSubmitting
                ? 'Đang lưu lên Firestore...'
                : targetCount > 0
                ? `Tạo phiếu đánh giá KPI (${targetCount})`
                : 'Tạo phiếu đánh giá KPI'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
