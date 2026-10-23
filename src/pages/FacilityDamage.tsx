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
  RefreshCw
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
    // Search query: class, device name, or ticket code
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCode = r.ticketCode?.toLowerCase().includes(q);
      const matchAsset = r.assetName?.toLowerCase().includes(q) || r.assetCode?.toLowerCase().includes(q);
      const matchClass = r.className?.toLowerCase().includes(q) || r.classroom?.toLowerCase().includes(q);
      if (!matchCode && !matchAsset && !matchClass) return false;
    }
    // Facility Group filter
    if (selectedGroup !== 'all' && r.facilityGroup !== selectedGroup) return false;
    // Status filter
    if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;
    // Month/Year filter (MM/YYYY)
    if (selectedMonthYear !== 'all') {
      const myStr = formatMonthVN(r.reportedAt || r.createdAt);
      if (myStr !== selectedMonthYear) return false;
    }
    // Class filter
    if (selectedClassFilter !== 'all' && r.className.toLowerCase() !== selectedClassFilter.toLowerCase()) return false;
    // Teacher filter
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

  const handleDelete = async (id: string, status: DamageReportStatus) => {
    if (status !== 'Nháp' && status !== 'Đã gửi báo hỏng') {
      alert('Không thể xóa phiếu đã được tiếp nhận hoặc đang xử lý!');
      return;
    }
    if (window.confirm('Bạn có chắc chắn muốn xóa phiếu báo hỏng này?')) {
      try {
        await facilityDamageService.deleteReport(id);
        fetchReports();
      } catch (err: any) {
        alert(err.message || 'Lỗi khi xóa phiếu.');
      }
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

  // Unique month/year list for filter dropdown
  const uniqueMonthYears = Array.from(new Set(reports.map(r => formatMonthVN(r.reportedAt || r.createdAt)))).filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50/65 pb-12 font-sans select-none">
      
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-[#123B78] via-[#1457D9] to-blue-600 text-white px-6 py-8 shadow-md">
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
              Hệ thống lập phiếu, theo dõi tiến độ khắc phục sự cố thiết bị lớp học và quản lý tài sản nhà trường.
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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

        {/* Filters and Search Toolbar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="w-full md:w-80 relative">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo lớp, thiết bị, mã phiếu..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            {/* Lọc theo tháng/năm hỏng */}
            <select
              value={selectedMonthYear}
              onChange={(e) => setSelectedMonthYear(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none"
            >
              <option value="all">Tất cả tháng hỏng</option>
              {uniqueMonthYears.map(my => (
                <option key={my} value={my}>Tháng {my}</option>
              ))}
            </select>

            {/* Lọc theo lớp */}
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none"
            >
              <option value="all">Tất cả các lớp</option>
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            {/* Lọc theo GVCN */}
            <select
              value={selectedTeacherFilter}
              onChange={(e) => setSelectedTeacherFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none"
            >
              <option value="all">Tất cả GVCN</option>
              {teachers.map(t => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>

            {/* Lọc theo nhóm thiết bị */}
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none capitalize"
            >
              <option value="all">Tất cả nhóm thiết bị</option>
              <option value="điều hòa">Điều hòa</option>
              <option value="bàn ghế học sinh">Bàn ghế học sinh</option>
              <option value="bàn ghế giáo viên">Bàn ghế giáo viên</option>
              <option value="bảng lớp học">Bảng lớp học</option>
              <option value="đèn chiếu sáng">Đèn chiếu sáng</option>
              <option value="quạt điện">Quạt điện</option>
              <option value="cửa ra vào, cửa sổ">Cửa ra vào, cửa sổ</option>
              <option value="hệ thống điện">Hệ thống điện</option>
              <option value="hệ thống nước">Hệ thống nước</option>
              <option value="máy chiếu">Máy chiếu</option>
              <option value="máy tính">Máy tính</option>
              <option value="thiết bị dạy học">Thiết bị dạy học</option>
              <option value="thiết bị vệ sinh">Thiết bị vệ sinh</option>
              <option value="khác">Khác</option>
            </select>

            {/* Lọc theo trạng thái xử lý */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Nháp">Nháp</option>
              <option value="Đã gửi báo hỏng">Đã gửi báo hỏng</option>
              <option value="Đã tiếp nhận">Đã tiếp nhận</option>
              <option value="Đang xử lý">Đang xử lý</option>
              <option value="Chờ vật tư hoặc chờ sửa chữa">Chờ vật tư / chờ sửa</option>
              <option value="Đã khắc phục">Đã khắc phục</option>
              <option value="GVCN xác nhận hoàn thành">GVCN xác nhận hoàn thành</option>
              <option value="Đóng phiếu">Đóng phiếu</option>
            </select>

            <button
              onClick={handleResetFilters}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              title="Xóa bộ lọc"
            >
              <RefreshCw size={13} /> Xóa bộ lọc
            </button>
          </div>
        </div>

        {/* ERROR BANNER IF ANY */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="shrink-0 text-rose-600" />
              <span><strong>Lỗi kết nối máy chủ:</strong> {errorMsg}</span>
            </div>
            <button onClick={fetchReports} className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg text-xs">Thử lại</button>
          </div>
        )}

        {/* DANH SÁCH BÁO HỎNG CƠ SỞ VẬT CHẤT LỚP HỌC (LUÔN HIỂN THỊ CẤU TRÚC BẢNG) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/30 flex items-center justify-between">
            <h2 className="text-sm font-black text-[#123B78] uppercase tracking-wide">
              DANH SÁCH BÁO HỎNG CƠ SỞ VẬT CHẤT LỚP HỌC
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              Tổng số bản ghi khớp: {filteredReports.length} / {reports.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-[#123B78] text-white text-[11px] font-extrabold uppercase tracking-wider">
                  {/* Cột chính xác theo yêu cầu người dùng */}
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
                        <p className="text-xs text-slate-400">
                          {reports.length === 0 
                            ? 'Hiện chưa có phiếu báo hỏng nào được tạo trên hệ thống.' 
                            : 'Không tìm thấy phiếu nào khớp với bộ lọc hiện tại. Hãy thử nhấn "Xóa bộ lọc".'}
                        </p>
                        {reports.length > 0 && (
                          <button 
                            onClick={handleResetFilters}
                            className="mt-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs"
                          >
                            Xóa bộ lọc để xem toàn bộ
                          </button>
                        )}
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
                          {r.acStatus && <div className="text-[10px] text-amber-700 font-bold">Tình trạng: {r.acStatus}</div>}
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
                          {(r.status === 'Nháp' || r.status === 'Đã gửi báo hỏng') && (
                            <button
                              onClick={() => handleDelete(r.id, r.status)}
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

      </div>

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
