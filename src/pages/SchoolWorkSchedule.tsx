import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Download,
  Printer,
  Plus,
  Save,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  FileSpreadsheet,
  FileText,
  Trash2,
  Edit2,
  Building2,
  Users,
  Check,
  Upload
} from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import { Card } from '../components/ui/Card';
import { useAuth } from '../store/AuthContext';
import { useAppContext } from '../store/AppContext';
import {
  SchoolWorkSchedule,
  SchoolWorkDay,
  SchoolWorkItem
} from '../types/schoolWorkSchedule';
import {
  schoolWorkScheduleService,
  DEFAULT_DEPARTMENTS_CONFIG,
  generateSampleSchoolWorkSchedule
} from '../services/schoolWorkScheduleService';
import { exportSchoolWorkScheduleToWord } from '../utils/schoolWorkScheduleExportWord';
import { getWeekInfoByNumber, getAllWeeksInYear, ACADEMIC_YEARS } from '../utils/schoolWeekUtils';
import SchoolScheduleWordImportModal from '../components/schoolSchedule/SchoolScheduleWordImportModal';
import AutoResizeTextarea from '../components/ui/AutoResizeTextarea';
import * as XLSX from 'xlsx';

export default function SchoolWorkSchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { teachers, departments } = useAppContext();

  // URL / State
  const initialDept = searchParams.get('dept') || 'all';
  const initialWeek = parseInt(searchParams.get('week') || '3', 10);
  const initialYear = searchParams.get('year') || '2026–2027';

  const [selectedDeptId, setSelectedDeptId] = useState<string>(initialDept);
  const [selectedWeek, setSelectedWeek] = useState<number>(initialWeek);
  const [selectedYear, setSelectedYear] = useState<string>(initialYear);

  const [schedule, setSchedule] = useState<SchoolWorkSchedule | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isWordImportOpen, setIsWordImportOpen] = useState<boolean>(false);

  // Modal item state
  const [editingItem, setEditingItem] = useState<{
    dayId: string;
    timeSlot: 'morning' | 'afternoon';
    item?: SchoolWorkItem;
  } | null>(null);
  const [itemFormContent, setItemFormContent] = useState<string>('');
  const [itemFormAssignee, setItemFormAssignee] = useState<string>('');
  const [itemFormStatus, setItemFormStatus] = useState<string>('Chưa thực hiện');

  // Permissions
  const isAdmin = user?.role === 'BGH' || (user?.role || '').includes('HIỆU TRƯỞNG') || (user?.role || '').includes('HT') || (user?.role || '').includes('PHT');
  const isHead = (user?.role || '').includes('TTCM') || (user?.position || '').toLowerCase().includes('tổ trưởng');
  const canEdit = isAdmin || isHead;

  // All weeks info
  const allWeeks = useMemo(() => getAllWeeksInYear(selectedYear), [selectedYear]);
  const currentWeekInfo = useMemo(() => getWeekInfoByNumber(selectedWeek, selectedYear), [selectedWeek, selectedYear]);

  // Combined departments list
  const allDepartments = useMemo(() => {
    const list = [...DEFAULT_DEPARTMENTS_CONFIG];
    departments.forEach(dept => {
      const exists = list.some(d => d.id === dept.id || d.name.toLowerCase() === dept.name.toLowerCase());
      if (!exists) {
        list.push({
          id: dept.id,
          name: dept.name,
          label: dept.name
        });
      }
    });
    return list;
  }, [departments]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load schedule when week, year or dept changes
  useEffect(() => {
    loadSchedule();
  }, [selectedWeek, selectedYear, selectedDeptId]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const data = await schoolWorkScheduleService.getSchedule(selectedWeek, selectedYear, selectedDeptId);
      setSchedule(data);
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi tải lịch công việc');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!schedule) return;
    try {
      setSaving(true);
      await schoolWorkScheduleService.saveSchedule(schedule);
      showToast('Đã lưu lịch công việc thành công!');
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi lưu lịch công việc');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToSample = async () => {
    try {
      setSaving(true);
      const sample = generateSampleSchoolWorkSchedule(selectedWeek, selectedYear, selectedDeptId);
      setSchedule(sample);
      await schoolWorkScheduleService.saveSchedule(sample);
      showToast(`Đã nạp lịch công việc chuẩn THPT Sơn Lương cho ${currentWeekInfo.label}!`);
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi nạp dữ liệu mẫu');
    } finally {
      setSaving(false);
    }
  };

  // Open item modal
  const openAddItemModal = (dayId: string, timeSlot: 'morning' | 'afternoon', item?: SchoolWorkItem) => {
    setEditingItem({ dayId, timeSlot, item });
    setItemFormContent(item ? item.content : '');
    setItemFormAssignee(item ? (item.assignee || '') : '');
    setItemFormStatus(item ? (item.status || 'Chưa thực hiện') : 'Chưa thực hiện');
  };

  const handleSaveItem = () => {
    if (!editingItem || !schedule || !itemFormContent.trim()) return;

    const newDays = schedule.days.map(d => {
      if (d.id !== editingItem.dayId) return d;

      const updatedTasks = editingItem.timeSlot === 'morning' ? [...d.morning_tasks] : [...d.afternoon_tasks];

      if (editingItem.item) {
        // Edit existing
        const idx = updatedTasks.findIndex(t => t.id === editingItem.item!.id);
        if (idx >= 0) {
          updatedTasks[idx] = {
            ...updatedTasks[idx],
            content: itemFormContent.trim(),
            assignee: itemFormAssignee.trim() || undefined,
            status: itemFormStatus as any
          };
        }
      } else {
        // Add new
        updatedTasks.push({
          id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timeSlot: editingItem.timeSlot,
          content: itemFormContent.trim(),
          assignee: itemFormAssignee.trim() || undefined,
          status: itemFormStatus as any
        });
      }

      return {
        ...d,
        [editingItem.timeSlot === 'morning' ? 'morning_tasks' : 'afternoon_tasks']: updatedTasks
      };
    });

    const updatedSchedule = { ...schedule, days: newDays };
    setSchedule(updatedSchedule);
    schoolWorkScheduleService.saveSchedule(updatedSchedule);
    setEditingItem(null);
    showToast('Đã cập nhật công việc!');
  };

  const handleDeleteItem = (dayId: string, timeSlot: 'morning' | 'afternoon', itemId: string) => {
    if (!schedule) return;
    const newDays = schedule.days.map(d => {
      if (d.id !== dayId) return d;
      return {
        ...d,
        [timeSlot === 'morning' ? 'morning_tasks' : 'afternoon_tasks']: (
          timeSlot === 'morning' ? d.morning_tasks : d.afternoon_tasks
        ).filter(t => t.id !== itemId)
      };
    });

    const updatedSchedule = { ...schedule, days: newDays };
    setSchedule(updatedSchedule);
    schoolWorkScheduleService.saveSchedule(updatedSchedule);
    showToast('Đã xóa công việc!');
  };

  // Update field of day (completion_date, duty_evaluator)
  const handleUpdateDayField = (dayId: string, field: 'completion_date' | 'duty_evaluator', val: string) => {
    if (!schedule) return;
    const newDays = schedule.days.map(d => {
      if (d.id === dayId) {
        return { ...d, [field]: val };
      }
      return d;
    });
    const updated = { ...schedule, days: newDays };
    setSchedule(updated);
    schoolWorkScheduleService.saveSchedule(updated);
  };

  // Export Word
  const handleExportWord = async () => {
    if (!schedule) return;
    try {
      await exportSchoolWorkScheduleToWord(schedule);
      showToast('Đã xuất file Word (.docx) thành công!');
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi xuất file Word');
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    if (!schedule) return;
    try {
      const dataRows: any[] = [
        ['TRƯỜNG THPT SƠN LƯƠNG'],
        [`TỔ: ${schedule.department_name}`],
        [`TUẦN: ${schedule.week_number}`],
        [`(Từ ngày ${currentWeekInfo.startDateStr} đến ngày ${currentWeekInfo.endDateStr} năm 2026)`],
        [],
        ['Thứ, ngày', 'Sáng - Nội dung công việc', 'Chiều - Nội dung công việc', 'Ngày hoàn thành', 'Lãnh đạo trực/đánh giá']
      ];

      schedule.days.forEach(day => {
        const morningText = day.morning_tasks.map(t => `- ${t.content}${t.assignee ? ` (${t.assignee})` : ''}`).join('\n');
        const afternoonText = day.afternoon_tasks.map(t => `- ${t.content}${t.assignee ? ` (${t.assignee})` : ''}`).join('\n');
        dataRows.push([
          `${day.day_of_week} (${day.date_str})`,
          morningText || '—',
          afternoonText || '—',
          day.completion_date || day.date_str || '',
          day.duty_evaluator || ''
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(dataRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'LichCongViec');
      XLSX.writeFile(wb, `Lich_Cong_Viec_Tuan_${schedule.week_number}_THPT_Son_Luong.xlsx`);
      showToast('Đã xuất file Excel thành công!');
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi xuất file Excel');
    }
  };

  // Format date range text
  const dateRangeSubtitle = `(Từ ngày ${currentWeekInfo.startDateStr} đến ngày ${currentWeekInfo.endDateStr} năm 2026)`;

  return (
    <div className="p-3 sm:p-6 max-w-[1550px] mx-auto space-y-6 pb-20 font-sans">
      <div className="flex items-center no-print">
        <BackButton />
      </div>

      {/* TOAST ALERT */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* TOP CONTROL TOOLBAR */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 sm:p-5 rounded-[24px] shadow-xl border border-blue-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full lg:w-auto">
          {/* Dropdown Năm học */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 whitespace-nowrap">Năm học:</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-xs"
            >
              {ACADEMIC_YEARS.map(y => (
                <option key={y} value={y} className="text-slate-900 bg-white font-semibold">
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown Tuần */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 whitespace-nowrap flex items-center gap-1">
              <span>📅</span> Tuần:
            </span>
            <select
              value={selectedWeek}
              onChange={e => setSelectedWeek(Number(e.target.value))}
              className="bg-white text-slate-900 font-black rounded-xl px-3.5 py-2 text-xs sm:text-sm shadow-md border-2 border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
            >
              {allWeeks.map(w => (
                <option key={w.weekNumber} value={w.weekNumber} className="text-slate-900 font-bold">
                  {w.weekLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown Chọn Tổ / Toàn trường */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 whitespace-nowrap flex items-center gap-1">
              <Building2 size={15} /> Tổ/Đơn vị:
            </span>
            <select
              value={selectedDeptId}
              onChange={e => setSelectedDeptId(e.target.value)}
              className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-xs max-w-[220px]"
            >
              {allDepartments.map(d => (
                <option key={d.id} value={d.id} className="text-slate-900 bg-white font-semibold">
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => setIsWordImportOpen(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-600 hover:from-blue-400 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer border border-white/20"
                title="Tải lên và nhập dữ liệu lịch công việc từ file Word (.docx)"
              >
                <Upload size={16} />
                <span>Tải file từ Word</span>
              </button>

              <button
                type="button"
                onClick={handleResetToSample}
                disabled={saving}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Nạp lại nội dung công việc mẫu chuẩn THPT Sơn Lương"
              >
                <Sparkles size={16} />
                <span>Nạp Mẫu Chuẩn Trường</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleExportWord}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer border border-blue-400/40"
            title="Xuất lịch công việc ra file Word (.docx) đúng theo mẫu"
          >
            <FileText size={16} />
            <span>Xuất Word (.docx)</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer border border-emerald-400/40"
            title="Xuất lịch công việc ra file Excel (.xlsx)"
          >
            <FileSpreadsheet size={16} />
            <span>Xuất Excel</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-600 transition-colors cursor-pointer"
            title="In lịch công việc"
          >
            <Printer size={18} />
          </button>
        </div>
      </div>

      {/* MAIN DOCUMENT CONTAINER (MÔ PHỎNG CHUẨN MẪU FILE GỬI KÈM) */}
      <div className="bg-white rounded-[24px] border border-slate-200/90 shadow-lg p-6 sm:p-10 space-y-6 text-slate-900 print:p-0 print:border-none print:shadow-none">
        {/* 1. DOCUMENT HEADER */}
        <div className="border-b border-slate-200 pb-5 space-y-2">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-slate-900 uppercase">
                TRƯỜNG THPT SƠN LƯƠNG
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs sm:text-sm font-black text-slate-900 uppercase">
                  TỔ:
                </span>
                <span className="text-xs sm:text-sm font-black text-blue-900 uppercase tracking-wide bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                  {schedule?.department_name || 'TOÀN TRƯỜNG'}
                </span>
              </div>
            </div>

            <div className="text-right sm:text-right w-full sm:w-auto">
              <span className="text-base sm:text-lg font-black text-slate-900 uppercase block tracking-wide">
                TUẦN: {selectedWeek}
              </span>
              <span className="text-xs sm:text-sm font-semibold italic text-slate-600 block mt-0.5">
                {dateRangeSubtitle}
              </span>
            </div>
          </div>
        </div>

        {/* 2. OFFICIAL WORK SCHEDULE TABLE (ĐÚNG 5 CỘT THEO FILE GỬI KÈM - KẺ Ô RÕ NÉT) */}
        <div className="overflow-x-auto rounded-2xl border-2 border-slate-800 shadow-md">
          <table className="w-full border-collapse text-left text-xs sm:text-sm border border-slate-800">
            <thead>
              {/* Header Row 1 */}
              <tr className="bg-slate-200 border-b-2 border-slate-800 text-slate-950 text-center font-black">
                <th rowSpan={2} className="py-3 px-3 border border-slate-800 w-28 sm:w-32 bg-slate-200 align-middle uppercase tracking-wider text-xs sm:text-[13px]">
                  Thứ, ngày
                </th>
                <th className="py-2.5 px-4 border border-slate-800 min-w-[280px] bg-slate-200 text-center uppercase tracking-wider text-xs sm:text-[13px]">
                  Sáng
                </th>
                <th className="py-2.5 px-4 border border-slate-800 min-w-[260px] bg-slate-200 text-center uppercase tracking-wider text-xs sm:text-[13px]">
                  Chiều
                </th>
                <th rowSpan={2} className="py-3 px-3 border border-slate-800 w-32 sm:w-36 text-center bg-slate-200 align-middle uppercase tracking-wider text-xs sm:text-[13px]">
                  Ngày hoàn thành
                </th>
                <th rowSpan={2} className="py-3 px-3.5 border border-slate-800 min-w-[220px] text-center bg-slate-200 align-middle uppercase tracking-wider text-xs sm:text-[13px] leading-snug">
                  Lãnh đạo<br />trực/đánh giá
                </th>
              </tr>
              {/* Header Row 2 (Subheader: Nội dung công việc) */}
              <tr className="bg-slate-100 border-b-2 border-slate-800 text-slate-800 text-xs italic">
                <th className="py-1.5 px-4 border border-slate-800 text-center font-bold">
                  Nội dung công việc
                </th>
                <th className="py-1.5 px-4 border border-slate-800 text-center font-bold">
                  Nội dung công việc
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 italic border border-slate-700">
                    Đang tải lịch công việc...
                  </td>
                </tr>
              ) : !schedule || schedule.days.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 italic border border-slate-700">
                    Chưa có dữ liệu lịch công việc cho tuần này.
                  </td>
                </tr>
              ) : (
                schedule.days.map((day, dIdx) => {
                  return (
                    <tr key={day.id} className="hover:bg-blue-50/20 transition-colors">
                      {/* CỘT 1: THỨ, NGÀY */}
                      <td className="py-3.5 px-3 border border-slate-700 text-center font-bold align-middle bg-slate-50/80">
                        <div className="space-y-0.5">
                          <span className="text-xs sm:text-sm font-black text-slate-900 block">
                            {day.day_of_week}
                          </span>
                          <span className="text-[11px] sm:text-xs font-bold text-slate-600 block">
                            ({day.date_str})
                          </span>
                        </div>
                      </td>

                      {/* CỘT 2: SÁNG - NỘI DUNG CÔNG VIỆC */}
                      <td className="py-3 px-4 border border-slate-700 align-top">
                        <div className="space-y-2">
                          {day.morning_tasks.length === 0 ? (
                            <div className="text-slate-400 text-xs italic py-1">
                              —
                            </div>
                          ) : (
                            day.morning_tasks.map((task) => (
                              <div
                                key={task.id}
                                className="group relative p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/80 border border-slate-300 transition-all text-xs space-y-1"
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <p className="font-bold text-slate-900 leading-relaxed whitespace-pre-wrap break-words">
                                    • {task.content}
                                  </p>

                                  {canEdit && (
                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity no-print shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => openAddItemModal(day.id, 'morning', task)}
                                        className="p-1 hover:bg-blue-100 text-blue-600 rounded"
                                        title="Sửa công việc"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteItem(day.id, 'morning', task.id)}
                                        className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                                        title="Xóa công việc"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {task.assignee && (
                                  <div className="text-[11px] font-bold text-blue-900">
                                    👤 Thực hiện: {task.assignee}
                                  </div>
                                )}
                              </div>
                            ))
                          )}

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openAddItemModal(day.id, 'morning')}
                              className="text-[11px] font-extrabold text-blue-700 hover:text-blue-900 flex items-center gap-1 hover:underline pt-0.5 no-print cursor-pointer"
                            >
                              <Plus size={13} /> + Thêm việc buổi sáng
                            </button>
                          )}
                        </div>
                      </td>

                      {/* CỘT 3: CHIỀU - NỘI DUNG CÔNG VIỆC */}
                      <td className="py-3 px-4 border border-slate-700 align-top">
                        <div className="space-y-2">
                          {day.afternoon_tasks.length === 0 ? (
                            <div className="text-slate-400 text-xs italic py-1">
                              —
                            </div>
                          ) : (
                            day.afternoon_tasks.map((task) => (
                              <div
                                key={task.id}
                                className="group relative p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/80 border border-slate-300 transition-all text-xs space-y-1"
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <p className="font-bold text-slate-900 leading-relaxed whitespace-pre-wrap break-words">
                                    • {task.content}
                                  </p>

                                  {canEdit && (
                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity no-print shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => openAddItemModal(day.id, 'afternoon', task)}
                                        className="p-1 hover:bg-blue-100 text-blue-600 rounded"
                                        title="Sửa công việc"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteItem(day.id, 'afternoon', task.id)}
                                        className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                                        title="Xóa công việc"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {task.assignee && (
                                  <div className="text-[11px] font-bold text-blue-900">
                                    👤 Thực hiện: {task.assignee}
                                  </div>
                                )}
                              </div>
                            ))
                          )}

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openAddItemModal(day.id, 'afternoon')}
                              className="text-[11px] font-extrabold text-blue-700 hover:text-blue-900 flex items-center gap-1 hover:underline pt-0.5 no-print cursor-pointer"
                            >
                              <Plus size={13} /> + Thêm việc buổi chiều
                            </button>
                          )}
                        </div>
                      </td>

                      {/* CỘT 4: NGÀY HOÀN THÀNH */}
                      <td className="py-3 px-3 border border-slate-700 text-center align-middle bg-slate-50/30">
                        {canEdit ? (
                          <input
                            type="text"
                            value={day.completion_date || ''}
                            onChange={e => handleUpdateDayField(day.id, 'completion_date', e.target.value)}
                            placeholder={day.date_str}
                            className="w-full text-center text-xs sm:text-sm font-bold text-slate-900 border border-slate-300 hover:border-blue-400 focus:border-blue-600 focus:bg-white rounded-lg px-2 py-1.5 transition-all outline-none"
                          />
                        ) : (
                          <span className="text-xs sm:text-sm font-bold text-slate-900">
                            {day.completion_date || day.date_str || '—'}
                          </span>
                        )}
                      </td>

                      {/* CỘT 5: LÃNH ĐẠO TRỰC/ĐÁNH GIÁ (NHẬN XÉT, ĐÁNH GIÁ CỦA LÃNH ĐẠO) */}
                      <td className="py-3 px-3.5 border border-slate-700 align-top bg-amber-50/20">
                        {canEdit ? (
                          <div className="space-y-2">
                            <AutoResizeTextarea
                              minHeight={64}
                              value={day.duty_evaluator || ''}
                              onChange={e => handleUpdateDayField(day.id, 'duty_evaluator', e.target.value)}
                              placeholder="Nhập nhận xét đánh giá của lãnh đạo..."
                              className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:border-amber-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-200 rounded-xl p-2.5 transition-all outline-none leading-relaxed"
                            />

                            {/* Gợi ý đánh giá nhanh */}
                            <div className="flex flex-wrap gap-1 no-print pt-0.5">
                              {[
                                'Hoàn thành tốt ⭐',
                                'Đạt yêu cầu ✓',
                                'Đang thực hiện ⏳',
                                'Cần đôn đốc ⚠'
                              ].map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    const current = (day.duty_evaluator || '').trim();
                                    const next = current ? `${current}. ${tag}` : tag;
                                    handleUpdateDayField(day.id, 'duty_evaluator', next);
                                  }}
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100/80 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors cursor-pointer"
                                  title={`Thêm nhận xét: ${tag}`}
                                >
                                  + {tag}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs font-semibold text-slate-800 italic leading-relaxed whitespace-pre-wrap break-words">
                            {day.duty_evaluator ? (
                              <span className="text-amber-950 font-bold">"{day.duty_evaluator}"</span>
                            ) : (
                              <span className="text-slate-400 italic">Chưa có nhận xét đánh giá</span>
                            )}
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

      {/* MODAL THÊM / CHỈNH SỬA CÔNG VIỆC */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingItem.item ? 'Chỉnh sửa nội dung công việc' : '+ Thêm công việc mới'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Buổi: <strong className="text-blue-700">{editingItem.timeSlot === 'morning' ? 'Sáng' : 'Chiều'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nội dung công việc <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={itemFormContent}
                  onChange={e => setItemFormContent(e.target.value)}
                  placeholder="Nhập nội dung công việc phân công..."
                  className="w-full p-3 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Người / Đơn vị thực hiện
                </label>
                <input
                  type="text"
                  value={itemFormAssignee}
                  onChange={e => setItemFormAssignee(e.target.value)}
                  placeholder="VD: Toàn thể CBGVNV / Tổ Toán - Lý / Lớp 12C / Đ/c Nam..."
                  className="w-full p-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Trạng thái
                </label>
                <select
                  value={itemFormStatus}
                  onChange={e => setItemFormStatus(e.target.value)}
                  className="w-full p-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none cursor-pointer"
                >
                  <option value="Chưa thực hiện">Chưa thực hiện</option>
                  <option value="Đang thực hiện">Đang thực hiện</option>
                  <option value="Hoàn thành">Hoàn thành</option>
                  <option value="Hoàn thành tốt">Hoàn thành tốt ⭐</option>
                  <option value="Quá hạn">Quá hạn ⚠</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveItem}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-colors"
              >
                Lưu công việc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TẢI TỪ FILE WORD */}
      <SchoolScheduleWordImportModal
        isOpen={isWordImportOpen}
        onClose={() => setIsWordImportOpen(false)}
        currentWeek={selectedWeek}
        currentYear={selectedYear}
        currentDeptId={selectedDeptId}
        onImportSuccess={async (imported) => {
          setSchedule(imported);
          setSelectedWeek(imported.week_number);
          await schoolWorkScheduleService.saveSchedule(imported);
          showToast(`Đã tải và áp dụng lịch công việc từ file Word thành công (Tuần ${imported.week_number})!`);
        }}
      />
    </div>
  );
}
