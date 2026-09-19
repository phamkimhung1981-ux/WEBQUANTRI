import { 
  KpiVcCriteriaGroup, 
  KpiVcCriterion, 
  KpiVcPeriod, 
  KpiVcScoreItem, 
  KpiVcCriteriaSnapshot,
  KpiVcLevel
} from '../types/kpiVc';
import { Teacher, Department } from '../types';

/**
 * 3 NHÓM TIÊU CHÍ CHUẨN THEO FILE PDF:
 * I. CHÍNH TRỊ TƯ TƯỞNG, ĐẠO ĐỨC LỐI SỐNG: 15 điểm
 * II. TÁC PHONG, LỀ LỐI LÀM VIỆC, Ý THỨC TỔ CHỨC KỶ LUẬT: 15 điểm
 * III. KẾT QUẢ THỰC HIỆN NHIỆM VỤ: 70 điểm
 * TỔNG CỘNG: 100 ĐIỂM
 */

export const DEFAULT_VC_GROUPS: KpiVcCriteriaGroup[] = [
  {
    id: 'group_I',
    code: 'I',
    name: 'Chính trị tư tưởng, đạo đức lối sống',
    maxScore: 15,
    order: 1,
    description: 'Đánh giá việc chấp hành đường lối chính trị, đạo đức công vụ, lối sống giản dị, tinh thần đoàn kết.',
    isActive: true
  },
  {
    id: 'group_II',
    code: 'II',
    name: 'Tác phong, lề lối làm việc, ý thức tổ chức kỷ luật',
    maxScore: 15,
    order: 2,
    description: 'Đánh giá tinh thần trách nhiệm, phương pháp làm việc, văn hóa ứng xử công vụ và chấp hành nội quy.',
    isActive: true
  },
  {
    id: 'group_III',
    code: 'III',
    name: 'Kết quả thực hiện nhiệm vụ',
    maxScore: 70,
    order: 3,
    description: 'Đánh giá năng lực chuyên môn, kỹ năng làm việc và kết quả hoàn thành nhiệm vụ được giao theo 5 mức.',
    isActive: true
  }
];

export const DEFAULT_VC_LEVELS_III_2: KpiVcLevel[] = [
  {
    id: 'level_2_1',
    code: '2.1',
    name: 'MỨC 1',
    score: 60,
    description: 'Hoàn thành 100% công việc theo kế hoạch, lịch công tác, đúng tiến độ, bảo đảm chất lượng, hiệu quả cao, trong đó có ít nhất 50% tiêu chí, nhiệm vụ hoàn thành vượt mức: tối đa 60 điểm.',
    order: 1
  },
  {
    id: 'level_2_2',
    code: '2.2',
    name: 'MỨC 2',
    score: 50,
    description: 'Hoàn thành 100% công việc theo kế hoạch, lịch công tác, đúng tiến độ, bảo đảm chất lượng, hiệu quả: tối đa 50 điểm.',
    order: 2
  },
  {
    id: 'level_2_3',
    code: '2.3',
    name: 'MỨC 3',
    score: 30,
    description: 'Hoàn thành 100% công việc theo kế hoạch, lịch công tác, trong đó có không quá 20% nhiệm vụ chưa bảo đảm chất lượng, tiến độ hoặc hiệu quả thấp: tối đa 30 điểm.',
    order: 3
  },
  {
    id: 'level_2_4',
    code: '2.4',
    name: 'MỨC 4',
    score: 20,
    description: 'Hoàn thành từ 50% đến dưới 100% công việc theo kế hoạch, lịch công tác: tối đa 20 điểm.',
    order: 4
  },
  {
    id: 'level_2_5',
    code: '2.5',
    name: 'MỨC 5',
    score: 10,
    description: 'Hoàn thành dưới 50% công việc theo kế hoạch, lịch công tác: tối đa 10 điểm.',
    order: 5
  }
];

