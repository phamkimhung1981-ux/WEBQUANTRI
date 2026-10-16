import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  CheckSquare, 
  FileText, 
  Award, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileSpreadsheet, 
  UserCheck, 
  ShieldCheck, 
  Phone, 
  Mail, 
  Briefcase, 
  Calendar, 
  ExternalLink,
  BookOpen,
  Activity,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import { useAppContext } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import { Teacher } from '../types';
import { 
  OfficeTask, 
  OfficeDocument, 
  OfficeJobStandard, 
  OfficeTaskCategory, 
  OfficeTaskPriority, 
  OfficeTaskStatus 
} from '../types/officeDepartment';
import { 
  officeService, 
  DEFAULT_OFFICE_TASKS, 
  DEFAULT_OFFICE_DOCUMENTS, 
  DEFAULT_OFFICE_STANDARDS 
} from '../services/officeService';
import { exportOfficeSummaryToExcel } from '../utils/officeExport';

export default function OfficeDepartment() {
  const navigate = useNavigate();
  const { teachers, departments, addTeacher, updateTeacher, deleteTeacher } = useAppContext();
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN' || user?.role === 'BGH';

  // Active Tab: 'roster' | 'tasks' | 'documents' | 'kpi_summary' | 'standards'
  const [activeTab, setActiveTab] = useState<'roster' | 'tasks' | 'documents' | 'kpi_summary' | 'standards'>('roster');

  // Staff Deletion State
  const [deletingStaff, setDeletingStaff] = useState<Teacher | null>(null);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);

  // Real-time Data States
  const [tasks, setTasks] = useState<OfficeTask[]>([]);
  const [documents, setDocuments] = useState<OfficeDocument[]>([]);
  const [standards] = useState<OfficeJobStandard[]>(DEFAULT_OFFICE_STANDARDS);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');

  // Toast & Modals
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Task Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<OfficeTask | null>(null);
  const [taskFormData, setTaskFormData] = useState<Partial<OfficeTask>>({
    title: '',
    category: 'Tài chính - Kế toán',
    assigneeId: '',
    assigneeName: '',
    assigneePosition: 'Kế toán viên',
    startDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'Bình thường',
    status: 'Chờ thực hiện',
    progressPercent: 0,
    notes: '',
    evidenceRequirement: ''
  });

  // Document Modal State
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docFormData, setDocFormData] = useState<Partial<OfficeDocument>>({
    dispatchCode: '',
    type: 'Công văn đến',
    title: '',
    issuingAgency: 'Sở GD&ĐT Yên Bái',
    receiptDate: new Date().toISOString().split('T')[0],
    category: 'Văn thư - Lưu trữ',
    handlerName: '',
    status: 'Chờ xử lý',
    summary: ''
  });

  // Staff Edit Modal State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Teacher | null>(null);
  const [staffFormData, setStaffFormData] = useState<Partial<Teacher>>({
    code: '',
    name: '',
    position: 'Nhân viên hành chính',
    email: '',
    phone: '',
    degree: 'Đại học',
    status: 'Đang công tác'
  });

  // 1. Initial Subscriptions
  useEffect(() => {
    const unsubTasks = officeService.subscribeOfficeTasks(setTasks);
    const unsubDocs = officeService.subscribeOfficeDocuments(setDocuments);
    return () => {
      unsubTasks();
      unsubDocs();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Staff Filters
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState<string>('all');

  // 1. Single source of truth for Office Staff from master CBGVNV store (teachers)
  const officeStaffList = useMemo(() => {
    return teachers.filter(t => {
      const deptId = (t.departmentId || '').toLowerCase();
      const deptName = (t.departmentName || '').toLowerCase();
      const pos = (t.position || '').toLowerCase();
      const role = (t.role || '').toLowerCase();

      // Check if explicitly assigned to a teaching department
      const isTeachingDept = 
        deptId === 'd_toan_ly_tin_cn' ||
        deptId === 'd_van_su_dia_gdkt_pl_an' ||
        deptId === 'd_hoa_sinh_gdtc_qpan_nn' ||
        (deptName.includes('toán') || deptName.includes('văn-sử') || deptName.includes('hóa-sinh'));

      if (isTeachingDept) return false;

      // Belonging to Office Department or having Office Position/Role
      return (
        deptId === 'd_van_phong' ||
        deptId === 'van_phong' ||
        deptId === 'vp' ||
        deptName.includes('văn phòng') ||
        deptName.includes('van phong') ||
        pos.includes('kế toán') ||
        pos.includes('văn thư') ||
        pos.includes('thủ quỹ') ||
        pos.includes('y tế') ||
        pos.includes('thư viện') ||
        pos.includes('thiết bị') ||
        pos.includes('bảo vệ') ||
        pos.includes('tạp vụ') ||
        pos.includes('hành chính') ||
        pos.includes('cntt') ||
        role === 'NHAN_VIEN'
      );
    });
  }, [teachers]);

  // 2. Filtered Office Staff list for searching and status filtering
  const filteredOfficeStaffList = useMemo(() => {
    return officeStaffList.filter(s => {
      const query = staffSearchQuery.trim().toLowerCase();
      const matchesSearch = 
        !query ||
        (s.name || '').toLowerCase().includes(query) ||
        (s.code || '').toLowerCase().includes(query) ||
        (s.position || '').toLowerCase().includes(query) ||
        (s.username || '').toLowerCase().includes(query) ||
        (s.email || '').toLowerCase().includes(query) ||
        (s.phone || '').toLowerCase().includes(query);

      const matchesStatus = 
        staffStatusFilter === 'all' || 
        (s.status || 'Đang công tác') === staffStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [officeStaffList, staffSearchQuery, staffStatusFilter]);

  // Head of Office Department (Tổ trưởng)
  const headOfOffice = useMemo(() => {
    return officeStaffList.find(s => {
      const pos = (s.position || '').toLowerCase();
      return pos.includes('tổ trưởng') || pos.includes('kế toán trưởng');
    }) || officeStaffList[0];
  }, [officeStaffList]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assigneeName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = taskCategoryFilter === 'all' || 
        t.category === taskCategoryFilter ||
        (taskCategoryFilter === 'Thư viện' && t.category === 'Thư viện - Thiết bị') ||
        (taskCategoryFilter === 'Thiết bị' && t.category === 'Thư viện - Thiết bị');
      const matchesStatus = taskStatusFilter === 'all' || t.status === taskStatusFilter;
      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [tasks, searchQuery, taskCategoryFilter, taskStatusFilter]);

  // Filtered Documents
  const filteredDocs = useMemo(() => {
    return documents.filter(d => {
      const matchesSearch = 
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.dispatchCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.issuingAgency.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = docTypeFilter === 'all' || d.type === docTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [documents, searchQuery, docTypeFilter]);

  // Handle Save Task
  const handleSaveTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskFormData.title?.trim()) {
      alert('Vui lòng nhập tên nhiệm vụ / công việc');
      return;
    }

    const res = await officeService.saveOfficeTask(taskFormData);
    if (res.success) {
      showToast(editingTask ? 'Đã cập nhật nhiệm vụ Tổ Văn phòng thành công!' : 'Đã tạo nhiệm vụ mới cho Tổ Văn phòng!');
      setIsTaskModalOpen(false);
      setEditingTask(null);
    }
  };

  // Handle Quick Task Status Toggle
  const handleQuickStatusChange = async (task: OfficeTask, newStatus: OfficeTaskStatus, newProgress: number) => {
    await officeService.saveOfficeTask({
      ...task,
      status: newStatus,
      progressPercent: newProgress
    });
    showToast(`Đã cập nhật tiến độ công việc "${task.title.slice(0, 30)}..." sang ${newStatus}`);
  };

  // Handle Delete Task
  const handleDeleteTask = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này khỏi Lịch giao việc Tổ Văn phòng?')) {
      await officeService.deleteOfficeTask(id);
      showToast('Đã xóa nhiệm vụ thành công.');
    }
  };

  // Handle Save Document
  const handleSaveDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFormData.title?.trim() || !docFormData.dispatchCode?.trim()) {
      alert('Vui lòng nhập Số/Ký hiệu và Trích yếu văn bản');
      return;
    }

    await officeService.saveOfficeDocument(docFormData);
    showToast('Đã lưu văn bản hành chính Tổ Văn phòng thành công.');
    setIsDocModalOpen(false);
  };

  // Handle Save Staff
  const handleSaveStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffFormData.name?.trim()) {
      alert('Vui lòng nhập họ và tên nhân viên');
      return;
    }

    const selectedDeptId = staffFormData.departmentId || 'd_van_phong';
    const selectedDeptObj = departments.find(d => d.id === selectedDeptId);
    const selectedDeptName = selectedDeptObj?.name || (selectedDeptId === 'd_van_phong' ? 'Tổ Văn phòng' : staffFormData.departmentName || 'Tổ Văn phòng');

    const payload = {
      ...staffFormData,
      departmentId: selectedDeptId,
      departmentName: selectedDeptName,
      status: staffFormData.status || 'Đang công tác',
      role: staffFormData.role || 'NHAN_VIEN'
    };

    if (editingStaff) {
      await updateTeacher(editingStaff.id, payload);
      showToast(`Đã cập nhật thông tin nhân viên ${editingStaff.name} vào hệ thống Quản lý CBGVNV.`);
    } else {
      await addTeacher({
        id: `t_vp_${Date.now()}`,
        code: staffFormData.code || `NV00${officeStaffList.length + 1}`,
        name: staffFormData.name || '',
        username: (staffFormData.code || `nv00${officeStaffList.length + 1}`).toLowerCase(),
        role: staffFormData.role || 'NHAN_VIEN',
        position: staffFormData.position || 'Nhân viên hành chính',
        departmentId: selectedDeptId,
        departmentName: selectedDeptName,
        email: staffFormData.email || '',
        phone: staffFormData.phone || '',
        degree: staffFormData.degree || 'Đại học',
        joinDate: staffFormData.joinDate || new Date().toISOString().split('T')[0],
        status: staffFormData.status || 'Đang công tác',
        subject: 'Hành chính'
      });
      showToast('Đã thêm nhân viên mới vào hệ thống Quản lý CBGVNV thành công!');
    }
    setIsStaffModalOpen(false);
  };

  // Handle Delete Staff
  const handleDeleteStaff = async () => {
    if (!deletingStaff) return;
    try {
      setIsDeletingStaff(true);
      await deleteTeacher(deletingStaff.id);
      showToast(`Đã xóa thành công nhân viên ${deletingStaff.name} khỏi Tổ Văn phòng.`);
      setDeletingStaff(null);
    } catch (err: any) {
      alert('Lỗi khi xóa nhân viên: ' + (err.message || err));
    } finally {
      setIsDeletingStaff(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1500px] mx-auto space-y-6 pb-16 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <BackButton />
        <button
          onClick={() => exportOfficeSummaryToExcel(officeStaffList, tasks, documents)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
        >
          <FileSpreadsheet size={15} />
          <span>XUẤT BÁO CÁO EXCEL TỔ VĂN PHÒNG</span>
        </button>
      </div>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-blue-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-bold text-cyan-300">
              <Building2 size={14} />
              <span>TRƯỜNG THPT SƠN LƯƠNG • KHỐI HÀNH CHÍNH QUẢN TRỊ</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white flex items-center gap-3">
              TỔ VĂN PHÒNG
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 font-medium max-w-3xl leading-relaxed">
              Quản lý toàn diện nhân sự hành chính, kế toán tài chính, văn thư - lưu trữ, thủ quỹ, y tế học đường, thư viện - thiết bị dạy học, CNTT & an ninh trường học.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl text-xs space-y-1.5 shrink-0 min-w-[240px]">
            <div className="text-blue-200 font-semibold flex items-center gap-1.5">
              <UserCheck size={14} className="text-cyan-300" />
              <span>Tổ trưởng Tổ Văn phòng:</span>
            </div>
            <div className="text-sm font-extrabold text-amber-300">
              {headOfOffice ? headOfOffice.name : 'Phạm Thị Dung'}
            </div>
            <div className="text-[11px] text-blue-100 flex items-center gap-1">
              <Briefcase size={12} /> {headOfOffice?.position || 'Kế toán trưởng'}
            </div>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Nhân sự Tổ Văn phòng</span>
            <div className="text-2xl font-black text-slate-900">{officeStaffList.length} <span className="text-xs font-normal text-slate-500">cán bộ</span></div>
            <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={12} /> 100% Đang công tác
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Users size={22} />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Nhiệm vụ đang thực hiện</span>
            <div className="text-2xl font-black text-slate-900">
              {tasks.filter(t => t.status === 'Đang thực hiện').length} <span className="text-xs font-normal text-slate-500">/ {tasks.length}</span>
            </div>
            <div className="text-[11px] font-bold text-blue-600 flex items-center gap-1">
              <Clock size={12} /> Tiến độ hoàn thành: {Math.round((tasks.filter(t => t.status === 'Đã hoàn thành').length / (tasks.length || 1)) * 100)}%
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600">
            <CheckSquare size={22} />
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Công văn & Văn bản</span>
            <div className="text-2xl font-black text-slate-900">{documents.length} <span className="text-xs font-normal text-slate-500">văn bản</span></div>
            <div className="text-[11px] font-bold text-purple-600 flex items-center gap-1">
              <FileText size={12} /> Công văn đi / đến tháng 10
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <FileText size={22} />
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Xếp loại KPI Nhân viên</span>
            <div className="text-2xl font-black text-emerald-600">Loại Tốt</div>
            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Award size={12} className="text-amber-500" /> Đánh giá định kỳ hàng tháng
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Award size={22} />
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('roster')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'roster'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users size={16} />
          <span>DANH SÁCH NHÂN SỰ ({officeStaffList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'tasks'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CheckSquare size={16} />
          <span>LỊCH GIAO VIỆC TỔ ({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'documents'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText size={16} />
          <span>QUẢN LÝ CÔNG VĂN ({documents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('kpi_summary')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'kpi_summary'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award size={16} />
          <span>TỔNG HỢP KPI NHÂN VIÊN</span>
        </button>

        <button
          onClick={() => setActiveTab('standards')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'standards'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck size={16} />
          <span>TIÊU CHUẨN VỊ TRÍ VIỆC LÀM</span>
        </button>
      </div>

      {/* TAB 1: DANH SÁCH NHÂN SỰ TỔ VĂN PHÒNG */}
      {activeTab === 'roster' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Users className="text-blue-600" size={18} />
                HỒ SƠ CÁN BỘ & NHÂN VIÊN TỔ VĂN PHÒNG
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Danh sách toàn bộ cán bộ kế toán, văn thư, y tế, thư viện, CNTT & bảo vệ</p>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setEditingStaff(null);
                  setStaffFormData({
                    code: `NV00${officeStaffList.length + 1}`,
                    name: '',
                    position: 'Nhân viên hành chính',
                    email: '',
                    phone: '',
                    degree: 'Đại học'
                  });
                  setIsStaffModalOpen(true);
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} />
                <span>THÊM NHÂN VIÊN VĂN PHÒNG</span>
              </button>
            )}
          </div>

          {/* Search & Status Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Tìm theo họ tên, mã nhân viên, chức danh hoặc tài khoản..."
                value={staffSearchQuery}
                onChange={e => setStaffSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="text-slate-400 shrink-0" size={16} />
              <select
                value={staffStatusFilter}
                onChange={e => setStaffStatusFilter(e.target.value)}
                className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">Tất cả trạng thái công tác</option>
                <option value="Đang công tác">Đang công tác</option>
                <option value="Tạm nghỉ">Tạm nghỉ</option>
                <option value="Đã chuyển công tác">Đã chuyển công tác</option>
              </select>
            </div>
          </div>

          {/* Roster Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 text-center w-12">STT</th>
                  <th className="p-3.5">Mã NV</th>
                  <th className="p-3.5">Họ và tên & Tài khoản</th>
                  <th className="p-3.5">Chức danh / Vị trí</th>
                  <th className="p-3.5">Tổ / Bộ phận</th>
                  <th className="p-3.5">Thông tin liên hệ</th>
                  <th className="p-3.5">Trình độ</th>
                  <th className="p-3.5 text-center">Trạng thái</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredOfficeStaffList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500 italic">
                      {officeStaffList.length === 0
                        ? 'Chưa có dữ liệu nhân sự Tổ Văn phòng trong Quản lý CBGVNV. Bấm "Thêm nhân viên" để bổ sung.'
                        : 'Không tìm thấy nhân viên phù hợp với từ khóa hoặc bộ lọc.'}
                    </td>
                  </tr>
                ) : (
                  filteredOfficeStaffList.map((staff, idx) => (
                    <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3.5 font-mono font-bold text-blue-700">{staff.code || `NV00${idx + 1}`}</td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-sm">{staff.name}</div>
                        {staff.username && (
                          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                            <span className="text-slate-400">TK:</span> {staff.username}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-extrabold text-[11px] bg-blue-50 text-blue-800 border border-blue-200">
                          <Briefcase size={12} />
                          {staff.position || 'Nhân viên hành chính'}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-700">
                        {staff.departmentName || 'Tổ Văn phòng'}
                      </td>
                      <td className="p-3.5 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px]">
                          <Phone size={12} className="text-slate-400" /> {staff.phone || '—'}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                          <Mail size={12} className="text-slate-400" /> {staff.email || '—'}
                        </div>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-700">{staff.degree || 'Đại học'}</td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] border ${
                          staff.status === 'Đã chuyển công tác'
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : staff.status === 'Tạm nghỉ'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        }`}>
                          {staff.status || 'Đang công tác'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => navigate('/kpi-nv')}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                          title="Đánh giá KPI Nhân viên"
                        >
                          <Award size={13} /> KPI
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => {
                                setEditingStaff(staff);
                                setStaffFormData(staff);
                                setIsStaffModalOpen(true);
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="Sửa thông tin nhân viên"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => setDeletingStaff(staff)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Xóa nhân viên khỏi Tổ Văn phòng"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LỊCH GIAO VIỆC TỔ VĂN PHÒNG */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <CheckSquare className="text-blue-600" size={18} />
                LỊCH GIAO VIỆC & PHÂN CÔNG CÔNG TÁC TỔ VĂN PHÒNG
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Theo dõi tiến độ báo cáo tài chính, văn thư, y tế, thư viện & bảo vệ</p>
            </div>

            <button
              onClick={() => {
                setEditingTask(null);
                setTaskFormData({
                  title: '',
                  category: 'Tài chính - Kế toán',
                  assigneeId: officeStaffList[0]?.id || 'unknown',
                  assigneeName: officeStaffList[0]?.name || 'Phạm Thị Dung',
                  assigneePosition: officeStaffList[0]?.position || 'Kế toán trưởng',
                  startDate: new Date().toISOString().split('T')[0],
                  dueDate: new Date().toISOString().split('T')[0],
                  priority: 'Bình thường',
                  status: 'Chờ thực hiện',
                  progressPercent: 0,
                  notes: '',
                  evidenceRequirement: ''
                });
                setIsTaskModalOpen(true);
              }}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>GIAO NHIỆM VỤ MỚI</span>
            </button>
          </div>

          {/* Task Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên công việc hoặc người thực hiện..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
              <select
                value={taskCategoryFilter}
                onChange={e => setTaskCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 font-bold focus:outline-none"
              >
                <option value="all">Tất cả mảng công tác</option>
                <option value="Tài chính - Kế toán">Tài chính - Kế toán</option>
                <option value="Văn thư - Lưu trữ">Văn thư - Lưu trữ</option>
                <option value="Y tế - BHYT Học sinh">Y tế - BHYT Học sinh</option>
                <option value="Thư viện">Thư viện</option>
                <option value="Thiết bị">Thiết bị</option>
                <option value="CNTT - Thiết bị số">CNTT - Thiết bị số</option>
                <option value="Cơ sở vật chất - An ninh">Cơ sở vật chất - An ninh</option>
              </select>

              <select
                value={taskStatusFilter}
                onChange={e => setTaskStatusFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 font-bold focus:outline-none"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="Chờ thực hiện">Chờ thực hiện</option>
                <option value="Đang thực hiện">Đang thực hiện</option>
                <option value="Đã hoàn thành">Đã hoàn thành</option>
                <option value="Chậm tiến độ">Chậm tiến độ</option>
              </select>
            </div>
          </div>

          {/* Task List */}
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-500 italic text-xs">
                Không tìm thấy công việc phù hợp với điều kiện lọc.
              </div>
            ) : (
              filteredTasks.map(task => (
                <div key={task.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] ${
                        task.priority === 'Khẩn cấp' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        task.priority === 'Cao' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}>
                        Ưu tiên: {task.priority}
                      </span>

                      <span className="px-2.5 py-0.5 rounded-full font-extrabold text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200">
                        {task.category}
                      </span>

                      <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] ${
                        task.status === 'Đã hoàn thành' ? 'bg-emerald-100 text-emerald-800' :
                        task.status === 'Đang thực hiện' ? 'bg-blue-100 text-blue-800' :
                        task.status === 'Chậm tiến độ' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {task.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        onClick={() => handleQuickStatusChange(task, 'Đã hoàn thành', 100)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                        title="Đánh dấu đã hoàn thành 100%"
                      >
                        ✓ Hoàn thành
                      </button>
                      <button
                        onClick={() => {
                          setEditingTask(task);
                          setTaskFormData(task);
                          setIsTaskModalOpen(true);
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="Sửa công việc"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Xóa công việc"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">{task.title}</h4>
                    {task.notes && <p className="text-slate-600 text-xs mt-1 leading-relaxed">{task.notes}</p>}
                  </div>

                  {/* Progress Bar & Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500 font-bold">Người thực hiện:</span>{' '}
                      <strong className="text-slate-800">{task.assigneeName}</strong> ({task.assigneePosition || 'Nhân viên'})
                    </div>

                    <div>
                      <span className="text-slate-500 font-bold">Thời gian:</span>{' '}
                      <span className="font-mono text-slate-700">{task.startDate} → <strong className="text-rose-600">{task.dueDate}</strong></span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between font-bold text-[11px]">
                        <span className="text-slate-500">Tiến độ:</span>
                        <span className="text-blue-700">{task.progressPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            task.progressPercent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${task.progressPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: QUẢN LÝ CÔNG VĂN & VĂN BẢN */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" size={18} />
                QUẢN LÝ CÔNG VĂN & VĂN BẢN HÀNH CHÍNH TỔ VĂN PHÒNG
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Sổ công văn đi, công văn đến, quyết định & tờ trình lưu trữ</p>
            </div>

            <button
              onClick={() => {
                setDocFormData({
                  dispatchCode: `CV-${Date.now().toString().slice(-4)}/THPTSL`,
                  type: 'Công văn đến',
                  title: '',
                  issuingAgency: 'Sở GD&ĐT Yên Bái',
                  receiptDate: new Date().toISOString().split('T')[0],
                  category: 'Văn thư - Lưu trữ',
                  handlerName: officeStaffList[0]?.name || 'Trần Văn Hải',
                  status: 'Chờ xử lý',
                  summary: ''
                });
                setIsDocModalOpen(true);
              }}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>TIẾP NHẬN / THÊM VĂN BẢN</span>
            </button>
          </div>

          {/* Doc Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 text-center w-12">STT</th>
                  <th className="p-3.5">Số / Ký hiệu</th>
                  <th className="p-3.5">Loại văn bản</th>
                  <th className="p-3.5">Trích yếu nội dung</th>
                  <th className="p-3.5">Cơ quan ban hành</th>
                  <th className="p-3.5">Cán bộ xử lý</th>
                  <th className="p-3.5 text-center">Trạng thái</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                      Chưa có văn bản hành chính nào. Bấm "Tiếp nhận / Thêm văn bản" để lưu.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((docItem, idx) => (
                    <tr key={docItem.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3.5 font-mono font-bold text-blue-800">{docItem.dispatchCode}</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-0.5 rounded-full font-extrabold text-[10px] bg-purple-50 text-purple-800 border border-purple-200">
                          {docItem.type}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-900 max-w-md">
                        {docItem.title}
                        {docItem.summary && <p className="text-[11px] text-slate-500 font-normal mt-0.5">{docItem.summary}</p>}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-700">{docItem.issuingAgency}</td>
                      <td className="p-3.5 font-semibold text-slate-800">{docItem.handlerName}</td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] ${
                          docItem.status === 'Đã xử lý' || docItem.status === 'Đã hoàn thành' || docItem.status === 'Đã lưu trữ'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {docItem.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        <button
                          onClick={async () => {
                            if (window.confirm('Xóa văn bản này khỏi sổ theo dõi?')) {
                              await officeService.deleteOfficeDocument(docItem.id);
                              showToast('Đã xóa văn bản khỏi sổ.');
                            }
                          }}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TỔNG HỢP KPI NHÂN VIÊN */}
      {activeTab === 'kpi_summary' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Award className="text-blue-600" size={18} />
                BẢNG TỔNG HỢP KPI VÀ XẾP LOẠI THI ĐƯA TỔ VĂN PHÒNG
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Đánh giá theo chuẩn 100 điểm dành cho Nhân viên hành chính THPT Sơn Lương</p>
            </div>

            <button
              onClick={() => navigate('/kpi-nv')}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink size={15} />
              <span>SỔ ĐÁNH GIÁ KPI NHÂN VIÊN</span>
            </button>
          </div>

          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 space-y-3">
            <h4 className="font-extrabold text-blue-900 text-sm flex items-center gap-2">
              <Sparkles size={16} className="text-blue-600" />
              QUY TRÌNH CHẤM ĐIỂM KPI TỔ VĂN PHÒNG (KHỐI NHÂN VIÊN)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs space-y-1">
                <span className="font-extrabold text-blue-800">1. Tự đánh giá (Tháng)</span>
                <p className="text-slate-600 leading-relaxed">
                  Cán bộ, nhân viên Kế toán, Văn thư, Y tế, Thư viện, CNTT, Bảo vệ tự chấm điểm theo khung tiêu chí công việc ban hành.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs space-y-1">
                <span className="font-extrabold text-blue-800">2. Tổ trưởng duyệt</span>
                <p className="text-slate-600 leading-relaxed">
                  Tổ trưởng Tổ Văn phòng rà soát minh chứng, chấm điểm thẩm định và xếp loại dự kiến.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs space-y-1">
                <span className="font-extrabold text-blue-800">3. Ban Giám hiệu phê duyệt</span>
                <p className="text-slate-600 leading-relaxed">
                  Hiệu trưởng / Phó Hiệu trưởng phê duyệt chính thức kết quả thi đua và ban hành quyết định khen thưởng.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TIÊU CHUẨN VỊ TRÍ VIỆC LÀM */}
      {activeTab === 'standards' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <ShieldCheck className="text-blue-600" size={18} />
              ĐỊNH MỨC & TIÊU CHUẨN VỊ TRÍ VIỆC LÀM TỔ VĂN PHÒNG
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Khung năng lực và nhiệm vụ cốt lõi theo Thông tư hướng dẫn vị trí việc làm ngành GD&ĐT</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {standards.map(std => (
              <div key={std.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="inline-block px-2.5 py-0.5 rounded-full font-extrabold text-[10px] bg-blue-100 text-blue-800">
                    {std.position}
                  </span>
                  <h4 className="font-extrabold text-slate-900 text-sm leading-snug">{std.title}</h4>

                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Nhiệm vụ cốt lõi:</span>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {std.responsibilities.map((resp, i) => (
                        <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                          <span className="text-blue-600 font-bold shrink-0">•</span>
                          <span>{resp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 text-xs text-slate-600 font-medium">
                  <span className="font-bold text-slate-500">Yêu cầu chuẩn:</span> {std.qualifications}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL GIAO NHIỆM VỤ MỚI */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <CheckSquare size={18} />
                {editingTask ? 'CẬP NHẬT NHIỆM VỤ TỔ VĂN PHÒNG' : 'GIAO NHIỆM VỤ MỚI TỔ VĂN PHÒNG'}
              </h3>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTaskSubmit} className="p-6 space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-700 font-bold">Tên nhiệm vụ / Công việc <span className="text-rose-600">*</span></label>
                <textarea
                  value={taskFormData.title || ''}
                  onChange={e => setTaskFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Nhập tên nhiệm vụ chi tiết..."
                  rows={2}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Mảng công tác</label>
                  <select
                    value={taskFormData.category || 'Tài chính - Kế toán'}
                    onChange={e => setTaskFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none"
                  >
                    <option value="Tài chính - Kế toán">Tài chính - Kế toán</option>
                    <option value="Văn thư - Lưu trữ">Văn thư - Lưu trữ</option>
                    <option value="Y tế - BHYT Học sinh">Y tế - BHYT Học sinh</option>
                    <option value="Thư viện">Thư viện</option>
                    <option value="Thiết bị">Thiết bị</option>
                    <option value="CNTT - Thiết bị số">CNTT - Thiết bị số</option>
                    <option value="Cơ sở vật chất - An ninh">Cơ sở vật chất - An ninh</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Người thực hiện</label>
                  <select
                    value={taskFormData.assigneeId || ''}
                    onChange={e => {
                      const selected = officeStaffList.find(s => s.id === e.target.value);
                      setTaskFormData(prev => ({
                        ...prev,
                        assigneeId: e.target.value,
                        assigneeName: selected?.name || 'Nhân viên Tổ Văn phòng',
                        assigneePosition: selected?.position || 'Nhân viên'
                      }));
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none"
                  >
                    {officeStaffList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.position || 'Nhân viên'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={taskFormData.startDate || ''}
                    onChange={e => setTaskFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Hạn hoàn thành</label>
                  <input
                    type="date"
                    value={taskFormData.dueDate || ''}
                    onChange={e => setTaskFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Mức ưu tiên</label>
                  <select
                    value={taskFormData.priority || 'Bình thường'}
                    onChange={e => setTaskFormData(prev => ({ ...prev, priority: e.target.value as OfficeTaskPriority }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none"
                  >
                    <option value="Bình thường">Bình thường</option>
                    <option value="Cao">Cao</option>
                    <option value="Khẩn cấp">Khẩn cấp</option>
                    <option value="Thấp">Thấp</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Trạng thái</label>
                  <select
                    value={taskFormData.status || 'Chờ thực hiện'}
                    onChange={e => setTaskFormData(prev => ({ ...prev, status: e.target.value as OfficeTaskStatus }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none"
                  >
                    <option value="Chờ thực hiện">Chờ thực hiện</option>
                    <option value="Đang thực hiện">Đang thực hiện</option>
                    <option value="Đã hoàn thành">Đã hoàn thành</option>
                    <option value="Chậm tiến độ">Chậm tiến độ</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Tiến độ (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={taskFormData.progressPercent !== undefined ? taskFormData.progressPercent : 0}
                    onChange={e => setTaskFormData(prev => ({ ...prev, progressPercent: Number(e.target.value) || 0 }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-bold">Ghi chú & Yêu cầu minh chứng</label>
                <input
                  type="text"
                  placeholder="Ghi chú yêu cầu nộp file, báo cáo hoặc biên bản..."
                  value={taskFormData.notes || ''}
                  onChange={e => setTaskFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {editingTask ? 'LƯU CẬP NHẬT' : 'GIAO NHIỆM VỤ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL THÊM CÔNG VĂN VĂN BẢN */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <FileText size={18} />
                TIẾP NHẬN / SỔ CÔNG VĂN VĂN BẢN
              </h3>
              <button
                onClick={() => setIsDocModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDocSubmit} className="p-6 space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Số / Ký hiệu văn bản <span className="text-rose-600">*</span></label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 142/SGDDT-VP"
                    value={docFormData.dispatchCode || ''}
                    onChange={e => setDocFormData(prev => ({ ...prev, dispatchCode: e.target.value }))}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Loại văn bản</label>
                  <select
                    value={docFormData.type || 'Công văn đến'}
                    onChange={e => setDocFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none"
                  >
                    <option value="Công văn đến">Công văn đến</option>
                    <option value="Công văn đi">Công văn đi</option>
                    <option value="Quyết định">Quyết định</option>
                    <option value="Tờ trình">Tờ trình</option>
                    <option value="Thông báo nội bộ">Thông báo nội bộ</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-bold">Trích yếu nội dung <span className="text-rose-600">*</span></label>
                <textarea
                  placeholder="Nhập trích yếu văn bản..."
                  value={docFormData.title || ''}
                  onChange={e => setDocFormData(prev => ({ ...prev, title: e.target.value }))}
                  rows={2}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Cơ quan ban hành</label>
                  <input
                    type="text"
                    value={docFormData.issuingAgency || ''}
                    onChange={e => setDocFormData(prev => ({ ...prev, issuingAgency: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Ngày nhận / ban hành</label>
                  <input
                    type="date"
                    value={docFormData.receiptDate || ''}
                    onChange={e => setDocFormData(prev => ({ ...prev, receiptDate: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Cán bộ xử lý</label>
                  <input
                    type="text"
                    value={docFormData.handlerName || ''}
                    onChange={e => setDocFormData(prev => ({ ...prev, handlerName: e.target.value }))}
                    placeholder="Nhập tên người xử lý..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Trạng thái</label>
                  <select
                    value={docFormData.status || 'Chờ xử lý'}
                    onChange={e => setDocFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none"
                  >
                    <option value="Chờ xử lý">Chờ xử lý</option>
                    <option value="Đang xử lý">Đang xử lý</option>
                    <option value="Đã xử lý">Đã xử lý</option>
                    <option value="Đã hoàn thành">Đã hoàn thành</option>
                    <option value="Đã lưu trữ">Đã lưu trữ</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md transition-all cursor-pointer"
                >
                  LƯU VĂN BẢN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL THÊM / SỬA NHÂN VIÊN TỔ VĂN PHÒNG */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Users size={18} />
                {editingStaff ? 'CẬP NHẬT THÔNG TIN NHÂN VIÊN' : 'THÊM NHÂN VIÊN MỚI TỔ VĂN PHÒNG'}
              </h3>
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStaffSubmit} className="p-6 space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Mã nhân viên <span className="text-rose-600">*</span></label>
                  <input
                    type="text"
                    value={staffFormData.code || ''}
                    onChange={e => setStaffFormData(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="Ví dụ: NV001"
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Họ và tên <span className="text-rose-600">*</span></label>
                  <input
                    type="text"
                    value={staffFormData.name || ''}
                    onChange={e => setStaffFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nhập họ và tên..."
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-bold">Chức danh / Vị trí việc làm</label>
                <select
                  value={staffFormData.position || 'Nhân viên hành chính'}
                  onChange={e => setStaffFormData(prev => ({ ...prev, position: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none"
                >
                  <option value="Kế toán trưởng">Kế toán trưởng</option>
                  <option value="Kế toán viên">Kế toán viên</option>
                  <option value="Văn thư - Lưu trữ">Văn thư - Lưu trữ</option>
                  <option value="Thủ quỹ">Thủ quỹ</option>
                  <option value="Nhân viên Y tế học đường">Nhân viên Y tế học đường</option>
                  <option value="Thư viện">Thư viện</option>
                  <option value="Thiết bị">Thiết bị</option>
                  {staffFormData.position === 'Thư viện - Thiết bị' && (
                    <option value="Thư viện - Thiết bị">Thư viện - Thiết bị (Hồ sơ cũ)</option>
                  )}
                  <option value="Quản trị CNTT">Quản trị CNTT</option>
                  <option value="Bảo vệ chuyên trách">Bảo vệ chuyên trách</option>
                  <option value="Tạp vụ - Phục vụ">Tạp vụ - Phục vụ</option>
                  <option value="Nhân viên hành chính">Nhân viên hành chính</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Số điện thoại</label>
                  <input
                    type="text"
                    value={staffFormData.phone || ''}
                    onChange={e => setStaffFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Email công vụ</label>
                  <input
                    type="email"
                    value={staffFormData.email || ''}
                    onChange={e => setStaffFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Tổ chuyên môn / Công tác</label>
                  <select
                    value={staffFormData.departmentId || 'd_van_phong'}
                    onChange={e => {
                      const dId = e.target.value;
                      const dObj = departments.find(d => d.id === dId);
                      setStaffFormData(prev => ({
                        ...prev,
                        departmentId: dId,
                        departmentName: dObj?.name || (dId === 'd_van_phong' ? 'Tổ Văn phòng' : 'Tổ Văn phòng')
                      }));
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="d_van_phong">Tổ Văn phòng</option>
                    {departments.filter(d => d.id !== 'd_van_phong').map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Trạng thái công tác</label>
                  <select
                    value={staffFormData.status || 'Đang công tác'}
                    onChange={e => setStaffFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="Đang công tác">Đang công tác</option>
                    <option value="Tạm nghỉ">Tạm nghỉ</option>
                    <option value="Đã chuyển công tác">Đã chuyển công tác</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md transition-all cursor-pointer"
                >
                  LƯU NHÂN VIÊN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận xóa nhân viên Tổ Văn phòng */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-900 uppercase">
                  Xác nhận xóa nhân viên?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Bạn có chắc chắn muốn xóa hồ sơ nhân viên <strong className="text-slate-900">{deletingStaff.name}</strong> ({deletingStaff.code || 'NV'}) khỏi Tổ Văn phòng?
                </p>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isDeletingStaff}
                  onClick={() => setDeletingStaff(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isDeletingStaff}
                  onClick={handleDeleteStaff}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {isDeletingStaff ? 'Đang xóa...' : 'Xác nhận xóa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
