import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Download, 
  RefreshCw, 
  Info, 
  FileCheck, 
  ShieldAlert,
  HelpCircle,
  Database,
  ArrowRight
} from 'lucide-react';
import { Teacher, Department, Role } from '../../types';

interface TeacherExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  existingTeachers: Teacher[];
  onImport: (teachers: Teacher[], options?: { duplicateMode?: 'skip' | 'update' }) => Promise<{
    success: boolean;
    added: number;
    updated: number;
    message?: string;
    isOfflineQuota?: boolean;
  }>;
}

interface ParsedTeacherRow {
  rowNumber: number;
  rawCode: string;
  code: string;
  rawName: string;
  name: string;
  rawRole: string;
  role: Role;
  position: string;
  rawDept: string;
  departmentId: string;
  departmentName: string;
  rawSubject: string;
  subject: string;
  rawStatus: string;
  status: 'Đang công tác' | 'Nghỉ phép' | 'Đã nghỉ việc';
  phone: string;
  email: string;
  degree: string;
  joinDate: string;
  
  // Validation state
  statusType: 'valid' | 'duplicate' | 'error';
  errors: string[];
  matchedExistingTeacher?: Teacher;
}

export default function TeacherExcelImportModal({
  isOpen,
  onClose,
  departments,
  existingTeachers,
  onImport
}: TeacherExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

  const [parsedRows, setParsedRows] = useState<ParsedTeacherRow[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update'>('skip');
  const [activeFilter, setActiveFilter] = useState<'all' | 'valid' | 'duplicate' | 'error'>('all');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [importResult, setImportResult] = useState<{
    added: number;
    updated: number;
    skipped: number;
    errors: number;
    isOfflineQuota?: boolean;
    message?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Statistics Hook - Always called at top level
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const valid = parsedRows.filter(r => r.statusType === 'valid').length;
    const duplicate = parsedRows.filter(r => r.statusType === 'duplicate').length;
    const error = parsedRows.filter(r => r.statusType === 'error').length;
    return { total, valid, duplicate, error };
  }, [parsedRows]);

  // Filtered rows for preview table Hook - Always called at top level
  const displayedRows = useMemo(() => {
    if (activeFilter === 'valid') return parsedRows.filter(r => r.statusType === 'valid');
    if (activeFilter === 'duplicate') return parsedRows.filter(r => r.statusType === 'duplicate');
    if (activeFilter === 'error') return parsedRows.filter(r => r.statusType === 'error');
    return parsedRows;
  }, [parsedRows, activeFilter]);

  // Helper to extract value matching synonyms
  const getRowValue = (row: any, synonyms: string[]): string => {
    const rowKeys = Object.keys(row);
    for (const syn of synonyms) {
      const foundKey = rowKeys.find(k => k.trim().toLowerCase() === syn.toLowerCase());
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
        return String(row[foundKey]).trim();
      }
    }
    return '';
  };

  // Resolve department from name or text
  const resolveDepartment = (rawDeptText: string): { deptId: string; deptName: string } => {
    if (!rawDeptText) {
      const fallback = departments[0] || { id: 'd_toan_ly_tin_cn', name: 'Tổ Toán-Lý-Tin-CN' };
      return { deptId: fallback.id, deptName: fallback.name };
    }

    const lower = rawDeptText.toLowerCase();

    // Check directly in existing departments
    const directMatch = departments.find(d => 
      d.name.toLowerCase() === lower || 
      d.id.toLowerCase() === lower ||
      d.name.toLowerCase().includes(lower) || 
      lower.includes(d.name.toLowerCase())
    );
    if (directMatch) return { deptId: directMatch.id, deptName: directMatch.name };

    // Standard school department keywords
    if (lower.includes('toán') || lower.includes('toan') || lower.includes('lý') || lower.includes('tin') || lower.includes('công nghệ') || lower.includes('cn')) {
      const d = departments.find(x => x.id === 'd_toan_ly_tin_cn' || x.name.includes('Toán'));
      return { deptId: d?.id || 'd_toan_ly_tin_cn', deptName: d?.name || 'Tổ Toán-Lý-Tin-CN' };
    }

    if (lower.includes('văn') || lower.includes('van') || lower.includes('sử') || lower.includes('địa') || lower.includes('gdkt') || lower.includes('âm nhạc') || lower.includes('mĩ thuật')) {
      const d = departments.find(x => x.id === 'd_van_su_dia_gdkt_pl_an' || x.name.includes('Văn-Sử'));
      return { deptId: d?.id || 'd_van_su_dia_gdkt_pl_an', deptName: d?.name || 'Tổ Văn-Sử-Địa-GDKT&PL-AN' };
    }

    if (lower.includes('hóa') || lower.includes('hoa') || lower.includes('sinh') || lower.includes('gdtc') || lower.includes('thể dục') || lower.includes('qpan') || lower.includes('tiếng anh') || lower.includes('ngoại ngữ') || lower.includes('nn')) {
      const d = departments.find(x => x.id === 'd_hoa_sinh_gdtc_qpan_nn' || x.id === 'd_hoa_ly_sinh_gdqpan_nn' || x.name.includes('Hóa-Sinh'));
      return { deptId: d?.id || 'd_hoa_sinh_gdtc_qpan_nn', deptName: d?.name || 'Tổ Hóa-Sinh-GDTC-QPAN-NN' };
    }

    if (lower.includes('văn phòng') || lower.includes('van phong') || lower.includes('hành chính') || lower.includes('kế toán') || lower.includes('văn thư') || lower.includes('thủ quỹ') || lower.includes('y tế')) {
      const d = departments.find(x => x.id === 'd_van_phong' || x.name.includes('Văn phòng'));
      return { deptId: d?.id || 'd_van_phong', deptName: d?.name || 'Tổ Văn phòng' };
    }

    const fallback = departments[0] || { id: 'd_toan_ly_tin_cn', name: 'Tổ Toán-Lý-Tin-CN' };
    return { deptId: fallback.id, deptName: rawDeptText };
  };

  // Resolve Role & Position
  const resolveRoleAndPosition = (rawRoleText: string, rawPositionText: string): { role: Role; position: string } => {
    const combined = `${rawRoleText} ${rawPositionText}`.trim().toLowerCase();

    if (combined.includes('hiệu trưởng') && !combined.includes('phó')) {
      return { role: 'BGH', position: 'Hiệu trưởng' };
    }
    if (combined.includes('phó hiệu trưởng') || combined.includes('pht') || combined.includes('pho hieu truong')) {
      return { role: 'BGH', position: 'Phó Hiệu trưởng' };
    }
    if (combined.includes('tổ trưởng') || combined.includes('ttcm') || combined.includes('to truong')) {
      return { role: 'TTCM', position: 'Tổ trưởng' };
    }
    if (combined.includes('tổ phó') || combined.includes('to pho')) {
      return { role: 'GIAO_VIEN', position: 'Tổ phó' };
    }
    if (combined.includes('nhân viên') || combined.includes('kế toán') || combined.includes('văn thư') || combined.includes('thủ quỹ') || combined.includes('y tế') || combined.includes('nhan vien')) {
      const pos = rawPositionText || rawRoleText || 'Nhân viên';
      return { role: 'NHAN_VIEN', position: pos };
    }

    return { 
      role: 'GIAO_VIEN', 
      position: rawPositionText || rawRoleText || 'Giáo viên' 
    };
  };

  // Process rows from a worksheet
  const processSheet = (ws: XLSX.WorkSheet) => {
    const rawData = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
    if (!rawData || rawData.length === 0) {
      setParsedRows([]);
      return;
    }

    const codeOccurrenceMap = new Map<string, number>();
    rawData.forEach(row => {
      const rawCode = getRowValue(row, [
        'Mã GV', 'Ma GV', 'Mã giáo viên', 'Mã viên chức', 'Mã CBGVNV', 
        'Mã nhân viên', 'Code', 'Ma giao vien', 'Mã'
      ]).trim();
      if (rawCode) {
        const lowerCode = rawCode.toLowerCase();
        codeOccurrenceMap.set(lowerCode, (codeOccurrenceMap.get(lowerCode) || 0) + 1);
      }
    });

    const parsed: ParsedTeacherRow[] = rawData.map((row, index) => {
      const rowNumber = index + 2; // Row 1 is usually header in Excel
      const rawCode = getRowValue(row, [
        'Mã GV', 'Ma GV', 'Mã giáo viên', 'Mã viên chức', 'Mã CBGVNV', 
        'Mã nhân viên', 'Code', 'Ma giao vien', 'Mã', 'ID'
      ]);
      const rawName = getRowValue(row, [
        'Họ và tên', 'Họ tên', 'Ho va ten', 'Ho ten', 'Tên', 'Ten', 'Họ và tên CBGVNV', 'Full Name', 'Name'
      ]);
      const rawRole = getRowValue(row, [
        'Chức vụ', 'Chuc vu', 'Vai trò', 'Role'
      ]);
      const rawPosition = getRowValue(row, [
        'Vị trí', 'Vị trí công tác', 'Chức danh', 'Position'
      ]);
      const rawDept = getRowValue(row, [
        'Tổ chuyên môn', 'Tổ', 'Tổ bộ môn', 'Phòng ban', 'To chuyen mon', 'To', 'Department'
      ]);
      const rawSubject = getRowValue(row, [
        'Môn giảng dạy', 'Môn', 'Bộ môn', 'Chuyên môn', 'Mon giang day', 'Mon', 'Subject'
      ]);
      const rawStatus = getRowValue(row, [
        'Trạng thái', 'Trạng thái công tác', 'Tình trạng', 'Trang thai', 'Status'
      ]);
      const phone = getRowValue(row, [
        'Số điện thoại', 'SĐT', 'SDT', 'Điện thoại', 'So dien thoai', 'Phone'
      ]);
      const email = getRowValue(row, [
        'Email', 'Mail', 'Địa chỉ email', 'Hòm thư'
      ]);
      const degree = getRowValue(row, [
        'Trình độ', 'Bằng cấp', 'Học vị', 'Trình độ đào tạo', 'Degree'
      ]) || 'Cử nhân';
      const joinDate = getRowValue(row, [
        'Ngày vào ngành', 'Ngày tuyển dụng', 'Ngày bắt đầu', 'Join Date', 'Start Date'
      ]) || new Date().toISOString().split('T')[0];

      // Validation
      const errors: string[] = [];
      const codeVal = rawCode.trim();
      const nameVal = rawName.trim();

      if (!nameVal) {
        errors.push('Thiếu Họ và tên');
      }

      if (!codeVal) {
        errors.push('Thiếu Mã GV/CBGVNV (hệ thống không tự suy đoán mã)');
      } else {
        const lowerCode = codeVal.toLowerCase();
        if ((codeOccurrenceMap.get(lowerCode) || 0) > 1) {
          errors.push('Mã GV bị trùng lặp với dòng khác trong tệp Excel');
        }
      }

      // Check duplicate against existing system teachers
      let matchedExistingTeacher: Teacher | undefined = undefined;
      if (codeVal) {
        matchedExistingTeacher = existingTeachers.find(
          t => t.code && t.code.trim().toLowerCase() === codeVal.toLowerCase()
        );
      }

      // Resolve role & department
      const { role, position } = resolveRoleAndPosition(rawRole, rawPosition);
      const { deptId, deptName } = resolveDepartment(rawDept);

      // Resolve status
      let finalStatus: 'Đang công tác' | 'Nghỉ phép' | 'Đã nghỉ việc' = 'Đang công tác';
      const normStatus = rawStatus.toLowerCase();
      if (normStatus.includes('nghỉ việc') || normStatus.includes('thôi việc') || normStatus.includes('chuyển công tác')) {
        finalStatus = 'Đã nghỉ việc';
      } else if (normStatus.includes('nghỉ phép') || normStatus.includes('tạm hoãn')) {
        finalStatus = 'Nghỉ phép';
      }

      let statusType: 'valid' | 'duplicate' | 'error' = 'valid';
      if (errors.length > 0) {
        statusType = 'error';
      } else if (matchedExistingTeacher) {
        statusType = 'duplicate';
      }

      return {
        rowNumber,
        rawCode,
        code: codeVal,
        rawName,
        name: nameVal,
        rawRole,
        role,
        position,
        rawDept,
        departmentId: deptId,
        departmentName: deptName,
        rawSubject,
        subject: rawSubject || 'Chưa phân công',
        rawStatus,
        status: finalStatus,
        phone,
        email,
        degree,
        joinDate,
        statusType,
        errors,
        matchedExistingTeacher
      };
    });

    setParsedRows(parsed);
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    loadWorkbook(selected);
  };

  const loadWorkbook = (selectedFile: File) => {
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        if (wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setSelectedSheet(firstSheet);
          processSheet(wb.Sheets[firstSheet]);
        }
      } catch (err: any) {
        setErrorMessage('Không thể đọc tệp Excel. Vui lòng kiểm tra định dạng tệp (.xlsx hoặc .xls).');
        console.error('Error reading Excel:', err);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  // Switch sheet
  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbook && workbook.Sheets[sheetName]) {
      processSheet(workbook.Sheets[sheetName]);
    }
  };

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const sampleHeaders = [
      'STT', 
      'Mã GV', 
      'Họ và tên', 
      'Chức vụ', 
      'Tổ chuyên môn', 
      'Môn giảng dạy', 
      'Trạng thái công tác', 
      'Số điện thoại', 
      'Email', 
      'Trình độ', 
      'Ngày vào ngành'
    ];
    const sampleData = [
      sampleHeaders,
      [1, 'GV001', 'Nguyễn Văn An', 'Tổ trưởng', 'Tổ Toán-Lý-Tin-CN', 'Toán', 'Đang công tác', '0912345678', 'nguyenvanan@sonluong.edu.vn', 'Thạc sĩ', '2019-09-01'],
      [2, 'GV002', 'Trần Thị Bình', 'Giáo viên', 'Tổ Văn-Sử-Địa-GDKT&PL-AN', 'Ngữ văn', 'Đang công tác', '0923456789', 'tranthibinh@sonluong.edu.vn', 'Cử nhân', '2020-09-01'],
      [3, 'GV003', 'Lê Văn Cường', 'Tổ trưởng', 'Tổ Hóa-Sinh-GDTC-QPAN-NN', 'Tiếng Anh', 'Đang công tác', '0934567890', 'levancuong@sonluong.edu.vn', 'Thạc sĩ', '2018-09-01'],
      [4, 'NV001', 'Phạm Thị Dung', 'Nhân viên', 'Tổ Văn phòng', 'Kế toán', 'Đang công tác', '0945678901', 'phamthidung@sonluong.edu.vn', 'Đại học', '2017-09-01']
    ];

    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DanhSachCBGVNV');
    XLSX.writeFile(wb, 'Mau_DanhSach_CBGVNV_THPT_SonLuong.xlsx');
  };

  // Export Error Report
  const handleExportErrorReport = () => {
    const errorRows = parsedRows.filter(r => r.statusType === 'error');
    if (errorRows.length === 0) return;

    const data = errorRows.map(r => ({
      'Dòng Excel': r.rowNumber,
      'Mã GV đã nhập': r.rawCode,
      'Họ và tên': r.rawName,
      'Chức vụ': r.rawRole,
      'Tổ chuyên môn': r.rawDept,
      'Nguyên nhân lỗi': r.errors.join('; ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dong_Loi_Excel');
    XLSX.writeFile(wb, `BaoCao_Loi_NhapExcel_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Execute Import
  const handleExecuteImport = async () => {
    // Filter eligible rows based on duplicate mode
    setErrorMessage(null);
    const eligibleRows = parsedRows.filter(r => {
      if (r.statusType === 'valid') return true;
      if (r.statusType === 'duplicate' && duplicateMode === 'update') return true;
      return false;
    });

    if (eligibleRows.length === 0) {
      setErrorMessage('Không có bản ghi hợp lệ nào để nhập! Vui lòng kiểm tra lại danh sách.');
      return;
    }

    const skippedCount = duplicateMode === 'skip' ? stats.duplicate : 0;

    setIsProcessing(true);
    setProgressPercent(20);

    const teachersToSave: Teacher[] = eligibleRows.map(r => {
      const existing = r.matchedExistingTeacher;
      return {
        id: existing?.id || `t${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        code: r.code,
        name: r.name,
        role: r.role,
        position: r.position,
        departmentId: r.departmentId,
        departmentName: r.departmentName,
        subject: r.subject,
        status: r.status,
        phone: r.phone,
        email: r.email,
        degree: r.degree,
        joinDate: r.joinDate,
        // Preserve account details if updating
        username: existing?.username,
        hasAccount: existing?.hasAccount,
        accountStatus: existing?.accountStatus,
        accountRole: existing?.accountRole
      } as Teacher;
    });

    setProgressPercent(50);

    try {
      const res = await onImport(teachersToSave, { duplicateMode });
      setProgressPercent(100);

      setImportResult({
        added: res.added,
        updated: res.updated,
        skipped: skippedCount,
        errors: stats.error,
        isOfflineQuota: res.isOfflineQuota,
        message: res.message
      });
    } catch (err: any) {
      console.error('Error importing teachers:', err);
      setErrorMessage(`Đã xảy ra lỗi khi lưu: ${err.message || 'Lỗi hệ thống'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200/80 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">
                Nhập danh sách CBGVNV từ Excel
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Xem trước, kiểm tra tính hợp lệ và cập nhật hồ sơ giáo viên & nhân viên
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            title="Đóng hộp thoại"
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">

          {/* ERROR ALERT BANNER */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-950 flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="text-xs sm:text-sm font-bold">{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-rose-700 p-1 cursor-pointer"
                title="Đóng thông báo"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* SUCCESS / COMPLETION RESULT BANNER */}
          {importResult && (
            <div className={`p-4.5 rounded-2xl border ${importResult.isOfflineQuota ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-emerald-50 border-emerald-300 text-emerald-950'} shadow-sm space-y-2 animate-fadeIn`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className={`w-6 h-6 ${importResult.isOfflineQuota ? 'text-amber-600' : 'text-emerald-600'} shrink-0`} />
                  <h4 className="font-extrabold text-sm sm:text-base">
                    {importResult.isOfflineQuota ? 'Đã lưu thành công vào bộ nhớ hệ thống (Chế độ dự phòng)' : 'Nhập danh sách CBGVNV thành công!'}
                  </h4>
                </div>
                <button
                  onClick={onClose}
                  className="px-3.5 py-1.5 bg-white text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-colors"
                >
                  Đóng & Xem danh sách
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                  <span className="text-slate-500">Đã thêm mới:</span>
                  <p className="text-base font-black text-emerald-700">{importResult.added} CBGVNV</p>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                  <span className="text-slate-500">Đã cập nhật:</span>
                  <p className="text-base font-black text-blue-700">{importResult.updated} CBGVNV</p>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                  <span className="text-slate-500">Đã bỏ qua:</span>
                  <p className="text-base font-black text-slate-700">{importResult.skipped} dòng</p>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                  <span className="text-slate-500">Dòng lỗi:</span>
                  <p className="text-base font-black text-rose-700">{importResult.errors} dòng</p>
                </div>
              </div>
              {importResult.isOfflineQuota && (
                <p className="text-[11px] text-amber-800 font-medium">
                  Lưu ý: Do Firebase Firestore đang đạt hạn mức lượt đọc/ghi miễn phí trong ngày (Free Daily Quota), dữ liệu đã được lưu trữ an toàn trong bộ nhớ đệm hệ thống và hiển thị ngay trên danh sách.
                </p>
              )}
            </div>
          )}

          {/* STEP 1: FILE PICKER & SHEET SELECTOR */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Bước 1: Chọn tệp Excel</span>
                <p className="text-sm font-bold text-slate-800">
                  {file ? `Đang chọn: ${fileName}` : 'Chọn tệp Excel (.xlsx hoặc .xls) từ máy tính của Thầy/Cô'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  title="Tải tệp Excel mẫu chuẩn"
                >
                  <Download size={14} className="text-emerald-600" />
                  <span>Tải tệp mẫu chuẩn</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Upload size={14} />
                  <span>{file ? 'Chọn tệp khác' : 'Chọn tệp từ máy tính'}</span>
                </button>
              </div>
            </div>

            {/* Sheet Selector (if multiple sheets exist) */}
            {sheetNames.length > 1 && (
              <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 shrink-0">Chọn trang tính (Sheet):</span>
                <select
                  value={selectedSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  className="text-xs font-bold px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {sheetNames.map((sName) => (
                    <option key={sName} value={sName}>
                      {sName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* STEP 2: SUMMARY METRICS & DUPLICATE HANDLING (Visible when file loaded) */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div 
                  onClick={() => setActiveFilter('all')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${activeFilter === 'all' ? 'bg-blue-50/80 border-blue-400 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Tổng số dòng</span>
                  <p className="text-xl font-black text-slate-900 mt-0.5">{stats.total}</p>
                  <span className="text-[10px] text-slate-400">Tất cả dữ liệu đọc được</span>
                </div>

                <div 
                  onClick={() => setActiveFilter('valid')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${activeFilter === 'valid' ? 'bg-emerald-50/80 border-emerald-400 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="text-[11px] font-bold text-emerald-700 uppercase">Hợp lệ (thêm mới)</span>
                  <p className="text-xl font-black text-emerald-700 mt-0.5">{stats.valid}</p>
                  <span className="text-[10px] text-emerald-600">Đầy đủ thông tin hợp lệ</span>
                </div>

                <div 
                  onClick={() => setActiveFilter('duplicate')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${activeFilter === 'duplicate' ? 'bg-amber-50/80 border-amber-400 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="text-[11px] font-bold text-amber-700 uppercase">Trùng mã hệ thống</span>
                  <p className="text-xl font-black text-amber-700 mt-0.5">{stats.duplicate}</p>
                  <span className="text-[10px] text-amber-600">Đã có GV trong hệ thống</span>
                </div>

                <div 
                  onClick={() => setActiveFilter('error')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${activeFilter === 'error' ? 'bg-rose-50/80 border-rose-400 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="text-[11px] font-bold text-rose-700 uppercase">Dòng có lỗi</span>
                  <p className="text-xl font-black text-rose-700 mt-0.5">{stats.error}</p>
                  <span className="text-[10px] text-rose-600">Thiếu tên/mã hoặc sai format</span>
                </div>
              </div>

              {/* DUPLICATE HANDLING OPTION (Rule 3) */}
              <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                    <span className="text-xs font-black uppercase text-amber-900 tracking-wide">
                      Quy tắc xử lý bản ghi trùng mã GV ({stats.duplicate} bản ghi):
                    </span>
                  </div>
                  <p className="text-xs text-amber-800">
                    Hệ thống không tự ý ghi đè. Thầy/Cô vui lòng lựa chọn phương thức xử lý mong muốn:
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-amber-300 text-slate-800 hover:bg-amber-100/50 transition-colors">
                    <input
                      type="radio"
                      name="duplicateMode"
                      value="skip"
                      checked={duplicateMode === 'skip'}
                      onChange={() => setDuplicateMode('skip')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>Bỏ qua bản ghi trùng (Giữ nguyên dữ liệu cũ)</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-amber-300 text-slate-800 hover:bg-amber-100/50 transition-colors">
                    <input
                      type="radio"
                      name="duplicateMode"
                      value="update"
                      checked={duplicateMode === 'update'}
                      onChange={() => setDuplicateMode('update')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>Cập nhật thông tin mới từ tệp Excel</span>
                  </label>
                </div>
              </div>

              {/* PREVIEW TABLE WITH FILTER TABS */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs space-y-0">
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setActiveFilter('all')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeFilter === 'all' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/60'}`}
                    >
                      Tất cả ({stats.total})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('valid')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeFilter === 'valid' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/60'}`}
                    >
                      Hợp lệ ({stats.valid})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('duplicate')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeFilter === 'duplicate' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/60'}`}
                    >
                      Trùng mã ({stats.duplicate})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('error')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeFilter === 'error' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/60'}`}
                    >
                      Có lỗi ({stats.error})
                    </button>
                  </div>

                  {stats.error > 0 && (
                    <button
                      type="button"
                      onClick={handleExportErrorReport}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-colors cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Tải báo cáo {stats.error} dòng lỗi (.xlsx)</span>
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200 text-slate-700 font-bold z-10">
                      <tr>
                        <th className="p-2.5 text-center w-12">Dòng</th>
                        <th className="p-2.5 w-24">Mã GV</th>
                        <th className="p-2.5 w-40">Họ và tên</th>
                        <th className="p-2.5 w-28">Chức vụ</th>
                        <th className="p-2.5 w-36">Tổ chuyên môn</th>
                        <th className="p-2.5 w-28">Môn dạy</th>
                        <th className="p-2.5 w-28">Trạng thái</th>
                        <th className="p-2.5">Kiểm tra tính hợp lệ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            Không có bản ghi nào trong nhóm này.
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map((r) => {
                          const isDup = r.statusType === 'duplicate';
                          const isErr = r.statusType === 'error';

                          return (
                            <tr 
                              key={r.rowNumber} 
                              className={`hover:bg-slate-50/70 transition-colors ${isErr ? 'bg-rose-50/30' : isDup ? 'bg-amber-50/20' : ''}`}
                            >
                              <td className="p-2.5 text-center font-bold text-slate-400">
                                {r.rowNumber}
                              </td>
                              <td className="p-2.5 font-bold font-mono text-slate-900">
                                {r.code || <span className="text-rose-500 italic">Trống</span>}
                              </td>
                              <td className="p-2.5 font-semibold text-slate-900">
                                {r.name || <span className="text-rose-500 italic">Trống</span>}
                              </td>
                              <td className="p-2.5 text-slate-700">
                                {r.position}
                              </td>
                              <td className="p-2.5 text-slate-700">
                                <span className="truncate block max-w-[140px]" title={r.departmentName}>
                                  {r.departmentName}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-600">
                                {r.subject}
                              </td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${r.status === 'Đang công tác' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="p-2.5">
                                {isErr ? (
                                  <div className="flex items-center gap-1.5 text-rose-700 font-bold">
                                    <XCircle size={14} className="shrink-0" />
                                    <span>{r.errors.join('; ')}</span>
                                  </div>
                                ) : isDup ? (
                                  <div className="flex items-center gap-1.5 text-amber-800 font-medium">
                                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                                    <span>
                                      Trùng mã (Hiện tại: {r.matchedExistingTeacher?.name}).{' '}
                                      <strong className="font-bold">
                                        {duplicateMode === 'skip' ? 'Sẽ bỏ qua' : 'Sẽ cập nhật'}
                                      </strong>
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                                    <CheckCircle2 size={14} className="shrink-0" />
                                    <span>Hợp lệ (Sẵn sàng thêm mới)</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* PROGRESS BAR (While saving) */}
          {isProcessing && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                <div className="flex items-center gap-2">
                  <RefreshCw size={15} className="animate-spin text-blue-600" />
                  <span>Đang ghi dữ liệu vào hệ thống...</span>
                </div>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-blue-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {parsedRows.length > 0 && (
              <span>
                Sẵn sàng xử lý:{' '}
                <strong className="text-slate-800">
                  {stats.valid + (duplicateMode === 'update' ? stats.duplicate : 0)}
                </strong>{' '}
                hồ sơ ({stats.valid} mới, {duplicateMode === 'update' ? stats.duplicate : 0} cập nhật)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {importResult ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Hoàn tất & Xem danh sách</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={
                    isProcessing ||
                    parsedRows.length === 0 ||
                    (stats.valid === 0 && (duplicateMode === 'skip' || stats.duplicate === 0))
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Đang lưu dữ liệu...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck size={16} />
                      <span>
                        Xác nhận nhập danh sách ({stats.valid + (duplicateMode === 'update' ? stats.duplicate : 0)} bản ghi)
                      </span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
