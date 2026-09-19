import React, { useState } from 'react';
import { X, Settings, Plus, Edit2, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { ConductCriterion, ConductCategory } from '../../types/homeroom';

interface CriteriaManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ConductCategory[];
  criteria: ConductCriterion[];
  onAddCriterion: (criterion: Omit<ConductCriterion, 'id'>) => Promise<void>;
  onUpdateCriterion: (id: string, updates: Partial<ConductCriterion>) => Promise<void>;
  onDeleteCriterion: (id: string) => Promise<void>;
}

export default function CriteriaManagerModal({
  isOpen,
  onClose,
  categories,
  criteria,
  onAddCriterion,
  onUpdateCriterion,
  onDeleteCriterion
}: CriteriaManagerModalProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [pointType, setPointType] = useState<'minus' | 'plus'>('minus');
  const [defaultPoint, setDefaultPoint] = useState(-5);
  const [severity, setSeverity] = useState<'Nhẹ' | 'Vừa' | 'Nghiêm trọng' | 'Rất nghiêm trọng'>('Vừa');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingId(null);
    setCode(`TC${String(criteria.length + 1).padStart(2, '0')}`);
    setName('');
    setDescription('');
    setCategoryId(categories[0]?.id || '');
    setPointType('minus');
    setDefaultPoint(-5);
    setSeverity('Vừa');
    setIsFormOpen(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (crit: ConductCriterion) => {
    setEditingId(crit.id);
    setCode(crit.code);
    setName(crit.name);
    setDescription(crit.description || '');
    setCategoryId(crit.categoryId);
    setPointType(crit.pointType);
    setDefaultPoint(crit.defaultPoint);
    setSeverity(crit.severity || 'Vừa');
    setIsFormOpen(true);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name || !categoryId) {
      setErrorMsg('Vui lòng điền đầy đủ Mã, Tên tiêu chí và Nhóm.');
      return;
    }

    const category = categories.find(c => c.id === categoryId);

    try {
      setSubmitting(true);
      setErrorMsg('');

      if (editingId) {
        await onUpdateCriterion(editingId, {
          code,
          name,
          description,
          categoryId,
          categoryName: category?.name || 'VI PHẠM KHÁC',
          pointType,
          defaultPoint: Number(defaultPoint),
          severity
        });
      } else {
        await onAddCriterion({
          code,
          name,
          description,
          categoryId,
          categoryName: category?.name || 'VI PHẠM KHÁC',
          pointType,
          defaultPoint: Number(defaultPoint),
          severity,
          status: 'active',
          sortOrder: criteria.length + 1
        });
      }

      setSubmitting(false);
      setIsFormOpen(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Lỗi khi lưu tiêu chí.');
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (crit: ConductCriterion) => {
    const newStatus = crit.status === 'active' ? 'inactive' : 'active';
    await onUpdateCriterion(crit.id, { status: newStatus });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tiêu chí này?')) {
      await onDeleteCriterion(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Settings size={20} className="text-blue-400" />
            CẤU HÌNH & QUẢN LÝ TIÊU CHÍ THEO DÕI NỀN NẾP (BGH)
          </h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50/60 p-4 rounded-xl border border-blue-100">
            <p className="text-xs text-slate-700">
              Hệ thống đã tích hợp sẵn <strong>16 tiêu chí nền nếp chuẩn</strong> từ file Excel <em>Theo dõi nền nếp.xlsx</em>. Bạn có thể chỉnh sửa số điểm, ẩn/hiện hoặc thêm mới tiêu chí bổ sung cho toàn trường.
            </p>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Plus size={16} /> Thêm tiêu chí mới
            </button>
          </div>

          {/* Form for Add/Edit */}
          {isFormOpen && (
            <form onSubmit={handleSubmit} className="bg-slate-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                {editingId ? 'Hiệu chỉnh tiêu chí' : 'Thêm mới tiêu chí'}
              </h3>

              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-2.5 rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Mã tiêu chí</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Nhóm tiêu chí</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Loại điểm</label>
                  <select
                    value={pointType}
                    onChange={(e) => {
                      const type = e.target.value as 'minus' | 'plus';
                      setPointType(type);
                      if (type === 'plus' && defaultPoint < 0) setDefaultPoint(Math.abs(defaultPoint));
                      if (type === 'minus' && defaultPoint > 0) setDefaultPoint(-Math.abs(defaultPoint));
                    }}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none"
                  >
                    <option value="minus">Điểm trừ (-)</option>
                    <option value="plus">Điểm cộng (+)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Tên tiêu chí vi phạm / khen thưởng</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Số điểm quy định</label>
                  <input
                    type="number"
                    value={defaultPoint}
                    onChange={(e) => setDefaultPoint(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Mức độ nghiêm trọng</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none"
                  >
                    <option value="Nhẹ">Nhẹ</option>
                    <option value="Vừa">Vừa</option>
                    <option value="Nghiêm trọng">Nghiêm trọng</option>
                    <option value="Rất nghiêm trọng">Rất nghiêm trọng</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Mô tả / Hướng dẫn</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu tiêu chí'}
                </button>
              </div>
            </form>
          )}

          {/* Table of Criteria */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="p-3 w-16">Mã</th>
                  <th className="p-3">Tên tiêu chí</th>
                  <th className="p-3">Nhóm</th>
                  <th className="p-3 text-center">Loại & Điểm</th>
                  <th className="p-3 text-center">Trạng thái</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {criteria.map(crit => (
                  <tr key={crit.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-600">{crit.code}</td>
                    <td className="p-3 font-semibold text-slate-800">
                      {crit.name}
                      {crit.description && (
                        <p className="text-[10px] text-slate-500 font-normal mt-0.5">{crit.description}</p>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">{crit.categoryName}</td>
                    <td className="p-3 text-center font-bold">
                      <span className={crit.pointType === 'plus' ? 'text-emerald-600' : 'text-rose-600'}>
                        {crit.pointType === 'plus' ? `+${crit.defaultPoint}` : `${crit.defaultPoint}`}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleStatus(crit)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors inline-flex items-center gap-1 ${
                          crit.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {crit.status === 'active' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                        {crit.status === 'active' ? 'Đang dùng' : 'Đã ẩn'}
                      </button>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(crit)}
                        className="text-blue-600 hover:text-blue-800 font-bold p-1"
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(crit.id)}
                        className="text-rose-600 hover:text-rose-800 font-bold p-1"
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
