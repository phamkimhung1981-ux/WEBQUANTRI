import React, { useState, useEffect } from 'react';
import { X, Wrench, AlertTriangle, Upload, Image as ImageIcon, CheckCircle, ShieldAlert } from 'lucide-react';
import { FacilityDamageReport, FacilityGroup, DamageSeverity, DamageReportStatus, AcFailureStatus } from '../../types/facilityDamage';
import { useAuth } from '../../store/AuthContext';
import { facilityDamageService } from '../../services/facilityDamageService';
import { useAppContext } from '../../store/AppContext';

interface FacilityDamageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingReport?: FacilityDamageReport | null;
}

const FACILITY_GROUPS: FacilityGroup[] = [
  'điều hòa',
  'bàn ghế học sinh',
  'bàn ghế giáo viên',
  'bảng lớp học',
  'đèn chiếu sáng',
  'quạt điện',
  'cửa ra vào, cửa sổ',
  'hệ thống điện',
  'hệ thống nước',
  'máy chiếu',
  'máy tính',
  'thiết bị dạy học',
  'thiết bị vệ sinh',
  'khác'
];

export default function FacilityDamageModal({
  isOpen,
  onClose,
  onSave,
  editingReport
}: FacilityDamageModalProps) {
  const { user } = useAuth();
  const { teachers, classes } = useAppContext();
  const isBgh = user?.role?.toUpperCase() === 'BGH' || user?.role?.toUpperCase() === 'ADMIN' || user?.username === 'admin';

  const [ticketCode, setTicketCode] = useState('');
  const [reportedDate, setReportedDate] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [classId, setClassId] = useState('');
  const [className, setClassName] = useState('');
  const [classroom, setClassroom] = useState('');
  const [facilityGroup, setFacilityGroup] = useState<FacilityGroup>('bàn ghế học sinh');
  const [assetName, setAssetName] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [acStatus, setAcStatus] = useState<AcFailureStatus>('không hoạt động');
  const [description, setDescription] = useState('');
  const [cause, setCause] = useState('');
  const [severity, setSeverity] = useState<DamageSeverity>('trung bình');
  const [detectionTime, setDetectionTime] = useState('');
  const [proposedSolution, setProposedSolution] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachments, setAttachments] = useState<Array<{ id: string; url: string; name: string; type: 'before' | 'after' | 'general'; uploadedAt: string; uploadedBy: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Get current date in Vietnam timezone format (YYYY-MM-DD)
  const getVietnamCurrentDate = () => {
    try {
      const now = new Date();
      const vnOptions: Intl.DateTimeFormatOptions = { 
        timeZone: 'Asia/Ho_Chi_Minh', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      };
      const parts = new Intl.DateTimeFormat('en-CA', vnOptions).formatToParts(now);
      const year = parts.find(p => p.type === 'year')?.value || '2026';
      const month = parts.find(p => p.type === 'month')?.value || '10';
      const day = parts.find(p => p.type === 'day')?.value || '21';
      return `${year}-${month}-${day}`;
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  };

  // Find classes where a teacher is homeroom teacher
  const getClassesForTeacher = (tId: string, tName: string) => {
    return classes.filter(c => 
      c.homeroomTeacherId === tId || 
      (tName && c.homeroomTeacher?.toLowerCase() === tName.toLowerCase()) ||
      (tName && c.homeroomTeacherName?.toLowerCase() === tName.toLowerCase())
    );
  };

  useEffect(() => {
    if (isOpen) {
      const currentDate = getVietnamCurrentDate();

      if (editingReport) {
        setTicketCode(editingReport.ticketCode);
        setReportedDate(editingReport.reportedAt ? editingReport.reportedAt.slice(0, 10) : currentDate);
        setSelectedTeacherId(editingReport.teacherId || user?.id || '');
        setTeacherName(editingReport.teacherName || user?.name || '');
        setClassId(editingReport.classId || '');
        setClassName(editingReport.className || '');
        setClassroom(editingReport.classroom || '');
        setFacilityGroup(editingReport.facilityGroup || 'bàn ghế học sinh');
        setAssetName(editingReport.assetName || '');
        setAssetCode(editingReport.assetCode || '');
        setQuantity(editingReport.quantity || 1);
        setAcStatus(editingReport.acStatus || 'không hoạt động');
        setDescription(editingReport.description || '');
        setCause(editingReport.cause || '');
        setSeverity(editingReport.severity || 'trung bình');
        setDetectionTime(editingReport.detectionTime || new Date().toISOString().slice(0, 16));
        setProposedSolution(editingReport.proposedSolution || '');
        setNotes(editingReport.notes || '');
        setAttachments(editingReport.attachments || []);
      } else {
        setTicketCode(facilityDamageService.generateTicketCode());
        setReportedDate(currentDate);

        if (!isBgh && user) {
          // Logged in as GVCN
          setSelectedTeacherId(user.id);
          setTeacherName(user.name);
          const assignedClasses = getClassesForTeacher(user.id, user.name);
          const matchedClass = assignedClasses[0] || classes[0];
          setClassId(matchedClass?.id || 'class_1');
          setClassName(matchedClass?.name || '10A1');
          setClassroom(matchedClass?.room || `Phòng học lớp ${matchedClass?.name || '10A1'}`);
        } else {
          // BGH / Admin: default to first teacher
          const firstTeacher = teachers[0] || { id: user?.id || 't1', name: user?.name || 'Giáo viên' };
          setSelectedTeacherId(firstTeacher.id);
          setTeacherName(firstTeacher.name);
          const assignedClasses = getClassesForTeacher(firstTeacher.id, firstTeacher.name);
          const matchedClass = assignedClasses[0] || classes[0];
          setClassId(matchedClass?.id || 'class_1');
          setClassName(matchedClass?.name || '10A1');
          setClassroom(matchedClass?.room || `Phòng học lớp ${matchedClass?.name || '10A1'}`);
        }

        setFacilityGroup('bàn ghế học sinh');
        setAssetName('');
        setAssetCode('');
        setQuantity(1);
        setAcStatus('không hoạt động');
        setDescription('');
        setCause('');
        setSeverity('trung bình');
        setDetectionTime(new Date().toISOString().slice(0, 16));
        setProposedSolution('');
        setNotes('');
        setAttachments([]);
      }
      setErrorMsg('');
      setSubmitting(false);
    }
  }, [isOpen, editingReport, user, teachers, classes, isBgh]);

  // When selected teacher changes (for BGH/Admin)
  const handleTeacherChange = (tId: string) => {
    setSelectedTeacherId(tId);
    const foundTeacher = teachers.find(t => t.id === tId);
    if (foundTeacher) {
      setTeacherName(foundTeacher.name);
      const assignedClasses = getClassesForTeacher(foundTeacher.id, foundTeacher.name);
      if (assignedClasses.length > 0) {
        setClassId(assignedClasses[0].id);
        setClassName(assignedClasses[0].name);
        setClassroom(assignedClasses[0].room || `Phòng học lớp ${assignedClasses[0].name}`);
      } else {
        // Fallback to first class if no homeroom assignment found
        const fallbackCls = classes[0];
        setClassId(fallbackCls?.id || 'class_1');
        setClassName(fallbackCls?.name || '10A1');
        setClassroom(fallbackCls?.room || `Phòng học lớp ${fallbackCls?.name || '10A1'}`);
      }
    }
  };

  // When selected class changes (if teacher has multiple classes)
  const handleClassChange = (cId: string) => {
    setClassId(cId);
    const foundCls = classes.find(c => c.id === cId);
    if (foundCls) {
      setClassName(foundCls.name);
      setClassroom(foundCls.room || `Phòng học lớp ${foundCls.name}`);
    }
  };

  if (!isOpen) return null;

  const teacherAssignedClasses = getClassesForTeacher(selectedTeacherId, teacherName);

  const hasSafetyRisk = 
    facilityGroup === 'hệ thống điện' || 
    facilityGroup === 'điều hòa' ||
    facilityGroup === 'cửa ra vào, cửa sổ' || 
    severity === 'khẩn cấp' || 
    severity === 'nghiêm trọng' ||
    description.toLowerCase().includes('cháy') ||
    description.toLowerCase().includes('nổ') ||
    description.toLowerCase().includes('điện giật') ||
    description.toLowerCase().includes('kính vỡ') ||
    description.toLowerCase().includes('nguy hiểm') ||
    description.toLowerCase().includes('rò điện');

  const handleAddAttachment = () => {
    if (!attachmentUrl.trim()) return;
    const newAtt = {
      id: Math.random().toString(36).substring(2, 9),
      url: attachmentUrl.trim(),
      name: `Ảnh minh chứng ${attachments.length + 1}`,
      type: 'before' as const,
      uploadedAt: new Date().toISOString(),
      uploadedBy: teacherName || 'GVCN'
    };
    setAttachments([...attachments, newAtt]);
    setAttachmentUrl('');
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  const handleSubmit = async (saveAsDraft: boolean) => {
    if (submitting) return; // Prevent double submission
    if (!assetName.trim() && facilityGroup !== 'điều hòa') {
      setErrorMsg('Vui lòng nhập tên thiết bị/tài sản bị hỏng.');
      return;
    }
    if (facilityGroup === 'điều hòa' && !assetName.trim()) {
      setAssetName('Điều hòa nhiệt độ');
    }
    if (!description.trim()) {
      setErrorMsg('Vui lòng nhập mô tả chi tiết tình trạng hư hỏng.');
      return;
    }
    if (!className) {
      setErrorMsg('Vui lòng chọn lớp chủ nhiệm.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const now = new Date().toISOString();
      const statusValue: DamageReportStatus = editingReport ? editingReport.status : (saveAsDraft ? 'Nháp' : 'Đã gửi báo hỏng');
      const reportMonth = reportedDate ? reportedDate.slice(5, 7) : String(new Date().getMonth() + 1).padStart(2, '0');

      const reportPayload = {
        ticketCode,
        reportedAt: reportedDate ? `${reportedDate}T00:00:00.000Z` : now,
        classId: classId || 'class_1',
        className,
        teacherId: selectedTeacherId || user?.id || 't1',
        teacherName: teacherName || user?.name || 'Giáo viên Chủ nhiệm',
        classroom: classroom || `Phòng học lớp ${className}`,
        facilityGroup,
        assetName: facilityGroup === 'điều hòa' ? (assetName.trim() || 'Điều hòa nhiệt độ') : assetName.trim(),
        assetCode: facilityGroup === 'điều hòa' ? assetCode.trim() : undefined,
        quantity: Number(quantity) || 1,
        acStatus: facilityGroup === 'điều hòa' ? acStatus : undefined,
        description: description.trim(),
        cause: cause.trim(),
        severity,
        detectionTime,
        attachments,
        proposedSolution: proposedSolution.trim(),
        notes: notes.trim(),
        status: statusValue,
        isUrgentSafetyRisk: hasSafetyRisk,
        academicYear: '2026-2027',
        month: reportMonth,
        history: editingReport ? editingReport.history : [
          {
            id: Math.random().toString(36).substring(2, 9),
            status: statusValue,
            updatedBy: selectedTeacherId || user?.id || 't1',
            updatedByName: teacherName || 'GVCN',
            timestamp: now,
            content: saveAsDraft ? 'Tạo phiếu lưu nháp' : 'Gửi báo hỏng chính thức',
            note: hasSafetyRisk ? 'CẢNH BÁO AN TOÀN: Phát hiện nguy cơ mất an toàn / khẩn cấp!' : ''
          }
        ]
      };

      await facilityDamageService.saveReport(reportPayload);
      alert('Đã lưu phiếu báo hỏng thành công lên máy chủ!');
      setSubmitting(false);
      onSave();
      onClose();
    } catch (err: any) {
      console.error('Failed to save facility damage report:', err);
      setErrorMsg(err.message || 'Lỗi khi lưu phiếu báo hỏng lên máy chủ thực tế.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#123B78] to-[#1457D9] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Wrench size={20} className="text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase tracking-wide">
                {editingReport ? 'CẬP NHẬT PHIẾU BÁO HỎNG CSVC' : 'LẬP PHIẾU BÁO HỎNG CƠ SỞ VẬT CHẤT LỚP HỌC'}
              </h2>
              <p className="text-xs text-blue-100">Mã phiếu: <strong>{ticketCode}</strong></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Safety Risk Alert Banner */}
          {hasSafetyRisk && (
            <div className="bg-amber-50 border-2 border-amber-400 p-3.5 rounded-xl text-xs space-y-1 animate-pulse">
              <p className="font-extrabold text-amber-900 flex items-center gap-1.5">
                <ShieldAlert size={18} className="text-amber-600 shrink-0" />
                <span>CẢNH BÁO: NGUY CƠ MẤT AN TOÀN ĐIỆN, CHÁY NỔ HOẶC SỰ CỐ KHẨN CẤP!</span>
              </p>
              <p className="text-amber-800">
                Hệ thống đã ghi nhận yếu tố rủi ro cao. Khi gửi, thông báo sẽ được chuyển ngay lập tức tới Ban Giám hiệu và nhân viên phụ trách.
              </p>
            </div>
          )}

          {/* GVCN & Class Selection (from CBGVNV module) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
            <div>
              <label className="block text-[11px] font-bold text-[#123B78] uppercase mb-1">
                Người báo hỏng / GVCN <span className="text-rose-500">*</span>
              </label>
              {isBgh ? (
                <select
                  value={selectedTeacherId}
                  onChange={(e) => handleTeacherChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white text-slate-800 font-bold border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code || t.subject || 'GV'})</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  value={teacherName} 
                  disabled 
                  className="w-full px-3 py-2 text-xs bg-white text-slate-800 font-bold border border-blue-200 rounded-xl cursor-not-allowed"
                />
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#123B78] uppercase mb-1">
                Lớp chủ nhiệm <span className="text-rose-500">*</span>
              </label>
              {teacherAssignedClasses.length > 1 ? (
                <select
                  value={classId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white text-slate-800 font-bold border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {teacherAssignedClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.room || 'Phòng học'})</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  value={`${className} (${classroom})`} 
                  disabled 
                  className="w-full px-3 py-2 text-xs bg-white text-slate-800 font-bold border border-blue-200 rounded-xl cursor-not-allowed"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ngày báo hỏng with explicit DD/MM/YYYY description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ngày báo hỏng (DD/MM/YYYY) <span className="text-rose-500">*</span>
              </label>
              <input 
                type="date" 
                value={reportedDate} 
                onChange={(e) => setReportedDate(e.target.value)} 
                className="w-full px-3 py-2 text-xs bg-white text-slate-800 font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Mặc định theo múi giờ Việt Nam (Asia/Ho_Chi_Minh).</span>
            </div>

            {/* Phòng học */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phòng học <span className="text-rose-500">*</span>
              </label>
              <input 
                type="text" 
                value={classroom} 
                onChange={(e) => setClassroom(e.target.value)} 
                placeholder="VD: Phòng 101 - Lớp 10A1"
                className="w-full px-3 py-2 text-xs bg-white text-slate-800 font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Nhóm CSVC */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nhóm cơ sở vật chất <span className="text-rose-500">*</span>
              </label>
              <select
                value={facilityGroup}
                onChange={(e) => setFacilityGroup(e.target.value as FacilityGroup)}
                className="w-full px-3 py-2 text-xs bg-white text-slate-800 font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none capitalize"
              >
                {FACILITY_GROUPS.map(g => (
                  <option key={g} value={g} className="capitalize">{g}</option>
                ))}
              </select>
            </div>

            {/* Mức độ */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mức độ hư hỏng <span className="text-rose-500">*</span>
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as DamageSeverity)}
                className="w-full px-3 py-2 text-xs bg-white text-slate-800 font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="nhẹ">🟢 Nhẹ (Vẫn sử dụng được)</option>
                <option value="trung bình">🟡 Trung bình (Cần sửa sớm)</option>
                <option value="nghiêm trọng">🟠 Nghiêm trọng (Không dùng được)</option>
                <option value="khẩn cấp">🔴 Khẩn cấp (Nguy hiểm / Sự cố)</option>
              </select>
            </div>

            {/* Thời điểm phát hiện */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Thời điểm phát hiện <span className="text-rose-500">*</span>
              </label>
              <input 
                type="datetime-local" 
                value={detectionTime} 
                onChange={(e) => setDetectionTime(e.target.value)} 
                className="w-full px-3 py-2 text-xs bg-white text-slate-800 font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Conditional Fields if facilityGroup is 'điều hòa' */}
          {facilityGroup === 'điều hòa' ? (
            <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-extrabold text-amber-900 uppercase">Thông tin chi tiết Điều hòa</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Mã / Tên thiết bị điều hòa</label>
                  <input 
                    type="text" 
                    value={assetCode} 
                    onChange={(e) => setAssetCode(e.target.value)} 
                    placeholder="VD: ĐH-10A1-01" 
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Số lượng hỏng</label>
                  <input 
                    type="number" 
                    min={1} 
                    value={quantity} 
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} 
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Tình trạng hỏng điều hòa</label>
                  <select
                    value={acStatus}
                    onChange={(e) => setAcStatus(e.target.value as AcFailureStatus)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold capitalize"
                  >
                    <option value="không hoạt động">Không hoạt động</option>
                    <option value="không làm mát">Không làm mát</option>
                    <option value="chảy nước">Chảy nước</option>
                    <option value="phát tiếng ồn">Phát tiếng ồn</option>
                    <option value="rò điện">Rò điện (Nguy hiểm)</option>
                    <option value="khác">Khác</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên thiết bị / tài sản bị hỏng <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={assetName} 
                  onChange={(e) => setAssetName(e.target.value)} 
                  placeholder="VD: Bóng đèn LED tuýp 1.2m, Quạt trần..."
                  className="w-full px-3 py-2 text-xs bg-white text-slate-800 font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số lượng hỏng <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="number" 
                  min={1} 
                  value={quantity} 
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} 
                  className="w-full px-3 py-2 text-xs bg-white text-slate-800 font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Mô tả tình trạng */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mô tả chi tiết tình trạng & Nguyên nhân (nếu có) <span className="text-rose-500">*</span>
            </label>
            <textarea 
              rows={3} 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Mô tả cụ thể thiết bị bị hư hỏng thế nào, nguyên nhân do đâu..."
              className="w-full px-3 py-2 text-xs bg-white text-slate-800 font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          {/* Đề xuất phương án khắc phục */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Đề xuất phương án khắc phục / sửa chữa / thay thế
            </label>
            <input 
              type="text" 
              value={proposedSolution} 
              onChange={(e) => setProposedSolution(e.target.value)} 
              placeholder="VD: Thay mới block điều hòa, nạp gas, hàn lại chân bàn..."
              className="w-full px-3 py-2 text-xs bg-white text-slate-800 font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Ảnh minh chứng */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ảnh minh chứng hư hỏng (đường dẫn / URL ảnh)
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={attachmentUrl} 
                onChange={(e) => setAttachmentUrl(e.target.value)} 
                placeholder="Dán link ảnh (https://...) hoặc tải ảnh lên..."
                className="flex-1 px-3 py-2 text-xs bg-white text-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                type="button"
                onClick={handleAddAttachment}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <Upload size={14} /> Thêm ảnh
              </button>
            </div>

            {attachments.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {attachments.map((att) => (
                  <div key={att.id} className="relative group bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center gap-2">
                    <ImageIcon size={16} className="text-blue-600 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-700 truncate">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="ml-auto text-rose-500 hover:text-rose-700 text-xs font-bold p-1 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú bổ sung
            </label>
            <input 
              type="text" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Các lưu ý khác cho người phụ trách..."
              className="w-full px-3 py-2 text-xs bg-white text-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

        </div>

        {/* Footer Actions with required buttons */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Hủy
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Đang lưu...' : 'Lưu nháp'}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle size={15} /> {submitting ? 'Đang lưu...' : 'Lưu phiếu báo hỏng'}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Wrench size={15} /> {submitting ? 'Đang gửi...' : 'Gửi báo hỏng'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
