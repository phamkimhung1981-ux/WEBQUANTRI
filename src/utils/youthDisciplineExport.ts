import * as XLSX from 'xlsx';
import {
  Document as DocxDocument,
  Packer as DocxPacker,
  Paragraph as DocxParagraph,
  TextRun as DocxTextRun,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  WidthType as DocxWidthType,
  AlignmentType as DocxAlignmentType,
  BorderStyle as DocxBorderStyle,
  VerticalAlign as DocxVerticalAlign,
  PageOrientation
} from 'docx';
import {
  YouthViolationRecord,
  ClassDisciplineSummary,
  YouthDisciplineSettings
} from '../types/youthDiscipline';

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const tableBorders = {
  top: { style: DocxBorderStyle.SINGLE, size: 4, color: '000000' },
  bottom: { style: DocxBorderStyle.SINGLE, size: 4, color: '000000' },
  left: { style: DocxBorderStyle.SINGLE, size: 4, color: '000000' },
  right: { style: DocxBorderStyle.SINGLE, size: 4, color: '000000' },
  insideHorizontal: { style: DocxBorderStyle.SINGLE, size: 4, color: '000000' },
  insideVertical: { style: DocxBorderStyle.SINGLE, size: 4, color: '000000' }
};

// 1. EXPORT EXCEL
export function exportYouthDisciplineToExcel(
  summaries: ClassDisciplineSummary[],
  violations: YouthViolationRecord[],
  scopeTitle: string,
  schoolYear: string = '2026–2027'
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Tổng hợp thi đua nề nếp các lớp
  const summaryRows: any[][] = [
    ['ĐOÀN TNCS HỒ CHÍ MINH - TRƯỜNG THPT SƠN LƯƠNG'],
    [`BẢNG TỔNG HỢP THI ĐUA NỀN NẾP HỌC SINH - ${scopeTitle.toUpperCase()}`],
    [`Năm học: ${schoolYear}`],
    [],
    [
      'Xếp hạng',
      'Lớp',
      'Khối',
      'Giáo viên chủ nhiệm',
      'Sĩ số',
      'Điểm chuẩn',
      'Tổng điểm trừ',
      'Điểm nền nếp',
      'Số lượt vi phạm',
      'Số HS vi phạm',
      'Xếp loại'
    ]
  ];

  summaries.forEach((s) => {
    summaryRows.push([
      `#${s.rank}`,
      s.className,
      `Khối ${s.grade}`,
      s.homeroomTeacherName || '—',
      s.totalStudents,
      s.baseScore,
      s.totalMinusPoints,
      s.finalScore,
      s.violationCount,
      s.violatingStudentCount,
      s.classification
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'ThiDuaLop');

  // Sheet 2: Danh sách chi tiết các lượt vi phạm
  const violationRows: any[][] = [
    ['DANH SÁCH CHI TIẾT CÁC LƯỢT VI PHẠM NỀN NẾP'],
    [`Thời gian: ${scopeTitle}`],
    [],
    [
      'STT',
      'Ngày',
      'Thời gian',
      'Tuần',
      'Lớp',
      'Học sinh',
      'Mã học sinh',
      'Nhóm vi phạm',
      'Nội dung vi phạm',
      'Mức độ',
      'Điểm trừ',
      'Địa điểm',
      'Người ghi nhận',
      'Trạng thái'
    ]
  ];

  violations.forEach((v, idx) => {
    violationRows.push([
      idx + 1,
      v.violationDate,
      v.violationTime || '',
      `Tuần ${v.weekNumber}`,
      v.className,
      v.studentName,
      v.studentCode || '',
      v.categoryName,
      v.content || v.criterionName,
      v.severity,
      v.minusPoints,
      v.location || '',
      v.recordedByName,
      v.status === 'DA_XAC_NHAN' ? 'Đã xác nhận' : v.status === 'CHO_XAC_NHAN' ? 'Chờ xác nhận' : v.status
    ]);
  });

  const wsViolations = XLSX.utils.aoa_to_sheet(violationRows);
  XLSX.utils.book_append_sheet(wb, wsViolations, 'ChiTietViPham');

  const safeFileName = `Bao_Cao_Nen_Nep_Doan_TN_${scopeTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  XLSX.writeFile(wb, safeFileName);
}

// 2. EXPORT WORD (.docx)
export async function exportYouthDisciplineToWord(
  summaries: ClassDisciplineSummary[],
  violations: YouthViolationRecord[],
  scopeTitle: string,
  schoolYear: string = '2026–2027',
  inspectorName: string = 'Ban Thường vụ Đoàn trường'
) {
  const tableRows: DocxTableRow[] = [];

  // Header row
  tableRows.push(
    new DocxTableRow({
      tableHeader: true,
      children: [
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 8, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Hạng', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        }),
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 10, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Lớp', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        }),
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 22, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Giáo viên chủ nhiệm', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        }),
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 10, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Sĩ số', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        }),
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 12, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Điểm trừ', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        }),
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 14, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Điểm thi đua', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        }),
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 12, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Số vi phạm', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        }),
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 12, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Xếp loại', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        })
      ]
    })
  );

  // Rows for each class
  summaries.forEach((s) => {
    tableRows.push(
      new DocxTableRow({
        children: [
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            borders: tableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [new DocxTextRun({ text: `#${s.rank}`, bold: true, font: 'Times New Roman', size: 20 })]
              })
            ]
          }),
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            borders: tableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [new DocxTextRun({ text: s.className, bold: true, font: 'Times New Roman', size: 20, color: '1E3A8A' })]
              })
            ]
          }),
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            borders: tableBorders,
            children: [
              new DocxParagraph({
                children: [new DocxTextRun({ text: s.homeroomTeacherName || '—', font: 'Times New Roman', size: 20 })]
              })
            ]
          }),
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            borders: tableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [new DocxTextRun({ text: String(s.totalStudents), font: 'Times New Roman', size: 20 })]
              })
            ]
          }),
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            borders: tableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [new DocxTextRun({ text: `-${s.totalMinusPoints}`, font: 'Times New Roman', size: 20, color: 'DC2626' })]
              })
            ]
          }),
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            borders: tableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [new DocxTextRun({ text: `${s.finalScore} đ`, bold: true, font: 'Times New Roman', size: 20, color: '047857' })]
              })
            ]
          }),
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            borders: tableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [new DocxTextRun({ text: String(s.violationCount), font: 'Times New Roman', size: 20 })]
              })
            ]
          }),
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            borders: tableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [new DocxTextRun({ text: s.classification, bold: true, font: 'Times New Roman', size: 20 })]
              })
            ]
          })
        ]
      })
    );
  });

  // Create Docx
  const docx = new DocxDocument({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 }
          }
        },
        children: [
          new DocxParagraph({
            alignment: DocxAlignmentType.CENTER,
            children: [
              new DocxTextRun({
                text: 'ĐOÀN TNCS HỒ CHÍ MINH TRƯỜNG THPT SƠN LƯƠNG',
                bold: true,
                font: 'Times New Roman',
                size: 22
              })
            ]
          }),
          new DocxParagraph({
            alignment: DocxAlignmentType.CENTER,
            spacing: { after: 180 },
            children: [
              new DocxTextRun({
                text: '***',
                bold: true,
                font: 'Times New Roman',
                size: 20
              })
            ]
          }),
          new DocxParagraph({
            alignment: DocxAlignmentType.CENTER,
            children: [
              new DocxTextRun({
                text: 'BÁO CÁO TỔNG HỢP NỀN NẾP & THI ĐUA HỌC SINH',
                bold: true,
                font: 'Times New Roman',
                size: 26,
                color: '1E3A8A'
              })
            ]
          }),
          new DocxParagraph({
            alignment: DocxAlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new DocxTextRun({
                text: `${scopeTitle.toUpperCase()} - NĂM HỌC ${schoolYear}`,
                bold: true,
                italics: true,
                font: 'Times New Roman',
                size: 22
              })
            ]
          }),
          new DocxTable({
            width: { size: 100, type: DocxWidthType.PERCENTAGE },
            rows: tableRows
          }),
          new DocxParagraph({
            spacing: { before: 360 },
            alignment: DocxAlignmentType.RIGHT,
            children: [
              new DocxTextRun({
                text: 'Sơn Lương, ngày ..... tháng ..... năm 2026',
                italics: true,
                font: 'Times New Roman',
                size: 20
              })
            ]
          }),
          new DocxParagraph({
            alignment: DocxAlignmentType.RIGHT,
            children: [
              new DocxTextRun({
                text: 'TM. BAN CHẤP HÀNH ĐOÀN TRƯỜNG\nBÍ THƯ',
                bold: true,
                font: 'Times New Roman',
                size: 22
              })
            ]
          })
        ]
      }
    ]
  });

  const blob = await DocxPacker.toBlob(docx);
  const safeFileName = `Bao_Cao_Nen_Nep_Doan_TN_${scopeTitle.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
  downloadBlob(blob, safeFileName);
}

// 3. EXPORT LATE STUDENTS LIST TO EXCEL
export function exportLateStudentsToExcel(
  lateList: YouthViolationRecord[],
  scopeTitle: string,
  schoolYear: string = '2026–2027'
) {
  const wb = XLSX.utils.book_new();

  const rows: any[][] = [
    ['ĐOÀN TNCS HỒ CHÍ MINH - TRƯỜNG THPT SƠN LƯƠNG'],
    [`DANH SÁCH HỌC SINH ĐI HỌC MUỘN - ${scopeTitle.toUpperCase()}`],
    [`Năm học: ${schoolYear} | Tổng số: ${lateList.length} lượt`],
    [],
    [
      'STT',
      'Ngày vi phạm',
      'Giờ đến',
      'Buổi',
      'Tuần',
      'Lớp',
      'Họ và tên học sinh',
      'Mã học sinh',
      'Điểm trừ',
      'Lý do / Nội dung',
      'Địa điểm',
      'Người ghi nhận',
      'Trạng thái'
    ]
  ];

  lateList.forEach((v, idx) => {
    rows.push([
      idx + 1,
      v.violationDate,
      v.violationTime || '',
      v.periodSlot || 'Sáng',
      `Tuần ${v.weekNumber}`,
      v.className,
      v.studentName,
      v.studentCode || '',
      `-${v.minusPoints} đ`,
      v.content || 'Đi học muộn',
      v.location || 'Cổng trường',
      v.recordedByName,
      v.status === 'DA_XAC_NHAN' ? 'Đã xác nhận' : 'Chờ xác nhận'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'HocSinhDiMuon');

  const safeFileName = `Danh_Sach_Hoc_Sinh_Di_Muon_${scopeTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  XLSX.writeFile(wb, safeFileName);
}

