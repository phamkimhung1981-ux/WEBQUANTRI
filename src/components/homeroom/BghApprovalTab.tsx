import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Eye, 
  Check, 
  Edit3, 
  MessageSquare, 
  ExternalLink,
  Search,
  Filter,
  UserCheck,
  Award
} from 'lucide-react';
import { ConductRecord, ConductEvaluation, Student, ClassInfo, ClassificationType } from '../../types/homeroom';
import { homeroomService } from '../../services/homeroomService';

interface BghApprovalTabProps {
  records: ConductRecord[];
  evaluations: ConductEvaluation[];
  students: Student[];
  classes: ClassInfo[];
  userRole?: string;
  onViewStudentProfile?: (student: Student) => void;
  onApproveRecord?: (recordId: string, status: any, note?: string, newRating?: string) => Promise<void>;
  onApproveEvaluation?: (evaluationId: string, status: any, comment?: string) => Promise<void>;
}

export default function BghApprovalTab({
  records,
  evaluations,
  students,
  classes,
  userRole,
  onViewStudentProfile,
  onApproveRecord,
  onApproveEvaluation
}: BghApprovalTabProps) {
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal for Evidence or Adjusting classification
  const [activeEvidenceUrl, setActiveEvidenceUrl] = useState<string | null>(null);
  const [adjustModalRecord, setAdjustModalRecord] = useState<ConductRecord | null>(null);
  const [adjustRating, setAdjustRating] = useState<ClassificationType>('Khá');
  const [adjustComment, setAdjustComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter records that require BGH attention
  const bghTargetRecords = records.filter(r => {
    // Check if record is serious violation or marked for BGH approval
    const isSerious = r.requiresBghApproval || 
      r.hasConductWarning || 
      r.categoryType === 'BẠO LỰC HỌC ĐƯỜNG' || 
      r.categoryType === 'GIAN LẬN THI CỬ' || 
      (r.categoryType === 'ATGT' && (r.level === 'Nghiêm trọng' || r.level === 'Rất nghiêm trọng')) ||
      r.level === 'Rất nghiêm trọng' ||
      r.level === 'Nghiêm trọng';

    if (!isSerious) return false;

    if (selectedClassFilter !== 'all' && r.classId !== selectedClassFilter) return false;
    
    if (selectedStatusFilter !== 'all') {
      const status = r.bghApprovalStatus || 'Chưa duyệt';
      if (status !== selectedStatusFilter) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.studentName.toLowerCase().includes(q) || r.className.toLowerCase().includes(q) || (r.note && r.note.toLowerCase().includes(q));
    }

    return true;
  });

  // Handle BGH quick approve
  const handleApproveRecord = async (record: ConductRecord) => {
    try {
      setIsSubmitting(true);
      await homeroomService.updateRecordBghApproval(record.id, 'Đã duyệt', 'BGH đã đồng ý với đề xuất', 'Ban Giám hiệu');
      alert(`Đã duyệt đề xuất cho học sinh ${record.studentName}`);
    } catch (err) {
      alert('Lỗi khi phê duyệt. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle BGH Request Additional info
  const handleRequestMoreInfo = async (record: ConductRecord) => {
    const comment = prompt('Nhập yêu cầu bổ sung thông tin cho GVCN:', 'Yêu cầu GVCN làm rõ thời gian, diễn biến sự việc và biên bản làm việc với gia đình');
    if (!comment) return;

    try {
      setIsSubmitting(true);
      await homeroomService.updateRecordBghApproval(record.id, 'Yêu cầu bổ sung', comment, 'Ban Giám hiệu');
      alert(`Đã gửi yêu cầu bổ sung thông tin tới GVCN.`);
    } catch (err) {
      alert('Lỗi khi lưu yêu cầu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle BGH Adjust Rating
  const handleConfirmAdjust = async () => {
    if (!adjustModalRecord) return;
    try {
      setIsSubmitting(true);
      await homeroomService.updateRecordBghApproval(
        adjustModalRecord.id, 
        'Điều chỉnh', 
        `BGH điều chỉnh kết quả: ${adjustRating}. Ghi chú: ${adjustComment}`, 
        'Ban Giám hiệu'
      );

      setAdjustModalRecord(null);
      alert('Đã cập nhật điều chỉnh đánh giá thành công.');
    } catch (err) {
      alert('Lỗi khi cập nhật điều chỉnh.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className="bg-linear-to-r from-rose-900 via-rose-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-rose-300">
              <ShieldAlert size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Đánh giá & Duyệt BGH - Vi phạm nghiêm trọng</h2>
              <p className="text-xs text-rose-200">
                Xem xét minh chứng, ý kiến đề xuất của GVCN và phê duyệt mức rèn luyện chính thức
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-xl border border-white/15 text-xs font-semibold">
            <span>Tổng số trường hợp:</span>
            <span className="bg-rose-500 text-white font-bold px-2 py-0.5 rounded-md">
              {bghTargetRecords.length}
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Lớp Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Lớp:</span>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="all">Tất cả các lớp</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Trạng thái BGH:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Chưa duyệt">🔴 Chưa duyệt</option>
              <option value="Đã duyệt">🟢 Đã duyệt</option>
              <option value="Điều chỉnh">🔵 Điều chỉnh</option>
              <option value="Yêu cầu bổ sung">🟡 Yêu cầu bổ sung</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên học sinh, lớp..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3.5 min-w-[180px]">Học sinh / Lớp</th>
                <th className="p-3.5 min-w-[160px]">Loại vi phạm & Mức độ</th>
                <th className="p-3.5 min-w-[220px]">Nội dung & Minh chứng</th>
                <th className="p-3.5 min-w-[180px]">Đề xuất của GVCN</th>
                <th className="p-3.5 min-w-[140px] text-center">Trạng thái BGH</th>
                <th className="p-3.5 min-w-[220px] text-center">Thao tác BGH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {bghTargetRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 size={36} className="text-emerald-500" />
                      <p className="font-bold text-slate-700">Không có trường hợp vi phạm nghiêm trọng nào cần duyệt.</p>
                      <p className="text-xs text-slate-400">Toàn bộ vi phạm đã được xử lý hoặc chưa phát sinh vi phạm nghiêm trọng.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                bghTargetRecords.map((rec) => {
                  const student = students.find(s => s.id === rec.studentId);
                  const status = rec.bghApprovalStatus || 'Chưa duyệt';

                  let statusBadge = 'bg-rose-100 text-rose-800 border-rose-300';
                  if (status === 'Đã duyệt') statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
                  if (status === 'Điều chỉnh') statusBadge = 'bg-blue-100 text-blue-800 border-blue-300 font-bold';
                  if (status === 'Yêu cầu bổ sung') statusBadge = 'bg-amber-100 text-amber-800 border-amber-300 font-bold';

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* Học sinh / Lớp */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-sm">{rec.studentName}</div>
                        <div className="text-xs text-slate-500">Lớp: <span className="font-semibold text-slate-800">{rec.className}</span></div>
                        <div className="text-[11px] text-slate-400">Ngày: {rec.recordDate}</div>
                      </td>

                      {/* Vi phạm */}
                      <td className="p-3.5 space-y-1">
                        <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {rec.categoryType || rec.criterionName}
                        </span>
                        <div>
                          <span className="text-[11px] font-semibold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                            {rec.level || 'Nghiêm trọng'} ({rec.point} điểm)
                          </span>
                        </div>
                      </td>

                      {/* Nội dung & Minh chứng */}
                      <td className="p-3.5 space-y-1">
                        <p className="text-slate-800 font-medium leading-tight">{rec.note || rec.criterionName}</p>
                        {rec.location && (
                          <p className="text-[11px] text-slate-500">📍 {rec.location}</p>
                        )}
                        {rec.evidenceUrl ? (
                          <button
                            type="button"
                            onClick={() => setActiveEvidenceUrl(rec.evidenceUrl || null)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer pt-1"
                          >
                            <ExternalLink size={13} />
                            <span>Xem minh chứng đính kèm</span>
                          </button>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">Chưa có file minh chứng</p>
                        )}
                      </td>

                      {/* Đề xuất GVCN */}
                      <td className="p-3.5 space-y-1">
                        <p className="font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 text-xs">
                          {rec.proposedRating || 'Chưa đạt – cần xem xét'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          GVCN: <span className="font-medium text-slate-800">{rec.recordedByName}</span>
                        </p>
                      </td>

                      {/* Trạng thái BGH */}
                      <td className="p-3.5 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs border ${statusBadge}`}>
                          {status}
                        </span>
                        {rec.bghComment && (
                          <p className="text-[10.5px] text-slate-500 mt-1 italic max-w-[150px] mx-auto truncate" title={rec.bghComment}>
                            💬 {rec.bghComment}
                          </p>
                        )}
                      </td>

                      {/* Thao tác BGH */}
                      <td className="p-3.5 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {student && (
                            <button
                              type="button"
                              onClick={() => onViewStudentProfile(student)}
                              className="px-2.5 py-1.2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              title="Xem toàn bộ hồ sơ rèn luyện"
                            >
                              <Eye size={13} /> Hồ sơ
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleApproveRecord(rec)}
                            className="px-2.5 py-1.2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                            title="Đồng ý với đề xuất của GVCN"
                          >
                            <Check size={13} /> Đồng ý
                          </button>

                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => {
                              setAdjustModalRecord(rec);
                              setAdjustRating('Khá');
                              setAdjustComment('');
                            }}
                            className="px-2.5 py-1.2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            title="Điều chỉnh mức rèn luyện"
                          >
                            <Edit3 size={13} /> Điều chỉnh
                          </button>

                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleRequestMoreInfo(rec)}
                            className="px-2.5 py-1.2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            title="Yêu cầu GVCN bổ sung minh chứng"
                          >
                            <MessageSquare size={13} /> Bổ sung
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal View Evidence */}
      {activeEvidenceUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <ExternalLink size={18} className="text-blue-600" />
                <span>Minh chứng vi phạm đính kèm</span>
              </h3>
              <button
                onClick={() => setActiveEvidenceUrl(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm px-2 py-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center min-h-[200px]">
              {activeEvidenceUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
                <img 
                  src={activeEvidenceUrl} 
                  alt="Minh chứng vi phạm" 
                  className="max-h-[350px] object-contain rounded-lg shadow-md"
                />
              ) : (
                <div className="text-center space-y-3">
                  <FileText size={48} className="text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-600 font-medium">Tệp đính kèm: {activeEvidenceUrl}</p>
                  <a
                    href={activeEvidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md"
                  >
                    Mở liên kết file minh chứng ↗
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveEvidenceUrl(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adjust Rating */}
      {adjustModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Edit3 size={18} className="text-blue-600" />
                <span>Ban Giám hiệu Điều chỉnh Kết quả Rèn luyện</span>
              </h3>
              <button
                onClick={() => setAdjustModalRecord(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm px-2 py-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-700">
                Học sinh: <strong className="text-slate-900 font-bold">{adjustModalRecord.studentName} ({adjustModalRecord.className})</strong>
              </p>
              <p className="text-slate-700">
                Vi phạm: <span className="font-semibold text-rose-700">{adjustModalRecord.categoryType || adjustModalRecord.criterionName}</span>
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mức xếp loại BGH điều chỉnh:
                </label>
                <select
                  value={adjustRating}
                  onChange={(e) => setAdjustRating(e.target.value as ClassificationType)}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Tốt">Tốt</option>
                  <option value="Khá">Khá</option>
                  <option value="Đạt">Đạt</option>
                  <option value="Chưa đạt">Chưa đạt</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lý do / Ý kiến điều chỉnh của BGH:
                </label>
                <textarea
                  rows={3}
                  value={adjustComment}
                  onChange={(e) => setAdjustComment(e.target.value)}
                  placeholder="Nhập căn cứ hoặc lý do điều chỉnh..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustModalRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAdjust}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
              >
                Lưu điều chỉnh
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
