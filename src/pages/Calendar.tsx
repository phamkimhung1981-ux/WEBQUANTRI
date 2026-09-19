import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { format, startOfWeek, addDays, isSameDay, subWeeks, addWeeks, subMonths, addMonths, startOfMonth, endOfMonth, endOfWeek, isSameMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, Users, BookOpen, AlertCircle, Plus, ChevronLeft, ChevronRight, X, Edit2, Trash2 } from 'lucide-react';
import { CalendarEvent } from '../types';
import { cn } from '../lib/utils';
import { safeFormat, safeParseDate } from '../utils/dateUtils';
import BackButton from '../components/ui/BackButton';

export default function Calendar() {
  const { calendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState<Partial<CalendarEvent>>({
    type: 'Sự kiện',
    date: new Date().toISOString().slice(0, 16)
  });

  // Week View Calculations
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  // Month View Calculations
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
    // Round to next hour
    now.setHours(now.getHours() + 1, 0, 0, 0);
    
    // Account for timezone offset to get correct local time string for input type="datetime-local"
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localIsoTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
    
    setFormData({
      type: 'Họp',
      date: localIsoTime,
      title: '',
      description: ''
    });
    setIsModalOpen(true);
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
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa sự kiện này?')) {
      deleteCalendarEvent(id);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date) return;

    // Convert local datetime back to UTC ISO string
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
    setIsModalOpen(false);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lịch công tác</h1>
          <p className="text-sm text-slate-500 mt-1">Lịch sự kiện, họp và hạn chót công việc</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          Thêm sự kiện
        </button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button onClick={navigatePrev} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600">
                <ChevronLeft size={20} />
              </button>
              <button onClick={navigateNext} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600">
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
            <button onClick={navigateToday} className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Hôm nay
            </button>
            <div className="flex bg-slate-100 p-1 rounded-lg">
               <button 
                 onClick={() => setViewMode('week')}
                 className={cn("px-3 py-1 text-sm font-medium rounded-md transition-colors", viewMode === 'week' ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
               >
                 Tuần
               </button>
               <button 
                 onClick={() => setViewMode('month')}
                 className={cn("px-3 py-1 text-sm font-medium rounded-md transition-colors", viewMode === 'month' ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
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
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }} className="p-1 hover:text-rose-600" title="Xóa"><Trash2 size={12}/></button>
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

      <div className="flex gap-4 flex-wrap">
         <div className="flex items-center gap-2 text-sm text-slate-600"><span className="w-3 h-3 rounded-full bg-blue-400"></span> Họp/Sự kiện</div>
         <div className="flex items-center gap-2 text-sm text-slate-600"><span className="w-3 h-3 rounded-full bg-emerald-400"></span> Sinh hoạt tổ</div>
         <div className="flex items-center gap-2 text-sm text-slate-600"><span className="w-3 h-3 rounded-full bg-purple-400"></span> Dự giờ/Thao giảng</div>
         <div className="flex items-center gap-2 text-sm text-slate-600"><span className="w-3 h-3 rounded-full bg-rose-400"></span> Hạn chót</div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-2xl rounded-[24px] shadow-2xl border border-white/50 w-full max-w-md flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                {editingEvent ? 'Cập nhật sự kiện' : 'Thêm sự kiện mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <form id="event-form" onSubmit={handleSave} className="space-y-4">
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
                onClick={() => setIsModalOpen(false)}
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
    </div>
  );
}