// 4. EXPORT LATE STUDENTS LIST TO WORD
export async function exportLateStudentsToWord(
  lateList: YouthViolationRecord[],
  scopeTitle: string,
  schoolYear: string = '2026–2027',
  inspectorName: string = 'Đội Cờ đỏ / Đoàn trường'
) {
  const tableRows: DocxTableRow[] = [];

  // Header row
  tableRows.push(
    new DocxTableRow({
      tableHeader: true,
      children: [
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 6, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'STT', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        }),
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 14, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Ngày / Giờ', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        }),
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 10, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Lớp', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        }),
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 22, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Họ và tên học sinh', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        }),
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 10, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Mã HS', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        }),
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 20, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Lý do / Nội dung', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        }),
        new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: 18, type: DocxWidthType.PERCENTAGE },
          borders: tableBorders,
          shading: { fill: 'F3F4F6' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [new DocxTextRun({ text: 'Người ghi nhận', bold: true, font: 'Times New Roman', size: 20 })]
            })
          ]
        })
      ]
    })
  );

  lateList.forEach((v, idx) => {
    tableRows.push(
      new DocxTableRow({
        children: [
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 6, type: DocxWidthType.PERCENTAGE },
            borders: tableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [new DocxTextRun({ text: `${idx + 1}`, font: 'Times New Roman', size: 20 })]
              })
            ]
          }),
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 14, type: DocxWidthType.PERCENTAGE },
            borders: tableBorders,
            children: [
              new DocxParagraph({
                children: [
                  new DocxTextRun({ text: `${v.violationDate}`, font: 'Times New Roman', size: 20, bold: true }),
                  new DocxTextRun({ text: `\n${v.violationTime || ''} (${v.periodSlot || 'Sáng'})`, font: 'Times New Roman', size: 18, color: '666666' })
                ]
              })
            ]
          }),
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 10, type: DocxWidthType.PERCENTAGE },
            borders: tableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [new DocxTextRun({ text: v.className, bold: true, font: 'Times New Roman', size: 20, color: '1E3A8A' })]
              })
            ]
          }),
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 22, type: DocxWidthType.PERCENTAGE },
            borders: tableBorders,
            children: [
              new DocxParagraph({
                children: [new DocxTextRun({ text: v.studentName, bold: true, font: 'Times New Roman', size: 20 })]
              })
            ]
          }),
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 10, type: DocxWidthType.PERCENTAGE },
            borders: tableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [new DocxTextRun({ text: v.studentCode || '—', font: 'Times New Roman', size: 18 })]
              })
            ]
          }),
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 20, type: DocxWidthType.PERCENTAGE },
            borders: tableBorders,
            children: [
              new DocxParagraph({
                children: [new DocxTextRun({ text: v.content || 'Đi học muộn', font: 'Times New Roman', size: 20 })]
              })
            ]
          }),
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 18, type: DocxWidthType.PERCENTAGE },
            borders: tableBorders,
            children: [
              new DocxParagraph({
                children: [new DocxTextRun({ text: v.recordedByName, font: 'Times New Roman', size: 18 })]
              })
            ]
          })
        ]
      })
    );
  });

  const docx = new DocxDocument({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1200, right: 1000 }
          }
        },
        children: [
          new DocxParagraph({
            alignment: DocxAlignmentType.CENTER,
            children: [
              new DocxTextRun({
                text: 'ĐOÀN TNCS HỒ CHÍ MINH - TRƯỜNG THPT SƠN LƯƠNG',
                bold: true,
                font: 'Times New Roman',
                size: 20
              })
            ]
          }),
          new DocxParagraph({
            alignment: DocxAlignmentType.CENTER,
            spacing: { before: 120, after: 80 },
            children: [
              new DocxTextRun({
                text: 'DANH SÁCH HỌC SINH ĐI HỌC MUỘN',
                bold: true,
                font: 'Times New Roman',
                size: 26,
                color: 'DC2626'
              })
            ]
          }),
          new DocxParagraph({
            alignment: DocxAlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new DocxTextRun({
                text: `${scopeTitle.toUpperCase()} - NĂM HỌC ${schoolYear} (Tổng số: ${lateList.length} em)`,
                bold: true,
                italics: true,
                font: 'Times New Roman',
                size: 22
              })
            ]
          }),
          new DocxTable({
            width: { size: 100, type: DocxWidthType.PERCENTAGE },
            rows: tableRows
          }),
          new DocxParagraph({
            spacing: { before: 360 },
            alignment: DocxAlignmentType.RIGHT,
            children: [
              new DocxTextRun({
                text: 'Sơn Lương, ngày ..... tháng ..... năm 2026',
                italics: true,
                font: 'Times New Roman',
                size: 20
              })
            ]
          }),
          new DocxParagraph({
            alignment: DocxAlignmentType.RIGHT,
            children: [
              new DocxTextRun({
                text: 'NGƯỜI LẬP DANH SÁCH / ĐỘI CỜ ĐỎ\n(Ký và ghi rõ họ tên)',
                bold: true,
                font: 'Times New Roman',
                size: 22
              })
            ]
          })
        ]
      }
    ]
  });

  const blob = await DocxPacker.toBlob(docx);
  const safeFileName = `Danh_Sach_Hoc_Sinh_Di_Muon_${scopeTitle.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
  downloadBlob(blob, safeFileName);
}

// 5. EXPORT DANH SÁCH HỌC SINH VI PHẠM RA FILE WORD (.docx)
export interface YouthDisciplineWordFilterOptions {
  schoolYear: string;
  weekNumber?: number;
  monthNumber?: number;
  weekDateRange?: string;
  grade?: string;
  className?: string;
  severity?: string;
  categoryName?: string;
  violationDate?: string;
  searchTerm?: string;
}

function formatViDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function getStatusLabel(status?: string): string {
  if (!status) return 'Đã ghi nhận';
  switch (status) {
    case 'DA_XAC_NHAN':
      return 'Đã xác nhận';
    case 'CHO_XAC_NHAN':
      return 'Chờ xác nhận';
    case 'TU_CHOI':
      return 'Từ chối';
    case 'DA_XOA':
      return 'Đã xóa';
    default:
      return status;
  }
}

function getCategoryDisplayName(cat?: string, catName?: string): string {
  if (catName && catName.trim()) return catName;
  switch (cat) {
    case 'CHUYEN_CAN':
      return 'Chuyên cần';
    case 'TRANG_PHUC_TAC_PHONG':
      return 'Trang phục – Tác phong';
    case 'Y_THUC_KY_LUAT':
      return 'Ý thức – Kỷ luật';
    case 'VE_SINH_MOI_TRUONG':
      return 'Vệ sinh – Môi trường';
    case 'HOC_TAP':
      return 'Học tập';
    case 'NEN_NEP_TAP_THE':
      return 'Nền nếp tập thể';
    case 'KHAC':
      return 'Khác';
    default:
      return cat || 'Nền nếp';
  }
}

export async function exportViolationsListToWord(
  violations: YouthViolationRecord[],
  filterOptions: YouthDisciplineWordFilterOptions,
  reporterName: string = 'Ban Chấp hành Đoàn trường'
): Promise<void> {
  if (!violations || violations.length === 0) {
    throw new Error('NO_DATA');
  }

  const borderless = {
    top: { style: DocxBorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: DocxBorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: DocxBorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: DocxBorderStyle.NONE, size: 0, color: 'auto' },
    insideHorizontal: { style: DocxBorderStyle.NONE, size: 0, color: 'auto' },
    insideVertical: { style: DocxBorderStyle.NONE, size: 0, color: 'auto' }
  };

  const solidTableBorders = {
    top: { style: DocxBorderStyle.SINGLE, size: 4, color: '000000' },
    bottom: { style: DocxBorderStyle.SINGLE, size: 4, color: '000000' },
    left: { style: DocxBorderStyle.SINGLE, size: 4, color: '000000' },
    right: { style: DocxBorderStyle.SINGLE, size: 4, color: '000000' },
    insideHorizontal: { style: DocxBorderStyle.SINGLE, size: 4, color: '000000' },
    insideVertical: { style: DocxBorderStyle.SINGLE, size: 4, color: '000000' }
  };

  // 1. Top Header Masthead (Administrative standard)
  const mastheadTable = new DocxTable({
    width: { size: 100, type: DocxWidthType.PERCENTAGE },
    borders: borderless,
    rows: [
      new DocxTableRow({
        children: [
          new DocxTableCell({
            width: { size: 45, type: DocxWidthType.PERCENTAGE },
            borders: borderless,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: 'TRƯỜNG THPT SƠN LƯƠNG',
                    bold: true,
                    font: 'Times New Roman',
                    size: 20
                  })
                ]
              }),
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: 'ĐOÀN TNCS HỒ CHÍ MINH',
                    bold: true,
                    font: 'Times New Roman',
                    size: 20
                  })
                ]
              }),
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                spacing: { after: 120 },
                children: [
                  new DocxTextRun({
                    text: '***',
                    bold: true,
                    font: 'Times New Roman',
                    size: 18
                  })
                ]
              })
            ]
          }),
          new DocxTableCell({
            width: { size: 55, type: DocxWidthType.PERCENTAGE },
            borders: borderless,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
                    bold: true,
                    font: 'Times New Roman',
                    size: 20
                  })
                ]
              }),
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: 'Độc lập - Tự do - Hạnh phúc',
                    bold: true,
                    font: 'Times New Roman',
                    size: 20
                  })
                ]
              }),
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                spacing: { after: 120 },
                children: [
                  new DocxTextRun({
                    text: '-----------------',
                    font: 'Times New Roman',
                    size: 18
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  // 2. Build Filter Strings for Title Section
  const yearStr = filterOptions.schoolYear || '2026–2027';
  let timeStr = 'Toàn trường (Tất cả các tuần)';
  if (filterOptions.weekNumber && filterOptions.weekNumber > 0) {
    timeStr = `Tuần ${filterOptions.weekNumber}${
      filterOptions.weekDateRange ? ` (${filterOptions.weekDateRange})` : ''
    }`;
  } else if (filterOptions.monthNumber && filterOptions.monthNumber > 0) {
    timeStr = `Tháng ${filterOptions.monthNumber}`;
  }

  const gradeStr =
    filterOptions.grade && filterOptions.grade !== 'All'
      ? `Khối ${filterOptions.grade}`
      : 'Tất cả các khối';
  const classStr =
    filterOptions.className && filterOptions.className !== 'All'
      ? `Lớp ${filterOptions.className}`
      : 'Tất cả các lớp';
  const severityStr =
    filterOptions.severity && filterOptions.severity !== 'All'
      ? filterOptions.severity
      : 'Tất cả';
  const categoryStr =
    filterOptions.categoryName && filterOptions.categoryName !== 'All'
      ? filterOptions.categoryName
      : 'Tất cả';

  // 3. Table Header Row (9 Columns)
  const headerCols = [
    { title: 'STT', width: 5, align: DocxAlignmentType.CENTER },
    { title: 'Họ và tên học sinh', width: 17, align: DocxAlignmentType.CENTER },
    { title: 'Lớp', width: 8, align: DocxAlignmentType.CENTER },
    { title: 'Nội dung vi phạm', width: 22, align: DocxAlignmentType.CENTER },
    { title: 'Nhóm vi phạm', width: 13, align: DocxAlignmentType.CENTER },
    { title: 'Điểm trừ', width: 8, align: DocxAlignmentType.CENTER },
    { title: 'Người ghi nhận', width: 13, align: DocxAlignmentType.CENTER },
    { title: 'Ngày vi phạm', width: 8, align: DocxAlignmentType.CENTER },
    { title: 'Trạng thái', width: 6, align: DocxAlignmentType.CENTER }
  ];

  const tableRows: DocxTableRow[] = [];

  tableRows.push(
    new DocxTableRow({
      tableHeader: true,
      cantSplit: true,
      children: headerCols.map((col) => {
        return new DocxTableCell({
          verticalAlign: DocxVerticalAlign.CENTER,
          width: { size: col.width, type: DocxWidthType.PERCENTAGE },
          borders: solidTableBorders,
          shading: { fill: 'E2E8F0' },
          children: [
            new DocxParagraph({
              alignment: col.align,
              children: [
                new DocxTextRun({
                  text: col.title,
                  bold: true,
                  font: 'Times New Roman',
                  size: 20
                })
              ]
            })
          ]
        });
      })
    })
  );

  // 4. Data Rows for each violation (Direct from system, no omissions)
  violations.forEach((v, idx) => {
    const formattedDate = formatViDate(v.violationDate);
    const dateChildren: DocxTextRun[] = [
      new DocxTextRun({
        text: formattedDate,
        font: 'Times New Roman',
        size: 19
      })
    ];
    if (v.violationTime) {
      dateChildren.push(
        new DocxTextRun({
          text: `\n${v.violationTime}`,
          font: 'Times New Roman',
          size: 17,
          color: '555555'
        })
      );
    }

    const nameChildren: DocxTextRun[] = [
      new DocxTextRun({
        text: v.studentName || 'Học sinh',
        bold: true,
        font: 'Times New Roman',
        size: 20
      })
    ];
    if (v.studentCode) {
      nameChildren.push(
        new DocxTextRun({
          text: `\n(${v.studentCode})`,
          font: 'Times New Roman',
          size: 17,
          color: '666666'
        })
      );
    }

    tableRows.push(
      new DocxTableRow({
        cantSplit: true,
        children: [
          // 1. STT
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 5, type: DocxWidthType.PERCENTAGE },
            borders: solidTableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: String(idx + 1),
                    font: 'Times New Roman',
                    size: 20
                  })
                ]
              })
            ]
          }),
          // 2. Họ và tên học sinh
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 17, type: DocxWidthType.PERCENTAGE },
            borders: solidTableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.LEFT,
                children: nameChildren
              })
            ]
          }),
          // 3. Lớp
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 8, type: DocxWidthType.PERCENTAGE },
            borders: solidTableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: v.className || '—',
                    bold: true,
                    font: 'Times New Roman',
                    size: 20,
                    color: '1E3A8A'
                  })
                ]
              })
            ]
          }),
          // 4. Nội dung vi phạm
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 22, type: DocxWidthType.PERCENTAGE },
            borders: solidTableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.LEFT,
                children: [
                  new DocxTextRun({
                    text: v.content || v.criterionName || 'Vi phạm nền nếp',
                    font: 'Times New Roman',
                    size: 19
                  })
                ]
              })
            ]
          }),
          // 5. Nhóm vi phạm
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 13, type: DocxWidthType.PERCENTAGE },
            borders: solidTableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.LEFT,
                children: [
                  new DocxTextRun({
                    text: getCategoryDisplayName(v.category, v.categoryName),
                    font: 'Times New Roman',
                    size: 19
                  })
                ]
              })
            ]
          }),
          // 6. Điểm trừ
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 8, type: DocxWidthType.PERCENTAGE },
            borders: solidTableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: `-${v.minusPoints} đ`,
                    bold: true,
                    font: 'Times New Roman',
                    size: 20,
                    color: 'DC2626'
                  })
                ]
              })
            ]
          }),
          // 7. Người ghi nhận
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 13, type: DocxWidthType.PERCENTAGE },
            borders: solidTableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.LEFT,
                children: [
                  new DocxTextRun({
                    text: v.recordedByName || 'Cán bộ Đoàn',
                    font: 'Times New Roman',
                    size: 19
                  })
                ]
              })
            ]
          }),
          // 8. Ngày vi phạm
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 8, type: DocxWidthType.PERCENTAGE },
            borders: solidTableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: dateChildren
              })
            ]
          }),
          // 9. Trạng thái
          new DocxTableCell({
            verticalAlign: DocxVerticalAlign.CENTER,
            width: { size: 6, type: DocxWidthType.PERCENTAGE },
            borders: solidTableBorders,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: getStatusLabel(v.status),
                    font: 'Times New Roman',
                    size: 18,
                    bold: v.status === 'DA_XAC_NHAN'
                  })
                ]
              })
            ]
          })
        ]
      })
    );
  });

  // 5. Calculate Summary Statistics
  const totalRecords = violations.length;
  const uniqueStudents = new Set(
    violations.map((v) =>
      v.studentId && v.studentId !== 'ALL_CLASS'
        ? v.studentId
        : `${v.className}_${v.studentName}`
    )
  );
  const totalViolatingStudents = uniqueStudents.size;
  const totalMinusPoints = violations.reduce(
    (acc, v) => acc + (Number(v.minusPoints) || 0),
    0
  );

  // Table Summary Footer Row
  tableRows.push(
    new DocxTableRow({
      cantSplit: true,
      children: [
        new DocxTableCell({
          columnSpan: 5,
          verticalAlign: DocxVerticalAlign.CENTER,
          borders: solidTableBorders,
          shading: { fill: 'F8FAFC' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.RIGHT,
              children: [
                new DocxTextRun({
                  text: `TỔNG CỘNG (${totalRecords} lượt vi phạm – ${totalViolatingStudents} học sinh):`,
                  bold: true,
                  font: 'Times New Roman',
                  size: 20
                })
              ]
            })
          ]
        }),
        new DocxTableCell({
          columnSpan: 1,
          verticalAlign: DocxVerticalAlign.CENTER,
          borders: solidTableBorders,
          shading: { fill: 'F8FAFC' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: [
                new DocxTextRun({
                  text: `-${totalMinusPoints} đ`,
                  bold: true,
                  font: 'Times New Roman',
                  size: 20,
                  color: 'DC2626'
                })
              ]
            })
          ]
        }),
        new DocxTableCell({
          columnSpan: 3,
          verticalAlign: DocxVerticalAlign.CENTER,
          borders: solidTableBorders,
          shading: { fill: 'F8FAFC' },
          children: [
            new DocxParagraph({
              alignment: DocxAlignmentType.CENTER,
              children: []
            })
          ]
        })
      ]
    })
  );

  // 6. Signatures block
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();

  const signatureTable = new DocxTable({
    width: { size: 100, type: DocxWidthType.PERCENTAGE },
    borders: borderless,
    rows: [
      new DocxTableRow({
        children: [
          new DocxTableCell({
            width: { size: 50, type: DocxWidthType.PERCENTAGE },
            borders: borderless,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: 'NGƯỜI CẬP NHẬT NỀN NẾP',
                    bold: true,
                    font: 'Times New Roman',
                    size: 20
                  })
                ]
              }),
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: '(BÍ THƯ ĐOÀN)',
                    bold: true,
                    font: 'Times New Roman',
                    size: 19
                  })
                ]
              }),
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                spacing: { after: 720 },
                children: [
                  new DocxTextRun({
                    text: '(Ký và ghi rõ họ tên)',
                    italics: true,
                    font: 'Times New Roman',
                    size: 18
                  })
                ]
              }),
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: 'Bí thư Đoàn',
                    bold: true,
                    font: 'Times New Roman',
                    size: 20
                  })
                ]
              })
            ]
          }),
          new DocxTableCell({
            width: { size: 50, type: DocxWidthType.PERCENTAGE },
            borders: borderless,
            children: [
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: `Sơn Lương, ngày ${d} tháng ${m} năm ${yyyy}`,
                    italics: true,
                    font: 'Times New Roman',
                    size: 20
                  })
                ]
              }),
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: [
                  new DocxTextRun({
                    text: 'XÁC NHẬN CỦA BGH',
                    bold: true,
                    font: 'Times New Roman',
                    size: 20
                  })
                ]
              }),
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                spacing: { after: 720 },
                children: [
                  new DocxTextRun({
                    text: '(Ký, ghi rõ họ tên và đóng dấu)',
                    italics: true,
                    font: 'Times New Roman',
                    size: 18
                  })
                ]
              }),
              new DocxParagraph({
                alignment: DocxAlignmentType.CENTER,
                children: []
              })
            ]
          })
        ]
      })
    ]
  });

  // Filter info line 2 components
  const extraFilterRuns: DocxTextRun[] = [];
  if (filterOptions.categoryName && filterOptions.categoryName !== 'All') {
    extraFilterRuns.push(
      new DocxTextRun({
        text: ` | Nhóm vi phạm: ${categoryStr}`,
        font: 'Times New Roman',
        size: 19
      })
    );
  }
  if (filterOptions.violationDate) {
    extraFilterRuns.push(
      new DocxTextRun({
        text: ` | Ngày: ${formatViDate(filterOptions.violationDate)}`,
        font: 'Times New Roman',
        size: 19
      })
    );
  }
  if (filterOptions.searchTerm) {
    extraFilterRuns.push(
      new DocxTextRun({
        text: ` | Tìm kiếm: "${filterOptions.searchTerm}"`,
        font: 'Times New Roman',
        size: 19
      })
    );
  }

  // 7. Assemble Document
  const docx = new DocxDocument({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE
            },
            margin: { top: 720, right: 720, bottom: 720, left: 720 }
          }
        },
        children: [
          mastheadTable,
          new DocxParagraph({
            alignment: DocxAlignmentType.CENTER,
            spacing: { before: 180, after: 100 },
            children: [
              new DocxTextRun({
                text: 'DANH SÁCH HỌC SINH VI PHẠM NỀN NẾP',
                bold: true,
                font: 'Times New Roman',
                size: 28,
                color: '1E3A8A'
              })
            ]
          }),
          new DocxParagraph({
            alignment: DocxAlignmentType.CENTER,
            spacing: { after: 60 },
            children: [
              new DocxTextRun({
                text: `Năm học: ${yearStr} | Thời gian: ${timeStr}`,
                bold: true,
                italics: true,
                font: 'Times New Roman',
                size: 20
              })
            ]
          }),
          new DocxParagraph({
            alignment: DocxAlignmentType.CENTER,
            spacing: { after: extraFilterRuns.length > 0 ? 40 : 180 },
            children: [
              new DocxTextRun({
                text: `Khối: ${gradeStr} | Lớp: ${classStr} | Mức độ: ${severityStr}`,
                italics: true,
                font: 'Times New Roman',
                size: 19
              }),
              ...extraFilterRuns
            ]
          }),
          new DocxTable({
            width: { size: 100, type: DocxWidthType.PERCENTAGE },
            rows: tableRows
          }),
          // Formal Statistics Section below table
          new DocxParagraph({
            spacing: { before: 240, after: 80 },
            children: [
              new DocxTextRun({
                text: 'THỐNG KÊ TỔNG HỢP:',
                bold: true,
                font: 'Times New Roman',
                size: 21,
                color: '1E3A8A'
              })
            ]
          }),
          new DocxParagraph({
            spacing: { after: 50 },
            children: [
              new DocxTextRun({
                text: '• Tổng số học sinh vi phạm: ',
                bold: true,
                font: 'Times New Roman',
                size: 20
              }),
              new DocxTextRun({
                text: `${totalViolatingStudents} học sinh`,
                bold: true,
                font: 'Times New Roman',
                size: 20,
                color: '047857'
              })
            ]
          }),
          new DocxParagraph({
            spacing: { after: 50 },
            children: [
              new DocxTextRun({
                text: '• Tổng số lượt vi phạm: ',
                bold: true,
                font: 'Times New Roman',
                size: 20
              }),
              new DocxTextRun({
                text: `${totalRecords} lượt vi phạm`,
                bold: true,
                font: 'Times New Roman',
                size: 20,
                color: '1E3A8A'
              })
            ]
          }),
          new DocxParagraph({
            spacing: { after: 260 },
            children: [
              new DocxTextRun({
                text: '• Tổng số điểm trừ: ',
                bold: true,
                font: 'Times New Roman',
                size: 20
              }),
              new DocxTextRun({
                text: `-${totalMinusPoints} điểm`,
                bold: true,
                font: 'Times New Roman',
                size: 20,
                color: 'DC2626'
              })
            ]
          }),
          signatureTable
        ]
      }
    ]
  });

  // 8. Output file name format: Danh_sach_hoc_sinh_vi_pham_[NamHoc][Tuan/Thang][NgayXuat].docx
  const cleanYear = (filterOptions.schoolYear || '2026-2027').replace(/[\u2010-\u2015\s/]/g, '-');
  let timeTag = '';
  if (filterOptions.weekNumber && filterOptions.weekNumber > 0) {
    timeTag = `_Tuan_${filterOptions.weekNumber}`;
  } else if (filterOptions.monthNumber && filterOptions.monthNumber > 0) {
    timeTag = `_Thang_${filterOptions.monthNumber}`;
  } else {
    timeTag = `_ToanTruong`;
  }
  const dateTag = `_${d}${m}${yyyy}`;
  const fileName = `Danh_sach_hoc_sinh_vi_pham_${cleanYear}${timeTag}${dateTag}.docx`;

  const blob = await DocxPacker.toBlob(docx);
  downloadBlob(blob, fileName);
}

// 6. EXPORT DANH SÁCH HỌC SINH VI PHẠM RA FILE EXCEL (.xlsx)
export function exportViolationsListToExcel(
  violations: YouthViolationRecord[],
  filterOptions: YouthDisciplineWordFilterOptions
): void {
  if (!violations || violations.length === 0) {
    throw new Error('NO_DATA');
  }

  const wb = XLSX.utils.book_new();

  const yearStr = filterOptions.schoolYear || '2026–2027';
  let timeStr = 'Toàn trường (Tất cả các tuần)';
  if (filterOptions.weekNumber && filterOptions.weekNumber > 0) {
    timeStr = `Tuần ${filterOptions.weekNumber}`;
  } else if (filterOptions.monthNumber && filterOptions.monthNumber > 0) {
    timeStr = `Tháng ${filterOptions.monthNumber}`;
  }

  const uniqueStudents = new Set(
    violations.map((v) =>
      v.studentId && v.studentId !== 'ALL_CLASS'
        ? v.studentId
        : `${v.className}_${v.studentName}`
    )
  );
  const totalMinusPoints = violations.reduce(
    (acc, v) => acc + (Number(v.minusPoints) || 0),
    0
  );

  const rows: any[][] = [
    ['TRƯỜNG THPT SƠN LƯƠNG - ĐOÀN TNCS HỒ CHÍ MINH'],
    ['DANH SÁCH HỌC SINH VI PHẠM NỀN NẾP'],
    [`Năm học: ${yearStr} | Thời gian: ${timeStr} | Khối: ${filterOptions.grade || 'Tất cả'} | Lớp: ${filterOptions.className || 'Tất cả'}`],
    [`Tổng số lượt vi phạm: ${violations.length} | Tổng số HS: ${uniqueStudents.size} | Tổng điểm trừ: -${totalMinusPoints} đ`],
    [],
    [
      'STT',
      'Họ và tên học sinh',
      'Mã học sinh',
      'Lớp',
      'Nội dung vi phạm',
      'Nhóm vi phạm',
      'Điểm trừ',
      'Người ghi nhận',
      'Ngày vi phạm',
      'Giờ / Buổi',
      'Địa điểm',
      'Trạng thái'
    ]
  ];

  violations.forEach((v, idx) => {
    rows.push([
      idx + 1,
      v.studentName || '',
      v.studentCode || '',
      v.className || '',
      v.content || v.criterionName || '',
      getCategoryDisplayName(v.category, v.categoryName),
      v.minusPoints ? -v.minusPoints : 0,
      v.recordedByName || '',
      formatViDate(v.violationDate),
      v.violationTime ? `${v.violationTime} (${v.periodSlot || ''})` : v.periodSlot || '',
      v.location || '',
      getStatusLabel(v.status)
    ]);
  });

  // Footer summary row
  rows.push([]);
  rows.push([
    'TỔNG CỘNG',
    `${uniqueStudents.size} học sinh`,
    '',
    '',
    `${violations.length} lượt vi phạm`,
    '',
    -totalMinusPoints,
    '',
    '',
    '',
    '',
    ''
  ]);

  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();

  rows.push([]);
  rows.push([
    '',
    'NGƯỜI CẬP NHẬT NỀN NẾP',
    '',
    '',
    '',
    '',
    '',
    '',
    `Sơn Lương, ngày ${d} tháng ${m} năm ${yyyy}`
  ]);
  rows.push([
    '',
    '(BÍ THƯ ĐOÀN)',
    '',
    '',
    '',
    '',
    '',
    '',
    'XÁC NHẬN CỦA BGH'
  ]);
  rows.push([
    '',
    '(Ký và ghi rõ họ tên)',
    '',
    '',
    '',
    '',
    '',
    '',
    '(Ký, ghi rõ họ tên và đóng dấu)'
  ]);
  rows.push([]);
  rows.push([]);
  rows.push([
    '',
    'Bí thư Đoàn',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 30 },
    { wch: 20 },
    { wch: 10 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'DSHocSinhViPham');

  const cleanYear = (filterOptions.schoolYear || '2026-2027').replace(/[\u2010-\u2015\s/]/g, '-');
  let timeTag = '';
  if (filterOptions.weekNumber && filterOptions.weekNumber > 0) {
    timeTag = `_Tuan_${filterOptions.weekNumber}`;
  } else if (filterOptions.monthNumber && filterOptions.monthNumber > 0) {
    timeTag = `_Thang_${filterOptions.monthNumber}`;
  } else {
    timeTag = `_ToanTruong`;
  }
  const dateTag = `_${d}${m}${yyyy}`;
  const fileName = `Danh_sach_hoc_sinh_vi_pham_${cleanYear}${timeTag}${dateTag}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

