import React, { useState } from 'react';
import { X, Calendar, Award, AlertTriangle, User, Phone, MapPin, PlusCircle, MinusCircle, FileText } from 'lucide-react';
import { Student, ConductRecord, ConductSettings } from '../../types/homeroom';
import { calculateConductScore } from '../../lib/homeroomData';
import BackButton from '../ui/BackButton';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  records: ConductRecord[];
  settings: ConductSettings;
  onDeleteRecord?: (id: string) => void;
}

export default function StudentProfileModal({
  isOpen,
  onClose,
  student,
  records,
  settings,
  onDeleteRecord
}: StudentProfileModalProps) {
  const [filterType, setFilterType] = useState<'all' | 'plus' | 'minus'>('all');

  if (!isOpen) return null;

  const studentRecords = records
    .filter(r => r.studentId === student.id)
    .filter(r => {
      if (filterType === 'plus') return r.pointType === 'plus';
      if (filterType === 'minus') return r.pointType === 'minus';
      return true;
    });

  let totalPlus = 0;
  let totalMinus = 0;

  records.filter(r => r.studentId === student.id).forEach(r => {
    if (r.pointType === 'plus') totalPlus += Math.abs(r.point);
    else totalMinus += Math.abs(r.point);
  });

  const { totalScore, classification } = calculateConductScore(
    settings.baseScore || 100,
    totalPlus,
    totalMinus,
    settings.thresholds
  );

  const getBadgeColor = (cls: string) => {
    switch (cls) {
      case 'Tốt': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Khá': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Đạt': return 'bg-amber-100 text-amber-800 border-amber-300';
      default: return 'bg-rose-100 text-rose-800 border-rose-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#123B78] to-[#1457D9] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>

          <div className="mb-4">
            <BackButton 
              onClick={onClose} 
              className="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20 hover:!text-white" 
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center text-3xl font-bold shadow-inner shrink-0">
              {student.name.charAt(student.name.lastIndexOf(' ') + 1) || 'H'}
            </div>
            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <h2 className="text-2xl font-bold">{student.name}</h2>
                <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-semibold">
                  {student.code}
                </span>
              </div>
              <p className="text-blue-100 text-sm flex flex-wrap items-center justify-center sm:justify-start gap-4">
                <span>Lớp: <strong className="text-white">{student.className}</strong></span>
                <span>•</span>
                <span>Giới tính: {student.gender}</span>
                <span>•</span>
                <span>Ngày sinh: {student.dob ? new Date(student.dob).toLocaleDateString('vi-VN') : 'N/A'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Info & Conduct Summary Cards */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <span className="text-xs text-slate-500 font-medium block mb-1">Điểm ban đầu</span>
              <span className="text-xl font-bold text-slate-800">{settings.baseScore || 100}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
              <span className="text-xs text-emerald-600 font-medium block mb-1">Tổng điểm cộng</span>
              <span className="text-xl font-bold text-emerald-600">+{totalPlus}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
              <span className="text-xs text-rose-600 font-medium block mb-1">Tổng điểm trừ</span>
              <span className="text-xl font-bold text-rose-600">-{totalMinus}</span>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <span className="text-xs text-blue-600 font-medium block mb-1">Tổng điểm rèn luyện</span>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-black text-blue-700">{totalScore}</span>
                <span className={`text-xs px-2 py-0.5 rounded-md font-bold border ${getBadgeColor(classification)}`}>
                  {classification}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          {(student.parentPhone || student.parentName || student.address) && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-xs text-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {student.parentName && (
                <div className="flex items-center gap-2">
                  <User size={14} className="text-blue-600" />
                  <span>Phụ huynh: <strong>{student.parentName}</strong></span>
                </div>
              )}
              {student.parentPhone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-blue-600" />
                  <span>SĐT liên hệ: <strong>{student.parentPhone}</strong></span>
                </div>
              )}
              {student.address && (
                <div className="flex items-center gap-2 col-span-1 sm:col-span-3">
                  <MapPin size={14} className="text-blue-600 shrink-0" />
                  <span className="truncate">Địa chỉ: {student.address}</span>
                </div>
              )}
            </div>
          )}

          {/* Conduct History Timeline / Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                Lịch sử ghi nhận nền nếp & vi phạm ({studentRecords.length})
              </h3>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-md transition-all ${filterType === 'all' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-600'}`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setFilterType('plus')}
                  className={`px-2.5 py-1 rounded-md transition-all ${filterType === 'plus' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-slate-600'}`}
                >
                  Điểm cộng
                </button>
                <button
                  onClick={() => setFilterType('minus')}
                  className={`px-2.5 py-1 rounded-md transition-all ${filterType === 'minus' ? 'bg-white text-rose-700 shadow-sm font-bold' : 'text-slate-600'}`}
                >
                  Điểm trừ
                </button>
              </div>
            </div>

            {studentRecords.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm">
                Không có ghi nhận nào trong mục chọn này.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                    <tr>
                      <th className="p-3">Ngày</th>
                      <th className="p-3">Tiêu chí / Nội dung</th>
                      <th className="p-3">Loại</th>
                      <th className="p-3 text-center">Số điểm</th>
                      <th className="p-3">Người ghi nhận</th>
                      <th className="p-3">Ghi chú</th>
                      {onDeleteRecord && <th className="p-3 text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentRecords.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-medium text-slate-700 whitespace-nowrap">
                          {new Date(r.recordDate).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="p-3 font-semibold text-slate-800">
                          {r.criterionName}
                          {r.level && (
                            <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded font-normal">
                              Mức: {r.level}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {r.pointType === 'plus' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <PlusCircle size={12} /> Điểm cộng
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              <MinusCircle size={12} /> Điểm trừ
                            </span>
                          )}
                        </td>
                        <td className={`p-3 text-center font-bold ${r.pointType === 'plus' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {r.pointType === 'plus' ? `+${r.point}` : `${r.point}`}
                        </td>
                        <td className="p-3 text-slate-600">{r.recordedByName || r.recordedBy}</td>
                        <td className="p-3 text-slate-500 italic">{r.note || '—'}</td>
                        {onDeleteRecord && (
                          <td className="p-3 text-right">
                            <button
                              onClick={() => onDeleteRecord(r.id)}
                              className="text-rose-600 hover:text-rose-800 text-xs font-semibold hover:underline"
                            >
                              Xóa
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
