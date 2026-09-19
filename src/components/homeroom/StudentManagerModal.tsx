import React, { useState, useRef } from 'react';
import {
  X,
  UserPlus,
  FileSpreadsheet,
  Download,
  Upload,
  Check,
  AlertCircle,
  CheckCircle2,
  Users,
  Edit3,
  Trash2,
  Phone,
  MapPin,
  Calendar,
  Sparkles
} from 'lucide-react';
import { Student, ClassInfo } from '../../types/homeroom';
import {
  exportStudentListToExcel,
  downloadStudentTemplateExcel,
  parseStudentExcelFile,
  ParsedStudentRow
} from '../../utils/studentExcel';

interface StudentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClass: ClassInfo | undefined;
  schoolYear: string;
  students: Student[];
  onAddStudent: (student: Omit<Student, 'id'>) => Promise<any>;
  onAddStudentsBulk: (students: Omit<Student, 'id'>[]) => Promise<any>;
  onUpdateStudent: (id: string, updates: Partial<Student>) => Promise<any>;
  onDeleteStudent: (id: string) => Promise<any>;
  onDeleteStudentsBulk: (ids: string[]) => Promise<any>;
}

export default function StudentManagerModal({
  isOpen,
  onClose,
  selectedClass,
  schoolYear,
  students,
  onAddStudent,
  onAddStudentsBulk,
  onUpdateStudent,
  onDeleteStudent,
  onDeleteStudentsBulk
}: StudentManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'single' | 'excel' | 'list'>('single');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Global alerts
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Student to delete for custom overlay
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Bulk selection states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Reset selection states on modal toggle
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedIds([]);
      setShowDeleteAllConfirm(false);
      setShowBulkDeleteConfirm(false);
      setStudentToDelete(null);
    }
  }, [isOpen]);

  // Reset selection when tab changes
  React.useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  // Single Add Form
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [dob, setDob] = useState('2010-01-01');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [address, setAddress] = useState('');

  // Excel Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importError, setImportError] = useState('');

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editGender, setEditGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [editDob, setEditDob] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [editParentName, setEditParentName] = useState('');
  const [editAddress, setEditAddress] = useState('');

  if (!isOpen || !selectedClass) return null;

  // Handle single student submit
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập Họ và tên học sinh!');
      return;
    }

    try {
      setIsSubmitting(true);
      const studentCode = code.trim() || `HS${selectedClass.name}${Date.now().toString().slice(-4)}`;

      await onAddStudent({
        code: studentCode,
        name: name.trim(),
        gender,
        dob,
        classId: selectedClass.id,
        className: selectedClass.name,
        parentName: parentName.trim() || undefined,
        parentPhone: parentPhone.trim() || undefined,
        address: address.trim() || undefined
      });

      setSuccessMsg(`Thêm học sinh ${name.trim()} vào lớp ${selectedClass.name} thành công!`);
      // Reset form
      setCode('');
      setName('');
      setParentName('');
      setParentPhone('');
      setAddress('');
      setTimeout(() => {
        setActiveTab('list');
        setSuccessMsg('');
      }, 1500);
    } catch (err) {
      setErrorMsg('Có lỗi xảy ra khi thêm học sinh!');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle file select for Excel
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportError('');
    setIsSubmitting(true);

    try {
      const rows = await parseStudentExcelFile(file);
      if (rows.length === 0) {
        setImportError('File Excel không có dữ liệu học sinh hoặc sai định dạng mẫu!');
        setParsedRows([]);
      } else {
        setParsedRows(rows);
      }
    } catch (err) {
      setImportError('Không thể đọc file Excel. Vui lòng kiểm tra định dạng file .xlsx hoặc .xls');
      setParsedRows([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Excel Bulk Import
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      setIsSubmitting(true);
      const payload = parsedRows.map(r => ({
        code: r.code,
        name: r.name,
        gender: r.gender,
        dob: r.dob,
        classId: selectedClass.id,
        className: selectedClass.name,
        parentName: r.parentName,
        parentPhone: r.parentPhone,
        address: r.address
      }));

      await onAddStudentsBulk(payload);
      setSuccessMsg(`Đã nhập thành công ${parsedRows.length} học sinh vào lớp ${selectedClass.name}!`);
      setParsedRows([]);
      setFileName('');
      setTimeout(() => {
        setActiveTab('list');
        setSuccessMsg('');
      }, 1500);
    } catch (err) {
      setErrorMsg('Có lỗi xảy ra khi nhập danh sách học sinh!');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit student inline
  const startEdit = (s: Student) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditCode(s.code || '');
    setEditGender(s.gender || 'Nam');
    setEditDob(s.dob || '2010-01-01');
    setEditParentPhone(s.parentPhone || '');
    setEditParentName(s.parentName || '');
    setEditAddress(s.address || '');
  };

  const handleSaveEdit = async (id: string) => {
    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await onUpdateStudent(id, {
        name: editName.trim(),
        code: editCode.trim(),
        gender: editGender,
        dob: editDob,
        parentPhone: editParentPhone.trim() || undefined,
        parentName: editParentName.trim() || undefined,
        address: editAddress.trim() || undefined
      });
      setEditingId(null);
      setSuccessMsg('Đã cập nhật thông tin học sinh thành công!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg('Có lỗi khi cập nhật thông tin học sinh!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (s: Student) => {
    setStudentToDelete(s);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative">
        {/* Custom Confirmation Modal Overlay */}
        {studentToDelete && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Xác nhận xóa học sinh?</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Bạn có chắc chắn muốn xóa học sinh <strong className="text-rose-600">{studentToDelete.name}</strong> (Mã: {studentToDelete.code}) khỏi lớp {selectedClass.name}?
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStudentToDelete(null)}
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setIsSubmitting(true);
                        setErrorMsg('');
                        setSuccessMsg('');
                        await onDeleteStudent(studentToDelete.id);
                        setSuccessMsg(`Đã xóa thành công học sinh ${studentToDelete.name}!`);
                        setStudentToDelete(null);
                        setTimeout(() => setSuccessMsg(''), 3000);
                      } catch (err: any) {
                        setErrorMsg('Lỗi khi xóa học sinh: ' + (err.message || err));
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-lg transition-colors"
                  >
                    {isSubmitting ? 'Đang xóa...' : 'Xác nhận xóa'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom Bulk Delete Confirmation Modal Overlay */}
        {showBulkDeleteConfirm && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Xác nhận xóa {selectedIds.length} học sinh?</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Hành động này sẽ xóa <strong className="text-rose-600">{selectedIds.length} học sinh</strong> đã chọn khỏi lớp {selectedClass.name}. Điểm số và rèn luyện liên kết sẽ bị xóa vĩnh viễn. Bạn có chắc chắn?
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkDeleteConfirm(false)}
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setIsSubmitting(true);
                        setErrorMsg('');
                        setSuccessMsg('');
                        await onDeleteStudentsBulk(selectedIds);
                        setSuccessMsg(`Đã xóa thành công ${selectedIds.length} học sinh khỏi lớp!`);
                        setSelectedIds([]);
                        setShowBulkDeleteConfirm(false);
                        setTimeout(() => setSuccessMsg(''), 3000);
                      } catch (err: any) {
                        setErrorMsg('Lỗi khi xóa danh sách học sinh: ' + (err.message || err));
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-lg transition-colors"
                  >
                    {isSubmitting ? 'Đang xóa...' : 'Xác nhận xóa'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom Delete All Confirmation Modal Overlay */}
        {showDeleteAllConfirm && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 animate-bounce">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-red-900 uppercase">Cảnh báo: Xóa sạch học sinh?</h3>
                  <p className="text-[11px] text-slate-500 mt-1 font-semibold leading-relaxed">
                    Hành động này sẽ <strong className="text-red-700">Xóa toàn bộ {students.length} học sinh</strong> của lớp {selectedClass.name}. Lịch sử vi phạm và điểm rèn luyện sẽ bị ảnh hưởng và không thể khôi phục!
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteAllConfirm(false)}
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setIsSubmitting(true);
                        setErrorMsg('');
                        setSuccessMsg('');
                        const allIds = students.map(s => s.id);
                        await onDeleteStudentsBulk(allIds);
                        setSuccessMsg(`Đã xóa sạch toàn bộ ${allIds.length} học sinh của lớp!`);
                        setSelectedIds([]);
                        setShowDeleteAllConfirm(false);
                        setTimeout(() => setSuccessMsg(''), 3000);
                      } catch (err: any) {
                        setErrorMsg('Lỗi khi xóa sạch danh sách: ' + (err.message || err));
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl text-xs shadow-lg transition-colors animate-pulse"
                  >
                    {isSubmitting ? 'Đang xóa...' : 'Chấp nhận xóa'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-[#123B78] to-[#1457D9] px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <Users size={22} className="text-blue-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold uppercase">QUẢN LÝ HỌC SINH - LỚP {selectedClass.name}</h2>
              <p className="text-xs text-blue-100">Thêm mới, nhập từ Excel hoặc xuất danh sách học sinh của lớp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation & Export Button */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('single')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 border-t border-x ${
                activeTab === 'single'
                  ? 'bg-white text-blue-700 border-slate-200 shadow-sm -mb-px'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <UserPlus size={15} /> Thêm 1 học sinh
            </button>
            <button
              onClick={() => setActiveTab('excel')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 border-t border-x ${
                activeTab === 'excel'
                  ? 'bg-white text-blue-700 border-slate-200 shadow-sm -mb-px'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet size={15} /> Nhập từ Excel
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 border-t border-x ${
                activeTab === 'list'
                  ? 'bg-white text-blue-700 border-slate-200 shadow-sm -mb-px'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <Users size={15} /> Danh sách lớp ({students.length})
            </button>
          </div>

          {/* Export Excel Button */}
          <button
            onClick={() => exportStudentListToExcel(selectedClass.name, schoolYear, students)}
            className="mb-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            title="Xuất danh sách học sinh ra file Excel"
          >
            <Download size={14} /> XUẤT FILE EXCEL
          </button>
        </div>

        {/* Global alerts */}
        {(errorMsg || successMsg) && (
          <div className="px-6 pt-4">
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2 font-medium animate-in fade-in">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-center gap-2 font-bold animate-in fade-in">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Tab Body */}
        <div className="p-6">
          {/* TAB 1: THÊM 1 HỌC SINH THỦ CÔNG */}
          {activeTab === 'single' && (
            <form onSubmit={handleSingleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Mã HS */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã học sinh</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={`VD: HS${selectedClass.name}01 (Để trống tự tạo)`}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                  />
                </div>

                {/* Họ tên */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Họ và tên học sinh <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Nguyễn Văn An"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                  />
                </div>

                {/* Giới tính */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Giới tính</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'Nam' | 'Nữ')}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>

                {/* Ngày sinh */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 font-medium"
                  />
                </div>

                {/* Tên Phụ huynh */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Họ tên Phụ huynh</label>
                  <input
                    type="text"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder="VD: Nguyễn Văn Bằng"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                  />
                </div>

                {/* SĐT Phụ huynh */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số điện thoại Phụ huynh</label>
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="VD: 0912345678"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 font-mono"
                  />
                </div>

                {/* Địa chỉ */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Địa chỉ thường trú</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="VD: Thôn 1, xã Sơn Lương, huyện Văn Chấn"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#1457D9] hover:bg-[#123B78] text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <UserPlus size={16} /> {isSubmitting ? 'Đang thêm...' : 'LƯU HỌC SINH'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: NHẬP TỪ FILE EXCEL */}
          {activeTab === 'excel' && (
            <div className="space-y-4 text-xs">
              {/* Instruction banner & Template button */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={24} className="text-blue-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-blue-900 text-sm">Tải file mẫu Excel chuẩn</h4>
                    <p className="text-slate-600 text-[11px]">
                      Vui lòng điền thông tin học sinh vào mẫu file Excel chuẩn trước khi tải lên.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => downloadStudentTemplateExcel(selectedClass.name)}
                  className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Download size={14} /> TẢI FILE MẪU EXCEL
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center bg-slate-50/50 transition-colors">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <Upload size={32} className="mx-auto text-blue-500 mb-2" />
                <p className="font-bold text-slate-700 mb-1">
                  {fileName ? `Đã chọn file: ${fileName}` : 'Bấm vào đây để chọn file Excel (.xlsx, .xls)'}
                </p>
                <p className="text-slate-400 text-[11px] mb-3">Hệ thống sẽ tự động đọc danh sách học sinh từ file</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl"
                >
                  {fileName ? 'Chọn file khác' : 'CHỌN FILE TỪ MÁY TÍNH'}
                </button>
              </div>

              {importError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Preview Table */}
              {parsedRows.length > 0 && (() => {
                const hasErrors = parsedRows.some(r => !r.isValid);
                return (
                  <div className="space-y-3">
                    {hasErrors && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl flex items-center gap-2 font-bold animate-pulse">
                        <AlertCircle size={16} className="shrink-0 text-rose-600" />
                        <span>Cảnh báo: Phát hiện lỗi ánh xạ hoặc sai dữ liệu cột Họ và tên. Vui lòng kiểm tra lại file Excel!</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-700 flex items-center gap-1 text-sm">
                        <Check size={16} /> Đã đọc {parsedRows.length} học sinh từ file:
                      </span>
                      <button
                        onClick={handleConfirmImport}
                        disabled={isSubmitting || hasErrors}
                        className={`px-5 py-2 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 ${
                          hasErrors 
                            ? 'bg-slate-300 cursor-not-allowed opacity-60' 
                            : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                        title={hasErrors ? 'Không thể nhập do có dữ liệu lỗi' : 'Nhập danh sách vào cơ sở dữ liệu'}
                      >
                        <Sparkles size={15} /> {isSubmitting ? 'Đang nhập...' : `XÁC NHẬN NHẬP ${parsedRows.length} HỌC SINH`}
                      </button>
                    </div>

                    <div className="max-h-[220px] overflow-y-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 sticky top-0">
                          <tr>
                            <th className="p-3 text-center">STT</th>
                            <th className="p-3">Mã HS</th>
                            <th className="p-3">Họ và tên</th>
                            <th className="p-3 text-center">Giới tính</th>
                            <th className="p-3 text-center">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedRows.map((r, idx) => (
                            <tr key={idx} className={`hover:bg-slate-50 transition-colors ${!r.isValid ? 'bg-rose-50/50' : ''}`}>
                              <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                              <td className="p-3 font-mono font-bold text-blue-800">{r.code}</td>
                              <td className={`p-3 font-bold ${!r.isValid ? 'text-rose-600' : 'text-slate-800'}`}>{r.name}</td>
                              <td className="p-3 text-center">{r.gender}</td>
                              <td className="p-3 text-center font-medium">
                                {r.isValid ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full">
                                    <Check size={12} /> Hợp lệ
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50 px-2.5 py-0.5 rounded-full" title={r.error}>
                                    <AlertCircle size={12} /> {r.error}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 3: DANH SÁCH & THAO TÁC SỬA/XÓA */}
          {activeTab === 'list' && (
            <div className="space-y-3 text-xs">
              {/* Actions Header for Deleting/Clearing List */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-700 font-medium">
                    Đã chọn: <strong className="text-[#1457D9]">{selectedIds.length}/{students.length}</strong> học sinh
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowBulkDeleteConfirm(true)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Trash2 size={13} /> Xóa học sinh đã chọn ({selectedIds.length})
                    </button>
                  )}
                  {students.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowDeleteAllConfirm(true)}
                      className="px-3 py-1.5 bg-red-800 hover:bg-red-900 text-white font-bold text-[11px] rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <AlertCircle size={13} /> XÓA TOÀN BỘ DANH SÁCH LỚP
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[380px] overflow-y-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={students.length > 0 && selectedIds.length === students.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(students.map(s => s.id));
                            } else {
                              setSelectedIds([]);
                            }
                          }}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 accent-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-3 text-center">STT</th>
                      <th className="p-3">Mã HS</th>
                      <th className="p-3">Họ và tên</th>
                      <th className="p-3 text-center">Giới tính</th>
                      <th className="p-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          Chưa có học sinh nào trong lớp {selectedClass.name}. Vui lòng thêm học sinh hoặc nhập từ file Excel.
                        </td>
                      </tr>
                    ) : (
                      students.map((s, idx) => {
                        const isEditing = editingId === s.id;

                        if (isEditing) {
                          return (
                            <tr key={s.id} className="bg-blue-50/50">
                              <td className="p-2 w-10 text-center"></td>
                              <td className="p-2 text-center font-bold">{idx + 1}</td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={editCode}
                                  onChange={(e) => setEditCode(e.target.value)}
                                  className="w-full px-2 py-1 border border-blue-400 rounded text-xs font-mono"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-2 py-1 border border-blue-400 rounded text-xs font-bold"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <select
                                  value={editGender}
                                  onChange={(e) => setEditGender(e.target.value as 'Nam' | 'Nữ')}
                                  className="px-2 py-1 border border-blue-400 rounded text-xs"
                                >
                                  <option value="Nam">Nam</option>
                                  <option value="Nữ">Nữ</option>
                                </select>
                              </td>
                              <td className="p-2 text-right space-x-1">
                                <button
                                  onClick={() => handleSaveEdit(s.id)}
                                  disabled={isSubmitting}
                                  className="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="px-2.5 py-1 bg-slate-200 text-slate-700 font-bold rounded"
                                >
                                  Hủy
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(s.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedIds(prev => [...prev, s.id]);
                                  } else {
                                    setSelectedIds(prev => prev.filter(id => id !== s.id));
                                  }
                                }}
                                className="w-4 h-4 rounded text-blue-600 border-slate-300 accent-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-mono font-bold text-blue-800">{s.code}</td>
                            <td className="p-3 font-bold text-slate-900">{s.name}</td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  s.gender === 'Nữ' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {s.gender || 'Nam'}
                              </span>
                            </td>
                            <td className="p-3 text-right space-x-1">
                              <button
                                onClick={() => startEdit(s)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                                title="Sửa học sinh"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(s)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                                title="Xóa học sinh"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-slate-500">Tổng cộng: <strong>{students.length}</strong> học sinh</span>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