export const DEFAULT_VC_CRITERIA: KpiVcCriterion[] = [
  // --- NHÓM I: 8 TIÊU CHÍ (15 ĐIỂM) ---
  {
    id: 'crit_I_1',
    code: 'I.1',
    groupId: 'group_I',
    groupName: 'Chính trị tư tưởng, đạo đức lối sống',
    order: 1,
    content: 'Chấp hành chủ trương, đường lối, quy định của Đảng, chính sách, pháp luật của Nhà nước và các nguyên tắc tổ chức, kỷ luật của Đảng, nhất là nguyên tắc tập trung dân chủ, tự phê bình và phê bình.',
    maxScore: 2,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_I_2',
    code: 'I.2',
    groupId: 'group_I',
    groupName: 'Chính trị tư tưởng, đạo đức lối sống',
    order: 2,
    content: 'Có quan điểm, bản lĩnh chính trị vững vàng; kiên định lập trường; không dao động trước mọi khó khăn, thách thức.',
    maxScore: 2,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_I_3',
    code: 'I.3',
    groupId: 'group_I',
    groupName: 'Chính trị tư tưởng, đạo đức lối sống',
    order: 3,
    content: 'Đặt lợi ích của Đảng, quốc gia - dân tộc, nhân dân, tập thể lên trên lợi ích cá nhân.',
    maxScore: 1.5,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_I_4',
    code: 'I.4',
    groupId: 'group_I',
    groupName: 'Chính trị tư tưởng, đạo đức lối sống',
    order: 4,
    content: 'Có ý thức nghiên cứu, học tập, vận dụng chủ nghĩa Mác - Lênin, tư tưởng Hồ Chí Minh, nghị quyết, chỉ thị, quyết định và các văn bản của Đảng.',
    maxScore: 1.5,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_I_5',
    code: 'I.5',
    groupId: 'group_I',
    groupName: 'Chính trị tư tưởng, đạo đức lối sống',
    order: 5,
    content: 'Không tham ô, tham nhũng, tiêu cực, lãng phí, quan liêu, cơ hội, vụ lợi, hách dịch, cửa quyền; không có biểu hiện suy thoái về đạo đức, lối sống, tự diễn biến, tự chuyển hóa.',
    maxScore: 2,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_I_6',
    code: 'I.6',
    groupId: 'group_I',
    groupName: 'Chính trị tư tưởng, đạo đức lối sống',
    order: 6,
    content: 'Có lối sống trung thực, khiêm tốn, chân thành, trong sáng, giản dị.',
    maxScore: 2,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_I_7',
    code: 'I.7',
    groupId: 'group_I',
    groupName: 'Chính trị tư tưởng, đạo đức lối sống',
    order: 7,
    content: 'Có tinh thần đoàn kết, xây dựng cơ quan, tổ chức, đơn vị trong sạch, vững mạnh.',
    maxScore: 2,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_I_8',
    code: 'I.8',
    groupId: 'group_I',
    groupName: 'Chính trị tư tưởng, đạo đức lối sống',
    order: 8,
    content: 'Không để người thân, người quen lợi dụng chức vụ, quyền hạn của mình để trục lợi.',
    maxScore: 2,
    scoreType: 'input_score',
    isActive: true
  },

  // --- NHÓM II: 8 TIÊU CHÍ (15 ĐIỂM) ---
  {
    id: 'crit_II_1',
    code: 'II.1',
    groupId: 'group_II',
    groupName: 'Tác phong, lề lối làm việc, ý thức tổ chức kỷ luật',
    order: 1,
    content: 'Có trách nhiệm với công việc; năng động, sáng tạo, dám nghĩ, dám làm, linh hoạt trong thực hiện nhiệm vụ.',
    maxScore: 2,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_II_2',
    code: 'II.2',
    groupId: 'group_II',
    groupName: 'Tác phong, lề lối làm việc, ý thức tổ chức kỷ luật',
    order: 2,
    content: 'Phương pháp làm việc khoa học, dân chủ, đúng nguyên tắc.',
    maxScore: 1.5,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_II_3',
    code: 'II.3',
    groupId: 'group_II',
    groupName: 'Tác phong, lề lối làm việc, ý thức tổ chức kỷ luật',
    order: 3,
    content: 'Có tinh thần trách nhiệm và phối hợp trong thực hiện nhiệm vụ.',
    maxScore: 2,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_II_4',
    code: 'II.4',
    groupId: 'group_II',
    groupName: 'Tác phong, lề lối làm việc, ý thức tổ chức kỷ luật',
    order: 4,
    content: 'Có thái độ đúng mực và phong cách ứng xử, lề lối làm việc chuẩn mực, đáp ứng yêu cầu của văn hóa công vụ.',
    maxScore: 2,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_II_5',
    code: 'II.5',
    groupId: 'group_II',
    groupName: 'Tác phong, lề lối làm việc, ý thức tổ chức kỷ luật',
    order: 5,
    content: 'Chấp hành sự phân công của tổ chức.',
    maxScore: 1.5,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_II_6',
    code: 'II.6',
    groupId: 'group_II',
    groupName: 'Tác phong, lề lối làm việc, ý thức tổ chức kỷ luật',
    order: 6,
    content: 'Thực hiện các quy định, quy chế, nội quy của cơ quan, tổ chức, đơn vị nơi công tác.',
    maxScore: 2,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_II_7',
    code: 'II.7',
    groupId: 'group_II',
    groupName: 'Tác phong, lề lối làm việc, ý thức tổ chức kỷ luật',
    order: 7,
    content: 'Thực hiện việc kê khai và công khai tài sản, thu nhập theo quy định.',
    maxScore: 2,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_II_8',
    code: 'II.8',
    groupId: 'group_II',
    groupName: 'Tác phong, lề lối làm việc, ý thức tổ chức kỷ luật',
    order: 8,
    content: 'Báo cáo đầy đủ, trung thực, cung cấp thông tin chính xác, khách quan về những nội dung liên quan đến việc thực hiện chức trách, nhiệm vụ được giao và hoạt động của cơ quan, tổ chức, đơn vị với cấp trên khi được yêu cầu.',
    maxScore: 2,
    scoreType: 'input_score',
    isActive: true
  },

  // --- NHÓM III: KẾT QUẢ THỰC HIỆN NHIỆM VỤ (70 ĐIỂM) ---
  {
    id: 'crit_III_1',
    code: 'III.1',
    groupId: 'group_III',
    groupName: 'Kết quả thực hiện nhiệm vụ',
    order: 1,
    content: `1. Năng lực và kỹ năng làm việc:
- Năng lực chuyên môn, nghiệp vụ theo yêu cầu của vị trí việc làm.
- Khả năng đáp ứng yêu cầu thực thi nhiệm vụ được giao thường xuyên, đột xuất.
- Sử dụng thành thạo các phần mềm, ứng dụng công nghệ thông tin đáp ứng yêu cầu công việc.
- Sẵn sàng tham gia thực hiện nhiệm vụ chính trị đặc biệt quan trọng, nhiệm vụ có tính chất đột xuất, phức tạp hoặc trong điều kiện khó khăn.`,
    maxScore: 10,
    scoreType: 'input_score',
    isActive: true
  },
  {
    id: 'crit_III_2',
    code: 'III.2',
    groupId: 'group_III',
    groupName: 'Kết quả thực hiện nhiệm vụ',
    order: 2,
    content: '2. Kết quả thực hiện nhiệm vụ được giao (Chọn 1 trong 5 mức tương ứng kết quả đạt được)',
    maxScore: 60,
    scoreType: 'select_level',
    levels: DEFAULT_VC_LEVELS_III_2,
    isActive: true
  }
];

