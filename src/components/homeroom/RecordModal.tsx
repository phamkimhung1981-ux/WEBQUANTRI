import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  User,
  List,
  AlertCircle,
  PlusCircle,
  MinusCircle,
  CheckCircle2,
  Paperclip,
  Search,
  Check,
  Users
} from 'lucide-react';
import { Student, ConductCategory, ConductCriterion, ConductRecord, ClassInfo } from '../../types/homeroom';
import { useAuth } from '../../store/AuthContext';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClass: ClassInfo | null;
  students: Student[];
  categories: ConductCategory[];
  criteria: ConductCriterion[];
  onSave: (record: Omit<ConductRecord, 'id' | 'createdAt'>) => Promise<void>;
  defaultStudentId?: string;
  defaultCriterionId?: string;
  defaultType?: 'plus' | 'minus';
}

export default function RecordModal({
  isOpen,
  onClose,
  selectedClass,
  students,
  categories,
  criteria,
  onSave,
  defaultStudentId,
  defaultCriterionId,
  defaultType
}: RecordModalProps) {
  const { user } = useAuth();

  const [recordDate, setRecordDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [criterionId, setCriterionId] = useState<string>('');
  const [pointType, setPointType] = useState<'minus' | 'plus'>('minus');
  const [point, setPoint] = useState<number>(-2);
  const [level, setLevel] = useState<'Nhẹ' | 'Vừa' | 'Nghiêm trọng' | 'Rất nghiêm trọng'>('Nhẹ');
  const [note, setNote] = useState<string>('');
  const [evidenceUrl, setEvidenceUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Initialize or reset form values
  const getCriteriaForCategory = (catId: string) => {
    const list = criteria.filter(c => !catId || c.categoryId === catId);
    
    // Check if category already has a positive compliance criterion
    const hasCompliance = list.some(c => c.pointType === 'plus' && (c.code.endsWith('_00') || c.id.startsWith('crit_strict_')));
    
    if (catId && !hasCompliance) {
      const selectedCat = categories.find(c => c.id === catId);
      if (selectedCat) {
        const virtualCrit: ConductCriterion = {
          id: `crit_strict_${catId}`,
          categoryId: catId,
          categoryName: selectedCat.name,
          code: `TC_${selectedCat.code || catId.substring(4)}_00`,
          name: `Học sinh thực hiện nghiêm túc nội quy ${selectedCat.name.toLowerCase()}`,
          description: `Chấp hành tốt các quy định về ${selectedCat.name.toLowerCase()}`,
          pointType: 'plus',
          defaultPoint: 5,
          severity: 'Nhẹ',
          status: 'active',
          sortOrder: -1 // Highest priority
        };
        return [virtualCrit, ...list];
      }
    }
    
    return list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  };

  useEffect(() => {
    if (isOpen) {
      setRecordDate(new Date().toISOString().split('T')[0]);

      if (defaultStudentId) {
        setSelectedStudentIds([defaultStudentId]);
      } else {
        setSelectedStudentIds([]);
      }

      setStudentSearch('');
      setPointType(defaultType || 'minus');

      if (defaultCriterionId) {
        const foundCrit = criteria.find(c => c.id === defaultCriterionId);
        if (foundCrit) {
          setCategoryId(foundCrit.categoryId);
          setCriterionId(foundCrit.id);
          setPointType(foundCrit.pointType);
          setPoint(foundCrit.defaultPoint);
          setLevel(foundCrit.severity || 'Nhẹ');
        }
      } else if (categories.length > 0) {
        const firstCat = categories[0];
        setCategoryId(firstCat.id);
        const crits = getCriteriaForCategory(firstCat.id);
        if (crits.length > 0) {
          const first = crits[0];
          setCriterionId(first.id);
          setPointType(first.pointType);
          setPoint(first.defaultPoint);
          setLevel(first.severity || 'Nhẹ');
        }
      }
      setNote('');
      setEvidenceUrl('');
      setErrorMsg('');
    }
  }, [isOpen, defaultStudentId, defaultCriterionId, defaultType, students, criteria, categories]);

  // When Category changes, filter and enhance criteria list
  const filteredCriteria = getCriteriaForCategory(categoryId);

  // Filter students for search
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

  const selectStrictComplianceMode = () => {
    // Select all visible students in class
    setSelectedStudentIds(visibleStudents.map(s => s.id));

    // Get compliance criterion for current selected category
    const crits = getCriteriaForCategory(categoryId || (categories.length > 0 ? categories[0].id : ''));
    const strictCrit = crits[0];

    if (strictCrit) {
      setCategoryId(strictCrit.categoryId);
      setCriterionId(strictCrit.id);
      setPointType('plus');
      setPoint(strictCrit.defaultPoint > 0 ? strictCrit.defaultPoint : 5);
      setLevel('Nhẹ');
      setNote(`Học sinh thực hiện nghiêm túc nội quy ${strictCrit.categoryName.toLowerCase()}`);
    }
  };

  const handleCategoryChange = (catId: string) => {
    setCategoryId(catId);
    const crits = getCriteriaForCategory(catId);
    if (crits.length > 0) {
      const first = crits[0];
      setCriterionId(first.id);
      setPointType(first.pointType);
      setPoint(first.defaultPoint);
      setLevel(first.severity || 'Nhẹ');
    }
  };

  const handleCriterionChange = (critId: string) => {
    setCriterionId(critId);
    const found = filteredCriteria.find(c => c.id === critId);
    if (found) {
      setPointType(found.pointType);
      setPoint(found.defaultPoint);
      setLevel(found.severity || 'Nhẹ');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) {
      setErrorMsg('Vui lòng chọn lớp học.');
      return;
    }
    if (selectedStudentIds.length === 0) {
      setErrorMsg('Vui lòng tích chọn ít nhất 1 học sinh trong danh sách.');
      return;
    }
    if (!criterionId) {
      setErrorMsg('Vui lòng chọn tiêu chí vi phạm / khen thưởng.');
      return;
    }

    const selectedCriterion = filteredCriteria.find(c => c.id === criterionId);
    const selectedCategory = categories.find(c => c.id === categoryId) || categories.find(c => c.id === selectedCriterion?.categoryId);

    if (!selectedCriterion) {
      setErrorMsg('Tiêu chí không hợp lệ.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const dateObj = new Date(recordDate);
      const monthNumber = dateObj.getMonth() + 1;
      const weekNumber = Math.ceil(((dateObj.getTime() - new Date(dateObj.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);

      // Save record for each checked student
      for (const stId of selectedStudentIds) {
        const student = students.find(s => s.id === stId);
        if (!student) continue;

        await onSave({
          studentId: student.id,
          studentName: student.name,
          classId: selectedClass.id,
          className: selectedClass.name,
          schoolYear: selectedClass.schoolYear || '2026–2027',
          weekNumber,
          monthNumber,
          criterionId: selectedCriterion.id,
          criterionName: selectedCriterion.name,
          categoryId: selectedCategory?.id || selectedCriterion.categoryId,
          categoryName: selectedCategory?.name || selectedCriterion.categoryName,
          pointType,
          point: Number(point),
          level,
          note,
          evidenceUrl,
          recordedBy: user?.id || 'gvcn',
          recordedByName: user?.name || 'Giáo viên',
          recordDate
        });
      }

      setSubmitting(false);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Có lỗi xảy ra khi lưu ghi nhận.');
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#123B78] to-[#1457D9] text-white p-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <PlusCircle size={20} className="text-blue-200" />
              GHI NHẬN NỀN NẾP & RÈN LUYỆN
            </h2>
            <p className="text-xs text-blue-100">Chọn 1 hoặc nhiều học sinh để áp dụng điểm nếp rèn luyện</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Quick preset for compliant students */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-sm">
            <div className="text-xs text-emerald-900 font-bold flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>GHI NHẬN HỌC SINH THỰC HIỆN NGHIÊM TÚC</span>
            </div>
            <button
              type="button"
              onClick={selectStrictComplianceMode}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1"
            >
              ⭐ Chọn tất cả HS & Tuyên dương nghiêm túc (+5đ)
            </button>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ngày ghi nhận */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ngày ghi nhận <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            {/* Lớp */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lớp học
              </label>
              <input
                type="text"
                value={selectedClass?.name || '10A1'}
                disabled
                className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-bold cursor-not-allowed"
              />
            </div>
          </div>

          {/* CHỌN HỌC SINH VỚI HỘP KIỂM (CHECKBOXES) */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users size={16} className="text-blue-600" />
                HỘP KIỂM DANH SÁCH HỌC SINH{' '}
                <span className="text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full text-[11px] font-bold">
                  Đã chọn: {selectedStudentIds.length}/{students.length}
                </span>
              </label>

              <button
                type="button"
                onClick={selectAllStudents}
                className="text-xs text-blue-700 hover:text-blue-900 font-bold underline"
              >
                {selectedStudentIds.length === visibleStudents.length && visibleStudents.length > 0
                  ? 'Bỏ chọn tất cả'
                  : 'Chọn tất cả trong danh sách'}
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Tìm kiếm học sinh theo tên, mã HS..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Checkboxes List */}
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {visibleStudents.length === 0 ? (
                <div className="col-span-2 text-center py-4 text-xs text-slate-400">
                  Không tìm thấy học sinh phù hợp.
                </div>
              ) : (
                <>
                  <label
                    onClick={selectAllStudents}
                    className={`col-span-1 sm:col-span-2 flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all mb-1 ${
                      selectedStudentIds.length === visibleStudents.length && visibleStudents.length > 0
                        ? 'bg-blue-100 border-blue-400 text-blue-950 font-bold shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.length === visibleStudents.length && visibleStudents.length > 0}
                      onChange={() => {}} // handled by parent onClick
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer shrink-0"
                    />
                    <span className="font-bold text-blue-900">
                      ⬜ CHỌN TẤT CẢ HỌC SINH ({visibleStudents.length} em)
                    </span>
                  </label>

                  {visibleStudents.map((s) => {
                    const isChecked = selectedStudentIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        onClick={() => toggleStudent(s.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-blue-50/80 border-blue-400 text-blue-900 font-bold shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent label onClick
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer shrink-0"
                        />
                        <span className="font-mono text-[10px] text-slate-400 font-semibold">{s.code}</span>
                        <span className="truncate">{s.name}</span>
                      </label>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Chọn Nhóm tiêu chí */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nhóm tiêu chí
              </label>
              <select
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">-- Tất cả nhóm --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Chọn Tiêu chí */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tiêu chí <span className="text-rose-500">*</span>
              </label>
              <select
                value={criterionId}
                onChange={(e) => handleCriterionChange(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                required
              >
                <option value="">-- Chọn tiêu chí --</option>
                {filteredCriteria.map(c => (
                  <option key={c.id} value={c.id}>
                    [{c.code}] {c.name} ({c.pointType === 'plus' ? `+${c.defaultPoint}` : `${c.defaultPoint}`})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Loại & Số điểm */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Loại điểm</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer text-rose-700 select-none">
                  <input
                    type="radio"
                    name="pointType"
                    checked={pointType === 'minus' && !criterionId.startsWith('crit_strict_')}
                    onChange={() => {
                      setPointType('minus');
                      if (point > 0) setPoint(-Math.abs(point));
                      // If compliance was selected, reset to first normal criterion of category
                      if (criterionId.startsWith('crit_strict_')) {
                        const normal = filteredCriteria.find(c => !c.id.startsWith('crit_strict_'));
                        if (normal) {
                          setCriterionId(normal.id);
                          setPointType(normal.pointType);
                          setPoint(normal.defaultPoint);
                          setLevel(normal.severity || 'Nhẹ');
                        }
                      }
                    }}
                    className="accent-rose-600"
                  />
                  <span>Điểm trừ (Vi phạm)</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer text-emerald-700 select-none">
                  <input
                    type="radio"
                    name="pointType"
                    checked={pointType === 'plus' && !criterionId.startsWith('crit_strict_')}
                    onChange={() => {
                      setPointType('plus');
                      if (point < 0) setPoint(Math.abs(point));
                      // If compliance was selected, reset to first normal criterion of category
                      if (criterionId.startsWith('crit_strict_')) {
                        const normal = filteredCriteria.find(c => !c.id.startsWith('crit_strict_'));
                        if (normal) {
                          setCriterionId(normal.id);
                          setPointType(normal.pointType);
                          setPoint(normal.defaultPoint);
                          setLevel(normal.severity || 'Nhẹ');
                        }
                      }
                    }}
                    className="accent-emerald-600"
                  />
                  <span>Điểm cộng (Khen thưởng)</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-blue-800 bg-blue-50/80 hover:bg-blue-100/95 px-2 py-1.5 rounded-xl border border-blue-200 transition-all select-none">
                  <input
                    type="radio"
                    name="pointType"
                    checked={criterionId.startsWith('crit_strict_') || criterionId === 'crit_strict'}
                    onChange={() => {
                      setPointType('plus');
                      // Find dynamic compliance criterion for current selected category or fallback
                      let strictCrit = filteredCriteria.find(c => c.id.startsWith('crit_strict_') || c.id === 'crit_strict');
                      if (!strictCrit) {
                        strictCrit = criteria.find(c => c.id === 'crit_strict');
                      }
                      if (strictCrit) {
                        setCategoryId(strictCrit.categoryId);
                        setCriterionId(strictCrit.id);
                        setPoint(strictCrit.defaultPoint > 0 ? strictCrit.defaultPoint : 5);
                        setLevel('Nhẹ');
                        setNote(strictCrit.description || `Học sinh thực hiện nghiêm túc nội quy ${strictCrit.categoryName ? strictCrit.categoryName.toLowerCase() : 'trường'}`);
                      }
                    }}
                    className="accent-blue-600"
                  />
                  <span className="flex items-center gap-1 text-[11px]">
                    ⭐ Thực hiện nghiêm túc (+5đ)
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số điểm</label>
              <input
                type="number"
                value={point}
                onChange={(e) => setPoint(Number(e.target.value))}
                className={`w-full px-3 py-1.5 text-xs font-bold border rounded-xl outline-none ${
                  pointType === 'plus' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-rose-300 text-rose-700 bg-rose-50'
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mức độ vi phạm</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="Nhẹ">Nhẹ</option>
                <option value="Vừa">Vừa</option>
                <option value="Nghiêm trọng">Nghiêm trọng</option>
                <option value="Rất nghiêm trọng">Rất nghiêm trọng</option>
              </select>
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú / Chi tiết vi phạm</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Nhập diễn biến sự việc hoặc mô tả nội dung tuyên dương..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          {/* Minh chứng */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Paperclip size={14} className="text-slate-500" />
              Minh chứng (đính kèm link/tên tài liệu)
            </label>
            <input
              type="text"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="VD: Biên bản số 01/BB-2026 hoặc link ảnh minh chứng..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Người ghi nhận */}
          <div className="bg-slate-100 p-2.5 rounded-xl text-xs text-slate-600 flex items-center justify-between">
            <span>Người ghi nhận:</span>
            <strong className="text-slate-800">{user?.name || 'Giáo viên'} ({user?.role || 'GVCN'})</strong>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[#1457D9] hover:bg-[#123B78] text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-2"
            >
              {submitting ? 'Đang lưu...' : (
                <>
                  <CheckCircle2 size={16} /> Lưu ghi nhận ({selectedStudentIds.length} học sinh)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
