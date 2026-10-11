import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  VerticalAlign,
  ShadingType
} from 'docx';
import { KpiVcForm } from '../types/kpiVc';
import { KpiCbqlForm } from '../types/kpiCbql';

/**
 * Loại bỏ dấu tiếng Việt để tạo tên file chuẩn
 */
export function removeVietnameseAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Cấu trúc tên file theo yêu cầu: PHIEU_DANH_GIA_VIEN_CHUC_[HO_TEN]_[NAM_HOC].docx
 */
export function generateWordFileName(name: string, academicYear: string): string {
  const cleanName = removeVietnameseAccents(name || 'CAN_BO').toUpperCase();
  const cleanYear = (academicYear || '2026-2027').replace(/[^a-zA-Z0-9-]/g, '');
  return `PHIEU_DANH_GIA_VIEN_CHUC_${cleanName}_${cleanYear}.docx`;
}

// Bảng viền chuẩn
const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '888888' },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '888888' },
};

// Khung không viền (Cho Header và Chữ ký)
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

/**
 * Xuất Phiếu đánh giá KPI Giáo viên / Viên chức ra file Word (.docx) chuẩn Microsoft Word OpenXML
 */
export const exportVcFormToWord = async (form: KpiVcForm): Promise<void> => {
  if (!form || !form.id) {
    alert('Vui lòng lưu phiếu trước khi xuất Word.');
    return;
  }

  try {
    const groupI = form.groupScores?.group_I ?? 0;
    const groupII = form.groupScores?.group_II ?? 0;
    const groupIII = form.groupScores?.group_III ?? 0;

    const ttcmGroupI = form.ttcmGroupScores?.group_I !== undefined && form.ttcmGroupScores?.group_I !== null ? `${form.ttcmGroupScores.group_I}` : '---';
    const ttcmGroupII = form.ttcmGroupScores?.group_II !== undefined && form.ttcmGroupScores?.group_II !== null ? `${form.ttcmGroupScores.group_II}` : '---';
    const ttcmGroupIII = form.ttcmGroupScores?.group_III !== undefined && form.ttcmGroupScores?.group_III !== null ? `${form.ttcmGroupScores.group_III}` : '---';

    const mgrGroupI = form.managerGroupScores?.group_I !== undefined && form.managerGroupScores?.group_I !== null ? `${form.managerGroupScores.group_I}` : '---';
    const mgrGroupII = form.managerGroupScores?.group_II !== undefined && form.managerGroupScores?.group_II !== null ? `${form.managerGroupScores.group_II}` : '---';
    const mgrGroupIII = form.managerGroupScores?.group_III !== undefined && form.managerGroupScores?.group_III !== null ? `${form.managerGroupScores.group_III}` : '---';

    const items = form.items || [];
    const groupIItems = items.filter(it => it.groupId === 'group_I');
    const groupIIItems = items.filter(it => it.groupId === 'group_II');
    const groupIIIItems = items.filter(it => it.groupId === 'group_III');

    const groupIIIaItems = groupIIIItems.filter(it => it.subGroup === 'A' || it.criterionCode?.startsWith('III.A') || it.criterionCode === 'III.1');
    const groupIIIbItems = groupIIIItems.filter(it => it.subGroup === 'B' || it.criterionCode?.startsWith('GV') || it.criterionCode?.startsWith('III.B') || it.criterionCode === 'III.2');

    // Bảng tiêu đề quốc hiệu & trường
    const headerTable = new Table({
      width: { size: 9600, type: WidthType.DXA },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4400, type: WidthType.DXA },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'SỞ GD&ĐT PHÚ THỌ', bold: true, size: 21, font: 'Times New Roman' })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'TRƯỜNG THPT SƠN LƯƠNG', bold: true, size: 22, font: 'Times New Roman' })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: '-----------------------', size: 18, font: 'Times New Roman' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 5200, type: WidthType.DXA },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 21, font: 'Times New Roman' })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'Độc lập – Tự do – Hạnh phúc', bold: true, size: 22, font: 'Times New Roman' })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: '-----------------------', size: 18, font: 'Times New Roman' })],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    // Dòng dữ liệu cho bảng tiêu chí
    const dataTableRows: TableRow[] = [
      // Header Bảng
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 600, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'STT', bold: true, size: 19, font: 'Times New Roman' })] })],
          }),
          new TableCell({
            width: { size: 3600, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NỘI DUNG ĐÁNH GIÁ', bold: true, size: 19, font: 'Times New Roman' })] })],
          }),
          new TableCell({
            width: { size: 800, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ĐIỂM TỐI ĐA', bold: true, size: 18, font: 'Times New Roman' })] })],
          }),
          new TableCell({
            width: { size: 1100, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'GIÁO VIÊN TỰ CHẤM', bold: true, size: 18, font: 'Times New Roman' })] })],
          }),
          new TableCell({
            width: { size: 1100, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'TTCM ĐÁNH GIÁ', bold: true, size: 18, font: 'Times New Roman' })] })],
          }),
          new TableCell({
            width: { size: 1100, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CBQL ĐÁNH GIÁ', bold: true, size: 18, font: 'Times New Roman' })] })],
          }),
          new TableCell({
            width: { size: 1300, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'GHI CHÚ / MINH CHỨNG', bold: true, size: 18, font: 'Times New Roman' })] })],
          }),
        ],
      }),

      // NHÓM I
      new TableRow({
        children: [
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'I', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'CHÍNH TRỊ TƯ TƯỞNG, ĐẠO ĐỨC LỐI SỐNG', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '15', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${groupI}`, bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: ttcmGroupI, bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: mgrGroupI, bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [] })] }),
        ],
      }),
      ...groupIItems.map((item, idx) => {
        const noteText = [item.selectedLevelName ? `[${item.selectedLevelName}]` : '', item.note || ''].filter(Boolean).join(' - ');
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${idx + 1}`, size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.content || '', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.maxScore}`, size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.selfScore ?? 0}`, bold: true, color: '1D4ED8', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.ttcmScore !== undefined && item.ttcmScore !== null ? `${item.ttcmScore}` : '---', bold: true, color: '7E22CE', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.managerScore !== undefined && item.managerScore !== null ? `${item.managerScore}` : '---', bold: true, color: 'B45309', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: noteText, size: 18, font: 'Times New Roman' })] })] }),
          ],
        });
      }),

      // NHÓM II
      new TableRow({
        children: [
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'II', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'TÁC PHONG, LỀ LỐI LÀM VIỆC, Ý THỨC TỔ CHỨC KỶ LUẬT', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '15', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${groupII}`, bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: ttcmGroupII, bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: mgrGroupII, bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [] })] }),
        ],
      }),
      ...groupIIItems.map((item, idx) => {
        const noteText = [item.selectedLevelName ? `[${item.selectedLevelName}]` : '', item.note || ''].filter(Boolean).join(' - ');
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${idx + 1}`, size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.content || '', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.maxScore}`, size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.selfScore ?? 0}`, bold: true, color: '1D4ED8', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.ttcmScore !== undefined && item.ttcmScore !== null ? `${item.ttcmScore}` : '---', bold: true, color: '7E22CE', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.managerScore !== undefined && item.managerScore !== null ? `${item.managerScore}` : '---', bold: true, color: 'B45309', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: noteText, size: 18, font: 'Times New Roman' })] })] }),
          ],
        });
      }),

      // NHÓM III
      new TableRow({
        children: [
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'III', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'KẾT QUẢ THỰC HIỆN NHIỆM VỤ', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '70', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${groupIII}`, bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: ttcmGroupIII, bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: mgrGroupIII, bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [] })] }),
        ],
      }),

      // III.A
      new TableRow({
        children: [
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'A', bold: true, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'A. NĂNG LỰC VÀ KỸ NĂNG LÀM VIỆC (10 ĐIỂM)', bold: true, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '10', bold: true, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${groupIIIaItems.reduce((acc, i) => acc + (i.selfScore || 0), 0)}`, bold: true, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: groupIIIaItems.some(i => i.ttcmScore != null) ? `${groupIIIaItems.reduce((acc, i) => acc + (i.ttcmScore || 0), 0)}` : '---', bold: true, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: groupIIIaItems.some(i => i.managerScore != null) ? `${groupIIIaItems.reduce((acc, i) => acc + (i.managerScore || 0), 0)}` : '---', bold: true, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [] })] }),
        ],
      }),
      ...groupIIIaItems.map((item, idx) => {
        const noteText = [item.selectedLevelName ? `[${item.selectedLevelName}]` : '', item.note || ''].filter(Boolean).join(' - ');
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${idx + 1}`, size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.content || '', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.maxScore}`, size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.selfScore ?? 0}`, bold: true, color: '1D4ED8', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.ttcmScore !== undefined && item.ttcmScore !== null ? `${item.ttcmScore}` : '---', bold: true, color: '7E22CE', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.managerScore !== undefined && item.managerScore !== null ? `${item.managerScore}` : '---', bold: true, color: 'B45309', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: noteText, size: 18, font: 'Times New Roman' })] })] }),
          ],
        });
      }),

      // III.B
      new TableRow({
        children: [
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'B', bold: true, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'B. KẾT QUẢ THỰC HIỆN NHIỆM VỤ ĐƯỢC GIAO (60 ĐIỂM)', bold: true, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '60', bold: true, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${groupIIIbItems.reduce((acc, i) => acc + (i.selfScore || 0), 0)}`, bold: true, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: groupIIIbItems.some(i => i.ttcmScore != null) ? `${groupIIIbItems.reduce((acc, i) => acc + (i.ttcmScore || 0), 0)}` : '---', bold: true, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: groupIIIbItems.some(i => i.managerScore != null) ? `${groupIIIbItems.reduce((acc, i) => acc + (i.managerScore || 0), 0)}` : '---', bold: true, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F8FAFC', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [] })] }),
        ],
      }),
      ...groupIIIbItems.map((item, idx) => {
        const noteText = [item.selectedLevelName ? `[${item.selectedLevelName}]` : '', item.note || ''].filter(Boolean).join(' - ');
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${idx + 1}`, size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.content || '', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.maxScore}`, size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.selfScore ?? 0}`, bold: true, color: '1D4ED8', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.ttcmScore !== undefined && item.ttcmScore !== null ? `${item.ttcmScore}` : '---', bold: true, color: '7E22CE', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.managerScore !== undefined && item.managerScore !== null ? `${item.managerScore}` : '---', bold: true, color: 'B45309', size: 19, font: 'Times New Roman' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: noteText, size: 18, font: 'Times New Roman' })] })] }),
          ],
        });
      }),

      // TỔNG CỘNG
      new TableRow({
        children: [
          new TableCell({ columnSpan: 2, shading: { fill: 'FEF3C7', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'TỔNG ĐIỂM KPI (100 ĐIỂM TỐI ĐA)', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'FEF3C7', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '100', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'FEF3C7', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${form.totalScore}`, bold: true, color: '1D4ED8', size: 21, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'FEF3C7', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: form.ttcmTotalScore !== null && form.ttcmTotalScore !== undefined ? `${form.ttcmTotalScore}` : '---', bold: true, color: '7E22CE', size: 21, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'FEF3C7', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: form.managerTotalScore !== null && form.managerTotalScore !== undefined ? `${form.managerTotalScore}` : '---', bold: true, color: 'B45309', size: 21, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'FEF3C7', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [] })] }),
        ],
      }),
    ];

    const dataTable = new Table({
      width: { size: 9600, type: WidthType.DXA },
      borders: tableBorders,
      rows: dataTableRows,
    });

    // Bảng Chữ ký cuối phiếu
    const signatureTable = new Table({
      width: { size: 9600, type: WidthType.DXA },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 3200, type: WidthType.DXA },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NGƯỜI TỰ ĐÁNH GIÁ', bold: true, size: 20, font: 'Times New Roman' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký, ghi rõ họ tên)', italics: true, size: 18, font: 'Times New Roman' })] }),
                new Paragraph({ children: [new TextRun({ text: '\n\n\n\n', size: 20 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: form.employeeName, bold: true, size: 20, font: 'Times New Roman' })] }),
              ],
            }),
            new TableCell({
              width: { size: 3200, type: WidthType.DXA },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'TỔ TRƯỜNG CHUYÊN MÔN', bold: true, size: 20, font: 'Times New Roman' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký, ghi rõ họ tên)', italics: true, size: 18, font: 'Times New Roman' })] }),
                new Paragraph({ children: [new TextRun({ text: '\n\n\n\n', size: 20 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: form.ttcmEvaluatorName || '...............................', bold: true, size: 20, font: 'Times New Roman' })] }),
              ],
            }),
            new TableCell({
              width: { size: 3200, type: WidthType.DXA },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BAN GIÁM HIỆU PHÊ DUYỆT', bold: true, size: 20, font: 'Times New Roman' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'DUYỆT', bold: true, size: 20, font: 'Times New Roman' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký, ghi rõ họ tên)', italics: true, size: 18, font: 'Times New Roman' })] }),
                new Paragraph({ children: [new TextRun({ text: '\n\n\n', size: 20 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: form.bghEvaluatorName || form.evaluatorName || '...............................', bold: true, size: 20, font: 'Times New Roman' })] }),
              ],
            }),
          ],
        }),
      ],
    });

    // Tạo Document
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 }
            }
          },
          children: [
            headerTable,
            new Paragraph({ text: '', spacing: { before: 150, after: 100 } }),
            
            // TIÊU ĐỀ PHIẾU
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 60 },
              children: [
                new TextRun({
                  text: `PHIẾU ĐÁNH GIÁ, CHẤM ĐIỂM KPI GIÁO VIÊN NĂM HỌC ${form.academicYear || '2026–2027'}`,
                  bold: true,
                  size: 26,
                  font: 'Times New Roman'
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 200 },
              children: [
                new TextRun({
                  text: '(Dự thảo vận hành – đề nghị nhà trường xác nhận trước khi ban hành)',
                  italics: true,
                  size: 20,
                  font: 'Times New Roman'
                })
              ]
            }),

            // THÔNG TIN CÁ NHÂN
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({ text: 'Họ và tên: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: form.employeeName, bold: true, color: '1D4ED8', size: 22, font: 'Times New Roman' })
              ]
            }),
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({ text: 'Chức vụ / môn: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: `${form.position || 'Giáo viên'} ${form.subject ? `• Môn ${form.subject}` : ''}`, size: 22, font: 'Times New Roman' })
              ]
            }),
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({ text: 'Tổ chuyên môn: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: form.department || 'Trường THPT Sơn Lương', size: 22, font: 'Times New Roman' })
              ]
            }),
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({ text: 'Tổ trưởng chuyên môn đánh giá: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: form.ttcmEvaluatorName || '....................', size: 22, font: 'Times New Roman' }),
                new TextRun({ text: '        Tổ: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: form.ttcmEvaluatorDepartment || form.department || '....................', size: 22, font: 'Times New Roman' })
              ]
            }),
            new Paragraph({
              spacing: { before: 40, after: 200 },
              children: [
                new TextRun({ text: 'Ban Giám hiệu đánh giá: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: form.bghEvaluatorName || form.evaluatorName || '....................', size: 22, font: 'Times New Roman' }),
                new TextRun({ text: '        Chức vụ: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: form.bghEvaluatorRole || form.evaluatorRole || 'Ban Giám hiệu', size: 22, font: 'Times New Roman' })
              ]
            }),

            // CĂN CỨ MẪU PHIẾU
            new Paragraph({
              spacing: { before: 50, after: 150 },
              children: [
                new TextRun({
                  text: 'Căn cứ mẫu Phiếu đánh giá, chấm điểm năm học 2025–2026 của Trường THPT Sơn Lương, phiếu này giữ cấu trúc 100 điểm gồm: (I) Chính trị tư tưởng, đạo đức lối sống 15 điểm; (II) Tác phong, lề lối làm việc, ý thức tổ chức kỷ luật 15 điểm; (III) Kết quả thực hiện nhiệm vụ 70 điểm. Các nhiệm vụ ở phần III được chi tiết hóa để thuận lợi cho tự đánh giá, đánh giá của tổ chuyên môn và BGH.',
                  italics: true,
                  size: 20,
                  font: 'Times New Roman'
                })
              ]
            }),

            // BẢNG TIÊU CHÍ
            new Paragraph({
              spacing: { before: 100, after: 100 },
              children: [
                new TextRun({ text: 'A. NỘI DUNG CHẤM ĐIỂM', bold: true, size: 22, font: 'Times New Roman' })
              ]
            }),
            dataTable,

            // TỔNG KẾT VÀ XẾP LOẠI
            new Paragraph({
              spacing: { before: 200, after: 60 },
              children: [
                new TextRun({ text: 'B. TỔNG HỢP VÀ TỰ XẾP LOẠI', bold: true, size: 22, font: 'Times New Roman' })
              ]
            }),
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({ text: '• Tổng điểm Giáo viên tự chấm: ', bold: true, size: 21, font: 'Times New Roman' }),
                new TextRun({ text: `${form.totalScore} / 100 điểm`, bold: true, color: '1D4ED8', size: 21, font: 'Times New Roman' })
              ]
            }),
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({ text: '• Tổng điểm TTCM đánh giá: ', bold: true, size: 21, font: 'Times New Roman' }),
                new TextRun({ text: form.ttcmTotalScore !== null && form.ttcmTotalScore !== undefined ? `${form.ttcmTotalScore} / 100 điểm` : 'Chưa chấm', bold: true, color: '7E22CE', size: 21, font: 'Times New Roman' })
              ]
            }),
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({ text: '• Tổng điểm Ban Giám hiệu phê duyệt: ', bold: true, size: 21, font: 'Times New Roman' }),
                new TextRun({ text: form.managerTotalScore !== null && form.managerTotalScore !== undefined ? `${form.managerTotalScore} / 100 điểm` : 'Chưa chấm', bold: true, color: 'B45309', size: 21, font: 'Times New Roman' })
              ]
            }),
            new Paragraph({
              spacing: { before: 40, after: 150 },
              children: [
                new TextRun({ text: '• Cá nhân tự xếp loại: ', bold: true, size: 21, font: 'Times New Roman' }),
                new TextRun({ text: form.selfClassification || 'Chưa xếp loại', bold: true, color: '0F172A', size: 21, font: 'Times New Roman' }),
                new TextRun({ text: '        • Xếp loại chính thức: ', bold: true, size: 21, font: 'Times New Roman' }),
                new TextRun({ text: form.leaderClassification || form.bghClassification || form.ttcmClassification || form.selfClassification || 'Chưa xếp loại', bold: true, color: '047857', size: 21, font: 'Times New Roman' })
              ]
            }),

            // CHỮ KÝ
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 200, after: 100 },
              children: [
                new TextRun({ text: 'Sơn Lương, ngày ..... tháng ..... năm 2026', italics: true, size: 20, font: 'Times New Roman' })
              ]
            }),
            signatureTable
          ]
        }
      ]
    });

    const fileName = generateWordFileName(form.employeeName, form.academicYear);
    const blob = await Packer.toBlob(doc);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);

  } catch (error) {
    console.error('Lỗi khi xuất Word KPI Viên chức:', error);
    alert('Đã có lỗi xảy ra khi tạo file Word: ' + (error instanceof Error ? error.message : 'Không xác định'));
  }
};