export const DEFAULT_VC_PERIODS: KpiVcPeriod[] = [
  // Năm học 2026-2027
  {
    id: 'vc_period_2026_2027_ca_nam',
    name: 'Cả năm học 2026-2027',
    academicYear: '2026-2027',
    startDate: '2026-09-01',
    endDate: '2027-05-31',
    status: 'active',
    description: 'Tổng kết đánh giá KPI viên chức cả năm học 2026-2027'
  },
  {
    id: 'vc_period_2026_2027_hk2',
    name: 'Học kỳ II năm học 2026-2027',
    academicYear: '2026-2027',
    startDate: '2027-01-16',
    endDate: '2027-05-31',
    status: 'active',
    description: 'Đánh giá KPI viên chức giáo viên, nhân viên Học kỳ II năm học 2026-2027'
  },
  {
    id: 'vc_period_2026_2027_hk1',
    name: 'Học kỳ I năm học 2026-2027',
    academicYear: '2026-2027',
    startDate: '2026-09-01',
    endDate: '2027-01-15',
    status: 'active',
    description: 'Đánh giá KPI viên chức giáo viên, nhân viên Học kỳ I năm học 2026-2027'
  },
  { id: 'vc_period_2026_01', name: 'Tháng 1/2026', academicYear: '2025-2026', startDate: '2026-01-01', endDate: '2026-01-31', status: 'active', description: 'Đánh giá KPI tháng 1 năm 2026' },
  { id: 'vc_period_2026_02', name: 'Tháng 2/2026', academicYear: '2025-2026', startDate: '2026-02-01', endDate: '2026-02-28', status: 'active', description: 'Đánh giá KPI tháng 2 năm 2026' },
  { id: 'vc_period_2026_03', name: 'Tháng 3/2026', academicYear: '2025-2026', startDate: '2026-03-01', endDate: '2026-03-31', status: 'active', description: 'Đánh giá KPI tháng 3 năm 2026' },
  { id: 'vc_period_2026_04', name: 'Tháng 4/2026', academicYear: '2025-2026', startDate: '2026-04-01', endDate: '2026-04-30', status: 'active', description: 'Đánh giá KPI tháng 4 năm 2026' },
  { id: 'vc_period_2026_05', name: 'Tháng 5/2026', academicYear: '2025-2026', startDate: '2026-05-01', endDate: '2026-05-31', status: 'active', description: 'Đánh giá KPI tháng 5 năm 2026' },
  { id: 'vc_period_2026_06', name: 'Tháng 6/2026', academicYear: '2025-2026', startDate: '2026-06-01', endDate: '2026-06-30', status: 'active', description: 'Đánh giá KPI tháng 6 năm 2026' },
  { id: 'vc_period_2026_07', name: 'Tháng 7/2026', academicYear: '2025-2026', startDate: '2026-07-01', endDate: '2026-07-31', status: 'active', description: 'Đánh giá KPI tháng 7 năm 2026' },
  { id: 'vc_period_2026_08', name: 'Tháng 8/2026', academicYear: '2025-2026', startDate: '2026-08-01', endDate: '2026-08-31', status: 'active', description: 'Đánh giá KPI tháng 8 năm 2026' },
  { id: 'vc_period_2026_09', name: 'Tháng 9/2026', academicYear: '2026-2027', startDate: '2026-09-01', endDate: '2026-09-30', status: 'active', description: 'Đánh giá KPI tháng 9 năm 2026' },
  { id: 'vc_period_2026_10', name: 'Tháng 10/2026', academicYear: '2026-2027', startDate: '2026-10-01', endDate: '2026-10-31', status: 'active', description: 'Đánh giá KPI tháng 10 năm 2026' },
  { id: 'vc_period_2026_11', name: 'Tháng 11/2026', academicYear: '2026-2027', startDate: '2026-11-01', endDate: '2026-11-30', status: 'active', description: 'Đánh giá KPI tháng 11 năm 2026' },
  { id: 'vc_period_2026_12', name: 'Tháng 12/2026', academicYear: '2026-2027', startDate: '2026-12-01', endDate: '2026-12-31', status: 'active', description: 'Đánh giá KPI tháng 12 năm 2026' },
  { id: 'vc_period_2027_01', name: 'Tháng 1/2027', academicYear: '2026-2027', startDate: '2027-01-01', endDate: '2027-01-31', status: 'active', description: 'Đánh giá KPI tháng 1 năm 2027' },
  { id: 'vc_period_2027_02', name: 'Tháng 2/2027', academicYear: '2026-2027', startDate: '2027-02-01', endDate: '2027-02-28', status: 'active', description: 'Đánh giá KPI tháng 2 năm 2027' },
  { id: 'vc_period_2027_03', name: 'Tháng 3/2027', academicYear: '2026-2027', startDate: '2027-03-01', endDate: '2027-03-31', status: 'active', description: 'Đánh giá KPI tháng 3 năm 2027' },
  { id: 'vc_period_2027_04', name: 'Tháng 4/2027', academicYear: '2026-2027', startDate: '2027-04-01', endDate: '2027-04-30', status: 'active', description: 'Đánh giá KPI tháng 4 năm 2027' },
  { id: 'vc_period_2027_05', name: 'Tháng 5/2027', academicYear: '2026-2027', startDate: '2027-05-01', endDate: '2027-05-31', status: 'active', description: 'Đánh giá KPI tháng 5 năm 2027' },
  { id: 'vc_period_2027_06', name: 'Tháng 6/2027', academicYear: '2026-2027', startDate: '2027-06-01', endDate: '2027-06-30', status: 'active', description: 'Đánh giá KPI tháng 6 năm 2027' },
  { id: 'vc_period_2027_07', name: 'Tháng 7/2027', academicYear: '2026-2027', startDate: '2027-07-01', endDate: '2027-07-31', status: 'active', description: 'Đánh giá KPI tháng 7 năm 2027' },
  { id: 'vc_period_2027_08', name: 'Tháng 8/2027', academicYear: '2026-2027', startDate: '2027-08-01', endDate: '2027-08-31', status: 'active', description: 'Đánh giá KPI tháng 8 năm 2027' },

  // Năm học 2025-2026
  {
    id: 'vc_period_2025_2026_ca_nam',
    name: 'Cả năm học 2025-2026',
    academicYear: '2025-2026',
    startDate: '2025-09-01',
    endDate: '2026-05-31',
    status: 'active',
    description: 'Tổng kết đánh giá KPI viên chức cả năm học 2025-2026'
  },
  {
    id: 'vc_period_2025_2026_hk2',
    name: 'Học kỳ II năm học 2025-2026',
    academicYear: '2025-2026',
    startDate: '2026-01-16',
    endDate: '2026-05-31',
    status: 'active',
    description: 'Đánh giá KPI viên chức giáo viên, nhân viên Học kỳ II năm học 2025-2026'
  },
  {
    id: 'vc_period_2025_2026_hk1',
    name: 'Kỳ đánh giá Học kỳ I',
    academicYear: '2025-2026',
    startDate: '2025-09-01',
    endDate: '2026-01-15',
    status: 'active',
    description: 'Đánh giá KPI viên chức giáo viên, nhân viên Học kỳ I năm học 2025-2026'
  }
];

