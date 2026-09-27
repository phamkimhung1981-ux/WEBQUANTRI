import React, { useState, useEffect } from 'react';
import {
  X,
  PlusCircle,
  CheckCircle2,
  Paperclip,
  Save,
  Trash2,
  Edit3,
  AlertCircle,
  History,
  ShieldAlert
} from 'lucide-react';
import { Student, ConductCategory, ConductCriterion, ConductRecord, ClassInfo, ViolationCategoryType, ViolationSeverity, WarningLevel } from '../../types/homeroom';
import { useAuth } from '../../store/AuthContext';
import { getDefaultDateForMonthAndWeek, getMonthNumberFromLabel } from '../../utils/schoolWeekUtils';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClass: ClassInfo | null;
  students: Student[];
  categories: ConductCategory[];
  criteria: ConductCriterion[];
  records?: ConductRecord[];
  onSave: (record: Omit<ConductRecord, 'id' | 'createdAt'>) => Promise<any>;
  onUpdateRecord?: (id: string, updates: Partial<ConductRecord>) => Promise<void>;
  onDeleteRecord?: (id: string) => Promise<void>;
  defaultStudentId?: string;
  defaultCriterionId?: string;
  defaultType?: 'plus' | 'minus';
  violationConfigs?: any[];
  selectedWeek?: number;
  selectedMonth?: string;
  selectedSchoolYear?: string;
}

