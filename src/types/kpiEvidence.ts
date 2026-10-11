export interface KpiEvidenceFile {
  id: string;
  formId: string;           // Mã phiếu KPI
  criterionId: string;      // ID/Mã tiêu chí
  criterionCode?: string;   // Mã tiêu chí (e.g. 'I.1', 'GV01')
  groupId?: string;         // ID nhóm tiêu chí
  groupName?: string;       // Tên nhóm tiêu chí
  employeeId: string;       // ID người được đánh giá
  employeeName?: string;    // Tên người được đánh giá
  academicYear?: string;    // Năm học
  periodId?: string;        // ID kỳ đánh giá
  fileName: string;         // Tên tệp
  fileType: string;         // Loại tệp MIME
  fileExtension?: string;   // Đuôi tệp (.pdf, .docx, .xlsx...)
  fileSize: number;         // Kích thước bytes
  fileUrl: string;          // Data URL (base64) hoặc Blob/Storage URL
  uploadedBy: string;       // ID người tải lên
  uploadedByName?: string;  // Tên người tải lên
  uploadedAt: string;       // Ngày giờ tải lên ISO
  status?: 'completed' | 'uploading' | 'error';
  note?: string;            // Ghi chú đính kèm
}

export const ALLOWED_EVIDENCE_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp'
];

export const ALLOWED_EVIDENCE_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

export const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
