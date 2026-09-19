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
 * Cấu trúc tên file theo yêu cầu: PHIEU_DANH_GIA_KPI_[HO_TEN]_[NAM_HOC].doc
 * Ví dụ: PHIEU_DANH_GIA_KPI_NGUYEN_VAN_A_2026-2027.doc
 */
export function generateWordFileName(name: string, academicYear: string): string {
  const cleanName = removeVietnameseAccents(name || 'CAN_BO').toUpperCase();
  const cleanYear = (academicYear || '2026-2027').replace(/[^a-zA-Z0-9-]/g, '');
  return `PHIEU_DANH_GIA_KPI_${cleanName}_${cleanYear}.doc`;
}

/**
 * Xuất Phiếu đánh giá KPI Viên chức (GVNV) ra file Word (.doc)
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

    const mgrGroupI = form.managerGroupScores?.group_I ?? '---';
    const mgrGroupII = form.managerGroupScores?.group_II ?? '---';
    const mgrGroupIII = form.managerGroupScores?.group_III ?? '---';

    const items = form.items || [];
    const groupIItems = items.filter(it => it.groupId === 'group_I');
    const groupIIItems = items.filter(it => it.groupId === 'group_II');
    const groupIIIItems = items.filter(it => it.groupId === 'group_III');

    const selectLevelItem = groupIIIItems.find(i => i.scoreType === 'select_level');
    const selLevelCode = selectLevelItem?.selectedLevelCode || '2.1';

    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
      <meta charset='utf-8'>
      <title>Phiếu đánh giá KPI Viên chức</title>
      <!--[if gte mso 9]>
      <xml>
       <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>100</w:Zoom>
        <w:DoNotOptimizeForBrowser/>
       </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page WordSection1 {
          size: 210mm 297mm;
          margin: 20mm 20mm 20mm 20mm;
          mso-header-margin: 36.0pt;
          mso-footer-margin: 36.0pt;
          mso-paper-source: 0;
        }
        div.WordSection1 {
          page: WordSection1;
        }
        body {
          font-family: 'Times New Roman', serif;
          font-size: 13pt;
          line-height: 1.35;
          color: #000000;
        }
        p {
          margin-top: 3pt;
          margin-bottom: 3pt;
        }
        .header-table {
          width: 100%;
          border-collapse: collapse;
          border: none !important;
          margin-bottom: 15pt;
        }
        .header-table td {
          border: none !important;
          vertical-align: top;
          padding: 0;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .font-bold { font-weight: bold; }
        .italic { font-style: italic; }
        .uppercase { text-transform: uppercase; }
        
        table.data-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10pt;
          margin-bottom: 12pt;
        }
        table.data-table, table.data-table th, table.data-table td {
          border: 1px solid #000000;
        }
        table.data-table th {
          background-color: #f2f2f2;
          font-weight: bold;
          text-align: center;
          padding: 6pt 4pt;
          font-size: 12pt;
        }
        table.data-table td {
          padding: 5pt 4pt;
          font-size: 11.5pt;
          vertical-align: top;
        }
        .signature-table {
          width: 100%;
          border-collapse: collapse;
          border: none !important;
          margin-top: 15pt;
        }
        .signature-table td {
          border: none !important;
          vertical-align: top;
          text-align: center;
        }
      </style>
      </head>
      <body>
      <div class="WordSection1">
        
        <!-- HEADER CƠ QUAN / QUỐC HUY -->
        <table class="header-table">
          <tr>
            <td style="width: 45%; text-align: center;">
              <p class="font-bold uppercase" style="font-size: 11pt;">SỞ GD&ĐT TỈNH PHÚ THỌ</p>
              <p class="font-bold uppercase" style="font-size: 12pt;">TRƯỜNG THPT SƠN LƯƠNG</p>
              <div style="border-bottom: 1px solid black; width: 100px; margin: 2pt auto;"></div>
            </td>
            <td style="width: 55%; text-align: center;">
              <p class="font-bold uppercase" style="font-size: 11pt;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p class="font-bold" style="font-size: 11pt; text-decoration: underline;">Độc lập – Tự do – Hạnh phúc</p>
            </td>
          </tr>
        </table>

        <!-- TIÊU ĐỀ PHIẾU -->
        <div style="text-align: center; margin-top: 10pt; margin-bottom: 15pt;">
          <p class="font-bold uppercase" style="font-size: 14pt; margin: 0;">
            PHIẾU ĐÁNH GIÁ, CHẤM ĐIỂM NĂM HỌC ${form.academicYear || '2025-2026'}
          </p>
          <p class="italic" style="font-size: 12pt; margin-top: 2pt;">
            (Áp dụng đối với viên chức không giữ chức vụ lãnh đạo, quản lý)
          </p>
        </div>

        <!-- THÔNG TIN VIÊN CHỨC -->
        <div style="margin-bottom: 12pt; font-size: 13pt;">
          <p><span class="font-bold">Họ và tên:</span> ${form.employeeName || ''}</p>
          <p><span class="font-bold">Chức vụ:</span> ${form.position || ''}</p>
          <p><span class="font-bold">Đơn vị công tác:</span> ${form.department || 'Trường THPT Sơn Lương'}</p>
          <p><span class="font-bold">Kỳ đánh giá:</span> ${form.periodName || ''}</p>
        </div>

        <p class="font-bold uppercase" style="font-size: 13pt; margin-bottom: 4pt;">A. NỘI DUNG CHẤM ĐIỂM</p>

        <!-- BẢNG ĐÁNH GIÁ TIÊU CHÍ KPI -->
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 35pt;">Stt</th>
              <th style="text-align: left;">Nội dung đánh giá</th>
              <th style="width: 50pt;">Điểm tối đa</th>
              <th style="width: 65pt;">Điểm cá nhân tự chấm</th>
              <th style="width: 70pt;">Đánh giá của CBQL</th>
            </tr>
          </thead>
          <tbody>
            
            <!-- NHÓM I -->
            <tr>
              <td class="text-center font-bold">I</td>
              <td class="font-bold">Chính trị tư tưởng, đạo đức lối sống</td>
              <td class="text-center font-bold">15</td>
              <td class="text-center font-bold">${groupI}</td>
              <td class="text-center font-bold">${mgrGroupI}</td>
            </tr>
            ${groupIItems.map((item, idx) => `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td>${item.content || ''}</td>
                <td class="text-center">${item.maxScore}</td>
                <td class="text-center font-bold">${item.selfScore}</td>
                <td class="text-center font-bold">${item.managerScore !== undefined && item.managerScore !== null ? item.managerScore : ''}</td>
              </tr>
            `).join('')}

            <!-- NHÓM II -->
            <tr>
              <td class="text-center font-bold">II</td>
              <td class="font-bold">Tác phong, lề lối làm việc, ý thức tổ chức kỷ luật</td>
              <td class="text-center font-bold">15</td>
              <td class="text-center font-bold">${groupII}</td>
              <td class="text-center font-bold">${mgrGroupII}</td>
            </tr>
            ${groupIIItems.map((item, idx) => `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td>${item.content || ''}</td>
                <td class="text-center">${item.maxScore}</td>
                <td class="text-center font-bold">${item.selfScore}</td>
                <td class="text-center font-bold">${item.managerScore !== undefined && item.managerScore !== null ? item.managerScore : ''}</td>
              </tr>
            `).join('')}

            <!-- NHÓM III -->
            <tr>
              <td class="text-center font-bold">III</td>
              <td class="font-bold uppercase">KẾT QUẢ THỰC HIỆN NHIỆM VỤ</td>
              <td class="text-center font-bold">70</td>
              <td class="text-center font-bold">${groupIII}</td>
              <td class="text-center font-bold">${mgrGroupIII}</td>
            </tr>

            <!-- III.1 -->
            ${groupIIIItems.filter(i => i.scoreType !== 'select_level').map(item => `
              <tr>
                <td class="text-center font-bold">1</td>
                <td style="white-space: pre-line;">${item.content || ''}</td>
                <td class="text-center font-bold">${item.maxScore}</td>
                <td class="text-center font-bold">${item.selfScore}</td>
                <td class="text-center font-bold">${item.managerScore !== undefined && item.managerScore !== null ? item.managerScore : ''}</td>
              </tr>
            `).join('')}

            <!-- III.2 -->
            <tr>
              <td class="text-center font-bold">2</td>
              <td class="font-bold">Kết quả thực hiện nhiệm vụ được giao</td>
              <td class="text-center font-bold">60</td>
              <td class="text-center font-bold">${selectLevelItem?.selfScore || 60}</td>
              <td class="text-center font-bold">${selectLevelItem?.managerScore ?? ''}</td>
            </tr>

            <!-- 5 MỨC CỦA III.2 -->
            <tr>
              <td class="text-center">2.1</td>
              <td><p class="font-bold">MỨC 1</p><p>Hoàn thành 100% công việc theo kế hoạch, lịch công tác, đúng tiến độ, bảo đảm chất lượng, hiệu quả cao, trong đó có ít nhất 50% tiêu chí, nhiệm vụ hoàn thành vượt mức: tối đa 60 điểm.</p></td>
              <td class="text-center">60</td>
              <td class="text-center font-bold">${selLevelCode === '2.1' ? (selectLevelItem?.selfScore || 60) : ''}</td>
              <td class="text-center font-bold">${selLevelCode === '2.1' && selectLevelItem?.managerScore != null ? selectLevelItem.managerScore : ''}</td>
            </tr>
            <tr>
              <td class="text-center">2.2</td>
              <td><p class="font-bold">MỨC 2</p><p>Hoàn thành 100% công việc theo kế hoạch, lịch công tác, đúng tiến độ, bảo đảm chất lượng, hiệu quả: tối đa 50 điểm.</p></td>
              <td class="text-center">50</td>
              <td class="text-center font-bold">${selLevelCode === '2.2' ? (selectLevelItem?.selfScore || 50) : ''}</td>
              <td class="text-center font-bold">${selLevelCode === '2.2' && selectLevelItem?.managerScore != null ? selectLevelItem.managerScore : ''}</td>
            </tr>
            <tr>
              <td class="text-center">2.3</td>
              <td><p class="font-bold">MỨC 3</p><p>Hoàn thành 100% công việc theo kế hoạch, lịch công tác, trong đó có không quá 20% nhiệm vụ chưa bảo đảm chất lượng, tiến độ hoặc hiệu quả thấp: tối đa 30 điểm.</p></td>
              <td class="text-center">30</td>
              <td class="text-center font-bold">${selLevelCode === '2.3' ? (selectLevelItem?.selfScore || 30) : ''}</td>
              <td class="text-center font-bold">${selLevelCode === '2.3' && selectLevelItem?.managerScore != null ? selectLevelItem.managerScore : ''}</td>
            </tr>
            <tr>
              <td class="text-center">2.4</td>
              <td><p class="font-bold">MỨC 4</p><p>Hoàn thành từ 50% đến dưới 100% công việc theo kế hoạch, lịch công tác: tối đa 20 điểm.</p></td>
              <td class="text-center">20</td>
              <td class="text-center font-bold">${selLevelCode === '2.4' ? (selectLevelItem?.selfScore || 20) : ''}</td>
              <td class="text-center font-bold">${selLevelCode === '2.4' && selectLevelItem?.managerScore != null ? selectLevelItem.managerScore : ''}</td>
            </tr>
            <tr>
              <td class="text-center">2.5</td>
              <td><p class="font-bold">MỨC 5</p><p>Hoàn thành dưới 50% công việc theo kế hoạch, lịch công tác: tối đa 10 điểm.</p></td>
              <td class="text-center">10</td>
              <td class="text-center font-bold">${selLevelCode === '2.5' ? (selectLevelItem?.selfScore || 10) : ''}</td>
              <td class="text-center font-bold">${selLevelCode === '2.5' && selectLevelItem?.managerScore != null ? selectLevelItem.managerScore : ''}</td>
            </tr>

            <!-- TỔNG ĐIỂM -->
            <tr style="font-weight: bold; background-color: #f9f9f9;">
              <td colspan="2" class="text-center uppercase font-bold">TỔNG ĐIỂM</td>
              <td class="text-center font-bold">100</td>
              <td class="text-center font-bold">${form.totalScore}</td>
              <td class="text-center font-bold">${form.managerTotalScore !== null && form.managerTotalScore !== undefined ? form.managerTotalScore : '---'}</td>
            </tr>
          </tbody>
        </table>

        <!-- NHẬN XÉT CỦA CBQL -->
        ${form.managerGeneralComment ? `
          <div style="margin-bottom: 10pt; border: 1px solid #cccccc; padding: 6pt; background-color: #fafafa;">
            <p class="font-bold">Nhận xét chung của CBQL:</p>
            <p class="italic">${form.managerGeneralComment}</p>
          </div>
        ` : ''}

        <!-- XẾP LOẠI CÁ NHÂN & KÝ TÊN -->
        <div style="margin-top: 10pt;">
          <p><span class="font-bold">Cá nhân tự xếp loại:</span> ${form.selfClassification || '................................................'}</p>

          <table class="signature-table">
            <tr>
              <td style="width: 50%;"></td>
              <td style="width: 50%;">
                <p class="italic">Sơn Lương, ngày ${form.selfDate ? form.selfDate.split('/')[0] : '...'} tháng ${form.selfDate ? form.selfDate.split('/')[1] : '...'} năm ${form.selfDate ? form.selfDate.split('/')[2] : '...'}</p>
                <p class="font-bold uppercase">NGƯỜI ĐÁNH GIÁ</p>
                <p class="italic" style="font-size: 10pt;">(Ký và ghi rõ họ tên)</p>
                <br/><br/><br/>
                <p class="font-bold">${form.employeeName}</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- PHẦN B. ĐÁNH GIÁ CỦA THỦ TRƯỞNG -->
        <div style="margin-top: 20pt; border-top: 1px solid #000000; padding-top: 10pt;">
          <p class="font-bold uppercase">B. Ý KIẾN NHẬN XÉT, ĐÁNH GIÁ <span class="italic font-bold" style="text-transform: none;">(Phần dành cho người đứng đầu đơn vị)</span></p>
          <p><span class="font-bold">Mức xếp loại:</span> ${form.leaderClassification || '................................................................................'}</p>
          ${form.leaderComment ? `<p><span class="font-bold">Ý kiến nhận xét:</span> ${form.leaderComment}</p>` : ''}

          <table class="signature-table">
            <tr>
              <td style="width: 50%;"></td>
              <td style="width: 50%;">
                <p class="italic">Sơn Lương, ngày ${form.leaderDate ? form.leaderDate.split('/')[0] : '...'} tháng ${form.leaderDate ? form.leaderDate.split('/')[1] : '...'} năm ${form.leaderDate ? form.leaderDate.split('/')[2] : '...'}</p>
                <p class="font-bold uppercase">NGƯỜI NHẬN XÉT, ĐÁNH GIÁ</p>
                <p class="italic" style="font-size: 10pt;">(Ký, ghi rõ họ tên; đóng dấu)</p>
                <br/><br/><br/>
                <p class="font-bold">${form.leaderSignName || 'Hiệu trưởng'}</p>
              </td>
            </tr>
          </table>
        </div>

      </div>
      </body>
      </html>
    `;

    const fileName = generateWordFileName(form.employeeName, form.academicYear);
    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Lỗi khi xuất Word KPI Viên chức:', error);
    alert('Đã có lỗi xảy ra khi tạo file Word: ' + (error instanceof Error ? error.message : 'Không xác định'));
  }
};

/**
 * Xuất Phiếu đánh giá KPI Cán bộ Quản lý (CBQL) ra file Word (.doc)
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

    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
      <meta charset='utf-8'>
      <title>Phiếu đánh giá KPI CBQL</title>
      <!--[if gte mso 9]>
      <xml>
       <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>100</w:Zoom>
        <w:DoNotOptimizeForBrowser/>
       </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page WordSection1 {
          size: 210mm 297mm;
          margin: 20mm 20mm 20mm 20mm;
          mso-header-margin: 36.0pt;
          mso-footer-margin: 36.0pt;
          mso-paper-source: 0;
        }
        div.WordSection1 {
          page: WordSection1;
        }
        body {
          font-family: 'Times New Roman', serif;
          font-size: 13pt;
          line-height: 1.35;
          color: #000000;
        }
        p {
          margin-top: 3pt;
          margin-bottom: 3pt;
        }
        .header-table {
          width: 100%;
          border-collapse: collapse;
          border: none !important;
          margin-bottom: 15pt;
        }
        .header-table td {
          border: none !important;
          vertical-align: top;
          padding: 0;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .font-bold { font-weight: bold; }
        .italic { font-style: italic; }
        .uppercase { text-transform: uppercase; }
        
        table.data-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10pt;
          margin-bottom: 12pt;
        }
        table.data-table, table.data-table th, table.data-table td {
          border: 1px solid #000000;
        }
        table.data-table th {
          background-color: #f2f2f2;
          font-weight: bold;
          text-align: center;
          padding: 6pt 4pt;
          font-size: 12pt;
        }
        table.data-table td {
          padding: 5pt 4pt;
          font-size: 11.5pt;
          vertical-align: top;
        }
        .signature-table {
          width: 100%;
          border-collapse: collapse;
          border: none !important;
          margin-top: 15pt;
        }
        .signature-table td {
          border: none !important;
          vertical-align: top;
          text-align: center;
        }
      </style>
      </head>
      <body>
      <div class="WordSection1">
        
        <!-- HEADER CƠ QUAN -->
        <table class="header-table">
          <tr>
            <td style="width: 45%; text-align: center;">
              <p class="font-bold uppercase" style="font-size: 11pt;">SỞ GD&ĐT TỈNH PHÚ THỌ</p>
              <p class="font-bold uppercase" style="font-size: 12pt;">TRƯỜNG THPT SƠN LƯƠNG</p>
              <div style="border-bottom: 1px solid black; width: 100px; margin: 2pt auto;"></div>
            </td>
            <td style="width: 55%; text-align: center;">
              <p class="font-bold uppercase" style="font-size: 11pt;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p class="font-bold" style="font-size: 11pt; text-decoration: underline;">Độc lập – Tự do – Hạnh phúc</p>
            </td>
          </tr>
        </table>

        <!-- TIÊU ĐỀ PHIẾU -->
        <div style="text-align: center; margin-top: 10pt; margin-bottom: 15pt;">
          <p class="font-bold uppercase" style="font-size: 14pt; margin: 0;">
            PHIẾU ĐÁNH GIÁ, CHẤM ĐIỂM KPI CÁN BỘ QUẢN LÝ
          </p>
          <p class="font-bold" style="font-size: 13pt; margin-top: 3pt;">
            ${form.periodName} - NĂM HỌC ${form.academicYear}
          </p>
        </div>

        <!-- THÔNG TIN CBQL -->
        <div style="margin-bottom: 12pt; font-size: 13pt;">
          <p><span class="font-bold">Họ và tên người được đánh giá:</span> ${form.evaluateeName}</p>
          <p><span class="font-bold">Chức vụ:</span> ${form.evaluateePosition}</p>
          <p><span class="font-bold">Đơn vị:</span> ${form.evaluateeDepartmentName || 'Trường THPT Sơn Lương'}</p>
          <p><span class="font-bold">Người đánh giá (Thủ trưởng):</span> ${form.evaluatorName} - ${form.evaluatorPosition}</p>
        </div>

        <!-- BẢNG ĐÁNH GIÁ TIÊU CHÍ -->
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40pt;">Mã TC</th>
              <th style="text-align: left;">Tên Tiêu Chí & Nội dung đánh giá</th>
              <th style="width: 50pt;">Mức tối đa</th>
              <th style="width: 65pt;">Tự đánh giá</th>
              <th style="width: 70pt;">Thủ trưởng chấm</th>
            </tr>
          </thead>
          <tbody>
            
            <!-- NHÓM I -->
            <tr style="background-color: #f2f2f2;">
              <td class="text-center font-bold">I</td>
              <td class="font-bold">CHÍNH TRỊ TƯ TƯỞNG, ĐẠO ĐỨC LỐI SỐNG</td>
              <td class="text-center font-bold">15</td>
              <td class="text-center font-bold">${form.selfGroupScores?.group_I || 0}</td>
              <td class="text-center font-bold">${form.evaluatorGroupScores?.group_I || 0}</td>
            </tr>
            ${groupIItems.map(item => `
              <tr>
                <td class="text-center font-bold">${item.criterionCode}</td>
                <td>
                  <p class="font-bold">${item.criterionName}</p>
                  ${item.selfLevelLabel ? `<p class="italic" style="font-size: 10.5pt; color: #444444;">- Chọn: ${item.selfLevelLabel}</p>` : ''}
                </td>
                <td class="text-center">${item.maxScore}</td>
                <td class="text-center font-bold">${item.selfScore}</td>
                <td class="text-center font-bold">${item.evaluatorScore}</td>
              </tr>
            `).join('')}

            <!-- NHÓM II -->
            <tr style="background-color: #f2f2f2;">
              <td class="text-center font-bold">II</td>
              <td class="font-bold">TÁC PHONG, LỀ LỐI LÀM VIỆC, Ý THỨC TỔ CHỨC KỶ LUẬT</td>
              <td class="text-center font-bold">15</td>
              <td class="text-center font-bold">${form.selfGroupScores?.group_II || 0}</td>
              <td class="text-center font-bold">${form.evaluatorGroupScores?.group_II || 0}</td>
            </tr>
            ${groupIIItems.map(item => `
              <tr>
                <td class="text-center font-bold">${item.criterionCode}</td>
                <td>
                  <p class="font-bold">${item.criterionName}</p>
                  ${item.selfLevelLabel ? `<p class="italic" style="font-size: 10.5pt; color: #444444;">- Chọn: ${item.selfLevelLabel}</p>` : ''}
                </td>
                <td class="text-center">${item.maxScore}</td>
                <td class="text-center font-bold">${item.selfScore}</td>
                <td class="text-center font-bold">${item.evaluatorScore}</td>
              </tr>
            `).join('')}

            <!-- NHÓM III -->
            <tr style="background-color: #f2f2f2;">
              <td class="text-center font-bold">III</td>
              <td class="font-bold">KẾT QUẢ THỰC HIỆN NHIỆM VỤ ĐƯỢC GIAO</td>
              <td class="text-center font-bold">70</td>
              <td class="text-center font-bold">${form.selfGroupScores?.group_III || 0}</td>
              <td class="text-center font-bold">${form.evaluatorGroupScores?.group_III || 0}</td>
            </tr>
            ${groupIIIItems.map(item => `
              <tr>
                <td class="text-center font-bold">${item.criterionCode}</td>
                <td>
                  <p class="font-bold">${item.criterionName}</p>
                  ${item.selfLevelLabel ? `<p class="italic" style="font-size: 10.5pt; color: #444444;">- Chọn: ${item.selfLevelLabel}</p>` : ''}
                </td>
                <td class="text-center">${item.maxScore}</td>
                <td class="text-center font-bold">${item.selfScore}</td>
                <td class="text-center font-bold">${item.evaluatorScore}</td>
              </tr>
            `).join('')}

            <!-- TỔNG ĐIỂM -->
            <tr style="font-weight: bold; background-color: #e6f0fa;">
              <td colspan="2" class="text-center uppercase font-bold">TỔNG ĐIỂM ĐÁNH GIÁ</td>
              <td class="text-center font-bold">100</td>
              <td class="text-center font-bold">${form.selfTotalScore || 0}</td>
              <td class="text-center font-bold">${form.evaluatorTotalScore || 0}</td>
            </tr>
          </tbody>
        </table>

        <!-- NHẬN XÉT CÁ NHÂN & THỦ TRƯỞNG -->
        <div style="margin-top: 10pt;">
          <p><span class="font-bold">Xếp loại kết quả:</span> ${form.grade || 'Chưa xếp loại'}</p>
          ${form.selfComment ? `<p><span class="font-bold">Tự nhận xét của CBQL:</span> ${form.selfComment}</p>` : ''}
          ${form.evaluatorComment ? `<p><span class="font-bold">Nhận xét của Thủ trưởng:</span> ${form.evaluatorComment}</p>` : ''}
        </div>

        <!-- CHỮ KÝ -->
        <table class="signature-table">
          <tr>
            <td style="width: 50%;">
              <p class="font-bold uppercase">NGƯỜI TỰ ĐÁNH GIÁ</p>
              <p class="italic" style="font-size: 10pt;">(Ký và ghi rõ họ tên)</p>
              <br/><br/><br/>
              <p class="font-bold">${form.evaluateeName}</p>
            </td>
            <td style="width: 50%;">
              <p class="italic">Sơn Lương, ngày .... tháng .... năm 2026</p>
              <p class="font-bold uppercase">THỦ TRƯỞNG ĐÁNH GIÁ</p>
              <p class="italic" style="font-size: 10pt;">(Ký, ghi rõ họ tên và đóng dấu)</p>
              <br/><br/><br/>
              <p class="font-bold">${form.evaluatorName}</p>
            </td>
          </tr>
        </table>

      </div>
      </body>
      </html>
    `;

    const fileName = generateWordFileName(form.evaluateeName, form.academicYear);
    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Lỗi khi xuất Word KPI CBQL:', error);
    alert('Đã có lỗi xảy ra khi tạo file Word: ' + (error instanceof Error ? error.message : 'Không xác định'));
  }
};
