import React, { useState, useRef } from 'react';
import { 
  Paperclip, 
  Upload, 
  Eye, 
  Download, 
  Trash2, 
  FileText, 
  FileSpreadsheet, 
  Presentation, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Plus,
  File
} from 'lucide-react';
import { KpiEvidenceFile } from '../../types/kpiEvidence';
import { 
  validateEvidenceFile, 
  saveEvidenceFile, 
  deleteEvidenceFile, 
  fileToDataUrl, 
  formatFileSize 
} from '../../services/kpiEvidenceService';
import KpiEvidencePreviewModal from './KpiEvidencePreviewModal';

interface KpiCriterionEvidenceCellProps {
  formId: string;
  criterionId: string;
  criterionCode?: string;
  groupId?: string;
  groupName?: string;
  employeeId: string;
  employeeName?: string;
  academicYear?: string;
  periodId?: string;
  evidenceFiles: KpiEvidenceFile[];
  canUpload: boolean;
  canDelete?: boolean;
  isLocked?: boolean;
  note?: string;
  onNoteChange?: (newNote: string) => void;
  currentUserId?: string;
  currentUserName?: string;
  onFilesUpdated?: (deletedFileId?: string) => void;
}

export default function KpiCriterionEvidenceCell({
  formId,
  criterionId,
  criterionCode,
  groupId,
  groupName,
  employeeId,
  employeeName,
  academicYear,
  periodId,
  evidenceFiles,
  canUpload,
  canDelete,
  isLocked,
  note = '',
  onNoteChange,
  currentUserId,
  currentUserName,
  onFilesUpdated
}: KpiCriterionEvidenceCellProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<KpiEvidenceFile | null>(null);

  // Filter files belonging to this criterion
  const criterionFiles = evidenceFiles.filter(f => f.criterionId === criterionId);

  // Allow delete if explicitly granted or defaults to canUpload, provided form is not locked
  const allowDelete = (canDelete !== undefined ? canDelete : canUpload) && !isLocked;

  // Trigger hidden file picker
  const handlePickFiles = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle uploaded files
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        // 1. Validation
        const validation = validateEvidenceFile(file);
        if (!validation.valid) {
          setErrorMessage(validation.error || 'Tệp không hợp lệ');
          setIsUploading(false);
          return;
        }

        // 2. Read file to Base64
        const dataUrl = await fileToDataUrl(file);
        const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

        // 3. Create evidence file item
        const evidenceItem: KpiEvidenceFile = {
          id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          formId,
          criterionId,
          criterionCode: criterionCode || criterionId,
          groupId,
          groupName,
          employeeId,
          employeeName,
          academicYear,
          periodId,
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileExtension: fileExt,
          fileSize: file.size,
          fileUrl: dataUrl,
          uploadedBy: currentUserId || 'system',
          uploadedByName: currentUserName || 'Giáo viên',
          uploadedAt: new Date().toISOString(),
          status: 'completed'
        };

        // 4. Save to persistent storage & database
        await saveEvidenceFile(evidenceItem);
      }

      setSuccessMessage(`Tải lên minh chứng thành công (${selectedFiles.length} tệp).`);
      setTimeout(() => setSuccessMessage(null), 3000);
      if (onFilesUpdated) onFilesUpdated();
    } catch (err: any) {
      console.error('Lỗi khi tải tệp minh chứng:', err);
      setErrorMessage(err.message || 'Có lỗi xảy ra khi lưu tệp minh chứng. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle delete file
  const handleDeleteFile = async (fileId: string, fileName: string) => {
    console.log(`[KPI Evidence Cell UI] Sự kiện click xóa tệp kích hoạt: ID=${fileId}, tên tệp="${fileName}"`);

    if (isLocked) {
      console.warn(`[KPI Evidence Cell UI] Không thể xóa tệp "${fileName}": Phiếu đã bị khóa.`);
      alert('Phiếu KPI đã bị khóa. Không thể xóa minh chứng.');
      return;
    }

    if (!window.confirm('Thầy/cô có chắc chắn muốn xóa minh chứng này không?')) {
      console.log(`[KPI Evidence Cell UI] Người dùng đã hủy xác nhận xóa tệp "${fileName}".`);
      return;
    }

    setDeletingFileId(fileId);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Immediately trigger UI update for instant feedback
    if (onFilesUpdated) {
      onFilesUpdated(fileId);
    }

    try {
      console.log(`[KPI Evidence Cell UI] Đang gọi dịch vụ deleteEvidenceFile cho ID=${fileId}...`);
      const res = await deleteEvidenceFile(fileId, formId, {
        isLocked,
        currentUserId,
        currentUserName
      });

      if (res.success) {
        console.log(`[KPI Evidence Cell UI] Xóa tệp ID=${fileId} thành công.`);
        setSuccessMessage(`Đã xóa minh chứng "${fileName}" thành công.`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        console.error(`[KPI Evidence Cell UI] Xóa tệp ID=${fileId} thất bại: ${res.error}`);
        setErrorMessage(res.error || 'Không thể xóa tệp minh chứng. Vui lòng thử lại.');
      }
    } catch (err: any) {
      console.error('[KPI Evidence Cell UI] Ngoại lệ xảy ra khi xóa minh chứng:', err);
      setErrorMessage(err.message || 'Có lỗi xảy ra khi xóa minh chứng.');
    } finally {
      setDeletingFileId(null);
    }
  };

  // Download file
  const handleDownload = (file: KpiEvidenceFile) => {
    const a = document.createElement('a');
    a.href = file.fileUrl;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // File icon lookup
  const getFileIcon = (file: KpiEvidenceFile) => {
    const fn = file.fileName.toLowerCase();
    if (file.fileType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp'].some(ext => fn.endsWith(ext))) {
      return <ImageIcon size={14} className="text-blue-500 shrink-0" />;
    }
    if (file.fileType === 'application/pdf' || fn.endsWith('.pdf')) {
      return <FileText size={14} className="text-rose-500 shrink-0" />;
    }
    if (['.doc', '.docx'].some(ext => fn.endsWith(ext))) {
      return <FileText size={14} className="text-blue-600 shrink-0" />;
    }
    if (['.xls', '.xlsx'].some(ext => fn.endsWith(ext))) {
      return <FileSpreadsheet size={14} className="text-emerald-600 shrink-0" />;
    }
    if (['.ppt', '.pptx'].some(ext => fn.endsWith(ext))) {
      return <Presentation size={14} className="text-amber-600 shrink-0" />;
    }
    return <File size={14} className="text-slate-500 shrink-0" />;
  };

  return (
    <div className="space-y-2 min-w-[200px]">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
        onChange={handleFilesSelected}
        className="hidden"
      />

      {/* Note Input */}
      {onNoteChange ? (
        <input
          type="text"
          disabled={isLocked}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Ghi chú minh chứng..."
          className="w-full p-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-normal disabled:bg-slate-100 disabled:opacity-75"
        />
      ) : note ? (
        <p className="text-xs text-slate-700 italic font-normal">{note}</p>
      ) : null}

      {/* Upload Button */}
      {canUpload && !isLocked && (
        <div>
          <button
            type="button"
            onClick={handlePickFiles}
            disabled={isUploading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Đang tải tệp...</span>
              </>
            ) : (
              <>
                <Plus size={13} />
                <span>+ Tải minh chứng</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 flex items-start gap-1.5">
          <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 flex items-start gap-1.5">
          <AlertCircle size={13} className="text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Files List */}
      {criterionFiles.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {criterionFiles.map((f) => (
            <div
              key={f.id}
              className="p-1.5 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-[11px] group transition-all"
            >
              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                {getFileIcon(f)}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate max-w-[130px]" title={f.fileName}>
                    {f.fileName}
                  </p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <span>{formatFileSize(f.fileSize)}</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                      <CheckCircle2 size={10} /> Đã lưu
                    </span>
                  </p>
                </div>
              </div>

              {/* Action Buttons: Preview, Download, Delete */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewFile(f)}
                  title="Xem trước minh chứng"
                  className="p-1 text-slate-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                >
                  <Eye size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(f)}
                  title="Tải xuống tệp minh chứng"
                  className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                >
                  <Download size={13} />
                </button>
                {allowDelete && (
                  <button
                    type="button"
                    disabled={deletingFileId === f.id}
                    onClick={() => handleDeleteFile(f.id, f.fileName)}
                    title="Xóa tệp minh chứng"
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {deletingFileId === f.id ? (
                      <Loader2 size={13} className="animate-spin text-rose-600" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <KpiEvidencePreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
      />
    </div>
  );
}
