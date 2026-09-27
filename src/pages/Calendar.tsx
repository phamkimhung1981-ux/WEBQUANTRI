import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { format, startOfWeek, addDays, isSameDay, subWeeks, addWeeks, subMonths, addMonths, startOfMonth, endOfMonth, endOfWeek, isSameMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Calendar as CalendarIcon, Clock, Users, BookOpen, AlertCircle, Plus, ChevronLeft, ChevronRight, X, Edit2, Trash2,
  Camera, FileSpreadsheet, Download, FileText, List, Eye, CheckCircle
} from 'lucide-react';
import { CalendarEvent } from '../types';
import { WeeklySchedule } from '../types/schedule';
import { scheduleService } from '../services/scheduleService';
import { cn } from '../lib/utils';
import { safeFormat } from '../utils/dateUtils';
import BackButton from '../components/ui/BackButton';
import ImageOcrModal from '../components/schedule/ImageOcrModal';
import WordExcelImportModal from '../components/schedule/WordExcelImportModal';
import WeeklyScheduleView from '../components/schedule/WeeklyScheduleView';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import { exportScheduleToWord } from '../components/schedule/WordExportUtil';

export default function Calendar() {
  const { calendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = useAppContext();

  // Primary Tab state: 'weekly_schedules' or 'calendar_events'
  const [activeTab, setActiveTab] = useState<'weekly_schedules' | 'calendar_events'>('weekly_schedules');

  // Weekly Schedules State
  const [weeklySchedules, setWeeklySchedules] = useState<WeeklySchedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [loadingSchedules, setLoadingSchedules] = useState<boolean>(true);

  // Non-blocking Toast and Inline Confirmation states
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMsg({ text, type });
    setTimeout(() => {
      setToastMsg(null);
    }, 4500);
  };

  // Modals state
  const [isOcrModalOpen, setIsOcrModalOpen] = useState<boolean>(false);
  const [isWordExcelModalOpen, setIsWordExcelModalOpen] = useState<boolean>(false);

  // Calendar Events State
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState<Partial<CalendarEvent>>({
    type: 'Sự kiện',
    date: new Date().toISOString().slice(0, 16)
  });

  // Load weekly schedules on mount
  useEffect(() => {
    loadWeeklySchedules();
  }, []);

  const loadWeeklySchedules = async () => {
    try {
      setLoadingSchedules(true);
      let list = await scheduleService.getWeeklySchedules();

      // Check if sample schedule was already seeded previously
      const hasSeeded = localStorage.getItem('thpt_son_luong_sample_schedule_seeded');

      // If empty and never seeded, populate default THPT Sơn Lương Weekly Schedule sample ONCE
      if (list.length === 0 && !hasSeeded) {
        const sampleSchedule: WeeklySchedule = {
          id: 'sched_sample_3',
          week_number: '3',
          week_start_date: '2026-09-21',
          week_end_date: '2026-09-27',
          duty_week: 'Lớp 12C',
          school_year: '2026-2027',
          title: 'LỊCH CÔNG TÁC TUẦN 3',
          header_text: 'SỞ GD&ĐT PHÚ THỌ - TRƯỜNG THPT SƠN LƯƠNG',
          days: [
            {
              id: 'd1',
              day_of_week: 'Thứ 2',
              date: '2026-09-21',
              date_str: '21/9',
              morning_events: [
                { id: 'm1', text: 'Tiết 1 (TN-HN): SH tập thể tại nhà vòm', highlight: 'normal' },
                { id: 'm2', text: 'Tiết 2: Dạy và học theo TKB', highlight: 'normal' }
              ],
              afternoon_events: [
                { id: 'a1', text: '14h00–17h00: Đại hội Chi đoàn Giáo viên năm học 2026-2027', highlight: 'red' }
              ],
              duty_leader: 'Ông Sáng'
            },
            {
              id: 'd2',
              day_of_week: 'Thứ 3',
              date: '2026-09-22',
              date_str: '22/9',
              morning_events: [
                { id: 'm3', text: 'Dạy và học theo TKB', highlight: 'normal' }
              ],
              afternoon_events: [
                { id: 'a2', text: '14h00: Bồi dưỡng học sinh giỏi các môn văn hóa', highlight: 'normal' }
              ],
              duty_leader: 'Ông Hòa'
            },
            {
              id: 'd3',
              day_of_week: 'Thứ 4',
              date: '2026-09-23',
              date_str: '23/9',
              morning_events: [
                { id: 'm4', text: 'Dạy và học theo TKB. Dự giờ thao giảng Tổ Tự nhiên', highlight: 'normal' }
              ],
              afternoon_events: [
                { id: 'a3', text: 'Sinh hoạt chuyên môn tổ KHTN và KHXH', highlight: 'normal' }
              ],
              duty_leader: 'Ông Hòa'
            },
            {
              id: 'd4',
              day_of_week: 'Thứ 5',
              date: '2026-09-24',
              date_str: '24/9',
              morning_events: [
                { id: 'm5', text: 'Dạy và học theo TKB', highlight: 'normal' }
              ],
              afternoon_events: [
                { id: 'a4', text: 'Kiểm tra hồ sơ giáo án đầu năm học', highlight: 'normal' }
              ],
              duty_leader: 'Ông Hùng'
            },
            {
              id: 'd5',
              day_of_week: 'Thứ 6',
              date: '2026-09-25',
              date_str: '25/9',
              morning_events: [
                { id: 'm6', text: 'Dạy và học theo TKB', highlight: 'normal' }
              ],
              afternoon_events: [
                { id: 'a5', text: 'Họp Hội đồng sư phạm tháng 9', highlight: 'red' }
              ],
              duty_leader: 'Ông Hùng'
            },
            {
              id: 'd6',
              day_of_week: 'Thứ 7',
              date: '2026-09-26',
              date_str: '26/9',
              morning_events: [
                { id: 'm7', text: 'Lao động vệ sinh khuôn viên trường (12C trực)', highlight: 'normal' }
              ],
              afternoon_events: [
                { id: 'a6', text: 'Trực chuyên môn', highlight: 'normal' }
              ],
              duty_leader: 'Ông Sáng'
            },
            {
              id: 'd7',
              day_of_week: 'Chủ nhật',
              date: '2026-09-27',
              date_str: '27/9',
              morning_events: [
                { id: 'm8', text: 'Nghỉ. Trực bảo vệ và trực lãnh đạo', highlight: 'normal' }
              ],
              afternoon_events: [],
              duty_leader: 'Ông Sáng'
            }
          ],
          footer: {
            working_time: 'Thời gian làm việc: Sáng từ 7h00 - 11h30; Chiều từ 13h30 - 17h00',
            recipients: '- BGH;\n- Niêm yết bảng tin;\n- Lưu VT.',
            principal_name: 'Nguyễn Quang Sáng'
          },
          created_at: new Date().toISOString()
        };

        await scheduleService.saveWeeklySchedule(sampleSchedule);
        localStorage.setItem('thpt_son_luong_sample_schedule_seeded', 'true');
        list = [sampleSchedule];
      }

      setWeeklySchedules(list);
      setSelectedScheduleId(prev => {
        if (prev && list.some(s => s.id === prev)) return prev;
        return list.length > 0 ? list[0].id : null;
      });
      setLoadingSchedules(false);
    } catch (err) {
      console.error(err);
      setLoadingSchedules(false);
    }
  };

  // Helper to check if a schedule is empty / inactive
  const isScheduleInactive = (sched: WeeklySchedule) => {
    if (!sched.days || sched.days.length === 0) return true;
    const totalEvents = sched.days.reduce(
      (sum, d) => sum + (d.morning_events?.length || 0) + (d.afternoon_events?.length || 0),
      0
    );
    return totalEvents === 0;
  };

  // Delete all inactive (empty) schedules
  const handleDeleteInactiveSchedules = async () => {
    const inactiveList = weeklySchedules.filter(isScheduleInactive);
    if (inactiveList.length === 0) {
      showToast('Không tìm thấy lịch công tác trống/chưa hoạt động nào.', 'info');
      return;
    }

    localStorage.setItem('thpt_son_luong_sample_schedule_seeded', 'true');
    const idsToDelete = inactiveList.map(s => s.id);

    // Optimistically remove from state
    setWeeklySchedules(prev => {
      const next = prev.filter(s => !idsToDelete.includes(s.id));
      if (selectedScheduleId && idsToDelete.includes(selectedScheduleId)) {
        setSelectedScheduleId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });

    try {
      for (const s of inactiveList) {
        await scheduleService.deleteWeeklySchedule(s.id);
      }
      showToast(`Đã dọn dẹp ${inactiveList.length} lịch công tác chưa hoạt động thành công.`, 'success');
    } catch (err) {
      console.error('Error cleaning inactive schedules:', err);
      showToast('Có lỗi xảy ra khi đồng bộ máy chủ, vui lòng tải lại trang.', 'error');
    }
  };

  const handleSaveWeeklySchedule = async (newSchedule: WeeklySchedule, isUpdate: boolean = false) => {
    localStorage.setItem('thpt_son_luong_sample_schedule_seeded', 'true');
    await scheduleService.saveWeeklySchedule(newSchedule);
    await loadWeeklySchedules();
    setSelectedScheduleId(newSchedule.id);
    showToast('Đã lưu lịch công tác thành công.', 'success');
  };

  const handleDeleteWeeklySchedule = async (id: string) => {
    localStorage.setItem('thpt_son_luong_sample_schedule_seeded', 'true');
    
    const originalSchedules = [...weeklySchedules];
    const originalSelectedId = selectedScheduleId;

    // Optimistically update state so UI updates immediately
    setWeeklySchedules(prev => {
      const next = prev.filter(s => s.id !== id);
      if (selectedScheduleId === id) {
        setSelectedScheduleId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });

    try {
      await scheduleService.deleteWeeklySchedule(id);
      showToast('Đã xóa lịch công tác thành công.', 'success');
    } catch (err) {
      console.error('Error deleting weekly schedule:', err);
      showToast('Không thể kết nối cơ sở dữ liệu để xóa lịch công tác. Vui lòng kiểm tra lại mạng.', 'error');
      setWeeklySchedules(originalSchedules);
      setSelectedScheduleId(originalSelectedId);
    }
  };

  const activeWeeklySchedule = weeklySchedules.find(s => s.id === selectedScheduleId) || weeklySchedules[0];

  // Manual Creation of a new blank Weekly Schedule
  const createNewBlankSchedule = async () => {
    const nextWeekNum = String(weeklySchedules.length + 1);
    const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
    const newSched: WeeklySchedule = {
      id: `sched_${Date.now()}`,
      week_number: nextWeekNum,
      week_start_date: format(new Date(), 'yyyy-MM-dd'),
      week_end_date: format(addDays(new Date(), 6), 'yyyy-MM-dd'),
      duty_week: 'Lớp 12A',
      school_year: '2026-2027',
      title: `LỊCH CÔNG TÁC TUẦN ${nextWeekNum}`,
      header_text: 'SỞ GD&ĐT PHÚ THỌ - TRƯỜNG THPT SƠN LƯƠNG',
      days: dayNames.map((name, i) => ({
        id: `day_new_${i}_${Date.now()}`,
        day_of_week: name,
        date: '',
        date_str: '',
        morning_events: [],
        afternoon_events: [],
        duty_leader: 'Ông Sáng'
      })),
      footer: {
        working_time: 'Thời gian làm việc: Sáng từ 7h00 - 11h30; Chiều từ 13h30 - 17h00',
        recipients: '- BGH;\n- Niêm yết bảng tin;\n- Lưu VT.',
        principal_name: 'Nguyễn Quang Sáng'
      },
      created_at: new Date().toISOString()
    };

    await scheduleService.saveWeeklySchedule(newSched);
    await loadWeeklySchedules();
    setSelectedScheduleId(newSched.id);
  };

  // Calendar Week / Month Calculations for Tab 2
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    monthDays.push(day);
    day = addDays(day, 1);
  }

  const navigatePrev = () => {
    if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subMonths(currentDate, 1));
  };

  const navigateNext = () => {
    if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localIsoTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
    
    setFormData({
      type: 'Họp',
      date: localIsoTime,
      title: '',
      description: ''
    });
    setIsEventModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    
    const eventDate = new Date(event.date);
    const tzOffset = eventDate.getTimezoneOffset() * 60000;
    const localIsoTime = (new Date(eventDate.getTime() - tzOffset)).toISOString().slice(0, 16);
    
    setFormData({
      title: event.title,
      description: event.description,
      type: event.type,
      date: localIsoTime,
    });
    setIsEventModalOpen(true);
  };

  const handleDeleteEvent = (id: string) => {
    deleteCalendarEvent(id);
    showToast('Đã xóa sự kiện thành công.', 'success');
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date) return;

    const localDate = new Date(formData.date);
    const isoDateString = localDate.toISOString();

    if (editingEvent) {
      updateCalendarEvent(editingEvent.id, {
        title: formData.title,
        description: formData.description,
        type: formData.type as any,
        date: isoDateString,
      });
    } else {
      addCalendarEvent({
        id: `evt${Date.now()}`,
        title: formData.title,
        description: formData.description,
        type: formData.type as any,
        date: isoDateString,
      });
    }
    setIsEventModalOpen(false);
  };

  const getEventIcon = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'Họp': return Users;
      case 'Dự giờ': return BookOpen;
      case 'Hạn chót': return AlertCircle;
      default: return CalendarIcon;
    }
  };

  const getEventColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'Họp': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Dự giờ': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Hạn chót': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Sinh hoạt tổ': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center">
        <BackButton />
      </div>

      {/* HEADER ACTION BAR */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>LỊCH CÔNG TÁC TRƯỜNG THPT SƠN LƯƠNG</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Quản lý lịch tuần hành chính, nhận diện AI từ hình ảnh và phân công trực lãnh đạo</p>
        </div>

        {/* Primary Action Buttons as requested */}
        <div className="flex flex-wrap items-center gap-2">
          {/* [Lịch giao việc tổ CM] */}
          <Link
            to="/department-schedule"
            className="inline-flex items-center px-3.5 py-2 border border-blue-200 rounded-xl shadow-xs text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4 text-blue-600" />
            Lịch giao việc tổ CM
          </Link>

          {/* [+ Tạo lịch mới] */}
          <button 
            type="button"
            onClick={createNewBlankSchedule}
            className="inline-flex items-center px-3.5 py-2 border border-slate-300 rounded-xl shadow-xs text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Plus className="mr-1.5 h-4 w-4 text-blue-600" />
            + Tạo lịch mới
          </button>

          {/* [📷 Tải từ hình ảnh] PRIMARY FEATURE BUTTON */}
          <button 
            type="button"
            onClick={() => setIsOcrModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-md text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer ring-2 ring-blue-300 animate-pulse-subtle"
          >
            <Camera className="mr-1.5 h-4 w-4" />
            📷 Tải từ hình ảnh
          </button>

          {/* [📄 Tải từ Word/Excel] */}
          <button 
            type="button"
            onClick={() => setIsWordExcelModalOpen(true)}
            className="inline-flex items-center px-3.5 py-2 border border-emerald-300 rounded-xl shadow-xs text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-600" />
            📄 Tải từ Word/Excel
          </button>

          {/* [📥 Xuất lịch] */}
          {activeWeeklySchedule && (
            <button 
              type="button"
              onClick={() => exportScheduleToWord(activeWeeklySchedule)}
              className="inline-flex items-center px-3.5 py-2 border border-slate-300 rounded-xl shadow-xs text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Download className="mr-1.5 h-4 w-4 text-slate-600" />
              📥 Xuất lịch
            </button>
          )}
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 bg-slate-100/80 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('weekly_schedules')}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === 'weekly_schedules'
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <FileText size={16} />
          <span>Lịch công tác tuần THPT Sơn Lương ({weeklySchedules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar_events')}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === 'calendar_events'
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <CalendarIcon size={16} />
          <span>Lịch sự kiện & Họp ({calendarEvents.length})</span>
        </button>
      </div>

      {/* TAB 1: WEEKLY SCHEDULES (OFFICIAL FORMAL VIEW) */}
      {activeTab === 'weekly_schedules' && (
        <div className="space-y-6">
          
          {/* Week Selector Ribbon */}
          {weeklySchedules.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                  <List size={14} /> Danh sách tuần:
                </span>
                {weeklySchedules.map(sched => {
                  const inactive = isScheduleInactive(sched);
                  const isSelected = selectedScheduleId === sched.id;

                  return (
                    <div
                      key={sched.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
                        isSelected
                          ? "bg-blue-600 text-white shadow-sm border-blue-600 ring-2 ring-blue-300"
                          : inactive
                          ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                      onClick={() => setSelectedScheduleId(sched.id)}
                    >
                      <span>Tuần {sched.week_number}</span>
                      {inactive && (
                        <span className={cn(
                          "px-1.5 py-0.2 text-[10px] rounded font-semibold",
                          isSelected ? "bg-blue-700 text-blue-100" : "bg-amber-200 text-amber-900"
                        )}>
                          Chưa có HĐ
                        </span>
                      )}
                      {deletingScheduleId === sched.id ? (
                        <div className="flex items-center gap-1.5 ml-2 border border-rose-200 bg-rose-50 rounded-lg p-0.5 animate-fade-in" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={async () => {
                              setDeletingScheduleId(null);
                              await handleDeleteWeeklySchedule(sched.id);
                            }}
                            className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[9px] rounded-md transition-colors shadow-xs"
                          >
                            Xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingScheduleId(null)}
                            className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[9px] rounded-md transition-colors"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingScheduleId(sched.id);
                          }}
                          className={cn(
                            "p-0.5 rounded hover:bg-black/10 transition-colors ml-1.5",
                            isSelected ? "text-white/80 hover:text-white" : "text-slate-400 hover:text-rose-600"
                          )}
                          title="Xóa lịch này"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quick action button to delete all inactive schedules */}
              {weeklySchedules.some(isScheduleInactive) && (
                <button
                  type="button"
                  onClick={handleDeleteInactiveSchedules}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ml-auto"
                  title="Xóa tất cả các tuần lịch công tác chưa có nội dung"
                >
                  <Trash2 size={13} className="text-rose-600" />
                  <span>Xóa tất cả lịch chưa hoạt động ({weeklySchedules.filter(isScheduleInactive).length})</span>
                </button>
              )}
            </div>
          )}

          {/* Active Schedule View */}
          {activeWeeklySchedule ? (
            <ErrorBoundary fallbackMessage="Có lỗi xảy ra khi hiển thị chi tiết lịch công tác tuần này.">
              <WeeklyScheduleView
                schedule={activeWeeklySchedule}
                onUpdateSchedule={handleSaveWeeklySchedule}
                onDeleteSchedule={handleDeleteWeeklySchedule}
                onTriggerOcr={() => setIsOcrModalOpen(true)}
              />
            </ErrorBoundary>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-slate-500 space-y-3">
                <p className="text-sm font-bold">Chưa có lịch công tác tuần nào được lưu.</p>
                <button
                  type="button"
                  onClick={() => setIsOcrModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow cursor-pointer"
                >
                  📷 Tải lịch từ hình ảnh ngay
                </button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: CALENDAR EVENTS GRID */}
      {activeTab === 'calendar_events' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <button onClick={navigatePrev} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={navigateNext} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer">
                    <ChevronRight size={20} />
                  </button>
                </div>
                <CardTitle className="text-lg">
                  {viewMode === 'week' 
                    ? `Tuần ${format(startDate, 'dd/MM')} - ${format(addDays(startDate, 6), 'dd/MM/yyyy')}`
                    : `Tháng ${format(currentDate, 'MM/yyyy')}`
                  }
                </CardTitle>
              </div>
              
              <div className="flex items-center gap-2">
                <button onClick={openCreateModal} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer">
                  + Thêm sự kiện họp
                </button>
                <button onClick={navigateToday} className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  Hôm nay
                </button>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                   <button 
                     onClick={() => setViewMode('week')}
                     className={cn("px-3 py-1 text-sm font-medium rounded-md transition-colors cursor-pointer", viewMode === 'week' ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
                   >
                     Tuần
                   </button>
                   <button 
                     onClick={() => setViewMode('month')}
                     className={cn("px-3 py-1 text-sm font-medium rounded-md transition-colors cursor-pointer", viewMode === 'month' ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
                   >
                     Tháng
                   </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {viewMode === 'week' ? (
                <div className="min-w-[800px]">
                  <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
                    {weekDays.map((day, i) => (
                      <div key={i} className="p-3 text-center border-r border-slate-200 last:border-0">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                          {format(day, 'EEEE', { locale: vi })}
                        </p>
                        <p className={cn("text-lg font-semibold", isSameDay(day, new Date()) ? "text-blue-600" : "text-slate-900")}>
                          {format(day, 'd')}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7 min-h-[400px]">
                    {weekDays.map((day, i) => {
                      const dayEvents = calendarEvents.filter(e => isSameDay(new Date(e.date), day)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      
                      return (
                        <div key={i} className={cn("p-2 border-r border-slate-100 last:border-0", isSameDay(day, new Date()) && "bg-blue-50/20")}>
                          <div className="space-y-2">
                            {dayEvents.map(event => {
                              const Icon = getEventIcon(event.type);
                              return (
                                <div 
                                  key={event.id}
                                  className={cn("p-2 text-xs rounded-lg border group relative", getEventColor(event.type))}
                                >
                                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex bg-white/80 backdrop-blur rounded shadow-sm border border-slate-200/50">
                                    <button onClick={(e) => openEditModal(e, event)} className="p-1 hover:text-blue-600" title="Sửa"><Edit2 size={12}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }} className="p-1 hover:text-rose-600" title="Xóa"><Trash2 size={12}/></button>
                                  </div>
                                  <div className="font-semibold mb-1 pr-6 leading-tight">{event.title}</div>
                                  {event.description && <div className="text-[10px] mb-1 opacity-80 line-clamp-2">{event.description}</div>}
                                  <div className="flex items-center gap-1 mt-1 font-medium opacity-90">
                                    <Clock size={10} />
                                    <span>{safeFormat(event.date, 'HH:mm', '--:--')}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="min-w-[800px]">
                  <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, i) => (
                      <div key={i} className="p-2 text-center border-r border-slate-200 last:border-0">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{day}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {monthDays.map((day, i) => {
                      const dayEvents = calendarEvents.filter(e => isSameDay(new Date(e.date), day)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const isCurrentMonth = isSameMonth(day, currentDate);
                      
                      return (
                        <div 
                          key={i} 
                          className={cn(
                            "min-h-[100px] p-1.5 border-b border-r border-slate-100 relative", 
                            !isCurrentMonth && "bg-slate-50/50 text-slate-400",
                            isSameDay(day, new Date()) && "bg-blue-50/20"
                          )}
                        >
                          <div className={cn("text-xs font-medium text-right p-1 mb-1", isSameDay(day, new Date()) && "text-blue-600 font-bold")}>
                            {format(day, 'd')}
                          </div>
                          <div className="space-y-1">
                            {dayEvents.map(event => (
                              <div 
                                key={event.id}
                                className={cn("px-1.5 py-1 text-[10px] rounded border truncate group relative cursor-pointer", getEventColor(event.type))}
                                title={`${safeFormat(event.date, 'HH:mm', '--:--')} - ${event.title}`}
                                onClick={(e) => openEditModal(e, event)}
                              >
                                <span className="font-semibold mr-1">{safeFormat(event.date, 'HH:mm', '--:--')}</span>
                                {event.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* OCR IMAGE MODAL */}
      <ErrorBoundary fallbackMessage="Không thể khởi chạy module camera hoặc nhận diện ảnh OCR.">
        <ImageOcrModal
          isOpen={isOcrModalOpen}
          onClose={() => setIsOcrModalOpen(false)}
          onSaveSchedule={handleSaveWeeklySchedule}
          existingSchedules={weeklySchedules}
        />
      </ErrorBoundary>

      {/* WORD/EXCEL IMPORT MODAL */}
      <WordExcelImportModal
        isOpen={isWordExcelModalOpen}
        onClose={() => setIsWordExcelModalOpen(false)}
        onImportSchedule={async (sched) => {
          await handleSaveWeeklySchedule(sched);
        }}
      />

      {/* SINGLE CALENDAR EVENT CREATE/EDIT MODAL */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-2xl rounded-[24px] shadow-2xl border border-white/50 w-full max-w-md flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                {editingEvent ? 'Cập nhật sự kiện' : 'Thêm sự kiện mới'}
              </h3>
              <button onClick={() => setIsEventModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <form id="event-form" onSubmit={handleSaveEvent} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Tên sự kiện</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.title || ''} 
                    onChange={e => setFormData({...formData, title: e.target.value})} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                    placeholder="Nhập tên sự kiện..."
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Loại sự kiện</label>
                  <select 
                    required 
                    value={formData.type || 'Sự kiện'} 
                    onChange={e => setFormData({...formData, type: e.target.value as any})} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Họp">Họp</option>
                    <option value="Dự giờ">Dự giờ</option>
                    <option value="Thao giảng">Thao giảng</option>
                    <option value="Sinh hoạt tổ">Sinh hoạt tổ</option>
                    <option value="Hạn chót">Hạn chót</option>
                    <option value="Sự kiện">Sự kiện chung</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Thời gian</label>
                  <input 
                    required 
                    type="datetime-local" 
                    value={formData.date || ''} 
                    onChange={e => setFormData({...formData, date: e.target.value})} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Mô tả chi tiết</label>
                  <textarea 
                    value={formData.description || ''} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                    rows={3}
                    placeholder="Nhập ghi chú hoặc nội dung chi tiết..."
                  />
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button 
                type="button" 
                onClick={() => setIsEventModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button type="submit" form="event-form" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                {editingEvent ? 'Cập nhật' : 'Thêm sự kiện'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-white border border-slate-200 shadow-xl rounded-2xl p-4 flex items-center gap-3 animate-slide-up-fade">
          <div className={cn(
            "p-2 rounded-xl",
            toastMsg.type === 'success' ? "bg-emerald-50 text-emerald-600" :
            toastMsg.type === 'error' ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
          )}>
            {toastMsg.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-800">{toastMsg.text}</p>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

    </div>
  );
}
