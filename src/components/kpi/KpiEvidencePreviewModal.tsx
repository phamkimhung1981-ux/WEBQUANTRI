import React from 'react';
import { X, Download, FileText, FileSpreadsheet, Presentation, Image as ImageIcon, ExternalLink, AlertTriangle } from 'lucide-react';
import { KpiEvidenceFile } from '../../types/kpiEvidence';
import { formatFileSize } from '../../services/kpiEvidenceService';

interface KpiEvidencePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: KpiEvidenceFile | null;
}

export default function KpiEvidencePreviewModal({
  isOpen,
  onClose,
  file
}: KpiEvidencePreviewModalProps) {
  if (!isOpen || !file) return null;

  const isImage = file.fileType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp'].some(ext => file.fileName.toLowerCase().endsWith(ext));
  const isPdf = file.fileType === 'application/pdf' || file.fileName.toLowerCase().endsWith('.pdf');
  const isWord = ['.doc', '.docx'].some(ext => file.fileName.toLowerCase().endsWith(ext)) || file.fileType.includes('word');
  const isExcel = ['.xls', '.xlsx'].some(ext => file.fileName.toLowerCase().endsWith(ext)) || file.fileType.includes('excel') || file.fileType.includes('spreadsheet');
  const isPpt = ['.ppt', '.pptx'].some(ext => file.fileName.toLowerCase().endsWith(ext)) || file.fileType.includes('powerpoint') || file.fileType.includes('presentation');

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = file.fileUrl;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="p-2 rounded-xl bg-white/10 text-blue-300 shrink-0">
              {isImage && <ImageIcon size={20} />}
              {isPdf && <FileText size={20} className="text-rose-400" />}
              {isWord && <FileText size={20} className="text-blue-400" />}
              {isExcel && <FileSpreadsheet size={20} className="text-emerald-400" />}
              {isPpt && <Presentation size={20} className="text-amber-400" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white truncate" title={file.fileName}>
                {file.fileName}
              </h3>
              <p className="text-xs text-slate-400 truncate">
                Dung lượng: {formatFileSize(file.fileSize)} • Đăng bởi: <strong className="text-slate-200">{file.uploadedByName || file.uploadedBy}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
            >
              <Download size={14} /> Tải xuống
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 overflow-auto p-6 bg-slate-100 flex items-center justify-center min-h-[350px]">
          {isImage && (
            <div className="max-w-full max-h-full flex flex-col items-center justify-center">
              <img
                src={file.fileUrl}
                alt={file.fileName}
                className="max-h-[65vh] max-w-full object-contain rounded-xl shadow-md border border-slate-200 bg-white"
              />
            </div>
          )}

          {isPdf && (
            <iframe
              src={file.fileUrl}
              title={file.fileName}
              className="w-full h-[65vh] rounded-xl border border-slate-300 shadow-sm bg-white"
            />
          )}

          {!isImage && !isPdf && (
            <div className="bg-white rounded-2xl p-8 max-w-md text-center border border-slate-200 shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto">
                {isWord && <FileText size={32} className="text-blue-600" />}
                {isExcel && <FileSpreadsheet size={32} className="text-emerald-600" />}
                {isPpt && <Presentation size={32} className="text-amber-600" />}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base mb-1">{file.fileName}</h4>
                <p className="text-xs text-slate-500">
                  Tệp tài liệu <span className="font-semibold text-slate-700">{file.fileType || 'Văn bản'}</span> ({formatFileSize(file.fileSize)}).
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-left flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Trình duyệt không hỗ trợ xem trực tiếp định dạng tài liệu Office trên khung xem. Nhấn nút bên dưới để tải tệp minh chứng về máy.
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={16} /> Tải xuống tệp minh chứng
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
          <span>
            Tiêu chí: <strong>{file.criterionCode || file.criterionId}</strong> • Mã phiếu: <span className="font-mono">{file.formId}</span>
          </span>
          <span>
            Thời gian tải lên: {new Date(file.uploadedAt).toLocaleString('vi-VN')}
          </span>
        </div>
      </div>
    </div>
  );
}
