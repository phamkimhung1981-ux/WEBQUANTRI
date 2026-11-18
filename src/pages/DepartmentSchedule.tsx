import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Upload, 
  Download, 
  Printer, 
  Plus, 
  Save, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Sparkles, 
  Users, 
  Award, 
  Check, 
  RotateCcw, 
  Trash2, 
  Eye,
  FileSpreadsheet,
  Building2,
  Share2,
  Send,
  Lock,
  ShieldCheck,
  Info
} from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import { Card } from '../components/ui/Card';
import { useAppContext } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { 
  DepartmentWeeklySchedule, 
  DepartmentScheduleDayItem 
} from '../types/departmentSchedule';
import { 
  departmentScheduleService,
  getCanonicalDepartmentId,
  getCanonicalDepartmentName,
  CANONICAL_DEPARTMENTS 
} from '../services/departmentScheduleService';
import { 
  exportDepartmentScheduleToWord, 
  downloadBlankTemplateWord 
} from '../utils/departmentScheduleExportWord';
import DepartmentScheduleWordUploadModal from '../components/departmentSchedule/DepartmentScheduleWordUploadModal';
import DepartmentSchedulePrintModal from '../components/departmentSchedule/DepartmentSchedulePrintModal';
import { PRESET_DEPARTMENTS } from './Tasks';
import { getWeekInfoByNumber, getAllWeeksInYear, getWeekDayDates, WeekDayDateItem } from '../utils/schoolWeekUtils';
import AutoResizeTextarea from '../components/ui/AutoResizeTextarea';

