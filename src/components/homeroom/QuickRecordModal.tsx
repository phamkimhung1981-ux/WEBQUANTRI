import React, { useState, useEffect } from 'react';
import { X, Zap, Check, AlertCircle, Users, Search } from 'lucide-react';
import { Student, ConductCriterion, ConductRecord, ClassInfo } from '../../types/homeroom';
import { useAuth } from '../../store/AuthContext';

interface QuickRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClass: ClassInfo | null;
  students: Student[];
  criteria: ConductCriterion[];
  onSaveQuick: (records: Omit<ConductRecord, 'id' | 'createdAt'>[]) => Promise<void>;
}

export default function QuickRecordModal({
  isOpen,
  onClose,
  selectedClass,
  students,
  criteria,
  onSaveQuick
}: QuickRecordModalProps) {
  const { user } = useAuth();

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedCriterionId, setSelectedCriterionId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedStudentIds([]);
      setStudentSearch('');
      setSelectedCriterionId('');
      setNote('');
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter active criteria for quick selection (both minus and strict compliance)
  const quickCriteria = criteria
    .filter(c => c.status === 'active')
    .sort((a, b) => (a.code === 'TC00' || a.pointType === 'plus' ? -1 : 1))
    .slice(0, 12);

  const visibleStudents = students.filter(s =>
    !studentSearch ||
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllStudents = () => {
    if (selectedStudentIds.length === visibleStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(visibleStudents.map(s => s.id));
    }
  };

  const handleSave = async () => {
    if (selectedStudentIds.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất 1 học sinh.');
      return;
    }
    if (!selectedCriterionId) {
      setErrorMsg('Vui lòng chọn 1 tiêu chí vi phạm.');
      return;
    }
    const criterion = criteria.find(c => c.id === selectedCriterionId);
    if (!criterion || !selectedClass) {
      setErrorMsg('Thông tin lớp hoặc tiêu chí không hợp lệ.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const recordDate = new Date().toISOString().split('T')[0];
      const dateObj = new Date();
      const monthNumber = dateObj.getMonth() + 1;
      const weekNumber = Math.ceil(((dateObj.getTime() - new Date(dateObj.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);

      const recordsToCreate = selectedStudentIds.map(stId => {
        const student = students.find(s => s.id === stId);
        return {
          studentId: stId,
          studentName: student?.name || 'Học sinh',
          classId: selectedClass.id,
          className: selectedClass.name,
          schoolYear: selectedClass.schoolYear || '2026–2027',
          weekNumber,
          monthNumber,
          criterionId: criterion.id,
          criterionName: criterion.name,
          categoryId: criterion.categoryId,
          categoryName: criterion.categoryName,
          pointType: criterion.pointType,
          point: criterion.defaultPoint,
          level: criterion.severity || 'Nhẹ',
          note: note ? `[Ghi nhận nhanh] ${note}` : '[Ghi nhận nhanh]',
          recordedBy: user?.id || 'gvcn',
          recordedByName: user?.name || 'Giáo viên',
          recordDate
        };
      });

      await onSaveQuick(recordsToCreate);
      setSubmitting(false);
      setSelectedStudentIds([]);
      setNote('');
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Lỗi ghi nhận nhanh.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Zap size={22} className="text-amber-200 fill-amber-200" />
              GHI NHẬN NHANH NỀN NẾP (N HỌC SINH)
            </h2>
            <p className="text-xs text-amber-100">Áp dụng cùng 1 lỗi vi phạm cho nhiều học sinh bằng hộp kiểm</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Step 1: Chọn tiêu chí */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              1. Chọn 1 tiêu chí vi phạm nhanh:
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
              {quickCriteria.map(c => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setSelectedCriterionId(c.id)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col justify-between ${
                    selectedCriterionId === c.id
                      ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold shadow-sm ring-2 ring-amber-400'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className={`text-[10px] font-bold mt-1 ${c.pointType === 'plus' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {c.pointType === 'plus' ? `+${c.defaultPoint}` : `${c.defaultPoint}`} điểm
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Chọn danh sách học sinh bằng hộp kiểm */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-amber-50/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users size={16} className="text-amber-600" />
                2. Hộp kiểm chọn học sinh vi phạm{' '}
                <span className="text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full text-[11px] font-bold">
                  Đã chọn: {selectedStudentIds.length}/{students.length}
                </span>
              </label>
              <button
                type="button"
                onClick={selectAllStudents}
                className="text-xs text-amber-800 hover:text-amber-950 font-bold underline"
              >
                {selectedStudentIds.length === visibleStudents.length && visibleStudents.length > 0
                  ? 'Bỏ chọn tất cả'
                  : 'Chọn tất cả trong danh sách'}
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Tìm kiếm học sinh..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            {/* Checkbox Grid */}
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {visibleStudents.length === 0 ? (
                <div className="col-span-2 text-center py-3 text-xs text-slate-400">
                  Không tìm thấy học sinh phù hợp.
                </div>
              ) : (
                <>
                  <label
                    onClick={selectAllStudents}
                    className={`col-span-1 sm:col-span-2 flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all mb-1 ${
                      selectedStudentIds.length === visibleStudents.length && visibleStudents.length > 0
                        ? 'bg-amber-100 border-amber-400 text-amber-950 font-bold shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.length === visibleStudents.length && visibleStudents.length > 0}
                      onChange={() => {}} // handled by parent onClick
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer shrink-0"
                    />
                    <span className="font-bold text-amber-900">
                      ⬜ CHỌN TẤT CẢ HỌC SINH ({visibleStudents.length} em)
                    </span>
                  </label>

                  {visibleStudents.map(s => {
                    const isChecked = selectedStudentIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        onClick={() => toggleStudent(s.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-amber-100/80 border-amber-400 text-amber-900 font-bold shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer shrink-0"
                        />
                        <span className="truncate">{s.name}</span>
                      </label>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* Ghi chú nhanh */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú thêm (không bắt buộc):
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Tiết 2 môn Toán, hoặc đầu giờ sáng..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-2"
            >
              <Zap size={16} className="fill-white" />
              {submitting ? 'Đang lưu...' : `Xác nhận ghi nhận (${selectedStudentIds.length} học sinh)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