/**
 * Kiểm tra xem một cán bộ/giáo viên có phải là VIÊN CHỨC KHÔNG GIỮ CHỨC VỤ LÃNH ĐẠO / QUẢN LÝ hay không
 * (Giáo viên, Nhân viên; Không bao gồm Hiệu trưởng, Phó Hiệu trưởng).
 */
export const isEligibleVcEmployee = (t: Teacher): boolean => {
  if (!t) return false;
  const roleStr = (t.role || '').toUpperCase();
  const posStr = (t.position || '').toLowerCase();
  const nameStr = (t.name || '').toLowerCase();

  // Loại trừ Hiệu trưởng, Phó Hiệu trưởng, Ban Giám hiệu lãnh đạo cao nhất
  if (roleStr === 'BGH' || roleStr === 'ADMIN' && t.id === 'admin') {
    if (posStr.includes('hiệu trưởng') || posStr.includes('phó hiệu trưởng') || posStr.includes('bgh')) {
      return false;
    }
  }
  if (posStr.includes('hiệu trưởng') || posStr.includes('phó hiệu trưởng')) {
    return false;
  }
  if (nameStr.includes('hiệu trưởng') || nameStr.includes('phó hiệu trưởng')) {
    return false;
  }

  return true;
};

/**
 * Lấy danh sách Giáo viên & Nhân viên hợp lệ cho module này
 */
