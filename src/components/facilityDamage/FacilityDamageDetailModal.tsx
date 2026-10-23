import React, { useState } from 'react';
import { X, Wrench, ShieldCheck, CheckCircle, Clock, AlertTriangle, User, Calendar, DollarSign, Upload, Printer } from 'lucide-react';
import { FacilityDamageReport, DamageReportStatus } from '../../types/facilityDamage';
import { facilityDamageService } from '../../services/facilityDamageService';
import { useAuth } from '../../store/AuthContext';

interface FacilityDamageDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: FacilityDamageReport | null;
  onUpdate: () => void;
}

export default function FacilityDamageDetailModal({
  isOpen,
  onClose,
  report,
  onUpdate
}: FacilityDamageDetailModalProps) {
  const { user } = useAuth();
  const isBgh = user?.role?.toUpperCase() === 'BGH' || user?.role?.toUpperCase() === 'ADMIN' || user?.username === 'admin';
  const isGvcn = !isBgh; // Or check if user is homeroom teacher

  const [actionNote, setActionNote] = useState('');
  const [assignedPerson, setAssignedPerson] = useState(report?.assignment?.assignedToName || '');
  const [deadline, setDeadline] = useState(report?.assignment?.deadline || '');
  const [estimatedCost, setEstimatedCost] = useState<number>(report?.assignment?.estimatedCost || 0);
  const [actualCost, setActualCost] = useState<number>(report?.assignment?.actualCost || 0);
  const [replacementParts, setReplacementParts] = useState(report?.assignment?.replacementParts || '');
  const [afterPhotoUrl, setAfterPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !report) return null;

  const handleStatusUpdate = async (newStatus: DamageReportStatus, noteText?: string, extra?: any) => {
    try {
      setSubmitting(true);
      setErrorMsg('');
      await facilityDamageService.updateReportStatus(
        report.id, 
        newStatus, 
        { id: user?.id || 'user', name: user?.name || 'Người dùng' },
        noteText || actionNote,
        extra
      );
      setSubmitting(false);
      setActionNote('');
      onUpdate();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Lỗi cập nhật trạng thái.');
      setSubmitting(false);
    }
  };

  const handleAssignAndReceive = async () => {
    const extra = {
      assignment: {
        assignedToId: 'staff_1',
        assignedToName: assignedPerson || 'Nhân viên thiết bị CSVC',
        assignedRole: 'Nhân viên CSVC',
        assignedAt: new Date().toISOString(),
        deadline: deadline || new Date().toISOString(),
        estimatedCost: Number(estimatedCost) || 0,
        actualCost: Number(actualCost) || 0,
        replacementParts: replacementParts || ''
      }
    };
    await handleStatusUpdate('Đang xử lý', `BGH tiếp nhận và phân công cho: ${assignedPerson || 'Nhân viên thiết bị'}. Hạn: ${deadline}`, extra);
  };

  const handleAddAfterPhoto = async () => {
    if (!afterPhotoUrl.trim()) return;
    const newAtt = {
      id: Math.random().toString(36).substring(2, 9),
      url: afterPhotoUrl.trim(),
      name: `Ảnh sau khi sửa chữa`,
      type: 'after' as const,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user?.name || 'Nhân viên CSVC'
    };
    const updatedAttachments = [...(report.attachments || []), newAtt];
    await handleStatusUpdate(report.status, `Tải lên ảnh minh chứng sau sửa chữa`, { attachments: updatedAttachments });
    setAfterPhotoUrl('');
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#123B78] to-[#1457D9] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Wrench size={20} className="text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase tracking-wide">
                CHI TIẾT PHIẾU BÁO HỎNG CSVC
              </h2>
              <p className="text-xs text-blue-100">Mã phiếu: <strong>{report.ticketCode}</strong> • Trạng thái: <span className="underline font-bold">{report.status}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintReport}
              className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="In phiếu báo hỏng"
            >
              <Printer size={18} />
            </button>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <span className="text-[11px] text-slate-500 block font-medium">Lớp & Phòng học</span>
              <span className="text-xs font-bold text-slate-800">{report.className} ({report.classroom})</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <span className="text-[11px] text-slate-500 block font-medium">Nhóm thiết bị</span>
              <span className="text-xs font-bold text-[#1457D9] capitalize">{report.facilityGroup}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <span className="text-[11px] text-slate-500 block font-medium">Mức độ</span>
              <span className={`text-xs font-extrabold uppercase ${report.severity === 'khẩn cấp' ? 'text-rose-600 animate-pulse' : 'text-amber-600'}`}>
                {report.severity}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <span className="text-[11px] text-slate-500 block font-medium">Giáo viên báo hỏng</span>
              <span className="text-xs font-bold text-slate-800">{report.teacherName}</span>
            </div>
          </div>

          {/* Asset & Description */}
          <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#123B78] uppercase">Tên thiết bị: {report.assetName} (SL: {report.quantity})</h3>
              <span className="text-[11px] font-semibold text-slate-500">Phát hiện lúc: {new Date(report.detectionTime || report.createdAt).toLocaleString('vi-VN')}</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              <strong>Mô tả hư hỏng:</strong> {report.description}
            </p>
            {report.proposedSolution && (
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>Đề xuất khắc phục:</strong> {report.proposedSolution}
              </p>
            )}
          </div>

          {/* Attachments */}
          {report.attachments && report.attachments.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">Ảnh minh chứng</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {report.attachments.map((att) => (
                  <div key={att.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full ${att.type === 'after' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                      <span className="text-[11px] font-bold text-slate-700">{att.name}</span>
                    </div>
                    <a 
                      href={att.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[11px] text-blue-600 hover:underline truncate"
                    >
                      Xem ảnh gốc ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assignment & Cost Details if any */}
          {report.assignment && (
            <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <User size={15} /> Thông tin phân công & xử lý
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Người phụ trách:</span> <strong>{report.assignment.assignedToName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Hạn xử lý:</span> <strong>{report.assignment.deadline ? new Date(report.assignment.deadline).toLocaleDateString('vi-VN') : 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Chi phí dự kiến:</span> <strong>{report.assignment.estimatedCost ? `${report.assignment.estimatedCost.toLocaleString('vi-VN')} đ` : 'Chưa có'}</strong>
                </div>
              </div>
              {report.assignment.replacementParts && (
                <p className="text-xs text-slate-700">
                  <strong>Vật tư thay thế:</strong> {report.assignment.replacementParts}
                </p>
              )}
            </div>
          )}

          {/* History Timeline */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2">Lịch sử xử lý phiếu</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {report.history?.map((h, idx) => (
                <div key={h.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#123B78]">{h.status}</span>
                      <span className="text-[10px] text-slate-400">• {new Date(h.timestamp).toLocaleString('vi-VN')}</span>
                    </div>
                    <p className="text-slate-700 mt-0.5">{h.content} {h.note ? `(${h.note})` : ''}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                    {h.updatedByName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Panel based on Role & Status */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-800">Thực hiện thao tác xử lý</h4>
            
            <textarea 
              rows={2}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="Nhập nội dung cập nhật, ghi chú hoặc lý do trả lại/từ chối..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />

            <div className="flex flex-wrap items-center gap-2">
              {/* BGH Actions */}
              {isBgh && report.status === 'Đã gửi báo hỏng' && (
                <>
                  <div className="flex items-center gap-2 w-full mb-1">
                    <input 
                      type="text" 
                      value={assignedPerson} 
                      onChange={(e) => setAssignedPerson(e.target.value)} 
                      placeholder="Tên nhân viên phụ trách sửa chữa..."
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <input 
                      type="date" 
                      value={deadline} 
                      onChange={(e) => setDeadline(e.target.value)} 
                      className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAssignAndReceive}
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Tiếp nhận & Phân công xử lý
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('Yêu cầu bổ sung')}
                    disabled={submitting}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Yêu cầu bổ sung thông tin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('Từ chối')}
                    disabled={submitting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Từ chối báo hỏng
                  </button>
                </>
              )}

              {/* Staff / Handler Actions */}
              {(report.status === 'Đã tiếp nhận' || report.status === 'Đang xử lý' || report.status === 'Chờ vật tư hoặc chờ sửa chữa') && (
                <>
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('Đang xử lý')}
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Chuyển "Đang xử lý"
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('Chờ vật tư hoặc chờ sửa chữa')}
                    disabled={submitting}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Chờ vật tư / chờ sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('Đã khắc phục')}
                    disabled={submitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Đã khắc phục xong (Gửi GVCN xác nhận)
                  </button>

                  <div className="flex items-center gap-2 w-full mt-2">
                    <input 
                      type="text" 
                      value={afterPhotoUrl} 
                      onChange={(e) => setAfterPhotoUrl(e.target.value)} 
                      placeholder="Link ảnh sau khi sửa chữa..."
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleAddAfterPhoto}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg"
                    >
                      Đính kèm ảnh sau sửa
                    </button>
                  </div>
                </>
              )}

              {/* GVCN Confirmation when fixed */}
              {report.status === 'Đã khắc phục' && (
                <button
                  type="button"
                  onClick={() => handleStatusUpdate('GVCN xác nhận hoàn thành', 'GVCN đã kiểm tra và xác nhận hoàn thành sửa chữa')}
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle size={16} /> GVCN Xác nhận hoàn thành
                </button>
              )}

              {/* BGH Close ticket */}
              {isBgh && report.status === 'GVCN xác nhận hoàn thành' && (
                <button
                  type="button"
                  onClick={() => handleStatusUpdate('Đóng phiếu', 'BGH kiểm tra và đóng phiếu báo hỏng')}
                  disabled={submitting}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold rounded-xl shadow transition-colors"
                >
                  Đóng phiếu báo hỏng
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
