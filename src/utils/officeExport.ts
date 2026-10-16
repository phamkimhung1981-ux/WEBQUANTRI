import * as XLSX from 'xlsx';
import { OfficeTask, OfficeDocument, OfficeStaffMember } from '../types/officeDepartment';
import { Teacher } from '../types';

export function exportOfficeSummaryToExcel(
  staffList: Teacher[],
  tasks: OfficeTask[],
  documents: OfficeDocument[]
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Danh sách Nhân sự Tổ Văn phòng
  const staffRows = staffList.map((s, idx) => ({
    'STT': idx + 1,
    'Mã Nhân viên': s.code || `NV00${idx + 1}`,
    'Họ và tên': s.name,
    'Chức danh / Vị trí': s.position || 'Nhân viên hành chính',
    'Tổ chuyên môn / Bộ phận': 'Tổ Văn phòng',
    'Số điện thoại': s.phone || '—',
    'Email': s.email || '—',
    'Chuyên môn / Trình độ': s.degree || 'Đại học',
    'Trạng thái công tác': s.status || 'Đang công tác'
  }));
  const wsStaff = XLSX.utils.json_to_sheet(staffRows);
  XLSX.utils.book_append_sheet(wb, wsStaff, 'Danh sách Nhân sự');

  // Sheet 2: Lịch Giao việc Tổ Văn phòng
  const taskRows = tasks.map((t, idx) => ({
    'STT': idx + 1,
    'Tên nhiệm vụ / Công việc': t.title,
    'Mảng công tác': t.category,
    'Người thực hiện': t.assigneeName,
    'Mức độ ưu tiên': t.priority,
    'Ngày bắt đầu': t.startDate,
    'Hạn hoàn thành': t.dueDate,
    'Tiến độ (%)': `${t.progressPercent}%`,
    'Trạng thái': t.status,
    'Yêu cầu minh chứng': t.evidenceRequirement || '—',
    'Ghi chú': t.notes || '—'
  }));
  const wsTasks = XLSX.utils.json_to_sheet(taskRows);
  XLSX.utils.book_append_sheet(wb, wsTasks, 'Lịch Giao việc');

  // Sheet 3: Quản lý Công văn & Văn bản
  const docRows = documents.map((d, idx) => ({
    'STT': idx + 1,
    'Số / Ký hiệu': d.dispatchCode,
    'Loại văn bản': d.type,
    'Trích yếu nội dung': d.title,
    'Cơ quan ban hành': d.issuingAgency,
    'Ngày nhận / Ban hành': d.receiptDate,
    'Lĩnh vực': d.category,
    'Cán bộ xử lý': d.handlerName,
    'Trạng thái': d.status
  }));
  const wsDocs = XLSX.utils.json_to_sheet(docRows);
  XLSX.utils.book_append_sheet(wb, wsDocs, 'Công văn & Văn bản');

  // Download File
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Bao_Cao_Tong_Hop_To_Van_Phong_THPT_Son_Luong_${dateStr}.xlsx`);
}