export const getEligibleVcTeachers = (teachers: Teacher[]): Teacher[] => {
  return teachers.filter(t => isEligibleVcEmployee(t));
};

/**
 * Tạo snapshot bộ tiêu chí hiện tại
 */
export const createCriteriaSnapshot = (
  groups: KpiVcCriteriaGroup[] = DEFAULT_VC_GROUPS,
  criteria: KpiVcCriterion[] = DEFAULT_VC_CRITERIA
): KpiVcCriteriaSnapshot => {
  return {
    version: 1,
    snapshotDate: new Date().toISOString(),
    groups: groups.filter(g => g.isActive),
    criteria: criteria.filter(c => c.isActive)
  };
};

/**
 * Khởi tạo danh sách Score Items từ criteria
 */
export const initializeVcScoreItems = (criteria: KpiVcCriterion[] = DEFAULT_VC_CRITERIA): KpiVcScoreItem[] => {
  const activeCriteria = criteria.filter(c => c.isActive);

  return activeCriteria.map(c => {
    let selfScore = 0;
    let selectedLevelId: string | undefined = undefined;
    let selectedLevelName: string | undefined = undefined;
    let selectedLevelCode: string | undefined = undefined;

    if (c.scoreType === 'select_level' && c.levels && c.levels.length > 0) {
      // Mặc định chọn mức 2 (50 điểm) hoặc mức 1 (60 điểm)
      const defaultLevel = c.levels.find(l => l.code === '2.1') || c.levels[0];
      selectedLevelId = defaultLevel.id;
      selectedLevelName = defaultLevel.name;
      selectedLevelCode = defaultLevel.code;
      selfScore = defaultLevel.score;
    } else {
      // Mặc định điểm tối đa
      selfScore = c.maxScore;
    }

    return {
      criterionId: c.id,
      criterionCode: c.code,
      groupId: c.groupId,
      groupName: c.groupName,
      order: c.order,
      content: c.content,
      maxScore: c.maxScore,
      scoreType: c.scoreType,
      selectedLevelId,
      selectedLevelName,
      selectedLevelCode,
      selfScore,
      note: '',
      managerScore: null,
      managerComment: ''
    };
  });
};

