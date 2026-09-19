import React, { useRef } from 'react';
import { X, Printer, Download, FileText } from 'lucide-react';
import { KpiVcForm } from '../../types/kpiVc';
import { useReactToPrint } from 'react-to-print';
import { exportSingleVcFormToExcel } from '../../utils/kpiVcExport';
import { exportVcFormToWord } from '../../utils/kpiWordExport';

interface KpiVcPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: KpiVcForm | null;
}

export default function KpiVcPrintModal({
  isOpen,
  onClose,
  form
}: KpiVcPrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Phieu_KPI_GVNV_${form?.employeeName || 'BaoCao'}_${form?.academicYear || '2025-2026'}`
  });

  if (!isOpen || !form) return null;

  const groupI = form.groupScores?.group_I ?? 0;
  const groupII = form.groupScores?.group_II ?? 0;
  const groupIII = form.groupScores?.group_III ?? 0;

  const mgrGroupI = form.managerGroupScores?.group_I ?? '---';
  const mgrGroupII = form.managerGroupScores?.group_II ?? '---';
  const mgrGroupIII = form.managerGroupScores?.group_III ?? '---';

  // Render items grouped by group I, II, III
  const items = form.items || [];
  const groupIItems = items.filter(it => it.groupId === 'group_I');
  const groupIIItems = items.filter(it => it.groupId === 'group_II');
  const groupIIIItems = items.filter(it => it.groupId === 'group_III');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col my-auto max-h-[96vh] overflow-hidden border border-slate-300">
        
        {/* HEADER MODAL - KHÔNG ĐƯỢC IN */}
        <div className="no-print bg-slate-800 text-white px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-blue-400" />
            <span className="font-bold text-sm">Xem trước bản in A4: {form.employeeName}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportSingleVcFormToExcel(form)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Download size={14} /> Xuất Excel
            </button>

            <button
              type="button"
              onClick={() => exportVcFormToWord(form)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <FileText size={14} /> Xuất Word (.doc)
            </button>

            <button
              type="button"
              onClick={() => handlePrint()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer"
            >
              <Printer size={15} /> In ngay (A4)
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PHẦN NỘI DUNG VĂN BẢN ĐƯỢC IN RA KHỔ GIẤY A4 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/50 custom-scrollbar">
          
          <div 
            ref={printRef}
            className="print-container bg-white border border-slate-300 rounded-lg p-8 sm:p-12 shadow-sm max-w-3xl mx-auto text-black font-serif leading-normal"
            style={{ minHeight: '297mm', color: '#000000', backgroundColor: '#ffffff' }}
          >
            
            {/* 1. QUỐC HUY / CƠ QUAN */}
            <div className="flex justify-between items-start text-center mb-6">
              <div className="w-5/12 text-center">
                <p className="text-[12px] uppercase font-bold">SỞ GD&ĐT TỈNH PHÚ THỌ</p>
                <p className="text-[13px] uppercase font-bold">TRƯỜNG THPT SƠN LƯƠNG</p>
                <div className="w-24 h-[1px] bg-black mx-auto mt-1" />
              </div>

              <div className="w-6/12 text-center">
                <p className="text-[12px] uppercase font-bold tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p className="text-[12px] font-bold underline">Độc lập – Tự do – Hạnh phúc</p>
              </div>
            </div>

            {/* 2. TIÊU ĐỀ */}
            <div className="text-center my-6">
              <h1 className="text-[15px] font-bold uppercase tracking-wide">
                PHIẾU ĐÁNH GIÁ, CHẤM ĐIỂM NĂM HỌC {form.academicYear || '2025-2026'}
              </h1>
              <p className="text-[13px] italic font-medium mt-0.5">
                (Áp dụng đối với viên chức không giữ chức vụ lãnh đạo, quản lý)
              </p>
            </div>

            {/* 3. THÔNG TIN */}
            <div className="space-y-1.5 text-[13px] mb-6">
              <p>
                <span className="font-semibold">Họ và tên:</span> {form.employeeName}
              </p>
              <p>
                <span className="font-semibold">Chức vụ:</span> {form.position}
              </p>
              <p>
                <span className="font-semibold">Đơn vị công tác:</span> {form.department}
              </p>
            </div>

            {/* 4. PHẦN A. NỘI DUNG CHẤM ĐIỂM */}
            <div className="mb-2">
              <p className="font-bold text-[13px] uppercase">
                A. NỘI DUNG CHẤM ĐIỂM
              </p>
            </div>

            {/* 5. BẢNG CHẤM ĐIỂM */}
            <table className="w-full border-collapse border border-black text-[12px] mb-6">
              <thead>
                <tr className="text-center font-bold border-b border-black">
                  <th className="border border-black p-2 w-10">Stt</th>
                  <th className="border border-black p-2 text-left">Nội dung đánh giá</th>
                  <th className="border border-black p-2 w-16">Điểm tối đa</th>
                  <th className="border border-black p-2 w-20">Điểm cá nhân tự chấm</th>
                  <th className="border border-black p-2 w-24">Đánh giá của CBQL</th>
                </tr>
              </thead>

              <tbody>
                
                {/* NHÓM I */}
                <tr className="font-bold">
                  <td className="border border-black p-1.5 text-center font-bold">I</td>
                  <td className="border border-black p-1.5 font-bold">Chính trị tư tưởng, đạo đức lối sống</td>
                  <td className="border border-black p-1.5 text-center font-bold">15</td>
                  <td className="border border-black p-1.5 text-center font-bold">{groupI}</td>
                  <td className="border border-black p-1.5 text-center font-bold">{mgrGroupI}</td>
                </tr>

                {groupIItems.map((item, idx) => (
                  <tr key={item.criterionId}>
                    <td className="border border-black p-1.5 text-center align-top">{idx + 1}</td>
                    <td className="border border-black p-1.5 align-top">{item.content}</td>
                    <td className="border border-black p-1.5 text-center align-top">{item.maxScore}</td>
                    <td className="border border-black p-1.5 text-center align-top font-semibold">{item.selfScore}</td>
                    <td className="border border-black p-1.5 text-center align-top font-semibold">{item.managerScore !== undefined && item.managerScore !== null ? item.managerScore : ''}</td>
                  </tr>
                ))}

                {/* NHÓM II */}
                <tr className="font-bold">
                  <td className="border border-black p-1.5 text-center font-bold">II</td>
                  <td className="border border-black p-1.5 font-bold">Tác phong, lề lối làm việc, ý thức tổ chức kỷ luật</td>
                  <td className="border border-black p-1.5 text-center font-bold">15</td>
                  <td className="border border-black p-1.5 text-center font-bold">{groupII}</td>
                  <td className="border border-black p-1.5 text-center font-bold">{mgrGroupII}</td>
                </tr>

                {groupIIItems.map((item, idx) => (
                  <tr key={item.criterionId}>
                    <td className="border border-black p-1.5 text-center align-top">{idx + 1}</td>
                    <td className="border border-black p-1.5 align-top">{item.content}</td>
                    <td className="border border-black p-1.5 text-center align-top">{item.maxScore}</td>
                    <td className="border border-black p-1.5 text-center align-top font-semibold">{item.selfScore}</td>
                    <td className="border border-black p-1.5 text-center align-top font-semibold">{item.managerScore !== undefined && item.managerScore !== null ? item.managerScore : ''}</td>
                  </tr>
                ))}

                {/* NHÓM III */}
                <tr className="font-bold">
                  <td className="border border-black p-1.5 text-center font-bold">III</td>
                  <td className="border border-black p-1.5 font-bold uppercase">KẾT QUẢ THỰC HIỆN NHIỆM VỤ</td>
                  <td className="border border-black p-1.5 text-center font-bold">70</td>
                  <td className="border border-black p-1.5 text-center font-bold">{groupIII}</td>
                  <td className="border border-black p-1.5 text-center font-bold">{mgrGroupIII}</td>
                </tr>

                {/* III.1 */}
                {groupIIIItems.filter(i => i.scoreType !== 'select_level').map((item) => (
                  <tr key={item.criterionId}>
                    <td className="border border-black p-1.5 text-center align-top font-bold">1</td>
                    <td className="border border-black p-1.5 align-top whitespace-pre-line">{item.content}</td>
                    <td className="border border-black p-1.5 text-center align-top font-bold">{item.maxScore}</td>
                    <td className="border border-black p-1.5 text-center align-top font-bold">{item.selfScore}</td>
                    <td className="border border-black p-1.5 text-center align-top font-bold">{item.managerScore !== undefined && item.managerScore !== null ? item.managerScore : ''}</td>
                  </tr>
                ))}

                {/* III.2 */}
                <tr className="font-bold">
                  <td className="border border-black p-1.5 text-center align-top">2</td>
                  <td className="border border-black p-1.5 align-top">Kết quả thực hiện nhiệm vụ được giao</td>
                  <td className="border border-black p-1.5 text-center align-top">60</td>
                  <td className="border border-black p-1.5 text-center align-top">
                    {groupIIIItems.find(i => i.scoreType === 'select_level')?.selfScore || 60}
                  </td>
                  <td className="border border-black p-1.5 text-center align-top">
                    {groupIIIItems.find(i => i.scoreType === 'select_level')?.managerScore ?? ''}
                  </td>
                </tr>

                {/* In đúng 5 mức III.2 theo mẫu PDF */}
                {groupIIIItems.filter(i => i.scoreType === 'select_level').map((item) => {
                  const selLevelCode = item.selectedLevelCode || '2.1';
                  return (
                    <React.Fragment key={item.criterionId}>
                      <tr>
                        <td className="border border-black p-1.5 text-center align-top">2.1</td>
                        <td className="border border-black p-1.5 align-top">
                          <p className="font-bold">MỨC 1</p>
                          <p>Hoàn thành 100% công việc theo kế hoạch, lịch công tác, đúng tiến độ, bảo đảm chất lượng, hiệu quả cao, trong đó có ít nhất 50% tiêu chí, nhiệm vụ hoàn thành vượt mức: tối đa 60 điểm.</p>
                        </td>
                        <td className="border border-black p-1.5 text-center align-top">60</td>
                        <td className="border border-black p-1.5 text-center align-top font-bold">
                          {selLevelCode === '2.1' ? `${item.selfScore}` : ''}
                        </td>
                        <td className="border border-black p-1.5 text-center align-top font-bold">
                          {item.managerScore !== undefined && item.managerScore !== null ? item.managerScore : ''}
                        </td>
                      </tr>

                      <tr>
                        <td className="border border-black p-1.5 text-center align-top">2.2</td>
                        <td className="border border-black p-1.5 align-top">
                          <p className="font-bold">MỨC 2</p>
                          <p>Hoàn thành 100% công việc theo kế hoạch, lịch công tác, đúng tiến độ, bảo đảm chất lượng, hiệu quả: tối đa 50 điểm.</p>
                        </td>
                        <td className="border border-black p-1.5 text-center align-top">50</td>
                        <td className="border border-black p-1.5 text-center align-top font-bold">
                          {selLevelCode === '2.2' ? `${item.selfScore}` : ''}
                        </td>
                        <td className="border border-black p-1.5 text-center align-top font-bold"></td>
                      </tr>

                      <tr>
                        <td className="border border-black p-1.5 text-center align-top">2.3</td>
                        <td className="border border-black p-1.5 align-top">
                          <p className="font-bold">MỨC 3</p>
                          <p>Hoàn thành 100% công việc theo kế hoạch, lịch công tác, trong đó có không quá 20% nhiệm vụ chưa bảo đảm chất lượng, tiến độ hoặc hiệu quả thấp: tối đa 30 điểm.</p>
                        </td>
                        <td className="border border-black p-1.5 text-center align-top">30</td>
                        <td className="border border-black p-1.5 text-center align-top font-bold">
                          {selLevelCode === '2.3' ? `${item.selfScore}` : ''}
                        </td>
                        <td className="border border-black p-1.5 text-center align-top font-bold"></td>
                      </tr>

                      <tr>
                        <td className="border border-black p-1.5 text-center align-top">2.4</td>
                        <td className="border border-black p-1.5 align-top">
                          <p className="font-bold">MỨC 4</p>
                          <p>Hoàn thành từ 50% đến dưới 100% công việc theo kế hoạch, lịch công tác: tối đa 20 điểm.</p>
                        </td>
                        <td className="border border-black p-1.5 text-center align-top">20</td>
                        <td className="border border-black p-1.5 text-center align-top font-bold">
                          {selLevelCode === '2.4' ? `${item.selfScore}` : ''}
                        </td>
                        <td className="border border-black p-1.5 text-center align-top font-bold"></td>
                      </tr>

                      <tr>
                        <td className="border border-black p-1.5 text-center align-top">2.5</td>
                        <td className="border border-black p-1.5 align-top">
                          <p className="font-bold">MỨC 5</p>
                          <p>Hoàn thành dưới 50% công việc theo kế hoạch, lịch công tác: tối đa 10 điểm.</p>
                        </td>
                        <td className="border border-black p-1.5 text-center align-top">10</td>
                        <td className="border border-black p-1.5 text-center align-top font-bold">
                          {selLevelCode === '2.5' ? `${item.selfScore}` : ''}
                        </td>
                        <td className="border border-black p-1.5 text-center align-top font-bold"></td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* TỔNG ĐIỂM */}
                <tr className="font-bold text-[13px]">
                  <td className="border border-black p-2 text-center uppercase" colSpan={2}>
                    TỔNG ĐIỂM
                  </td>
                  <td className="border border-black p-2 text-center">100</td>
                  <td className="border border-black p-2 text-center">{form.totalScore}</td>
                  <td className="border border-black p-2 text-center">{form.managerTotalScore !== null && form.managerTotalScore !== undefined ? form.managerTotalScore : '---'}</td>
                </tr>

              </tbody>
            </table>

            {form.managerGeneralComment && (
              <div className="mb-4 text-[13px] border border-slate-300 p-3 rounded bg-amber-50/30">
                <p className="font-bold">Nhận xét chung của CBQL:</p>
                <p className="italic">{form.managerGeneralComment}</p>
              </div>
            )}

            {/* 6. XẾP LOẠI & KÝ TÊN */}
            <div className="space-y-4 text-[13px]">
              <p>
                <span className="font-bold">Cá nhân tự xếp loại:</span> {form.selfClassification || '................................................'}
              </p>

              <div className="flex justify-end text-center pt-2">
                <div className="w-64 space-y-1">
                  <p className="italic">
                    Sơn Lương, ngày {form.selfDate ? form.selfDate.split('/')[0] : '...'} tháng {form.selfDate ? form.selfDate.split('/')[1] : '...'} năm {form.selfDate ? form.selfDate.split('/')[2] : '...'}
                  </p>
                  <p className="font-bold uppercase">Người đánh giá</p>
                  <p className="text-[11px] italic">(Ký và ghi rõ họ tên)</p>
                  <div className="h-16" />
                  <p className="font-bold">{form.employeeName}</p>
                </div>
              </div>

              {/* PHẦN B */}
              <div className="border-t border-black pt-4 mt-6 space-y-3">
                <p className="font-bold uppercase text-[13px]">
                  B. Ý KIẾN NHẬN XÉT, ĐÁNH GIÁ <span className="font-normal normal-case italic">(Phần dành cho người đứng đầu đơn vị)</span>
                </p>

                <p>
                  <span className="font-bold">Mức xếp loại:</span> {form.leaderClassification || '................................................................................'}
                </p>

                {form.leaderComment && (
                  <p>
                    <span className="font-bold">Ý kiến nhận xét:</span> {form.leaderComment}
                  </p>
                )}

                <div className="flex justify-end text-center pt-4">
                  <div className="w-72 space-y-1">
                    <p className="italic">
                      Sơn Lương, ngày {form.leaderDate ? form.leaderDate.split('/')[0] : '...'} tháng {form.leaderDate ? form.leaderDate.split('/')[1] : '...'} năm {form.leaderDate ? form.leaderDate.split('/')[2] : '...'}
                    </p>
                    <p className="font-bold uppercase">NGƯỜI NHẬN XÉT, ĐÁNH GIÁ</p>
                    <p className="text-[11px] italic">(Ký, ghi rõ họ tên; đóng dấu)</p>
                    <div className="h-16" />
                    <p className="font-bold">{form.leaderSignName || 'Hiệu trưởng'}</p>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
