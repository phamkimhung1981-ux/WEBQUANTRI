import React, { useState } from 'react';
import { KpiStaffPeriod } from '../../types/kpiStaff';
import { parseAcademicYearRange } from '../../lib/kpiStaffData';
import { Calendar, Plus, Lock, Unlock, Edit2, Trash2, Check, X, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  periods: KpiStaffPeriod[];
  selectedPeriodId: string;
  onSelectPeriod: (id: string) => void;
  onSavePeriod: (period: KpiStaffPeriod) => void;
  onDeletePeriod: (id: string) => void;
  onGenerateAcademicYear?: (academicYear: string) => Promise<number>;
}

export default function KpiStaffPeriodManagerModal({
  isOpen,
  onClose,
  periods,
  selectedPeriodId,
  onSelectPeriod,
  onSavePeriod,
  onDeletePeriod,
  onGenerateAcademicYear
}: Props) {
  const [editingPeriod, setEditingPeriod] = useState<Partial<KpiStaffPeriod> | null>(null);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [newYearInput, setNewYearInput] = useState<string>('2027–2028');
  const [isGeneratingYear, setIsGeneratingYear] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    const now = new Date();
    const m = now.getMonth() + 1;
    const yr = now.getFullYear();
    const mPadded = String(m).padStart(2, '0');
    const lastDay = String(new Date(yr, m, 0).getDate()).padStart(2, '0');
    const startYr = m >= 7 ? yr : yr - 1;
    setEditingPeriod({
      id: `period_staff_m${mPadded}_${yr}`,
      name: `Tháng ${m}/${yr}`,
      academicYear: `${startYr}–${startYr + 1}`,
      periodType: 'month',
      month: m,
      startDate: `${yr}-${mPadded}-01`,
      endDate: `${yr}-${mPadded}-${lastDay}`,
      status: 'active',
      description: `Đánh giá, chấm điểm KPI Nhân viên Tháng ${m}/${yr}`
    });
    setError('');
    setSuccessMsg('');
  };

  const handleGenerateFullYear = async () => {
    if (!onGenerateAcademicYear) return;
    setError('');
    setSuccessMsg('');
    const trimmed = newYearInput.trim();
    if (!/^\d{4}\s*[-–]\s*\d{4}$/.test(trimmed)) {
      setError('Vui lòng nhập năm học đúng định dạng (ví dụ: 2027–2028).');
      return;
    }
    const { yearRangeStr } = parseAcademicYearRange(trimmed);
    setIsGeneratingYear(true);
    try {
      const addedCount = await onGenerateAcademicYear(yearRangeStr);
      setSuccessMsg(
        addedCount > 0
          ? `Đã khởi tạo đủ 12 tháng (Tháng 7 – Tháng 6) cùng kỳ Năm học/Học kỳ cho năm học ${yearRangeStr} (thêm mới ${addedCount} kỳ).`
          : `Năm học ${yearRangeStr} đã có đầy đủ toàn bộ 12 kỳ tháng (Tháng 7 – Tháng 6).`
      );
    } catch (err: any) {
      setError('Không thể khởi tạo năm học mới: ' + (err?.message || 'Lỗi kết nối Firestore.'));
    } finally {
      setIsGeneratingYear(false);
    }
  };

  const handleSave = () => {
    if (!editingPeriod || !editingPeriod.name || !editingPeriod.academicYear) {
      setError('Vui lòng nhập tên kỳ đánh giá và năm học.');
      return;
    }
    onSavePeriod(editingPeriod as KpiStaffPeriod);
    setEditingPeriod(null);
    setError('');
  };

  const handleToggleLock = (period: KpiStaffPeriod) => {
    const newStatus = period.status === 'locked' ? 'active' : 'locked';
    onSavePeriod({ ...period, status: newStatus });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Calendar className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Quản lý Kỳ đánh giá KPI Nhân viên</h2>
              <p className="text-xs text-emerald-200/80">Thêm mới, khóa hoặc thiết lập các đợt đánh giá cho Nhân viên</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-emerald-200 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {onGenerateAcademicYear && !editingPeriod && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-800">Khởi tạo tự động 12 tháng cho năm học mới</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tự động tạo đủ 12 kỳ tháng từ Tháng 7 năm trước đến Tháng 6 năm sau (không tạo trùng).
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={newYearInput}
                  onChange={e => setNewYearInput(e.target.value)}
                  placeholder="2027–2028"
                  className="w-28 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isGeneratingYear}
                  onClick={handleGenerateFullYear}
                  className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Sparkles size={14} />
                  {isGeneratingYear ? 'Đang tạo...' : 'Tạo đủ 12 tháng'}
                </button>
              </div>
            </div>
          )}

          {/* Edit / Create Form */}
          {editingPeriod ? (
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                <Plus size={16} /> {editingPeriod.id ? 'Cấu hình Kỳ đánh giá' : 'Thêm Kỳ đánh giá mới'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tên kỳ đánh giá *</label>
                  <input
                    type="text"
                    value={editingPeriod.name || ''}
                    onChange={e => setEditingPeriod({ ...editingPeriod, name: e.target.value })}
                    placeholder="Vd: Tháng 09/2026"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Năm học *</label>
                  <input
                    type="text"
                    value={editingPeriod.academicYear || ''}
                    onChange={e => setEditingPeriod({ ...editingPeriod, academicYear: e.target.value })}
                    placeholder="Vd: 2026-2027"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={editingPeriod.startDate || ''}
                    onChange={e => setEditingPeriod({ ...editingPeriod, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày kết thúc</label>
                  <input
                    type="date"
                    value={editingPeriod.endDate || ''}
                    onChange={e => setEditingPeriod({ ...editingPeriod, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả / Ghi chú</label>
                <input
                  type="text"
                  value={editingPeriod.description || ''}
                  onChange={e => setEditingPeriod({ ...editingPeriod, description: e.target.value })}
                  placeholder="Ghi chú về đợt đánh giá..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingPeriod(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Check size={16} /> Lưu thông tin
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Danh sách kỳ đánh giá ({periods.length})</span>
              <button
                onClick={handleStartCreate}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              >
                <Plus size={16} /> Thêm kỳ đánh giá mới
              </button>
            </div>
          )}

          {/* Periods List */}
          <div className="space-y-3">
            {periods.map(p => {
              const isSelected = p.id === selectedPeriodId;
              const isLocked = p.status === 'locked';

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onSelectPeriod(p.id)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800">{p.name}</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold border border-slate-200">
                          {p.academicYear}
                        </span>
                        {isLocked ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md text-[10px] font-bold flex items-center gap-1">
                            <Lock size={12} /> Đã khóa
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                            Đang mở
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{p.description || 'Chưa có mô tả'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleLock(p)}
                      title={isLocked ? "Mở khóa kỳ đánh giá" : "Khóa kỳ đánh giá"}
                      className={`p-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 ${
                        isLocked
                          ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                    >
                      {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>

                    <button
                      onClick={() => setEditingPeriod(p)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                      title="Chỉnh sửa"
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Bạn có chắc chắn muốn xóa kỳ đánh giá "${p.name}"?`)) {
                          onDeletePeriod(p.id);
                        }
                      }}
                      className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors"
                      title="Xóa"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-md transition-all"
          >
            Đóng cửa sổ
          </button>
        </div>

      </div>
    </div>
  );
}