export default function DepartmentSchedule() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { hasPermission, canEdit, canApprove, isSystemAdmin, isBGH, isTTCM, roleGroup } = usePermission();
  const { departments } = useAppContext();

  // Combine Preset departments and custom departments from context with canonical IDs
  const allDepartments = useMemo(() => {
    const list = [...PRESET_DEPARTMENTS];
    departments.forEach(dept => {
      const canonicalId = getCanonicalDepartmentId(dept.id);
      const exists = list.some(d => getCanonicalDepartmentId(d.id) === canonicalId);
      if (!exists) {
        list.push({
          id: canonicalId,
          slug: canonicalId,
          name: dept.name,
          shortName: dept.name.replace(/^Tổ\s+/i, ''),
          groupToken: `GROUP_${canonicalId.toUpperCase()}`,
          icon: Users,
          description: `Tổ chuyên môn ${dept.name}`,
          subjects: [],
          color: {
            border: 'border-blue-200',
            bg: 'bg-blue-600',
            badge: 'bg-blue-50 text-blue-700 border-blue-200',
            text: 'text-blue-700',
            activeTab: 'bg-blue-600 text-white',
            light: 'bg-blue-50/70',
            ring: 'focus:ring-blue-500'
          }
        });
      }
    });
    return list;
  }, [departments]);

  // Determine user's assigned department ID in canonical form
  const userAssignedDeptId = useMemo(() => {
    if (!user) return '';
    const rawDept = (user as any).departmentId || (user as any).departmentName || '';
    return rawDept ? getCanonicalDepartmentId(rawDept) : '';
  }, [user]);

  // Selected Department State (strictly canonicalized)
  const initialDeptId = useMemo(() => {
    const paramDept = searchParams.get('dept');
    if (paramDept) return getCanonicalDepartmentId(paramDept);
    if (userAssignedDeptId) return userAssignedDeptId;
    return 'd_toan_ly_tin_cn';
  }, [searchParams, userAssignedDeptId]);

  const initialWeek = parseInt(searchParams.get('week') || '10', 10);

  const [selectedDeptId, setSelectedDeptId] = useState<string>(initialDeptId);
  const [selectedWeek, setSelectedWeek] = useState<number>(initialWeek);

  // Canonical selected ID and authoritative display name
  const canonicalSelectedDeptId = useMemo(() => getCanonicalDepartmentId(selectedDeptId), [selectedDeptId]);
  const currentDeptName = useMemo(() => getCanonicalDepartmentName(canonicalSelectedDeptId), [canonicalSelectedDeptId]);

  // Active schedule being viewed/edited
  const [schedule, setSchedule] = useState<DepartmentWeeklySchedule | null>(null);
  const [allSchedules, setAllSchedules] = useState<DepartmentWeeklySchedule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [isWordUploadOpen, setIsWordUploadOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Permission Checks:
  // - Admin and BGH can view, edit, and approve all departments
  const isBGHOrAdmin = isSystemAdmin || isBGH || roleGroup === 'ADMIN' || roleGroup === 'BGH' || user?.role === 'admin' || user?.role === 'BGH';

  // - TTCM or Teacher can edit only if they belong to this specific department
  const isUserOwnDepartment = !!userAssignedDeptId && userAssignedDeptId === canonicalSelectedDeptId;
  const hasEditPermission = canEdit('department_schedule') || hasPermission('department_schedule', 'create') || isTTCM;
  const canEditCurrentDept = isBGHOrAdmin || (hasEditPermission && isUserOwnDepartment);

  // - Approval permission (BGH / Admin only)
  const canApproveSchedule = isBGHOrAdmin || canApprove('department_schedule');

  // Selected department config from list
  const currentDeptConfig = useMemo(() => {
    return allDepartments.find(d => getCanonicalDepartmentId(d.id) === canonicalSelectedDeptId) || allDepartments[0];
  }, [allDepartments, canonicalSelectedDeptId]);

  // Weeks list for 2026-2027
  const allWeeks = useMemo(() => {
    return getAllWeeksInYear('2026-2027');
  }, []);

  const currentWeekInfo = useMemo(() => {
    return getWeekInfoByNumber(selectedWeek, '2026-2027');
  }, [selectedWeek]);

  // Danh sách 7 ngày trong tuần được tính trực tiếp từ mốc Thứ Hai của tuần đang chọn
  const currentWeekDays = useMemo(() => {
    return getWeekDayDates(selectedWeek, '2026-2027');
  }, [selectedWeek]);

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Load schedules from Firestore & LocalStorage
  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const list = await departmentScheduleService.getSchedules();
      setAllSchedules(list);
    } catch (e) {
      console.error('Error loading schedules:', e);
    } finally {
      setLoading(false);
    }
  };

  // Switch or generate schedule when department or week changes
  useEffect(() => {
    if (loading) return;

    const targetDeptId = canonicalSelectedDeptId;
    const targetDeptName = currentDeptName;

    // Filter schedules strictly matching canonical department ID and week number
    const matching = allSchedules.filter(s => 
      getCanonicalDepartmentId(s.departmentId || s.departmentName) === targetDeptId &&
      Number(s.weekNumber) === Number(selectedWeek)
    );

    let existing: DepartmentWeeklySchedule | undefined;
    if (matching.length > 0) {
      // Prioritize: approved first, then has non-empty day tasks, then latest updatedAt
      const sorted = [...matching].sort((a, b) => {
        if (a.status === 'approved' && b.status !== 'approved') return -1;
        if (b.status === 'approved' && a.status !== 'approved') return 1;
        const aHasContent = (a.days || []).some(d => (d.morningTasks?.trim() || d.afternoonTasks?.trim()));
        const bHasContent = (b.days || []).some(d => (d.morningTasks?.trim() || d.afternoonTasks?.trim()));
        if (aHasContent && !bHasContent) return -1;
        if (!aHasContent && bHasContent) return 1;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      });
      existing = sorted[0];
    }

    if (existing) {
      // Chuẩn hóa và gắn ngày thực tế của tuần đang chọn
      const normalized = departmentScheduleService.normalizeScheduleForWeek(existing, selectedWeek, '2026-2027');
      // Enforce strict canonical department ID and name in active state
      normalized.departmentId = targetDeptId;
      normalized.departmentName = targetDeptName;
      setSchedule(normalized);
    } else {
      // Create fresh blank schedule
      const blank = departmentScheduleService.createBlankSchedule(
        targetDeptId,
        targetDeptName,
        selectedWeek,
        2026
      );
      setSchedule(blank);
    }

    // Sync query params strictly with canonical ID
    setSearchParams({ dept: targetDeptId, week: String(selectedWeek) }, { replace: true });
  }, [canonicalSelectedDeptId, selectedWeek, allSchedules, loading, currentDeptName]);

  // Handle cell edit by date ISO (Liên kết dữ liệu với ngày thực tế)
  const handleUpdateDay = (dateIso: string, field: keyof DepartmentScheduleDayItem, value: any) => {
    if (!schedule) return;

    if (!canEditCurrentDept) {
      showToast('Bạn chỉ có quyền xem, không được chỉnh sửa lịch của tổ này.');
      return;
    }

    const newDays = [...schedule.days];
    let dayIndex = newDays.findIndex(d => d.date === dateIso);

    if (dayIndex >= 0) {
      newDays[dayIndex] = {
        ...newDays[dayIndex],
        [field]: value
      };
    } else {
      // Nếu chưa có phần tử ngày này thì tạo mới gắn đúng ngày thực tế
      const wDay = currentWeekDays.find(w => w.dateIso === dateIso);
      if (wDay) {
        newDays.push({
          id: `day_${Date.now()}`,
          dayOfWeek: wDay.dayOfWeek,
          date: dateIso,
          dateDisplay: wDay.dateLabel,
          morningTasks: field === 'morningTasks' ? value : '',
          afternoonTasks: field === 'afternoonTasks' ? value : '',
          dutyLeaderOrEvaluation: field === 'dutyLeaderOrEvaluation' ? value : '',
          notes: field === 'notes' ? value : '',
          assignedTeachers: [],
          status: 'pending'
        });
      }
    }

    const updatedSchedule: DepartmentWeeklySchedule = {
      ...schedule,
      departmentId: canonicalSelectedDeptId,
      departmentName: currentDeptName,
      days: newDays,
      updatedAt: new Date().toISOString()
    };

    setSchedule(updatedSchedule);

    // Auto-save immediately to localStorage and Firestore
    departmentScheduleService.saveSchedule(updatedSchedule).catch(console.error);
  };

  // Manual save
  const handleSave = async () => {
    if (!schedule) return;

    if (!canEditCurrentDept) {
      showToast('Bạn chỉ có quyền xem, không thể lưu lịch của tổ này.');
      return;
    }

    setSaving(true);
    try {
      const normalized = departmentScheduleService.normalizeScheduleForWeek(schedule, selectedWeek, '2026-2027');
      normalized.departmentId = canonicalSelectedDeptId;
      normalized.departmentName = currentDeptName;
      
      await departmentScheduleService.saveSchedule(normalized);
      setSchedule(normalized);
      
      // Update local state list
      setAllSchedules(prev => {
        const idx = prev.findIndex(s => 
          s.id === normalized.id || 
          (getCanonicalDepartmentId(s.departmentId) === canonicalSelectedDeptId && Number(s.weekNumber) === Number(normalized.weekNumber))
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = normalized;
          return updated;
        }
        return [normalized, ...prev];
      });

      showToast(`Đã lưu lịch giao việc ${currentDeptName} (Tuần ${selectedWeek}) thành công!`);
    } catch (e: any) {
      console.error(e);
      showToast('Lỗi khi lưu: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  // Handle imported schedule from Word Modal
  const handleWordScheduleSaved = async (imported: DepartmentWeeklySchedule) => {
    const normalized = departmentScheduleService.normalizeScheduleForWeek(imported, imported.weekNumber, '2026-2027');
    await departmentScheduleService.saveSchedule(normalized);
    setAllSchedules(prev => [normalized, ...prev.filter(s => s.id !== normalized.id)]);
    
    // Switch to imported department and week
    const targetDept = getCanonicalDepartmentId(normalized.departmentId);
    setSelectedDeptId(targetDept);
    setSelectedWeek(normalized.weekNumber);
    setSchedule(normalized);
    showToast(`Đã nạp thành công lịch tuần ${normalized.weekNumber} cho ${normalized.departmentName} từ file Word!`);
  };

  // Handle BGH Approval
  const handleApprove = async () => {
    if (!schedule) return;

    if (!canApproveSchedule) {
      showToast('Chỉ Ban Giám Hiệu hoặc Quản trị viên mới có quyền phê duyệt lịch.');
      return;
    }

    const approverName = user?.name || 'Ban Giám Hiệu';
    try {
      const updated = await departmentScheduleService.approveSchedule(schedule.id, approverName);
      if (updated) {
        setSchedule(updated);
        setAllSchedules(prev => prev.map(s => s.id === updated.id ? updated : s));
        showToast(`Đã phê duyệt lịch giao việc Tuần ${selectedWeek} của ${currentDeptName}!`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add bullet to day cell
  const handleAddBullet = (dateIso: string, field: 'morningTasks' | 'afternoonTasks') => {
    if (!schedule || !canEditCurrentDept) return;
    const targetDay = schedule.days?.find(d => d.date === dateIso);
    const currentText = targetDay ? targetDay[field] || '' : '';
    const newText = currentText ? `${currentText}\n- ` : '- ';
    handleUpdateDay(dateIso, field, newText);
  };

  return (
    <div className="p-3 sm:p-6 max-w-[1500px] mx-auto space-y-6 pb-20 font-sans">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/90 backdrop-blur-xl p-5 sm:p-6 rounded-[24px] border border-white/40 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-4">
          <BackButton />
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 uppercase tracking-tight">
                Lịch Giao Việc Tổ Chuyên Môn
              </h1>
              <span className="bg-blue-100 text-blue-700 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                Mẫu chuẩn Word
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Phân công kế hoạch công tác tuần theo biểu mẫu hành chính THPT Sơn Lương
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Upload Word Button (PRIMARY FEATURE) */}
          <button
            type="button"
            onClick={() => setIsWordUploadOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Upload size={16} />
            <span>Tải lên từ file Word</span>
          </button>

          {/* Download Blank Template */}
          <button
            type="button"
            onClick={() => downloadBlankTemplateWord(currentDeptName, String(selectedWeek))}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            title="Tải biểu mẫu Word trống để điền"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Tải mẫu Word</span>
          </button>

          {/* Export Current Schedule to Word */}
          {schedule && (
            <button
              type="button"
              onClick={() => exportDepartmentScheduleToWord(schedule)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              title="Xuất lịch tuần này ra file Word"
            >
              <FileText size={15} />
              <span className="hidden sm:inline">Xuất Word</span>
            </button>
          )}

          {/* Print preview */}
          {schedule && (
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              title="Xem và In lịch"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">In lịch</span>
            </button>
          )}

          {/* Save Button (Disabled if read-only) */}
          {canEditCurrentDept && (
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save size={15} className={saving ? 'animate-spin' : ''} />
              <span>{saving ? 'Đang lưu...' : 'Lưu lại'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Department Tabs & Week Filter */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-4">
        
        {/* Department Pills */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide mr-1">
              Tổ chuyên môn:
            </span>
            {allDepartments.map((dept) => {
              const canonicalDeptId = getCanonicalDepartmentId(dept.id);
              const isSelected = canonicalDeptId === canonicalSelectedDeptId;
              const IconComp = dept.icon || Users;
              const isUserDept = userAssignedDeptId === canonicalDeptId;

              return (
                <button
                  key={dept.id}
                  onClick={() => {
                    setSelectedDeptId(canonicalDeptId);
                    setSearchParams({ dept: canonicalDeptId, week: String(selectedWeek) }, { replace: true });
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600 ring-offset-2'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <IconComp size={15} />
                  <span>{dept.shortName || dept.name}</span>
                  {isUserDept && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700'}`}>
                      Tổ của bạn
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Week navigation & metadata */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          
          {/* Week Selector buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Chọn tuần:</span>
            
            <button
              type="button"
              disabled={selectedWeek <= 1}
              onClick={() => setSelectedWeek(prev => Math.max(1, prev - 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-700 transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="bg-white border border-slate-300 font-extrabold text-xs text-blue-700 rounded-xl px-3 py-1.5 shadow-xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {allWeeks.slice(0, 37).map(w => (
                <option key={w.weekNumber} value={w.weekNumber}>
                  Tuần {w.weekNumber} ({w.startDateStr} → {w.endDateStr})
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={selectedWeek >= 37}
              onClick={() => setSelectedWeek(prev => Math.min(37, prev + 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-700 transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Status & Approval info */}
          <div className="flex items-center gap-3">
            {schedule?.sourceFile && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <FileText size={13} />
                Nguồn: {schedule.sourceFile}
              </span>
            )}

            {schedule?.status === 'approved' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-3 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 size={15} />
                BGH đã duyệt ({schedule.approvedBy})
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  <Clock size={13} />
                  Bản dự thảo
                </span>
                
                {/* Allow BGH to approve */}
                {canApproveSchedule && (
                  <button
                    type="button"
                    onClick={handleApprove}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Check size={14} />
                    Duyệt lịch
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Read-Only Alert Banner if user is viewing another department */}
      {!canEditCurrentDept && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-amber-900 text-xs shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
            <Lock size={16} />
          </div>
          <div>
            <div className="font-bold text-amber-800">
              Chế độ xem lịch: {currentDeptName}
            </div>
            <p className="text-amber-700/90 mt-0.5">
              Bạn đang xem lịch công tác của tổ bạn không phụ trách. Theo nguyên tắc bảo mật và phân quyền, chỉ Tổ trưởng chuyên môn của <strong>{currentDeptName}</strong> hoặc Ban Giám Hiệu mới có quyền tạo mới và chỉnh sửa bảng lịch này.
            </p>
          </div>
        </div>
      )}

      {/* Main Schedule Document View */}
      <Card className="p-6 sm:p-8 bg-white border border-slate-200 shadow-sm rounded-3xl space-y-6">
        
        {/* Document Header (Matches Word Document - STRICTLY TIED TO SELECTED DEPARTMENT) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-200 gap-4">
          <div className="space-y-1.5">
            <h2 className="text-base sm:text-lg font-bold uppercase tracking-tight text-slate-900">
              TRƯỜNG THPT SƠN LƯƠNG
            </h2>
            <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-blue-700 uppercase">
              <span className="text-slate-700">TỔ:</span>
              <span className="text-blue-800 tracking-wide font-black bg-blue-50 px-3 py-1 rounded-xl border border-blue-200">
                {currentDeptName.replace(/^Tổ\s+/i, '')}
              </span>
            </div>
          </div>

          <div className="text-left sm:text-right space-y-1">
            <div className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-wide">
              TUẦN: {schedule?.weekNumber || selectedWeek}
            </div>
            <div className="text-xs sm:text-sm italic text-slate-600">
              (Từ ngày {currentWeekInfo?.startDateStr || '....'} đến ngày {currentWeekInfo?.endDateStr || '....'} năm 2026)
            </div>
          </div>
        </div>

        {/* Schedule Table (Matches exact 5 columns from official school format) */}
        <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              
              {/* Table Header */}
              <thead className="bg-slate-100 text-slate-800 font-extrabold uppercase text-[11px] border-b border-slate-300">
                <tr>
                  <th 
                    rowSpan={2} 
                    className="px-3.5 py-3 border-r border-slate-300 w-36 text-center align-middle bg-slate-200/70"
                  >
                    Thứ, ngày
                  </th>
                  <th 
                    className="px-4 py-2 border-r border-slate-300 text-center bg-blue-100/60 text-blue-900"
                  >
                    Sáng
                  </th>
                  <th 
                    className="px-4 py-2 border-r border-slate-300 text-center bg-amber-100/60 text-amber-900"
                  >
                    Chiều
                  </th>
                  <th 
                    rowSpan={2} 
                    className="px-3.5 py-3 border-r border-slate-300 w-44 text-center align-middle bg-slate-200/70"
                  >
                    Lãnh đạo trực/đánh giá
                  </th>
                  <th 
                    rowSpan={2} 
                    className="px-3.5 py-3 w-32 text-center align-middle bg-slate-200/70"
                  >
                    Ghi chú
                  </th>
                </tr>
                <tr className="border-b border-slate-300 text-[10.5px] font-bold italic text-slate-600">
                  <th className="px-4 py-1.5 border-r border-slate-300 text-center bg-blue-50/60">
                    Nội dung công việc
                  </th>
                  <th className="px-4 py-1.5 border-r border-slate-300 text-center bg-amber-50/60">
                    Nội dung công việc
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-300 bg-white">
                {currentWeekDays.map((wDay, idx) => {
                  const day = schedule?.days?.find(d => d.date === wDay.dateIso)
                           || schedule?.days?.find(d => d.dayOfWeek?.trim().toLowerCase() === wDay.dayOfWeek.trim().toLowerCase())
                           || schedule?.days?.[idx]
                           || {
                             id: `day_${idx}`,
                             dayOfWeek: wDay.dayOfWeek,
                             date: wDay.dateIso,
                             dateDisplay: wDay.dateLabel,
                             morningTasks: '',
                             afternoonTasks: '',
                             dutyLeaderOrEvaluation: '',
                             notes: '',
                             assignedTeachers: [],
                             status: 'pending'
                           };

                  return (
                    <tr key={`week_${selectedWeek}_${wDay.dateIso}`} className="hover:bg-blue-50/20 transition-colors">
                      
                      {/* Col 1: Thứ, ngày - Tính trực tiếp từ tuần đang chọn */}
                      <td className="px-3 py-3 border-r border-slate-300 font-extrabold text-slate-800 text-center align-middle bg-slate-50/70 w-36">
                        <div className="text-xs uppercase tracking-tight">{wDay.dayOfWeek}</div>
                        <div className="text-xs text-blue-600 font-extrabold mt-0.5">
                          {wDay.dateDisplayShort}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {wDay.dateDisplayFull}
                        </div>
                      </td>

                      {/* Col 2: Sáng - Nội dung công việc */}
                      <td className="p-2.5 border-r border-slate-300 align-top group relative">
                        {canEditCurrentDept && (
                          <div className="flex items-center justify-between mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleAddBullet(wDay.dateIso, 'morningTasks')}
                              className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Plus size={11} /> Thêm dòng việc
                            </button>
                          </div>
                        )}
                        <AutoResizeTextarea
                          minHeight={64}
                          readOnly={!canEditCurrentDept}
                          value={day.morningTasks || ''}
                          onChange={(e) => handleUpdateDay(wDay.dateIso, 'morningTasks', e.target.value)}
                          placeholder={canEditCurrentDept ? "Nội dung công việc buổi sáng..." : "Không có nhiệm vụ"}
                          className={`w-full text-xs text-slate-800 rounded-lg p-1.5 leading-relaxed ${
                            canEditCurrentDept 
                              ? 'bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none' 
                              : 'bg-transparent cursor-default'
                          }`}
                        />
                      </td>

                      {/* Col 3: Chiều - Nội dung công việc */}
                      <td className="p-2.5 border-r border-slate-300 align-top group relative">
                        {canEditCurrentDept && (
                          <div className="flex items-center justify-between mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleAddBullet(wDay.dateIso, 'afternoonTasks')}
                              className="text-[10px] text-amber-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Plus size={11} /> Thêm dòng việc
                            </button>
                          </div>
                        )}
                        <AutoResizeTextarea
                          minHeight={64}
                          readOnly={!canEditCurrentDept}
                          value={day.afternoonTasks || ''}
                          onChange={(e) => handleUpdateDay(wDay.dateIso, 'afternoonTasks', e.target.value)}
                          placeholder={canEditCurrentDept ? "Nội dung công việc buổi chiều..." : "Không có nhiệm vụ"}
                          className={`w-full text-xs text-slate-800 rounded-lg p-1.5 leading-relaxed ${
                            canEditCurrentDept 
                              ? 'bg-transparent focus:bg-white focus:ring-1 focus:ring-amber-400 focus:border-amber-400 outline-none' 
                              : 'bg-transparent cursor-default'
                          }`}
                        />
                      </td>

                      {/* Col 4: Lãnh đạo trực/đánh giá */}
                      <td className="p-2.5 border-r border-slate-300 align-top w-44">
                        <AutoResizeTextarea
                          minHeight={64}
                          readOnly={!canEditCurrentDept}
                          value={day.dutyLeaderOrEvaluation || ''}
                          onChange={(e) => handleUpdateDay(wDay.dateIso, 'dutyLeaderOrEvaluation', e.target.value)}
                          placeholder={canEditCurrentDept ? "Lãnh đạo trực / đánh giá kết quả..." : "-"}
                          className={`w-full text-xs text-slate-700 rounded-lg p-1.5 text-center leading-relaxed ${
                            canEditCurrentDept 
                              ? 'bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 outline-none' 
                              : 'bg-transparent cursor-default'
                          }`}
                        />
                      </td>

                      {/* Col 5: Ghi chú */}
                      <td className="p-2.5 align-top w-32">
                        <AutoResizeTextarea
                          minHeight={64}
                          readOnly={!canEditCurrentDept}
                          value={day.notes || ''}
                          onChange={(e) => handleUpdateDay(wDay.dateIso, 'notes', e.target.value)}
                          placeholder={canEditCurrentDept ? "Ghi chú thêm..." : ""}
                          className={`w-full text-xs text-slate-600 rounded-lg p-1.5 text-center leading-relaxed ${
                            canEditCurrentDept 
                              ? 'bg-transparent focus:bg-white focus:ring-1 focus:ring-slate-400 outline-none' 
                              : 'bg-transparent cursor-default'
                          }`}
                        />
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick action helper bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Mẹo: Bạn có thể nhập trực tiếp vào bảng hoặc bấm <strong>"Tải lên từ file Word"</strong> để nạp toàn bộ từ file .docx của trường.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <Eye size={14} />
              Xem bản in tiêu chuẩn
            </button>
            {canEditCurrentDept && (
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={14} />
                Lưu bảng lịch
              </button>
            )}
          </div>
        </div>

      </Card>

      {/* History of Saved Department Schedules */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
              Danh sách lịch các tổ đã lưu
            </h3>
            <p className="text-xs text-slate-500">
              Nhấn vào lịch để xem và chỉnh sửa nhanh
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200">
            {allSchedules.length} bản ghi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {allSchedules.map((s) => {
            const isCurrent = s.id === schedule?.id;
            const canonicalId = getCanonicalDepartmentId(s.departmentId || s.departmentName);
            const displayDeptName = getCanonicalDepartmentName(canonicalId);

            return (
              <div
                key={s.id}
                onClick={() => {
                  setSchedule(s);
                  setSelectedDeptId(canonicalId);
                  setSelectedWeek(s.weekNumber);
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500 shadow-sm'
                    : 'bg-white hover:bg-slate-100/80 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-extrabold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                      Tuần {s.weekNumber}
                    </span>
                    {s.status === 'approved' ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Đã duyệt ({s.approvedBy || 'BGH'})
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        Dự thảo
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-800 line-clamp-1">
                    {displayDeptName}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Năm học: {s.academicYear || '2026-2027'}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{s.updatedAt ? new Date(s.updatedAt).toLocaleDateString('vi-VN') : ''}</span>
                  <span className="text-blue-600 font-bold hover:underline">Xem lịch &rarr;</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Word Upload Modal */}
      <DepartmentScheduleWordUploadModal
        isOpen={isWordUploadOpen}
        onClose={() => setIsWordUploadOpen(false)}
        onSaveSchedule={handleWordScheduleSaved}
        currentDepartmentId={canonicalSelectedDeptId}
        currentDepartmentName={currentDeptName}
      />

      {/* Print / Preview Modal */}
      {schedule && (
        <DepartmentSchedulePrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          schedule={schedule}
        />
      )}

    </div>
  );
}