/**
 * Tính tổng điểm CBQL theo từng nhóm và tổng cộng (Tối đa 100)
 */
export const calculateVcManagerTotals = (items: KpiVcScoreItem[]) => {
  const managerGroupScores: Record<string, number> = {
    group_I: 0,
    group_II: 0,
    group_III: 0
  };

  let managerTotalScore = 0;
  let evaluatedCount = 0;

  for (const item of items) {
    if (item.managerScore !== undefined && item.managerScore !== null && !isNaN(Number(item.managerScore))) {
      evaluatedCount++;
      const score = Math.max(0, Math.min(item.maxScore, Number(item.managerScore) || 0));
      if (!managerGroupScores[item.groupId]) {
        managerGroupScores[item.groupId] = 0;
      }
      managerGroupScores[item.groupId] += score;
      managerTotalScore += score;
    }
  }

  // Làm tròn 1 chữ số thập phân
  Object.keys(managerGroupScores).forEach(key => {
    managerGroupScores[key] = Math.round(managerGroupScores[key] * 10) / 10;
  });
  managerTotalScore = Math.round(managerTotalScore * 10) / 10;
  managerTotalScore = Math.min(100, Math.max(0, managerTotalScore));

  const ratio = Math.round((managerTotalScore / 100) * 1000) / 10; // e.g. 92.0%

  return {
    managerGroupScores,
    managerTotalScore,
    evaluatedCount,
    ratio
  };
};

/**
 * Tính tổng điểm theo từng nhóm và tổng cộng (Tối đa 100)
 */
export const calculateVcTotals = (items: KpiVcScoreItem[]) => {
  const groupScores: Record<string, number> = {
    group_I: 0,
    group_II: 0,
    group_III: 0
  };

  let totalScore = 0;

  for (const item of items) {
    const score = Math.max(0, Math.min(item.maxScore, Number(item.selfScore) || 0));
    if (!groupScores[item.groupId]) {
      groupScores[item.groupId] = 0;
    }
    groupScores[item.groupId] += score;
    totalScore += score;
  }

  // Làm tròn 1 chữ số thập phân
  Object.keys(groupScores).forEach(key => {
    groupScores[key] = Math.round(groupScores[key] * 10) / 10;
  });
  totalScore = Math.round(totalScore * 10) / 10;

  // Giới hạn max 100
  totalScore = Math.min(100, Math.max(0, totalScore));

  return {
    groupScores,
    totalScore
  };
};

/**
 * Tự động xếp loại theo điểm
 */
export const resolveVcClassification = (totalScore: number): string => {
  if (totalScore >= 90) return 'Hoàn thành xuất sắc nhiệm vụ';
  if (totalScore >= 70) return 'Hoàn thành tốt nhiệm vụ';
  if (totalScore >= 50) return 'Hoàn thành nhiệm vụ';
  return 'Không hoàn thành nhiệm vụ';
};

/**
 * Tra cứu chức vụ chuẩn của giáo viên / nhân viên
 */
export const resolveVcTeacherPosition = (teacher: Teacher | null | undefined, departments: Department[] = []): string => {
  if (!teacher) return 'Viên chức';
  if (teacher.position && teacher.position.trim()) return teacher.position.trim();
  
  if (teacher.subject) {
    return `Giáo viên ${teacher.subject}`;
  }

  const dept = departments.find(d => d.id === teacher.departmentId);
  if (dept) {
    if (dept.id.toLowerCase().includes('van_phong') || dept.name.toLowerCase().includes('văn phòng')) {
      return 'Nhân viên';
    }
    return `Giáo viên ${dept.name}`;
  }

  return 'Giáo viên';
};

/**
 * Tra cứu đơn vị công tác chuẩn
 */
export const resolveVcTeacherDepartment = (teacher: Teacher | null | undefined, departments: Department[] = []): string => {
  if (!teacher) return 'Trường THPT Sơn Lương';
  if (teacher.departmentName && teacher.departmentName.trim()) {
    return teacher.departmentName.trim();
  }
  const dept = departments.find(d => d.id === teacher.departmentId);
  if (dept) return dept.name;
  return 'Trường THPT Sơn Lương';
};
