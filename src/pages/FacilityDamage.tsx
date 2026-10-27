import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Building2, 
  FileSpreadsheet, 
  Printer, 
  Eye, 
  Trash2, 
  ShieldAlert,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  FileText
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useAppContext } from '../store/AppContext';
import { FacilityDamageReport, DamageReportStatus, FacilityGroup } from '../types/facilityDamage';
import { facilityDamageService } from '../services/facilityDamageService';
import FacilityDamageModal from '../components/facilityDamage/FacilityDamageModal';
import FacilityDamageDetailModal from '../components/facilityDamage/FacilityDamageDetailModal';

export default function FacilityDamagePage() {
  const { user } = useAuth();
  const { classes, teachers } = useAppContext();
  const isBgh = user?.role?.toUpperCase() === 'BGH' || user?.role?.toUpperCase() === 'ADMIN' || user?.username === 'admin';

  // View mode tab: 'list' (Danh sách phiếu) vs 'report_table' (Bảng Báo hỏng & Đề nghị sửa CSVC Lớp học theo mẫu)
  const [viewMode, setViewMode] = useState<'list' | 'report_table'>('report_table');

  // Find user's homeroom class if user is GVCN
  const userClass = classes.find(c => c.homeroomTeacherId === user?.id || c.homeroomTeacher?.toLowerCase() === user?.name?.toLowerCase());

  const [reports, setReports] = useState<FacilityDamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<FacilityDamageReport | null>(null);
  const [editingReport, setEditingReport] = useState<FacilityDamageReport | null>(null);

  const [quickInputs, setQuickInputs] = useState<Record<string, { assetName: string; description: string; quantity: number }>>({});
  const [submittingClassId, setSubmittingClassId] = useState<string | null>(null);

  const handleQuickSubmit = async (cls: any) => {
    const input = quickInputs[cls.id];
    if (!input || !input.assetName?.trim()) {
      alert('Vui lòng nhập tên thiết bị hỏng trước khi gửi BGH!');
      return;
    }
    try {
      setSubmittingClassId(cls.id);
      await facilityDamageService.saveReport({
        ticketCode: facilityDamageService.generateTicketCode(),
        reportedAt: new Date().toISOString(),
        classId: cls.id,
        className: cls.name,
        teacherId: user?.id || cls.homeroomTeacherId || 'GV',
        teacherName: user?.name || cls.homeroomTeacher || 'Giáo viên',
        classroom: `Phòng học ${cls.name}`,
        facilityGroup: 'khác',
        assetName: input.assetName.trim(),
        quantity: input.quantity || 1,
        description: input.description?.trim() || 'Báo hỏng cơ sở vật chất lớp học',
        severity: 'trung bình',
        detectionTime: 'Giờ học',
        attachments: [],
        status: 'Đã gửi báo hỏng',
        academicYear: '2026-2027',
        month: String(new Date().getMonth() + 1).padStart(2, '0'),
        history: [{
          id: Math.random().toString(36).substring(2, 9),
          status: 'Đã gửi báo hỏng',
          updatedBy: user?.id || 'GV',
          updatedByName: user?.name || 'Giáo viên',
          timestamp: new Date().toISOString(),
          content: 'Báo hỏng cơ sở vật chất gửi BGH'
        }]
      });
      setQuickInputs(prev => ({ ...prev, [cls.id]: { assetName: '', description: '', quantity: 1 } }));
      await fetchReports();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi gửi báo hỏng lên BGH.');
    } finally {
      setSubmittingClassId(null);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await facilityDamageService.getAllReports();
      setReports(data);
    } catch (err: any) {
      console.error('Error fetching facility damage reports:', err);
      setErrorMsg(err.message || 'Không thể tải dữ liệu từ máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);
    const unsub = facilityDamageService.subscribeReports(
      (data) => {
        setReports(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error in subscribeReports:', err);
        setErrorMsg(err.message || 'Không thể kết nối cơ sở dữ liệu.');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Format date helper: DD/MM/YYYY
  const formatDateVN = (dateStr?: string): string => {
    if (!dateStr) return 'Chưa cập nhật';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Chưa cập nhật';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return 'Chưa cập nhật';
    }
  };

  // Format month helper: MM/YYYY
  const formatMonthVN = (dateStr?: string): string => {
    if (!dateStr) return 'Chưa cập nhật';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Chưa cập nhật';
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${month}/${year}`;
    } catch (e) {
      return 'Chưa cập nhật';
    }
  };

  // Filter reports
  const filteredReports = reports.filter(r => {
    if (!isBgh && userClass && r.className.toLowerCase() !== userClass.name.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCode = r.ticketCode?.toLowerCase().includes(q);
      const matchAsset = r.assetName?.toLowerCase().includes(q) || r.assetCode?.toLowerCase().includes(q);
      const matchClass = r.className?.toLowerCase().includes(q) || r.classroom?.toLowerCase().includes(q);
      if (!matchCode && !matchAsset && !matchClass) return false;
    }
    if (selectedGroup !== 'all' && r.facilityGroup !== selectedGroup) return false;
    if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;
    if (selectedMonthYear !== 'all') {
      const myStr = formatMonthVN(r.reportedAt || r.createdAt);
      if (myStr !== selectedMonthYear) return false;
    }
    if (selectedClassFilter !== 'all' && r.className.toLowerCase() !== selectedClassFilter.toLowerCase()) return false;
    if (selectedTeacherFilter !== 'all' && r.teacherName.toLowerCase() !== selectedTeacherFilter.toLowerCase()) return false;

    return true;
  });

  // Statistics counters
  const totalCount = reports.length;
  const urgentCount = reports.filter(r => r.severity === 'khẩn cấp' || r.isUrgentSafetyRisk).length;
  const pendingCount = reports.filter(r => r.status === 'Đã gửi báo hỏng' || r.status === 'Nháp').length;
  const processingCount = reports.filter(r => ['Đã tiếp nhận', 'Đang xử lý', 'Chờ vật tư hoặc chờ sửa chữa'].includes(r.status)).length;
  const completedCount = reports.filter(r => ['Đã khắc phục', 'GVCN xác nhận hoàn thành', 'Đóng phiếu'].includes(r.status)).length;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedGroup('all');
    setSelectedStatus('all');
    setSelectedMonthYear('all');
    setSelectedClassFilter('all');
    setSelectedTeacherFilter('all');
  };

  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; name: string; status: DamageReportStatus } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDelete = (id: string, status: DamageReportStatus, name?: string) => {
    if (!isBgh && status !== 'Nháp' && status !== 'Đã gửi báo hỏng') {
      setToastMessage({ type: 'error', text: 'Không thể xóa phiếu đã được tiếp nhận hoặc đang xử lý!' });
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    setDeleteConfirmTarget({ id, name: name || 'thiết bị', status });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    try {
      setIsDeleting(true);
      const targetId = deleteConfirmTarget.id;
      setReports(prev => prev.filter(r => r.id !== targetId));
      await facilityDamageService.deleteReport(targetId);
      setToastMessage({ type: 'success', text: `Đã xóa phiếu "${deleteConfirmTarget.name}" thành công!` });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error('Error deleting report:', err);
      setToastMessage({ type: 'error', text: err.message || 'Lỗi khi xóa phiếu trên máy chủ.' });
      setTimeout(() => setToastMessage(null), 4000);
      await fetchReports();
    } finally {
      setIsDeleting(false);
      setDeleteConfirmTarget(null);
    }
  };

  const handleExportExcel = () => {
    let csv = '\uFEFFSTT,Lớp,Ngày hỏng,Tháng hỏng,Thiết bị hỏng,Tên GVCN,Trạng thái\n';
    filteredReports.forEach((r, idx) => {
      csv += `"${idx + 1}","${r.className}","${formatDateVN(r.reportedAt || r.createdAt)}","${formatMonthVN(r.reportedAt || r.createdAt)}","${r.assetName} - ${r.description.replace(/"/g, '""')}","${r.teacherName}","${r.status}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Danh_sach_bao_hong_csvc_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintAll = () => {
    window.print();
  };

  const uniqueMonthYears = Array.from(new Set(reports.map(r => formatMonthVN(r.reportedAt || r.createdAt)))).filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50/65 pb-12 font-sans select-none">
      
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-[#123B78] via-[#1457D9] to-blue-600 text-white px-6 py-8 shadow-md no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-400/30 text-blue-100 text-[11px] font-extrabold tracking-wider uppercase">
                {isBgh ? 'Quản lý toàn trường • BGH' : `Lớp: ${userClass?.name || 'Chủ nhiệm'}`}
              </span>
              <span className="text-blue-200 text-xs">• Năm học 2026-2027</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <Wrench className="text-amber-300 w-7 h-7" />
              BÁO HỎNG CƠ SỞ VẬT CHẤT LỚP HỌC
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-2xl font-medium">
              Hệ thống lập phiếu, theo dõi tiến độ khắc phục sự cố thiết bị lớp học và báo cáo đề nghị sửa chữa lên Ban Giám Hiệu.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={fetchReports}
              className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
              title="Tải lại dữ liệu"
            >
              <RefreshCw size={15} /> Tải lại
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
            >
              <FileSpreadsheet size={16} /> Xuất Excel
            </button>
            <button
              onClick={handlePrintAll}
              className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
            >
              <Printer size={16} /> In danh sách
            </button>
            {!isBgh && (
              <button
                onClick={() => {
                  setEditingReport(null);
                  setIsCreateModalOpen(true);
                }}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-900 text-xs font-extrabold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus size={18} strokeWidth={2.5} /> + Tạo phiếu báo hỏng
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-4 space-y-6">

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 no-print">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Tổng số phiếu</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-[#123B78]">{totalCount}</span>
              <span className="text-xs font-semibold text-slate-400">phiếu</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wide flex items-center gap-1">
              <ShieldAlert size={14} /> Khẩn cấp / Rủi ro
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-rose-600">{urgentCount}</span>
              <span className="text-xs font-semibold text-rose-400">cần gấp</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide flex items-center gap-1">
              <Clock size={14} /> Chờ tiếp nhận
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-amber-600">{pendingCount}</span>
              <span className="text-xs font-semibold text-amber-400">mới gửi</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1">
              <Wrench size={14} /> Đang xử lý
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-blue-600">{processingCount}</span>
              <span className="text-xs font-semibold text-blue-400">đang sửa</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide flex items-center gap-1">
              <CheckCircle size={14} /> Đã hoàn thành
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-emerald-600">{completedCount}</span>
              <span className="text-xs font-semibold text-emerald-400">xong</span>
            </div>
          </div>
        </div>

        {/* VIEW MODE TABS: BẢNG BÁO HỎNG & ĐỀ NGHỊ SỬA CSVC LỚP HỌC VS DANH SÁCH CHI TIẾT */}
        <div className="flex items-center gap-2 no-print border-b border-slate-200 pb-3 pt-2">
          <button
            type="button"
            onClick={() => setViewMode('report_table')}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'report_table'
                ? 'bg-[#123B78] text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileText size={16} />
            <span>📑 Bảng Báo hỏng & Đề nghị sửa CSVC Lớp học (Mẫu BGH)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'list'
                ? 'bg-[#123B78] text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Layers size={16} />
            <span>📋 Quản lý danh sách phiếu chi tiết ({filteredReports.length})</span>
          </button>
        </div>

        {/* ERROR BANNER IF ANY */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-4 rounded-xl flex items-center justify-between no-print">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="shrink-0 text-rose-600" />
              <span><strong>Lỗi kết nối máy chủ:</strong> {errorMsg}</span>
            </div>
            <button onClick={fetchReports} className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg text-xs">Thử lại</button>
          </div>
        )}

        {/* VIEW MODE 1: BẢNG BÁO HỎNG VÀ ĐỀ NGHỊ SỬA CSVC LỚP HỌC (THEO MẪU ĐÍNH KÈM) */}
        {viewMode === 'report_table' && (
          <div className="bg-white border-2 border-slate-300 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-wide">
                BÁO HỎNG VÀ ĐỀ NGHỊ SỬA CSVC LỚP HỌC
              </h2>
              <p className="text-xs text-slate-500 italic">
                Trường THPT Sơn Lương • Năm học 2026–2027
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-300 text-xs font-sans">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-black text-center uppercase tracking-wider text-xs border-b-2 border-slate-300">
                    <th className="p-3 border border-slate-300 w-16">LỚP</th>
                    <th className="p-3 border border-slate-300 min-w-[280px]">CSVC LỚP ĐỀ NGHỊ SỬA</th>
                    <th className="p-3 border border-slate-300 w-36">Gửi BGH</th>
                    <th className="p-3 border border-slate-300 w-44">Xác nhận</th>
                    <th className="p-3 border border-slate-300 w-36">Ngày hoàn thành sửa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 bg-white">
                  {classes.map(cls => {
                    // Find reports for this class
                    const classReports = filteredReports.filter(r => r.className.toLowerCase() === cls.name.toLowerCase());

                    return (
                      <tr key={cls.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border border-slate-300 text-center font-extrabold text-[#123B78]">
                          {cls.name}
                        </td>
                        <td className="p-3 border border-slate-300 space-y-3">
                          {classReports.length > 0 && (
                            <div className="space-y-2">
                              {classReports.map(r => (
                                <div key={r.id} className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-bold text-slate-900 capitalize">
                                      • {r.assetName} (SL: {r.quantity})
                                    </div>
                                    <div className="text-[11px] text-slate-600 mt-0.5">
                                      Mô tả: {r.description}
                                    </div>
                                  </div>
                                  {(r.status === 'Nháp' || r.status === 'Đã gửi báo hỏng' || isBgh) && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(r.id, r.status, r.assetName);
                                      }}
                                      className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="Xóa phiếu"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Quick input form */}
                          <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                            <div className="text-[11px] font-bold text-[#123B78]">
                              + Nhập CSVC hỏng đề nghị sửa:
                            </div>
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                placeholder="Tên thiết bị (vd: Quạt trần, Bóng đèn...)"
                                value={(quickInputs[cls.id] || {}).assetName || ''}
                                onChange={(e) => setQuickInputs(prev => ({
                                  ...prev,
                                  [cls.id]: { ...(prev[cls.id] || { quantity: 1, description: '' }), assetName: e.target.value }
                                }))}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              />
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  placeholder="Mô tả chi tiết / Số lượng"
                                  value={(quickInputs[cls.id] || {}).description || ''}
                                  onChange={(e) => setQuickInputs(prev => ({
                                    ...prev,
                                    [cls.id]: { ...(prev[cls.id] || { quantity: 1, assetName: '' }), description: e.target.value }
                                  }))}
                                  className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  disabled={submittingClassId === cls.id}
                                  onClick={() => handleQuickSubmit(cls)}
                                  className="px-3.5 py-1.5 bg-[#123B78] hover:bg-blue-800 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
                                >
                                  {submittingClassId === cls.id ? 'Đang gửi...' : 'Gửi BGH'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 border border-slate-300 text-center text-slate-700 font-semibold">
                          {classReports.length > 0 ? (
                            <div>
                              <div>Đã gửi</div>
                              <div className="text-[11px] text-slate-500 font-normal">{formatDateVN(classReports[0].reportedAt || classReports[0].createdAt)}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 border border-slate-300 text-center">
                          {classReports.length > 0 ? (
                            <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] inline-block ${
                              classReports[0].status === 'Đã khắc phục' || classReports[0].status === 'GVCN xác nhận hoàn thành'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : classReports[0].status === 'Đang xử lý'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {classReports[0].status}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 border border-slate-300 text-center font-semibold text-slate-700">
                          {classReports.length > 0 && (classReports[0].status === 'Đã khắc phục' || classReports[0].status === 'GVCN xác nhận hoàn thành') ? (
                            <span className="text-emerald-700 font-bold">{formatDateVN(classReports[0].updatedAt)}</span>
                          ) : (
                            <span className="text-slate-400 italic">Đang tiến hành</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW MODE 2: QUẢN LÝ DANH SÁCH PHIẾU CHI TIẾT */}
        {viewMode === 'list' && (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/30 flex items-center justify-between">
              <h2 className="text-sm font-black text-[#123B78] uppercase tracking-wide">
                DANH SÁCH PHIẾU BÁO HỎNG CƠ SỞ VẬT CHẤT
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                Tổng số bản ghi khớp: {filteredReports.length} / {reports.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-[#123B78] text-white text-[11px] font-extrabold uppercase tracking-wider">
                    <th className="p-3 border border-slate-300 text-center w-12">STT</th>
                    <th className="p-3 border border-slate-300">Lớp</th>
                    <th className="p-3 border border-slate-300">Ngày hỏng</th>
                    <th className="p-3 border border-slate-300">Tháng hỏng</th>
                    <th className="p-3 border border-slate-300">Thiết bị hỏng</th>
                    <th className="p-3 border border-slate-300">Tên GVCN</th>
                    <th className="p-3 border border-slate-300">Trạng thái</th>
                    <th className="p-3 border border-slate-300 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500 font-semibold bg-white">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          <span>Đang tải dữ liệu từ máy chủ thực tế...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-16 text-center text-slate-500 bg-white">
                        <div className="max-w-xs mx-auto space-y-2">
                          <Wrench className="w-10 h-10 text-slate-300 mx-auto" />
                          <p className="text-sm font-bold text-slate-700">Chưa có phiếu báo hỏng</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((r, index) => {
                      const dateVal = r.reportedAt || r.createdAt;
                      const formattedDate = formatDateVN(dateVal);
                      const formattedMonth = formatMonthVN(dateVal);

                      return (
                        <tr 
                          key={r.id} 
                          className={`hover:bg-blue-50/50 transition-colors ${index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}`}
                        >
                          <td className="p-3 border border-slate-200 text-center font-bold text-slate-600">{index + 1}</td>
                          <td className="p-3 border border-slate-200 font-extrabold text-[#123B78]">{r.className}</td>
                          <td className="p-3 border border-slate-200 whitespace-nowrap font-semibold">{formattedDate}</td>
                          <td className="p-3 border border-slate-200 whitespace-nowrap text-slate-600 font-semibold">{formattedMonth}</td>
                          <td className="p-3 border border-slate-200">
                            <div className="font-bold text-slate-900 capitalize">{r.assetName} (SL: {r.quantity})</div>
                            <div className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">{r.description}</div>
                          </td>
                          <td className="p-3 border border-slate-200 font-bold text-slate-700">{r.teacherName}</td>
                          <td className="p-3 border border-slate-200">
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 whitespace-nowrap text-[11px]">
                              {r.status}
                            </span>
                          </td>
                          <td className="p-3 border border-slate-200 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedReport(r);
                                setIsDetailModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Xem chi tiết"
                            >
                              <Eye size={13} /> Chi tiết
                            </button>
                            {(r.status === 'Nháp' || r.status === 'Đã gửi báo hỏng' || isBgh) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(r.id, r.status, r.assetName);
                                }}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Xóa phiếu"
                              >
                                <Trash2 size={13} />
                              </button>
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
        )}

      </div>

      {/* In-App Confirmation Modal for Deleting Report */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={24} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Xác nhận xóa phiếu báo hỏng</h3>
                <p className="text-xs text-slate-500 font-medium">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
              <div>
                <span className="font-semibold text-slate-500">Thiết bị:</span>{" "}
                <strong className="text-slate-900 capitalize">{deleteConfirmTarget.name}</strong>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Trạng thái:</span>{" "}
                <span className="font-bold text-amber-700">{deleteConfirmTarget.status}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa bản ghi báo hỏng cơ sở vật chất này khỏi hệ thống trường học không?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Xóa vĩnh viễn</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold text-white ${
            toastMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}>
            {toastMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Modals */}
      <FacilityDamageModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={fetchReports}
        editingReport={editingReport}
      />

      <FacilityDamageDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        report={selectedReport}
        onUpdate={fetchReports}
      />

    </div>
  );
}