/**
 * Xuất Phiếu đánh giá KPI Cán bộ Quản lý (CBQL) ra file Word (.docx) chuẩn Microsoft Word OpenXML
 */
export const exportCbqlFormToWord = async (form: KpiCbqlForm): Promise<void> => {
  if (!form || !form.id) {
    alert('Vui lòng lưu phiếu trước khi xuất Word.');
    return;
  }

  try {
    const items = form.items || [];
    const groupIItems = items.filter(it => it.groupId === 'group_I');
    const groupIIItems = items.filter(it => it.groupId === 'group_II');
    const groupIIIItems = items.filter(it => it.groupId === 'group_III');

    const headerTable = new Table({
      width: { size: 9600, type: WidthType.DXA },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4400, type: WidthType.DXA },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SỞ GD&ĐT PHÚ THỌ', bold: true, size: 21, font: 'Times New Roman' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'TRƯỜNG THPT SƠN LƯƠNG', bold: true, size: 22, font: 'Times New Roman' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '-----------------------', size: 18, font: 'Times New Roman' })] }),
              ],
            }),
            new TableCell({
              width: { size: 5200, type: WidthType.DXA },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 21, font: 'Times New Roman' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Độc lập – Tự do – Hạnh phúc', bold: true, size: 22, font: 'Times New Roman' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '-----------------------', size: 18, font: 'Times New Roman' })] }),
              ],
            }),
          ],
        }),
      ],
    });

    const dataTableRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 800, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Mã TC', bold: true, size: 19, font: 'Times New Roman' })] })],
          }),
          new TableCell({
            width: { size: 4800, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Tên Tiêu Chí & Nội Dung Đánh Giá', bold: true, size: 19, font: 'Times New Roman' })] })],
          }),
          new TableCell({
            width: { size: 1000, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Mức Tối Đa', bold: true, size: 18, font: 'Times New Roman' })] })],
          }),
          new TableCell({
            width: { size: 1500, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Tự Đánh Giá', bold: true, size: 18, font: 'Times New Roman' })] })],
          }),
          new TableCell({
            width: { size: 1500, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Thủ Trưởng Chấm', bold: true, size: 18, font: 'Times New Roman' })] })],
          }),
        ],
      }),

      // NHÓM I
      new TableRow({
        children: [
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'I', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'CHÍNH TRỊ TƯ TƯỞNG, ĐẠO ĐỨC LỐI SỐNG', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '15', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${form.selfGroupScores?.group_I || 0}`, bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${form.evaluatorGroupScores?.group_I || 0}`, bold: true, size: 20, font: 'Times New Roman' })] })] }),
        ],
      }),
      ...groupIItems.map(item => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.criterionCode, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.criterionName, size: 19, font: 'Times New Roman' }), item.selfLevelLabel ? new TextRun({ text: `\n- Chọn: ${item.selfLevelLabel}`, italics: true, size: 17, color: '555555', font: 'Times New Roman' }) : new TextRun({ text: '' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.maxScore}`, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.selfScore}`, bold: true, color: '1D4ED8', size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.evaluatorScore}`, bold: true, color: '047857', size: 19, font: 'Times New Roman' })] })] }),
        ],
      })),

      // NHÓM II
      new TableRow({
        children: [
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'II', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'TÁC PHONG, LỀ LỐI LÀM VIỆC, Ý THỨC TỔ CHỨC KỶ LUẬT', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '15', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${form.selfGroupScores?.group_II || 0}`, bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${form.evaluatorGroupScores?.group_II || 0}`, bold: true, size: 20, font: 'Times New Roman' })] })] }),
        ],
      }),
      ...groupIIItems.map(item => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.criterionCode, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.criterionName, size: 19, font: 'Times New Roman' }), item.selfLevelLabel ? new TextRun({ text: `\n- Chọn: ${item.selfLevelLabel}`, italics: true, size: 17, color: '555555', font: 'Times New Roman' }) : new TextRun({ text: '' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.maxScore}`, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.selfScore}`, bold: true, color: '1D4ED8', size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.evaluatorScore}`, bold: true, color: '047857', size: 19, font: 'Times New Roman' })] })] }),
        ],
      })),

      // NHÓM III
      new TableRow({
        children: [
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'III', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'KẾT QUẢ THỰC HIỆN NHIỆM VỤ ĐƯỢC GIAO', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '70', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${form.selfGroupScores?.group_III || 0}`, bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${form.evaluatorGroupScores?.group_III || 0}`, bold: true, size: 20, font: 'Times New Roman' })] })] }),
        ],
      }),
      ...groupIIIItems.map(item => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.criterionCode, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.criterionName, size: 19, font: 'Times New Roman' }), item.selfLevelLabel ? new TextRun({ text: `\n- Chọn: ${item.selfLevelLabel}`, italics: true, size: 17, color: '555555', font: 'Times New Roman' }) : new TextRun({ text: '' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.maxScore}`, size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.selfScore}`, bold: true, color: '1D4ED8', size: 19, font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.evaluatorScore}`, bold: true, color: '047857', size: 19, font: 'Times New Roman' })] })] }),
        ],
      })),

      // TỔNG CỘNG
      new TableRow({
        children: [
          new TableCell({ columnSpan: 2, shading: { fill: 'FEF3C7', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'TỔNG ĐIỂM ĐÁNH GIÁ (100 ĐIỂM TỐI ĐA)', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'FEF3C7', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '100', bold: true, size: 20, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'FEF3C7', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${form.selfTotalScore || 0}`, bold: true, color: '1D4ED8', size: 21, font: 'Times New Roman' })] })] }),
          new TableCell({ shading: { fill: 'FEF3C7', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${form.evaluatorTotalScore || 0}`, bold: true, color: '047857', size: 21, font: 'Times New Roman' })] })] }),
        ],
      }),
    ];

    const dataTable = new Table({
      width: { size: 9600, type: WidthType.DXA },
      borders: tableBorders,
      rows: dataTableRows,
    });

    const signatureTable = new Table({
      width: { size: 9600, type: WidthType.DXA },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4800, type: WidthType.DXA },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NGƯỜI TỰ ĐÁNH GIÁ', bold: true, size: 20, font: 'Times New Roman' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký và ghi rõ họ tên)', italics: true, size: 18, font: 'Times New Roman' })] }),
                new Paragraph({ children: [new TextRun({ text: '\n\n\n\n', size: 20 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: form.evaluateeName, bold: true, size: 20, font: 'Times New Roman' })] }),
              ],
            }),
            new TableCell({
              width: { size: 4800, type: WidthType.DXA },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'THỦ TRƯỜNG ĐÁNH GIÁ', bold: true, size: 20, font: 'Times New Roman' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký, ghi rõ họ tên và đóng dấu)', italics: true, size: 18, font: 'Times New Roman' })] }),
                new Paragraph({ children: [new TextRun({ text: '\n\n\n\n', size: 20 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: form.evaluatorName, bold: true, size: 20, font: 'Times New Roman' })] }),
              ],
            }),
          ],
        }),
      ],
    });

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 }
            }
          },
          children: [
            headerTable,
            new Paragraph({ text: '', spacing: { before: 150, after: 100 } }),
            
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 60 },
              children: [
                new TextRun({ text: 'PHIẾU ĐÁNH GIÁ, CHẤM ĐIỂM KPI CÁN BỘ QUẢN LÝ', bold: true, size: 26, font: 'Times New Roman' })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 200 },
              children: [
                new TextRun({ text: `${form.periodName} - NĂM HỌC ${form.academicYear}`, bold: true, size: 22, font: 'Times New Roman' })
              ]
            }),

            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({ text: 'Họ và tên người được đánh giá: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: form.evaluateeName, bold: true, color: '1D4ED8', size: 22, font: 'Times New Roman' })
              ]
            }),
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({ text: 'Chức vụ: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: form.evaluateePosition, size: 22, font: 'Times New Roman' })
              ]
            }),
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({ text: 'Đơn vị: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: form.evaluateeDepartmentName || 'Trường THPT Sơn Lương', size: 22, font: 'Times New Roman' })
              ]
            }),
            new Paragraph({
              spacing: { before: 40, after: 200 },
              children: [
                new TextRun({ text: 'Người đánh giá (Thủ trưởng): ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: `${form.evaluatorName} - ${form.evaluatorPosition}`, size: 22, font: 'Times New Roman' })
              ]
            }),

            dataTable,

            new Paragraph({
              spacing: { before: 150, after: 40 },
              children: [
                new TextRun({ text: 'Xếp loại chất lượng: ', bold: true, size: 21, font: 'Times New Roman' }),
                new TextRun({ text: form.grade || 'Chưa xếp loại', bold: true, color: '047857', size: 21, font: 'Times New Roman' })
              ]
            }),
            form.selfComment ? new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({ text: 'Tự nhận xét của CBQL: ', bold: true, size: 21, font: 'Times New Roman' }),
                new TextRun({ text: form.selfComment, size: 21, font: 'Times New Roman' })
              ]
            }) : new Paragraph({ text: '' }),
            form.evaluatorComment ? new Paragraph({
              spacing: { before: 40, after: 150 },
              children: [
                new TextRun({ text: 'Nhận xét của Thủ trưởng: ', bold: true, size: 21, font: 'Times New Roman' }),
                new TextRun({ text: form.evaluatorComment, size: 21, font: 'Times New Roman' })
              ]
            }) : new Paragraph({ text: '' }),

            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 200, after: 100 },
              children: [
                new TextRun({ text: 'Sơn Lương, ngày ..... tháng ..... năm 2026', italics: true, size: 20, font: 'Times New Roman' })
              ]
            }),
            signatureTable
          ]
        }
      ]
    });

    const fileName = generateWordFileName(form.evaluateeName, form.academicYear);
    const blob = await Packer.toBlob(doc);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);

  } catch (error) {
    console.error('Lỗi khi xuất Word KPI CBQL:', error);
    alert('Đã có lỗi xảy ra khi tạo file Word: ' + (error instanceof Error ? error.message : 'Không xác định'));
  }
};
