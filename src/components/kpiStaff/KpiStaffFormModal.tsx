import React, { useState, useEffect } from 'react';
import { KpiStaffForm, KpiStaffScoreItem, StaffPositionKey } from '../../types/kpiStaff';
import { POSITION_CONFIGS, getClassificationByScore } from '../../lib/kpiStaffData';
import { 
  FileCheck, Award, Save, Send, Lock, Printer, X, MessageSquare, AlertCircle, Sparkles 
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  form: KpiStaffForm | null;
  onSaveForm: (updatedForm: KpiStaffForm) => void;
  onPrintForm?: (form: KpiStaffForm) => void;
}

export default function KpiStaffFormModal({
  isOpen,
  onClose,
  form,
  onSaveForm,
  onPrintForm
}: Props) {
  const [formData, setFormData] = useState<KpiStaffForm | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  useEffect(() => {
    if (form) {
      setFormData(JSON.parse(JSON.stringify(form)));
      setSaveSuccessMsg('');
    }
  }, [form]);

  if (!isOpen || !formData) return null;

  const isLocked = formData.status === 'locked' || formData.status === 'completed';
  const posConfig = POSITION_CONFIGS[formData.positionKey] || POSITION_CONFIGS.KE_TOAN;

  const handlePositionChange = (newKey: StaffPositionKey) => {
    if (isLocked) return;
    const newPosConfig = POSITION_CONFIGS[newKey];
    
    const newPositionItems: KpiStaffScoreItem[] = newPosConfig.criteria.map(c => ({
      criterionId: c.id,
      code: c.code,
      category: 'B_VI_TRI',
      content: c.content,
      maxScore: c.maxScore,
      selfScore: c.maxScore,
      evidence: ''
    }));

    const posTotal = newPositionItems.reduce((acc, curr) => acc + curr.selfScore, 0);
    const newTotalScore = formData.generalTotalSelf + posTotal;

    setFormData({
      ...formData,
      positionKey: newKey,
      position: newPosConfig.positionName,
      positionItems: newPositionItems,
      positionTotalSelf: posTotal,
      totalScore: newTotalScore,
      selfClassification: getClassificationByScore(newTotalScore)
    });
  };

  const handleGeneralScoreChange = (index: number, score: number) => {
    if (isLocked) return;
    const items = [...formData.generalItems];
    const max = items[index].maxScore;
    items[index].selfScore = Math.min(max, Math.max(0, score));

    const genTotal = items.reduce((acc, curr) => acc + curr.selfScore, 0);
    const newTotal = genTotal + formData.positionTotalSelf;

    setFormData({
      ...formData,
      generalItems: items,
      generalTotalSelf: genTotal,
      totalScore: newTotal,
      selfClassification: getClassificationByScore(newTotal)
    });
  };

  const handlePositionScoreChange = (index: number, score: number) => {
    if (isLocked) return;
    const items = [...formData.positionItems];
    const max = items[index].maxScore;
    items[index].selfScore = Math.min(max, Math.max(0, score));

    const posTotal = items.reduce((acc, curr) => acc + curr.selfScore, 0);
    const newTotal = formData.generalTotalSelf + posTotal;

    setFormData({
      ...formData,
      positionItems: items,
      positionTotalSelf: posTotal,
      totalScore: newTotal,
      selfClassification: getClassificationByScore(newTotal)
    });
  };

  const handleEvidenceChange = (category: 'A_CHUNG' | 'B_VI_TRI', index: number, evidence: string) => {
    if (isLocked) return;
    if (category === 'A_CHUNG') {
      const items = [...formData.generalItems];
      items[index].evidence = evidence;
      setFormData({ ...formData, generalItems: items });
    } else {
      const items = [...formData.positionItems];
      items[index].evidence = evidence;
      setFormData({ ...formData, positionItems: items });
    }
  };

  const handleSave = (newStatus?: KpiStaffForm['status']) => {
    if (!formData) return;
    const finalStatus = newStatus || formData.status;
    const updatedForm: KpiStaffForm = {
      ...formData,
      status: finalStatus,
      updatedAt: new Date().toISOString()
    };
    onSaveForm(updatedForm);
    setSaveSuccessMsg('Đã lưu phiếu đánh giá KPI thành công!');
    setTimeout(() => setSaveSuccessMsg(''), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <FileCheck className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-emerald-200 uppercase tracking-wide">SỞ GD&ĐT PHÚ THỌ - THPT SƠN LƯƠNG</span>
                <span className="px-2 py-0.5 bg-emerald-700/80 rounded text-[10px] font-bold text-emerald-100 border border-emerald-500/40">
                  {formData.academicYear}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                PHIẾU ĐÁNH GIÁ, CHẤM ĐIỂM KPI NHÂN VIÊN - {formData.employeeName.toUpperCase()}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onPrintForm && (
              <button
                onClick={() => onPrintForm(formData)}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 border border-white/20"
              >
                <Printer size={15} /> In phiếu
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-emerald-200 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Info & Config Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 text-xs font-semibold text-slate-700">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Họ và tên & Đơn vị</span>
            <p className="text-slate-900 font-bold">{formData.employeeName} ({formData.department || 'Tổ Văn phòng'})</p>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Kích hoạt Bộ KPI Vị trí việc làm (70đ)</span>
            <select
              disabled={isLocked}
              value={formData.positionKey}
              onChange={e => handlePositionChange(e.target.value as StaffPositionKey)}
              className="mt-0.5 w-full px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {Object.values(POSITION_CONFIGS).map(cfg => (
                <option key={cfg.key} value={cfg.key}>
                  {cfg.positionName} (70 điểm)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Tổng điểm đạt được</span>
              <span className="text-base font-black text-emerald-800">{formData.totalScore} / 100 điểm</span>
            </div>
            <div className="px-3 py-1 bg-emerald-100 text-emerald-900 rounded-xl border border-emerald-300 text-xs font-extrabold">
              {formData.selfClassification}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-600" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Section A: KPI CHUNG - 30 ĐIỂM */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="bg-emerald-900 text-white px-4 py-2.5 font-bold flex justify-between items-center">
              <span>A. KPI CHUNG – 30 ĐIỂM (Áp dụng cho tất cả nhân viên)</span>
              <span className="bg-emerald-700 px-2.5 py-0.5 rounded text-xs font-extrabold">{formData.generalTotalSelf} / 30đ</span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="p-3 w-20 text-center">Mã KPI</th>
                  <th className="p-3">Nội dung đánh giá / nhiệm vụ</th>
                  <th className="p-3 w-24 text-center">Điểm tối đa</th>
                  <th className="p-3 w-28 text-center">Cá nhân tự chấm</th>
                  <th className="p-3">Minh chứng / ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {formData.generalItems.map((item, idx) => (
                  <tr key={item.code} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-center font-bold text-emerald-800 bg-emerald-50/50">{item.code}</td>
                    <td className="p-3 font-medium text-slate-800">{item.content}</td>
                    <td className="p-3 text-center font-bold text-slate-600">{item.maxScore}</td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max={item.maxScore}
                        disabled={isLocked}
                        value={item.selfScore}
                        onChange={e => handleGeneralScoreChange(idx, parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        disabled={isLocked}
                        value={item.evidence || ''}
                        onChange={e => handleEvidenceChange('A_CHUNG', idx, e.target.value)}
                        placeholder="Nhập minh chứng..."
                        className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section B: KPI VỊ TRÍ VIỆC LÀM - 70 ĐIỂM */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="bg-teal-900 text-white px-4 py-2.5 font-bold flex justify-between items-center">
              <span>{posConfig.title}</span>
              <span className="bg-teal-700 px-2.5 py-0.5 rounded text-xs font-extrabold">{formData.positionTotalSelf} / 70đ</span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="p-3 w-12 text-center">STT</th>
                  <th className="p-3 w-20 text-center">Mã KPI</th>
                  <th className="p-3">Nhiệm vụ cụ thể</th>
                  <th className="p-3 w-24 text-center">Điểm tối đa</th>
                  <th className="p-3 w-28 text-center">Cá nhân tự chấm</th>
                  <th className="p-3">Minh chứng / ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {formData.positionItems.map((item, idx) => (
                  <tr key={item.code} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="p-3 text-center font-bold text-teal-800 bg-teal-50/50">{item.code}</td>
                    <td className="p-3 font-medium text-slate-800">{item.content}</td>
                    <td className="p-3 text-center font-bold text-slate-600">{item.maxScore}</td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max={item.maxScore}
                        disabled={isLocked}
                        value={item.selfScore}
                        onChange={e => handlePositionScoreChange(idx, parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-teal-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        disabled={isLocked}
                        value={item.evidence || ''}
                        onChange={e => handleEvidenceChange('B_VI_TRI', idx, e.target.value)}
                        placeholder="Nhập minh chứng..."
                        className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section C & D: Evidence suggestion & Total summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <h4 className="font-extrabold text-slate-800 uppercase text-[11px] tracking-wider">Gợi ý minh chứng & Người theo dõi</h4>
              <p className="text-slate-600 leading-relaxed"><strong>Minh chứng gợi ý:</strong> {posConfig.evidenceSuggestion}</p>
              <p className="text-slate-600 leading-relaxed"><strong>Người theo dõi:</strong> {posConfig.trackingPerson}</p>
            </div>

            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2 font-bold text-slate-800">
              <h4 className="font-extrabold text-emerald-900 uppercase text-[11px] tracking-wider">D. TỔNG HỢP ĐIỂM KPI</h4>
              <div className="flex justify-between border-b border-emerald-200/80 pb-1">
                <span>1. KPI Chung (Tối đa 30đ):</span>
                <span className="text-emerald-900">{formData.generalTotalSelf} điểm</span>
              </div>
              <div className="flex justify-between border-b border-emerald-200/80 pb-1">
                <span>2. KPI Vị trí việc làm (Tối đa 70đ):</span>
                <span className="text-emerald-900">{formData.positionTotalSelf} điểm</span>
              </div>
              <div className="flex justify-between text-sm pt-1">
                <span className="font-black text-slate-900">TỔNG ĐIỂM KPI ĐẠT ĐƯỢC:</span>
                <span className="font-black text-emerald-800 text-base">{formData.totalScore} / 100 ĐIỂM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs font-semibold text-slate-500">
            Trạng thái: <span className="font-bold text-emerald-800 uppercase">{formData.status === 'completed' ? 'Đã nghiệm thu' : 'Bản nháp'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
            >
              Đóng
            </button>

            {!isLocked && (
              <>
                <button
                  onClick={() => handleSave('draft')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Save size={15} /> Lưu nháp
                </button>

                <button
                  onClick={() => handleSave('completed')}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-md"
                >
                  <Send size={15} /> Hoàn tất & Nghiệm thu
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