export default function RecordModal({
  isOpen,
  onClose,
  selectedClass,
  students,
  categories,
  criteria,
  records = [],
  onSave,
  onUpdateRecord,
  onDeleteRecord,
  defaultStudentId,
  defaultCriterionId,
  selectedWeek,
  selectedMonth,
  selectedSchoolYear
}: RecordModalProps) {
  const { user } = useAuth();

  // Active student state
  const [activeStudentId, setActiveStudentId] = useState<string>('');

  const [recordDate, setRecordDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [categoryType, setCategoryType] = useState<ViolationCategoryType>('NỘI QUY');
  const [criterionId, setCriterionId] = useState<string>('');
  
  // Point type is STRICTLY minus / violation for conduct recording
  const pointType = 'minus';
  const [pointMagnitude, setPointMagnitude] = useState<number>(2); // Stored as positive input e.g. 2, 5
  
  const [level, setLevel] = useState<ViolationSeverity>('Nhẹ');
  const [location, setLocation] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [evidenceUrl, setEvidenceUrl] = useState<string>('');
  const [hasConductWarning, setHasConductWarning] = useState<boolean>(false);
  const [proposedRatingState, setProposedRatingState] = useState<string>('Theo dõi');
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState<string>('');

  // Find active student object
  const currentStudent = students.find(s => s.id === activeStudentId) || (students.length > 0 ? students[0] : null);

  // Get criteria for currently selected category
  const filteredCriteria = criteria
    .filter(c => !categoryId || c.categoryId === categoryId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // Get history records belonging ONLY to current student
  const currentStudentHistory = records.filter(r => r.studentId === currentStudent?.id);

  // Existing record for current student for currently selected criterion
  const existingStudentCriterionRecord = records.find(
    r => r.studentId === currentStudent?.id && r.criterionId === criterionId
  );

  // Sync inputs when active student or criterion changes
  useEffect(() => {
    if (!criterionId || !currentStudent) return;

    const existing = existingStudentCriterionRecord;
    if (existing) {
      setPointMagnitude(Math.abs(existing.point || 2));
      setLevel(existing.level || 'Nhẹ');
      if (existing.categoryType) setCategoryType(existing.categoryType);
      if (existing.location) setLocation(existing.location);
      if (existing.note) setNote(existing.note);
      if (existing.evidenceUrl) setEvidenceUrl(existing.evidenceUrl);
      if (existing.hasConductWarning !== undefined) setHasConductWarning(existing.hasConductWarning);
      if (existing.proposedRating) {
        if (existing.proposedRating === 'YẾU / CHƯA ĐẠT') {
          setProposedRatingState('Chưa đạt (Xếp Yếu)');
        } else {
          setProposedRatingState(existing.proposedRating);
        }
      }
    }
  }, [criterionId, activeStudentId, records.length]);

  // Modal open initialization
  useEffect(() => {
    if (isOpen) {
      const mNum = getMonthNumberFromLabel(selectedMonth || 'Tháng 09');
      const wNum = selectedWeek !== undefined ? selectedWeek : 3;
      setRecordDate(getDefaultDateForMonthAndWeek(mNum, wNum, selectedSchoolYear || '2026–2027'));

      if (defaultStudentId) {
        setActiveStudentId(defaultStudentId);
      } else if (students.length > 0) {
        setActiveStudentId(students[0].id);
      }

      setPointMagnitude(2);
      setCategoryType('NỘI QUY');
      setLocation('');
      setHasConductWarning(false);
      setProposedRatingState('Theo dõi');
      setSuccessToast('');
      setNote('');
      setEvidenceUrl('');
      setErrorMsg('');

      if (defaultCriterionId) {
        const foundCrit = criteria.find(c => c.id === defaultCriterionId);
        if (foundCrit) {
          setCategoryId(foundCrit.categoryId);
          setCriterionId(foundCrit.id);
          setPointMagnitude(Math.abs(foundCrit.defaultPoint || 2));
          setLevel(foundCrit.severity || 'Nhẹ');
        }
      } else if (categories.length > 0) {
        const firstCat = categories[0];
        setCategoryId(firstCat.id);
        const crits = criteria.filter(c => c.categoryId === firstCat.id);
        if (crits.length > 0) {
          const first = crits[0];
          setCriterionId(first.id);
          setPointMagnitude(Math.abs(first.defaultPoint || 2));
          setLevel(first.severity || 'Nhẹ');
        }
      }
    }
  }, [isOpen, defaultStudentId, defaultCriterionId, students, criteria, categories]);

  // Auto set warning flag & rating state based on special violation types
  useEffect(() => {
    if (categoryType === 'ATGT' || categoryType === 'BẠO LỰC HỌC ĐƯỜNG' || categoryType === 'GIAN LẬN THI CỬ') {
      setHasConductWarning(true);
      setProposedRatingState('Chưa đạt (Xếp Yếu)');
    } else if (level === 'Nghiêm trọng' || level === 'Rất nghiêm trọng') {
      setHasConductWarning(true);
    }
  }, [categoryType, level]);

  // Switch Category
  const handleCategoryChange = (catId: string) => {
    setCategoryId(catId);
    const crits = criteria.filter(c => !catId || c.categoryId === catId);
    if (crits.length > 0) {
      const first = crits[0];
      setCriterionId(first.id);

      const existing = records.find(r => r.studentId === currentStudent?.id && r.criterionId === first.id);
      if (existing) {
        setPointMagnitude(Math.abs(existing.point || 2));
        setLevel(existing.level || 'Nhẹ');
        if (existing.note) setNote(existing.note);
      } else {
        setPointMagnitude(Math.abs(first.defaultPoint || 2));
        setLevel(first.severity || 'Nhẹ');
        setNote('');
      }
    }
  };

  // Switch Criterion
  const handleCriterionChange = (critId: string) => {
    setCriterionId(critId);
    const found = filteredCriteria.find(c => c.id === critId) || criteria.find(c => c.id === critId);
    if (found) {
      const existing = records.find(r => r.studentId === currentStudent?.id && r.criterionId === critId);
      if (existing) {
        setPointMagnitude(Math.abs(existing.point || 2));
        setLevel(existing.level || 'Nhẹ');
        if (existing.note) setNote(existing.note);
      } else {
        setPointMagnitude(Math.abs(found.defaultPoint || 2));
        setLevel(found.severity || 'Nhẹ');
        setNote('');
      }
    }
  };

  // Save record for current single student (STRICTLY MINUS POINT)
  const handleSaveCurrentStudent = async () => {
    try {
      if (!currentStudent) {
        throw new Error('Chưa chọn học sinh để ghi nhận.');
      }
      if (!criterionId) {
        throw new Error('Vui lòng chọn tiêu chí đánh giá.');
      }

      setSubmitting(true);
      setErrorMsg('');
      setSuccessToast('');

      const selectedCriterion = filteredCriteria.find(c => c.id === criterionId) || criteria.find(c => c.id === criterionId);
      const selectedCategory = categories.find(c => c.id === categoryId) || categories.find(c => c.id === selectedCriterion?.categoryId);

      if (!selectedCriterion) throw new Error('Tiêu chí không hợp lệ.');

      const dateObj = new Date(recordDate);
      const parsedMonth = selectedMonth ? parseInt(selectedMonth.replace(/\D/g, ''), 10) : NaN;
      const monthNumber = !isNaN(parsedMonth) && parsedMonth > 0 ? parsedMonth : (dateObj.getMonth() + 1);
      const weekNumber = selectedWeek !== undefined ? selectedWeek : Math.ceil(((dateObj.getTime() - new Date(dateObj.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
      const schoolYear = selectedSchoolYear || selectedClass?.schoolYear || '2026–2027';

      const isSpecial = categoryType === 'ATGT' || categoryType === 'BẠO LỰC HỌC ĐƯỜNG' || categoryType === 'GIAN LẬN THI CỬ';

      let warningLabel = '';
      if (categoryType === 'ATGT') warningLabel = '⚠ ATGT';
      else if (categoryType === 'BẠO LỰC HỌC ĐƯỜNG') warningLabel = '🔴 BẠO LỰC HỌC ĐƯỜNG';
      else if (categoryType === 'GIAN LẬN THI CỬ') warningLabel = '🔴 GIAN LẬN THI CỬ';
      else if (level === 'Nghiêm trọng' || level === 'Rất nghiêm trọng') warningLabel = '🔴 VI PHẠM NGHIÊM TRỌNG';

      let finalProposedRating = 'Theo dõi đánh giá';
      if (isSpecial || proposedRatingState === 'Chưa đạt (Xếp Yếu)') {
        finalProposedRating = 'YẾU / CHƯA ĐẠT';
      } else if (proposedRatingState && proposedRatingState !== 'Theo dõi') {
        finalProposedRating = proposedRatingState;
      }

      const isWarningActive = isSpecial || hasConductWarning || proposedRatingState === 'Chưa đạt (Xếp Yếu)';
      const requiresBghApproval = isWarningActive || level === 'Nghiêm trọng' || level === 'Rất nghiêm trọng';

      // Enforce strict negative point (score = -pointMagnitude)
      const minusPointValue = -Math.abs(Number(pointMagnitude) || 2);

      const recordPayload = {
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        classId: selectedClass?.id || currentStudent.classId,
        className: selectedClass?.name || currentStudent.className || '10A',
        schoolYear,
        weekNumber,
        monthNumber,
        criterionId: selectedCriterion.id,
        criterionName: selectedCriterion.name,
        categoryId: selectedCategory?.id || selectedCriterion.categoryId,
        categoryName: selectedCategory?.name || selectedCriterion.categoryName,
        categoryType,
        location,
        pointType: 'minus' as const,
        point: minusPointValue,
        level,
        hasConductWarning: isWarningActive,
        special_warning: isSpecial,
        special_warning_message: isSpecial ? 'Học sinh có vi phạm thuộc nhóm cảnh báo đặc biệt.' : undefined,
        conduct_rating: isSpecial ? 'YẾU / CHƯA ĐẠT' : undefined,
        warningLevel: (isSpecial ? 'critical' : (level === 'Rất nghiêm trọng' ? 'critical' : (isWarningActive ? 'serious' : 'mild'))) as WarningLevel,
        warningLabel,
        proposedRating: finalProposedRating,
        requiresBghApproval,
        bghApprovalStatus: (requiresBghApproval ? 'Chưa duyệt' : undefined) as ('Chưa duyệt' | undefined),
        note,
        evidenceUrl,
        recordedBy: user?.id || 'gvcn',
        recordedByName: user?.name || 'Giáo viên',
        recordDate
      };

      if (existingStudentCriterionRecord && onUpdateRecord) {
        await onUpdateRecord(existingStudentCriterionRecord.id, recordPayload);
        setSuccessToast(`✅ Đã cập nhật vi phạm [${selectedCriterion.code}] (-${Math.abs(minusPointValue)}đ) cho ${currentStudent.name}!`);
      } else {
        await onSave(recordPayload);
        setSuccessToast(`✅ Đã ghi nhận vi phạm [${selectedCriterion.code}] (-${Math.abs(minusPointValue)}đ) cho ${currentStudent.name}!`);
      }

      setSubmitting(false);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Có lỗi xảy ra khi lưu ghi nhận.');
      setSubmitting(false);
    }
  };

  // Edit record from history
  const handleEditHistoryRecord = (rec: ConductRecord) => {
    setCriterionId(rec.criterionId);
    setPointMagnitude(Math.abs(rec.point || 2));
    setLevel(rec.level || 'Nhẹ');
    if (rec.categoryType) setCategoryType(rec.categoryType);
    if (rec.location) setLocation(rec.location);
    if (rec.note) setNote(rec.note);
    if (rec.evidenceUrl) setEvidenceUrl(rec.evidenceUrl);
    setSuccessToast(`✏️ Đã tải lại tiêu chí [${rec.criterionName}] để chỉnh sửa.`);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  // Delete record from history
  const handleDeleteHistoryRecord = async (recId: string) => {
    if (!onDeleteRecord) return;
    if (window.confirm('Bạn có chắc chắn muốn xóa ghi nhận này của học sinh?')) {
      try {
        setSubmitting(true);
        await onDeleteRecord(recId);
        setSuccessToast('✅ Đã xóa ghi nhận vi phạm thành công.');
        setSubmitting(false);
        setTimeout(() => setSuccessToast(''), 3000);
      } catch (err: any) {
        setErrorMsg('Lỗi khi xóa ghi nhận: ' + err.message);
        setSubmitting(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-4 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#123B78] to-[#1457D9] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <PlusCircle size={20} className="text-blue-200 shrink-0" />
              GHI NHẬN NỀN NẾP & VI PHẠM HỌC SINH
            </h2>
            <p className="text-xs text-blue-100 mt-0.5">
              Chỉ ghi nhận điểm trừ do vi phạm nội quy • Cập nhật trừ điểm rèn luyện trực tiếp
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1. HỌC SINH ĐƯỢC ĐÁNH GIÁ (Fixed Info Box) */}
        {currentStudent ? (
          <div className="bg-blue-50/90 border-b border-blue-200 p-3.5 px-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center text-base shadow-xs shrink-0">
                {currentStudent.name.split(' ').pop()?.charAt(0) || 'H'}
              </div>
              <div>
                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                  👤 HỌC SINH ĐƯỢC ĐÁNH GIÁ
                </span>
                <div className="font-black text-blue-950 text-base flex items-center gap-2">
                  <span>{currentStudent.name}</span>
                  <span className="text-xs font-bold text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-blue-200">
                    Mã HS: <strong className="font-mono text-blue-900">{currentStudent.code}</strong>
                  </span>
                  <span className="text-xs font-bold text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-blue-200">
                    Lớp: <strong className="text-blue-900">{selectedClass?.name || currentStudent.className || '10A'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick student switcher */}
            {students.length > 1 && (
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-blue-200 shadow-2xs">
                <span className="text-xs text-slate-500 font-medium">Đổi HS khác:</span>
                <select
                  value={activeStudentId}
                  onChange={(e) => setActiveStudentId(e.target.value)}
                  className="bg-transparent font-bold text-xs text-blue-950 outline-none cursor-pointer"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : null}

        {/* Modal Form Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          {/* Toast Notice */}
          {successToast && (
            <div className="bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs p-3 rounded-xl flex items-center gap-2 font-bold shadow-xs animate-in fade-in">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Controls Section */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3.5 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Ngày ghi nhận */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ngày ghi nhận <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              {/* Nhóm tiêu chí */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nhóm tiêu chí
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                >
                  <option value="">-- Tất cả nhóm tiêu chí --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Tiêu chí đánh giá */}
              <div>
                <label className="block text-xs font-bold text-blue-900 mb-1">
                  Tiêu chí vi phạm <span className="text-rose-500">*</span>
                </label>
                <select
                  value={criterionId}
                  onChange={(e) => handleCriterionChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border-2 border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50 font-bold text-blue-950"
                  required
                >
                  <option value="">-- Chọn tiêu chí --</option>
                  {filteredCriteria.map(c => {
                    const isRec = records.some(r => r.studentId === currentStudent?.id && r.criterionId === c.id);
                    return (
                      <option key={c.id} value={c.id}>
                        {isRec ? '✅ ' : '🟡 '} [{c.code}] {c.name} (-{Math.abs(c.defaultPoint)})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Criteria Badges Quick Switch */}
            {filteredCriteria.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-600 block">
                  📋 Tiêu chí vi phạm thuộc nhóm đang chọn:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {filteredCriteria.map(c => {
                    const isRec = records.some(r => r.studentId === currentStudent?.id && r.criterionId === c.id);
                    const isSelected = c.id === criterionId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleCriterionChange(c.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border text-left transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-700 font-bold shadow-xs'
                            : isRec
                            ? 'bg-rose-50 text-rose-900 border-rose-300 font-semibold'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isRec ? '✅' : '🟡'}
                        <span className="font-mono text-[10px] opacity-80">{c.code}:</span>
                        <span className="truncate max-w-[180px]">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Score & Severity row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
              {/* Loại điểm STRICTLY MINUS */}
              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">LOẠI ĐIỂM</label>
                <div className="flex items-center gap-2 pt-1 font-extrabold text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
                  <span>🔴 Điểm trừ (Vi phạm)</span>
                </div>
              </div>

              {/* Số điểm trừ */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Số điểm trừ</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-rose-600 font-black text-xs">-</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={pointMagnitude}
                    onChange={(e) => setPointMagnitude(Math.abs(Number(e.target.value)))}
                    className="w-full pl-6 pr-3 py-1 text-xs font-bold border border-rose-300 text-rose-700 bg-rose-50 rounded-lg outline-none"
                    required
                  />
                </div>
              </div>

              {/* Mức độ vi phạm */}
              <div className="md:col-span-6">
                <label className="block text-xs font-bold text-slate-700 mb-1">Mức độ vi phạm</label>
                <div className="flex flex-wrap gap-1">
                  {[
                    { val: 'Nhẹ', label: '🟢 Nhẹ' },
                    { val: 'Vừa', label: '🟡 Vừa' },
                    { val: 'Nghiêm trọng', label: '🔴 Nghiêm trọng' },
                    { val: 'Rất nghiêm trọng', label: '🚨 Rất nghiêm trọng' }
                  ].map(item => (
                    <label
                      key={item.val}
                      className={`px-2 py-1 rounded-lg border flex items-center gap-1 cursor-pointer text-[11px] font-bold transition-all ${
                        level === item.val
                          ? 'bg-rose-100 border-rose-400 text-rose-900 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="severity_level_radio"
                        value={item.val}
                        checked={level === item.val}
                        onChange={() => setLevel(item.val as any)}
                        className="accent-rose-600 shrink-0"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Phân loại & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phân loại vi phạm</label>
                <select
                  value={categoryType}
                  onChange={(e) => {
                    const val = e.target.value as ViolationCategoryType;
                    setCategoryType(val);
                    if (val === 'ATGT' || val === 'BẠO LỰC HỌC ĐƯỜNG' || val === 'GIAN LẬN THI CỬ') {
                      setHasConductWarning(true);
                      setProposedRatingState('Chưa đạt (Xếp Yếu)');
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-xs font-bold border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none bg-white text-rose-900"
                >
                  <option value="NỘI QUY">Nội quy thông thường</option>
                  <option value="ATGT">An toàn giao thông</option>
                  <option value="BẠO LỰC HỌC ĐƯỜNG">Bạo lực học đường</option>
                  <option value="GIAN LẬN THI CỬ">Gian lận thi cử</option>
                  <option value="KHÁC">Vi phạm khác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">📍 Địa điểm vi phạm</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ví dụ: Cổng trường, Sân trường, Phòng 202, Bãi xe..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú / Mô tả chi tiết</label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập diễn biến sự việc vi phạm..."
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>

            {/* Proposed Rating & Special Warning */}
            <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200 space-y-2">
              <label className="block text-xs font-bold text-amber-950">
                🎯 Đề xuất xếp loại rèn luyện do vi phạm:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { val: 'Theo dõi', label: '○ Theo dõi thêm' },
                  { val: 'Khá', label: '○ Khống chế Khá' },
                  { val: 'Đạt', label: '○ Khống chế Đạt' },
                  { val: 'Chưa đạt (Xếp Yếu)', label: '🔴 XẾP YẾU / CHƯA ĐẠT' }
                ].map(r => {
                  const isSpecial = categoryType === 'ATGT' || categoryType === 'BẠO LỰC HỌC ĐƯỜNG' || categoryType === 'GIAN LẬN THI CỬ';
                  const isChecked = proposedRatingState === r.val;
                  const isDanger = r.val === 'Chưa đạt (Xếp Yếu)';

                  return (
                    <label
                      key={r.val}
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-center gap-1 cursor-pointer text-xs font-bold transition-all ${
                        isChecked
                          ? isDanger
                            ? 'bg-rose-600 text-white border-rose-700 shadow-xs font-black'
                            : 'bg-amber-200 text-amber-950 border-amber-400'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="proposed_rating_choice"
                        value={r.val}
                        checked={isChecked}
                        disabled={isSpecial && !isDanger}
                        onChange={() => setProposedRatingState(r.val)}
                        className="hidden"
                      />
                      <span>{r.label}</span>
                    </label>
                  );
                })}
              </div>

              {(categoryType === 'ATGT' || categoryType === 'BẠO LỰC HỌC ĐƯỜNG' || categoryType === 'GIAN LẬN THI CỬ') && (
                <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-rose-950 text-xs font-bold flex items-center gap-2 mt-1">
                  <ShieldAlert size={16} className="text-rose-600 shrink-0" />
                  <span>⚠️ CẢNH BÁO ĐẶC BIỆT: Tự động xếp loại YẾU / CHƯA ĐẠT!</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. LỊCH SỬ VI PHẠM CỦA HỌC SINH NÀY */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-2 p-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-extrabold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                <History size={16} className="text-blue-600" />
                LỊCH SỬ VI PHẠM CỦA HỌC SINH NÀY ({currentStudent?.name})
              </h3>
              <span className="text-[11px] font-bold text-slate-500">
                Tổng số lượt đã ghi nhận: <strong className="text-rose-700">{currentStudentHistory.length}</strong>
              </span>
            </div>

            <div className="overflow-x-auto max-h-52 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 min-w-[180px]">Tiêu chí vi phạm</th>
                    <th className="p-2.5 w-24 text-center">Điểm trừ</th>
                    <th className="p-2.5 w-24 text-center">Mức độ</th>
                    <th className="p-2.5 w-28 text-center">Ngày ghi nhận</th>
                    <th className="p-2.5 min-w-[150px]">Ghi chú</th>
                    <th className="p-2.5 w-28 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentStudentHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        Học sinh {currentStudent?.name} chưa có lịch sử vi phạm nào.
                      </td>
                    </tr>
                  ) : (
                    currentStudentHistory.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 font-bold text-slate-900">
                          {rec.criterionName}
                          {rec.special_warning && (
                            <span className="ml-1 text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold">
                              Cảnh báo đặc biệt
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="font-bold px-2 py-0.5 rounded text-[11px] bg-rose-100 text-rose-800 border border-rose-300">
                            -{Math.abs(rec.point)} điểm
                          </span>
                        </td>
                        <td className="p-2.5 text-center text-slate-600 font-medium">
                          {rec.level || 'Nhẹ'}
                        </td>
                        <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">
                          {rec.recordDate}
                        </td>
                        <td className="p-2.5 text-slate-600 truncate max-w-[180px]">
                          {rec.note || '—'}
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditHistoryRecord(rec)}
                              className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] rounded transition-colors flex items-center gap-0.5 cursor-pointer"
                              title="Sửa bản ghi này"
                            >
                              <Edit3 size={11} /> Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteHistoryRecord(rec.id)}
                              className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-[11px] rounded transition-colors flex items-center gap-0.5 cursor-pointer"
                              title="Xóa bản ghi này"
                            >
                              <Trash2 size={11} /> Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Ghi nhận vi phạm cho học sinh <strong className="text-slate-800">{currentStudent?.name}</strong>.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Hủy / Đóng
            </button>

            {/* Save Record button */}
            <button
              type="button"
              onClick={handleSaveCurrentStudent}
              disabled={submitting}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save size={16} />
              {submitting ? 'Đang lưu...' : `💾 GHI NHẬN VI PHẠM CHO ${currentStudent?.name.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
