import { 
  KpiStaffCriterionItem, 
  KpiStaffPositionConfig, 
  StaffPositionKey, 
  KpiStaffPeriod,
  KpiStaffForm,
  KpiStaffScoreItem
} from '../types/kpiStaff';
import { Teacher } from '../types';

/**
 * A. KPI CHUNG – 30 ĐIỂM (Áp dụng cho tất cả nhân viên)
 */
export const GENERAL_STAFF_CRITERIA: KpiStaffCriterionItem[] = [
  {
    id: 'crit_general_NV_A1',
    code: 'NV-A1',
    category: 'A_CHUNG',
    content: 'Chấp hành chủ trương, pháp luật, quy định; trung thực, đoàn kết, có ý thức phục vụ',
    maxScore: 5
  },
  {
    id: 'crit_general_NV_A2',
    code: 'NV-A2',
    category: 'A_CHUNG',
    content: 'Không tham ô, tiêu cực, lãng phí; giữ gìn uy tín và tài sản của nhà trường',
    maxScore: 5
  },
  {
    id: 'crit_general_NV_B1',
    code: 'NV-B1',
    category: 'A_CHUNG',
    content: 'Chấp hành thời gian, phân công, nội quy và quy chế làm việc',
    maxScore: 4
  },
  {
    id: 'crit_general_NV_B2',
    code: 'NV-B2',
    category: 'A_CHUNG',
    content: 'Báo cáo đầy đủ, chính xác; phối hợp với đồng nghiệp và bộ phận liên quan',
    maxScore: 4
  },
  {
    id: 'crit_general_NV_B3',
    code: 'NV-B3',
    category: 'A_CHUNG',
    content: 'Sử dụng hiệu quả thời gian; giữ nơi làm việc gọn gàng, an toàn, tiết kiệm',
    maxScore: 4
  },
  {
    id: 'crit_general_NV_B4',
    code: 'NV-B4',
    category: 'A_CHUNG',
    content: 'Thực hiện nhiệm vụ đột xuất và các công việc khác do lãnh đạo phân công',
    maxScore: 4
  },
  {
    id: 'crit_general_NV_C1',
    code: 'NV-C1',
    category: 'A_CHUNG',
    content: 'Năng lực chuyên môn theo vị trí việc làm; sử dụng phần mềm, ứng dụng phục vụ công việc',
    maxScore: 4
  }
];

export const DEFAULT_STAFF_CRITERIA = GENERAL_STAFF_CRITERIA;

export const DEFAULT_STAFF_GROUPS = [
  {
    id: 'group_A',
    name: 'A. KPI CHUNG',
    maxScore: 30,
    criteria: GENERAL_STAFF_CRITERIA
  }
];

const COMMON_EVIDENCE_GUT = 'hồ sơ/sổ sách vị trí việc làm; báo cáo; phần mềm; biên bản kiểm tra; phiếu giao việc; xác nhận của bộ phận phụ trách.';
const COMMON_TRACKING = 'TTVP/bộ phận phụ trách; BGH kiểm tra, phê duyệt/tổng hợp.';

/**
 * B. BỘ BẢNG ĐIỂM 8 VỊ TRÍ VIỆC LÀM NHÂN VIÊN – 70 ĐIỂM/BỘ
 */
export const POSITION_CONFIGS: Record<StaffPositionKey, KpiStaffPositionConfig> = {
  KE_TOAN: {
    key: 'KE_TOAN',
    title: 'B. KPI VỊ TRÍ VIỆC LÀM: KẾ TOÁN – 70 ĐIỂM',
    positionName: 'Kế toán',
    keywords: ['kế toán', 'ke toan', 'tài chính', 'thu chi kế toán'],
    totalScore: 70,
    evidenceSuggestion: COMMON_EVIDENCE_GUT,
    trackingPerson: COMMON_TRACKING,
    criteria: [
      { id: 'NVKT_1', code: 'NVKT-1', stt: 1, category: 'B_VI_TRI', content: 'Chứng từ, sổ sách, hồ sơ kế toán đầy đủ; trình ký đúng quy trình', maxScore: 12 },
      { id: 'NVKT_2', code: 'NVKT-2', stt: 2, category: 'B_VI_TRI', content: 'Tham mưu kịp thời chế độ đối với CBGVNV; theo dõi dự toán được duyệt', maxScore: 10 },
      { id: 'NVKT_3', code: 'NVKT-3', stt: 3, category: 'B_VI_TRI', content: 'Công khai tài chính định kỳ; báo cáo tháng/quý và đối chiếu đúng hạn', maxScore: 10 },
      { id: 'NVKT_4', code: 'NVKT-4', stt: 4, category: 'B_VI_TRI', content: 'Theo dõi tài sản, kiểm kê học kỳ/năm; hồ sơ bảo quản đầy đủ', maxScore: 10 },
      { id: 'NVKT_5', code: 'NVKT-5', stt: 5, category: 'B_VI_TRI', content: 'Đối chiếu thu-chi hằng tháng; hướng dẫn hồ sơ quyết toán của các bộ phận', maxScore: 8 },
      { id: 'NVKT_6', code: 'NVKT-6', stt: 6, category: 'B_VI_TRI', content: 'Hạn chế tối đa sai sót; bảo mật hồ sơ, dữ liệu, chứng từ', maxScore: 8 },
      { id: 'NVKT_7', code: 'NVKT-7', stt: 7, category: 'B_VI_TRI', content: 'Hoàn thành nhiệm vụ tài chính phát sinh/đột xuất đúng yêu cầu', maxScore: 12 }
    ]
  },
  THU_QUY: {
    key: 'THU_QUY',
    title: 'B. KPI VỊ TRÍ VIỆC LÀM: THỦ QUỸ – 70 ĐIỂM',
    positionName: 'Thủ quỹ',
    keywords: ['thủ quỹ', 'thu quy', 'quản lý quỹ', 'tiền mặt'],
    totalScore: 70,
    evidenceSuggestion: COMMON_EVIDENCE_GUT,
    trackingPerson: COMMON_TRACKING,
    criteria: [
      { id: 'NVTQ_1', code: 'NVTQ-1', stt: 1, category: 'B_VI_TRI', content: 'Thu, chi đúng chứng từ và phê duyệt; không chi khi chưa được phép', maxScore: 12 },
      { id: 'NVTQ_2', code: 'NVTQ-2', stt: 2, category: 'B_VI_TRI', content: 'Lập sổ quỹ, chốt sổ hằng tháng, đối chiếu với kế toán đúng hạn', maxScore: 12 },
      { id: 'NVTQ_3', code: 'NVTQ-3', stt: 3, category: 'B_VI_TRI', content: 'Báo cáo Hiệu trưởng định kỳ về các khoản thu chi ngân sách và ngoài ngân sách', maxScore: 10 },
      { id: 'NVTQ_4', code: 'NVTQ-4', stt: 4, category: 'B_VI_TRI', content: 'Lưu trữ chứng từ, hồ sơ thu-chi đầy đủ, dễ kiểm tra', maxScore: 8 },
      { id: 'NVTQ_5', code: 'NVTQ-5', stt: 5, category: 'B_VI_TRI', content: 'Bảo đảm an toàn tiền mặt; không để thất thoát do chủ quan', maxScore: 10 },
      { id: 'NVTQ_6', code: 'NVTQ-6', stt: 6, category: 'B_VI_TRI', content: 'Phối hợp kế toán thu, nộp các khoản phí đúng quy định', maxScore: 8 },
      { id: 'NVTQ_7', code: 'NVTQ-7', stt: 7, category: 'B_VI_TRI', content: 'Hoàn thành nhiệm vụ thu-chi, kiểm kê, đối soát phát sinh đúng yêu cầu', maxScore: 10 }
    ]
  },
  VAN_THU: {
    key: 'VAN_THU',
    title: 'B. KPI VỊ TRÍ VIỆC LÀM: VĂN THƯ – 70 ĐIỂM',
    positionName: 'Văn thư',
    keywords: ['văn thư', 'van thu', 'văn bản', 'hồ sơ lưu trữ', 'lưu trữ'],
    totalScore: 70,
    evidenceSuggestion: COMMON_EVIDENCE_GUT,
    trackingPerson: COMMON_TRACKING,
    criteria: [
      { id: 'NVVT_1', code: 'NVVT-1', stt: 1, category: 'B_VI_TRI', content: 'Tiếp nhận, vào sổ, phân loại, chuyển văn bản kịp thời đến đúng bộ phận', maxScore: 12 },
      { id: 'NVVT_2', code: 'NVVT-2', stt: 2, category: 'B_VI_TRI', content: 'Kiểm tra thể thức trước khi trình ký; phát hành đúng quy trình', maxScore: 12 },
      { id: 'NVVT_3', code: 'NVVT-3', stt: 3, category: 'B_VI_TRI', content: 'Bảo quản hồ sơ đầy đủ; sắp xếp, lưu trữ dễ tìm, không tự ý cho mượn', maxScore: 12 },
      { id: 'NVVT_4', code: 'NVVT-4', stt: 4, category: 'B_VI_TRI', content: 'Bảo quản và sử dụng con dấu đúng quy định, đúng thẩm quyền', maxScore: 10 },
      { id: 'NVVT_5', code: 'NVVT-5', stt: 5, category: 'B_VI_TRI', content: 'Chuyển tải thông tin, báo cáo kịp thời; bảo đảm bí mật hồ sơ', maxScore: 8 },
      { id: 'NVVT_6', code: 'NVVT-6', stt: 6, category: 'B_VI_TRI', content: 'Cập nhật dữ liệu, văn bản điện tử chính xác, đúng thời hạn', maxScore: 6 },
      { id: 'NVVT_7', code: 'NVVT-7', stt: 7, category: 'B_VI_TRI', content: 'Hoàn thành công tác văn thư phát sinh, hội họp, hồ sơ theo phân công', maxScore: 10 }
    ]
  },
  Y_TE: {
    key: 'Y_TE',
    title: 'B. KPI VỊ TRÍ VIỆC LÀM: NHÂN VIÊN Y TẾ – 70 ĐIỂM',
    positionName: 'Nhân viên Y tế',
    keywords: ['y tế', 'y te', 'chăm sóc sức khỏe', 'phòng y tế'],
    totalScore: 70,
    evidenceSuggestion: COMMON_EVIDENCE_GUT,
    trackingPerson: COMMON_TRACKING,
    criteria: [
      { id: 'NVYT_1', code: 'NVYT-1', stt: 1, category: 'B_VI_TRI', content: 'Trực phòng y tế; khám sức khỏe ban đầu, cấp thuốc/sơ cứu theo quy định', maxScore: 12 },
      { id: 'NVYT_2', code: 'NVYT-2', stt: 2, category: 'B_VI_TRI', content: 'Phát hiện, báo ngay lãnh đạo khi học sinh bệnh nặng/tai nạn; phối hợp xử lý', maxScore: 10 },
      { id: 'NVYT_3', code: 'NVYT-3', stt: 3, category: 'B_VI_TRI', content: 'Đầy đủ hồ sơ, sổ sách, cơ số thuốc và trang thiết bị theo quy định', maxScore: 10 },
      { id: 'NVYT_4', code: 'NVYT-4', stt: 4, category: 'B_VI_TRI', content: 'Lập kế hoạch và báo cáo tháng, học kỳ, năm đúng hạn', maxScore: 10 },
      { id: 'NVYT_5', code: 'NVYT-5', stt: 5, category: 'B_VI_TRI', content: 'Theo dõi hồ sơ BHYT/BHTN; chăm sóc sức khỏe học sinh và CBGVNV', maxScore: 10 },
      { id: 'NVYT_6', code: 'NVYT-6', stt: 6, category: 'B_VI_TRI', content: 'Giám sát vệ sinh trường học, phối hợp hoạt động chăm sóc sức khỏe', maxScore: 8 },
      { id: 'NVYT_7', code: 'NVYT-7', stt: 7, category: 'B_VI_TRI', content: 'Hoàn thành nhiệm vụ y tế phát sinh/đột xuất theo phân công', maxScore: 10 }
    ]
  },
  BAO_VE: {
    key: 'BAO_VE',
    title: 'B. KPI VỊ TRÍ VIỆC LÀM: BẢO VỆ – 70 ĐIỂM',
    positionName: 'Bảo vệ',
    keywords: ['bảo vệ', 'bao ve', 'an ninh', 'bảo vệ trường'],
    totalScore: 70,
    evidenceSuggestion: COMMON_EVIDENCE_GUT,
    trackingPerson: COMMON_TRACKING,
    criteria: [
      { id: 'NVBV_1', code: 'NVBV-1', stt: 1, category: 'B_VI_TRI', content: 'Thực hiện đúng ca trực theo phân công; bảo đảm giờ giấc trực', maxScore: 12 },
      { id: 'NVBV_2', code: 'NVBV-2', stt: 2, category: 'B_VI_TRI', content: 'Quan sát, ghi nhận diễn biến bất thường; báo cáo kịp thời', maxScore: 12 },
      { id: 'NVBV_3', code: 'NVBV-3', stt: 3, category: 'B_VI_TRI', content: 'Hướng dẫn khách, kiểm soát ra vào và bố trí phương tiện theo quy định', maxScore: 10 },
      { id: 'NVBV_4', code: 'NVBV-4', stt: 4, category: 'B_VI_TRI', content: 'Phòng ngừa mất mát, hư hỏng; phát hiện và báo cáo nguy cơ', maxScore: 12 },
      { id: 'NVBV_5', code: 'NVBV-5', stt: 5, category: 'B_VI_TRI', content: 'Thực hiện yêu cầu PCCC, phối hợp xử lý tình huống an toàn', maxScore: 8 },
      { id: 'NVBV_6', code: 'NVBV-6', stt: 6, category: 'B_VI_TRI', content: 'Ghi chép ca trực, bàn giao đầy đủ, trung thực', maxScore: 6 },
      { id: 'NVBV_7', code: 'NVBV-7', stt: 7, category: 'B_VI_TRI', content: 'Hỗ trợ hội họp, sự kiện, xử lý tình huống phát sinh theo phân công', maxScore: 10 }
    ]
  },
  PHUC_VU: {
    key: 'PHUC_VU',
    title: 'B. KPI VỊ TRÍ VIỆC LÀM: NHÂN VIÊN PHỤC VỤ/VỆ SINH – 70 ĐIỂM',
    positionName: 'Nhân viên Phục vụ/Vệ sinh',
    keywords: ['phục vụ', 'vệ sinh', 'tạp vụ', 'phuc vu', 've sinh', 'tap vu'],
    totalScore: 70,
    evidenceSuggestion: COMMON_EVIDENCE_GUT,
    trackingPerson: COMMON_TRACKING,
    criteria: [
      { id: 'NVPV_1', code: 'NVPV-1', stt: 1, category: 'B_VI_TRI', content: 'Vệ sinh phòng lãnh đạo, phòng họp, khuôn viên, công trình vệ sinh theo phân công', maxScore: 15 },
      { id: 'NVPV_2', code: 'NVPV-2', stt: 2, category: 'B_VI_TRI', content: 'Thực hiện vệ sinh đúng lịch, bảo đảm sạch sẽ, gọn gàng', maxScore: 12 },
      { id: 'NVPV_3', code: 'NVPV-3', stt: 3, category: 'B_VI_TRI', content: 'Sử dụng, bảo quản dụng cụ và vật tư vệ sinh tiết kiệm', maxScore: 8 },
      { id: 'NVPV_4', code: 'NVPV-4', stt: 4, category: 'B_VI_TRI', content: 'Thực hiện yêu cầu an toàn, PCCC, tiết kiệm điện nước', maxScore: 10 },
      { id: 'NVPV_5', code: 'NVPV-5', stt: 5, category: 'B_VI_TRI', content: 'Chuẩn bị phòng, cơ sở phục vụ các cuộc họp/sự kiện theo phân công', maxScore: 10 },
      { id: 'NVPV_6', code: 'NVPV-6', stt: 6, category: 'B_VI_TRI', content: 'Kịp thời báo hỏng hóc, mất an toàn, thiếu vật tư cho người phụ trách', maxScore: 5 },
      { id: 'NVPV_7', code: 'NVPV-7', stt: 7, category: 'B_VI_TRI', content: 'Hoàn thành nhiệm vụ phát sinh theo phân công', maxScore: 10 }
    ]
  },
  THU_VIEN: {
    key: 'THU_VIEN',
    title: 'B. KPI VỊ TRÍ VIỆC LÀM: THƯ VIỆN – 70 ĐIỂM',
    positionName: 'Thư viện',
    keywords: ['thư viện', 'thu vien', 'cán bộ thư viện', 'sách'],
    totalScore: 70,
    evidenceSuggestion: COMMON_EVIDENCE_GUT,
    trackingPerson: COMMON_TRACKING,
    criteria: [
      { id: 'NVTV_1', code: 'NVTV-1', stt: 1, category: 'B_VI_TRI', content: 'Lập thư mục, sắp xếp, bảo quản sách; thực hiện đầy đủ sổ sách thư viện', maxScore: 12 },
      { id: 'NVTV_2', code: 'NVTV-2', stt: 2, category: 'B_VI_TRI', content: 'Quản lý thẻ, thời gian mượn-trả, ký nhận; thu hồi sách cuối năm', maxScore: 10 },
      { id: 'NVTV_3', code: 'NVTV-3', stt: 3, category: 'B_VI_TRI', content: 'Kiểm tra sách báo; lập danh mục mất, hỏng, cần thanh lý', maxScore: 10 },
      { id: 'NVTV_4', code: 'NVTV-4', stt: 4, category: 'B_VI_TRI', content: 'Lập kế hoạch, nội quy phòng đọc; phối hợp phát triển văn hóa đọc', maxScore: 10 },
      { id: 'NVTV_5', code: 'NVTV-5', stt: 5, category: 'B_VI_TRI', content: 'Cập nhật sách chuyên môn, giới thiệu sách mới, bài viết phù hợp', maxScore: 8 },
      { id: 'NVTV_6', code: 'NVTV-6', stt: 6, category: 'B_VI_TRI', content: 'Báo cáo lượt đọc, mượn, tình hình sách và bổ sung hằng tháng', maxScore: 10 },
      { id: 'NVTV_7', code: 'NVTV-7', stt: 7, category: 'B_VI_TRI', content: 'Hoàn thành mua/bổ sung sách và nhiệm vụ thư viện theo phân công', maxScore: 10 }
    ]
  },
  THIET_BI: {
    key: 'THIET_BI',
    title: 'B. KPI VỊ TRÍ VIỆC LÀM: THIẾT BỊ – 70 ĐIỂM',
    positionName: 'Thiết bị',
    keywords: ['thiết bị', 'thiet bi', 'phòng thí nghiệm', 'cán bộ thiết bị'],
    totalScore: 70,
    evidenceSuggestion: COMMON_EVIDENCE_GUT,
    trackingPerson: COMMON_TRACKING,
    criteria: [
      { id: 'NVTB_1', code: 'NVTB-1', stt: 1, category: 'B_VI_TRI', content: 'Sắp xếp, bảo quản thiết bị an toàn, dễ tìm; hồ sơ quản lý đầy đủ', maxScore: 12 },
      { id: 'NVTB_2', code: 'NVTB-2', stt: 2, category: 'B_VI_TRI', content: 'Phục vụ giáo viên mượn/trả thiết bị; theo dõi tình trạng sử dụng', maxScore: 10 },
      { id: 'NVTB_3', code: 'NVTB-3', stt: 3, category: 'B_VI_TRI', content: 'Bảo đảm chuẩn bị thiết bị phục vụ các tiết thực hành theo kế hoạch', maxScore: 12 },
      { id: 'NVTB_4', code: 'NVTB-4', stt: 4, category: 'B_VI_TRI', content: 'Lập danh mục cần bổ sung, thay thế, thanh lý; kiểm kê đúng kỳ', maxScore: 10 },
      { id: 'NVTB_5', code: 'NVTB-5', stt: 5, category: 'B_VI_TRI', content: 'Báo cáo tình hình sử dụng, bảo quản thiết bị và thực hành hằng tháng', maxScore: 10 },
      { id: 'NVTB_6', code: 'NVTB-6', stt: 6, category: 'B_VI_TRI', content: 'Đề xuất giải pháp phát huy hiệu quả thiết bị, thí nghiệm', maxScore: 6 },
      { id: 'NVTB_7', code: 'NVTB-7', stt: 7, category: 'B_VI_TRI', content: 'Hoàn thành chuẩn bị thiết bị, hỗ trợ sự kiện/thực hành phát sinh', maxScore: 10 }
    ]
  }
};

/**
 * Chuẩn hóa năm học về dạng chuẩn "YYYY–YYYY" và trích xuất năm bắt đầu
 */
export function parseAcademicYearRange(academicYearStr: string = '2026–2027'): {
  startYear: number;
  endYear: number;
  yearRangeStr: string;
} {
  const match = String(academicYearStr || '').match(/(\d{4})/);
  const startYear = match ? parseInt(match[1], 10) : 2026;
  const endYear = startYear + 1;
  return {
    startYear,
    endYear,
    yearRangeStr: `${startYear}–${endYear}`
  };
}

/**
 * Tự động sinh đầy đủ bộ kỳ đánh giá KPI Nhân viên cho MỌI năm học:
 * - Cả năm học (từ 01/07 năm trước đến 30/06 năm sau)
 * - Học kỳ I & Học kỳ II
 * - ĐẦY ĐỦ 12 KỲ THÁNG liên tục từ Tháng 7 năm trước đến Tháng 6 năm sau
 *   (Tháng 7, 8, 9, 10, 11, 12 năm bắt đầu -> Tháng 1, 2, 3, 4, 5, 6 năm kết thúc)
 */
export function generateStaffPeriodsForAcademicYear(academicYearStr: string = '2026–2027'): KpiStaffPeriod[] {
  const { startYear, endYear, yearRangeStr } = parseAcademicYearRange(academicYearStr);

  const list: KpiStaffPeriod[] = [
    {
      id: `period_staff_${startYear}_${endYear}`,
      name: `Năm học ${yearRangeStr}`,
      academicYear: yearRangeStr,
      periodType: 'year',
      startDate: `${startYear}-07-01`,
      endDate: `${endYear}-06-30`,
      status: 'active',
      description: `Đánh giá KPI Nhân viên cả năm học ${yearRangeStr} (07/${startYear} – 06/${endYear})`
    },
    {
      id: `period_staff_${startYear}_hk1`,
      name: `Học kỳ I (${yearRangeStr})`,
      academicYear: yearRangeStr,
      periodType: 'semester',
      semester: 'HK1',
      startDate: `${startYear}-09-01`,
      endDate: `${endYear}-01-15`,
      status: 'active',
      description: `Đánh giá KPI Nhân viên Học kỳ I năm học ${yearRangeStr}`
    },
    {
      id: `period_staff_${startYear}_hk2`,
      name: `Học kỳ II (${yearRangeStr})`,
      academicYear: yearRangeStr,
      periodType: 'semester',
      semester: 'HK2',
      startDate: `${endYear}-01-16`,
      endDate: `${endYear}-05-31`,
      status: 'active',
      description: `Đánh giá KPI Nhân viên Học kỳ II năm học ${yearRangeStr}`
    }
  ];

  // Sinh tự động đúng 12 tháng: Tháng 7..12 của startYear và Tháng 1..6 của endYear
  for (let offset = 0; offset < 12; offset++) {
    const m = ((6 + offset) % 12) + 1; // 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6
    const yr = m >= 7 ? startYear : endYear;
    const mPadded = String(m).padStart(2, '0');
    const lastDay = String(new Date(yr, m, 0).getDate()).padStart(2, '0');
    list.push({
      id: `period_staff_m${mPadded}_${yr}`,
      name: `Tháng ${m}/${yr}`,
      academicYear: yearRangeStr,
      periodType: 'month',
      month: m,
      startDate: `${yr}-${mPadded}-01`,
      endDate: `${yr}-${mPadded}-${lastDay}`,
      status: 'active',
      description: `Đánh giá, chấm điểm KPI Nhân viên Tháng ${m}/${yr}`
    });
  }

  return list;
}

/**
 * Sắp xếp danh sách kỳ đánh giá KPI Nhân viên theo đúng thứ tự:
 * Năm học -> Học kỳ I -> Học kỳ II -> Tháng 7 -> Tháng 8 -> ... -> Tháng 12 -> Tháng 1 -> ... -> Tháng 6
 */
export function sortStaffPeriods(periods: KpiStaffPeriod[]): KpiStaffPeriod[] {
  const getOrderScore = (p: KpiStaffPeriod): [number, number, string] => {
    const { startYear } = parseAcademicYearRange(p.academicYear || p.name || '2026–2027');
    if (p.periodType === 'year') return [startYear, 0, p.id];
    if (p.periodType === 'semester') {
      const semUpper = String(p.semester || p.name || '').toUpperCase();
      if (semUpper.includes('HK1') || semUpper.includes('KỲ I ') || semUpper.endsWith('KỲ I')) {
        return [startYear, 1, p.id];
      }
      return [startYear, 2, p.id];
    }
    if (p.periodType === 'month') {
      let monthNum = typeof p.month === 'number' ? p.month : 0;
      if (!monthNum) {
        const mMatch = String(p.id || '').match(/_m(\d{2})_/) || String(p.name || '').match(/Tháng\s*(\d{1,2})/i);
        if (mMatch) monthNum = parseInt(mMatch[1], 10);
      }
      if (monthNum >= 1 && monthNum <= 12) {
        // Tháng 7 -> offset 0, ..., Tháng 12 -> 5, Tháng 1 -> 6, ..., Tháng 6 -> 11
        const academicMonthOffset = monthNum >= 7 ? monthNum - 7 : monthNum + 5;
        return [startYear, 10 + academicMonthOffset, p.id];
      }
    }
    return [startYear, 50, p.startDate || p.id];
  };

  return [...periods].sort((a, b) => {
    const [ya, oa, ia] = getOrderScore(a);
    const [yb, ob, ib] = getOrderScore(b);
    if (ya !== yb) return ya - yb;
    if (oa !== ob) return oa - ob;
    return ia.localeCompare(ib);
  });
}

/**
 * Đảm bảo mọi năm học có mặt trong hệ thống (mặc định tối thiểu 2026–2027)
 * luôn có đầy đủ 12 tháng từ Tháng 7 năm trước đến Tháng 6 năm sau,
 * không ghi đè kỳ đã tùy chỉnh/khóa và tuyệt đối không tạo bản ghi trùng.
 */
export function ensureCompleteStaffPeriods(
  existingPeriods: KpiStaffPeriod[] = [],
  requiredAcademicYears: string[] = ['2026–2027']
): KpiStaffPeriod[] {
  const yearSet = new Set<string>();
  requiredAcademicYears.forEach(y => {
    if (y && String(y).trim()) {
      yearSet.add(parseAcademicYearRange(y).yearRangeStr);
    }
  });
  (existingPeriods || []).forEach(p => {
    if (p?.academicYear) {
      yearSet.add(parseAcademicYearRange(p.academicYear).yearRangeStr);
    }
  });

  const byId = new Map<string, KpiStaffPeriod>();
  const existingMonthKeys = new Set<string>();

  // 1. Giữ nguyên toàn bộ kỳ hiện có (ưu tiên dữ liệu đã lưu trong Firestore)
  (existingPeriods || []).forEach(p => {
    if (!p || !p.id) return;
    const { yearRangeStr } = parseAcademicYearRange(p.academicYear || '2026–2027');
    const normalized: KpiStaffPeriod = {
      ...p,
      academicYear: yearRangeStr
    };
    byId.set(normalized.id, normalized);
    if (normalized.periodType === 'month' && normalized.month) {
      existingMonthKeys.add(`${yearRangeStr}__m${normalized.month}`);
    }
  });

  // 2. Bổ sung tự động mọi kỳ chuẩn còn thiếu (đặc biệt Tháng 7 và Tháng 6) cho từng năm học
  yearSet.forEach(yearRangeStr => {
    const canonical = generateStaffPeriodsForAcademicYear(yearRangeStr);
    canonical.forEach(cp => {
      if (byId.has(cp.id)) return;
      if (cp.periodType === 'month' && cp.month) {
        const monthKey = `${yearRangeStr}__m${cp.month}`;
        if (existingMonthKeys.has(monthKey)) return;
        existingMonthKeys.add(monthKey);
      }
      byId.set(cp.id, cp);
    });
  });

  return sortStaffPeriods(Array.from(byId.values()));
}

export const DEFAULT_STAFF_PERIODS: KpiStaffPeriod[] = generateStaffPeriodsForAcademicYear('2026–2027');

/**
 * Tự động xác định bộ Vị trí việc làm dựa trên tên chức danh / công việc của nhân viên
 */
export const detectPositionKey = (positionStr: string): StaffPositionKey => {
  const p = (positionStr || '').toLowerCase();
  
  if (p.includes('thủ quỹ') || p.includes('thu quy')) return 'THU_QUY';
  if (p.includes('kế toán') || p.includes('ke toan') || p.includes('tài chính')) return 'KE_TOAN';
  if (p.includes('văn thư') || p.includes('van thu') || p.includes('lưu trữ')) return 'VAN_THU';
  if (p.includes('y tế') || p.includes('y te') || p.includes('sức khỏe')) return 'Y_TE';
  if (p.includes('bảo vệ') || p.includes('bao ve') || p.includes('an ninh')) return 'BAO_VE';
  if (p.includes('phục vụ') || p.includes('vệ sinh') || p.includes('tạp vụ') || p.includes('phuc vu')) return 'PHUC_VU';
  if (p.includes('thư viện') || p.includes('thu vien')) return 'THU_VIEN';
  if (p.includes('thiết bị') || p.includes('thiet bi') || p.includes('thí nghiệm')) return 'THIET_BI';

  return 'KE_TOAN'; // default fallback
};

/**
 * Danh mục chuẩn 4 Nhân viên thuộc Khối Nhân viên / Tổ Văn phòng Trường THPT Sơn Lương
 */
export const DEFAULT_STAFF_MEMBERS: Teacher[] = [
  {
    id: 't1792151918417_melmyz',
    username: 'hadangquy',
    code: 'NV01',
    name: 'Hà Đăng Quy',
    role: 'NHAN_VIEN',
    position: 'Tổ trưởng Văn phòng - Kế toán',
    departmentId: 'd_van_phong',
    departmentName: 'Tổ Văn phòng',
    status: 'Đang công tác',
    subject: 'Kế toán',
    degree: 'Cử nhân'
  },
  {
    id: 't1792151918417_6fdpqz',
    username: 'nguyenthithuhuong_vp',
    code: 'NV02',
    name: 'Nguyễn Thị Thu Hương',
    role: 'NHAN_VIEN',
    position: 'Văn thư - Lưu trữ',
    departmentId: 'd_van_phong',
    departmentName: 'Tổ Văn phòng',
    status: 'Đang công tác',
    subject: 'Văn thư',
    degree: 'Cử nhân'
  },
  {
    id: 't1792151918417_r0q0m1',
    username: 'duongthithanhhuong',
    code: 'NV03',
    name: 'Dương Thị Thanh Hương',
    role: 'NHAN_VIEN',
    position: 'Thư viện',
    departmentId: 'd_van_phong',
    departmentName: 'Tổ Văn phòng',
    status: 'Đang công tác',
    subject: 'Thư viện',
    degree: 'Cử nhân'
  },
  {
    id: 't1792151918417_ek1t68',
    username: 'hoangtronghuong',
    code: 'NV04',
    name: 'Hoàng Trọng Hưởng',
    role: 'NHAN_VIEN',
    position: 'Thiết bị',
    departmentId: 'd_van_phong',
    departmentName: 'Tổ Văn phòng',
    status: 'Đang công tác',
    subject: 'Thiết bị',
    degree: 'Cử nhân'
  }
];

/**
 * Tiêu chuẩn phân loại chính xác nhân viên hợp lệ thuộc Khối Nhân viên:
 * - Kế toán, Văn thư, Thủ quỹ, Y tế, Bảo vệ, Phục vụ, Thư viện, Thiết bị
 * - Loại trừ hoàn toàn BGH, CBQL và toàn bộ Giáo viên giảng dạy (GV01 - GV48)
 */
export const isEligibleStaffEmployee = (t: Teacher): boolean => {
  if (!t) return false;

  // 1. Loại trừ Cán bộ quản lý (BGH)
  const roleUpper = (t.role || '').toUpperCase();
  const posLower = (t.position || '').toLowerCase();
  if (
    roleUpper === 'BGH' || 
    posLower.includes('hiệu trưởng') || 
    posLower.includes('phó hiệu trưởng') ||
    (t.code || '').toUpperCase().startsWith('BGH')
  ) {
    return false;
  }

  // 2. Loại trừ giáo viên giảng dạy thuộc các tổ chuyên môn
  const deptIdLower = (t.departmentId || '').toLowerCase();
  const deptNameLower = (t.departmentName || '').toLowerCase();
  const isTeachingDept = 
    deptIdLower === 'd_toan_ly_tin_cn' ||
    deptIdLower === 'd_van_su_dia_gdkt_pl_an' ||
    deptIdLower === 'd_hoa_sinh_gdtc_qpan_nn' ||
    deptIdLower === 'd_hoa_ly_sinh_gdqpan_nn' ||
    deptNameLower.includes('toán') ||
    deptNameLower.includes('văn-sử') ||
    deptNameLower.includes('hóa-sinh');

  if (isTeachingDept) {
    return false;
  }

  // 3. Loại trừ mã nhân sự bắt đầu bằng GV (Giáo viên)
  const codeUpper = (t.code || '').toUpperCase();
  if (codeUpper.startsWith('GV')) {
    return false;
  }

  // 4. Đạt chuẩn nếu có mã nhân viên NVxx hoặc vai trò NHAN_VIEN
  if (codeUpper.startsWith('NV') || roleUpper === 'NHAN_VIEN' || roleUpper === 'NV') {
    return true;
  }

  // 5. Đạt chuẩn nếu thuộc Tổ Văn phòng
  if (
    deptIdLower === 'd_van_phong' || 
    deptIdLower === 'van_phong' || 
    deptIdLower === 'vp' ||
    deptNameLower.includes('văn phòng') ||
    deptNameLower.includes('van phong')
  ) {
    return true;
  }

  // 6. Đạt chuẩn nếu chức danh vị trí việc làm thuộc 8 vị trí khối nhân viên
  const staffKeywords = [
    'kế toán', 'ke toan',
    'văn thư', 'van thu', 'lưu trữ',
    'thủ quỹ', 'thu quy',
    'y tế', 'y te',
    'thư viện', 'thu vien',
    'thiết bị', 'thiet bi', 'thí nghiệm',
    'bảo vệ', 'bao ve',
    'phục vụ', 'phuc vu', 'tạp vụ', 'lao công'
  ];

  if (staffKeywords.some(kw => posLower.includes(kw))) {
    return true;
  }

  return false;
};

/**
 * Lấy danh sách nhân viên thực tế thuộc Khối Nhân viên (đảm bảo đúng 4 nhân viên thực tế)
 * Deduplicate theo ID và Code để tránh đếm trùng từ nhiều nguồn
 */
export const getEligibleStaffMembers = (teachers: Teacher[]): Teacher[] => {
  if (!teachers || teachers.length === 0) {
    return DEFAULT_STAFF_MEMBERS;
  }

  // Lọc chỉ những hồ sơ thực tế thuộc khối nhân viên
  const staff = teachers.filter(t => isEligibleStaffEmployee(t));

  // Chống đếm trùng theo ID và Mã nhân sự
  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();
  const uniqueStaff: Teacher[] = [];

  for (const s of staff) {
    const idKey = (s.id || '').trim();
    const codeKey = (s.code || '').trim().toUpperCase();

    if (idKey && seenIds.has(idKey)) continue;
    if (codeKey && seenCodes.has(codeKey)) continue;

    if (idKey) seenIds.add(idKey);
    if (codeKey) seenCodes.add(codeKey);

    uniqueStaff.push(s);
  }

  // Nếu mảng teachers truyền vào chưa đồng bộ được khối nhân viên, fallback về danh sách chuẩn 4 nhân viên
  if (uniqueStaff.length === 0) {
    return DEFAULT_STAFF_MEMBERS;
  }

  // Sắp xếp ổn định theo mã NV (NV01, NV02, NV03, NV04)
  uniqueStaff.sort((a, b) => (a.code || '').localeCompare(b.code || ''));

  return uniqueStaff;
};

/**
 * Chuẩn hóa chuỗi năm học (ví dụ: "2026 - 2027", "2026–2027", "2026-2027" -> "2026-2027")
 */
export const normalizeAcademicYear = (year?: string | null): string => {
  if (!year) return '';
  return String(year)
    .trim()
    .replace(/[–—−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ');
};

/**
 * Kiểm tra phiếu KPI nhân viên có đang hoạt động hợp lệ hay không:
 * - Loại trừ phiếu đã xóa mềm hoặc đã hủy (isDeleted, status = deleted/cancelled)
 * - Loại trừ bản ghi giáo viên (GVxx) bị lẫn trong collection kpi_staff_forms
 */
export const isActiveStaffKpiForm = (form?: KpiStaffForm | null): boolean => {
  if (!form) return false;
  if (form.isDeleted === true) return false;

  const statusLower = String(form.status || '').trim().toLowerCase();
  if (statusLower === 'deleted' || statusLower === 'cancelled' || statusLower === 'canceled') {
    return false;
  }

  const codeUpper = String(form.employeeCode || '').trim().toUpperCase();
  if (codeUpper.startsWith('GV') || codeUpper.startsWith('BGH')) {
    return false;
  }

  return true;
};

/**
 * Đối chiếu chính xác phiếu KPI với nhân viên theo employeeId hoặc mã nhân viên (employeeCode)
 */
export const isStaffFormMatchingEmployee = (
  form: KpiStaffForm,
  staff: Pick<Teacher, 'id' | 'code'>
): boolean => {
  const formEmpId = String(form.employeeId || '').trim();
  const staffId = String(staff.id || '').trim();
  if (formEmpId && staffId && formEmpId === staffId) {
    return true;
  }

  const formCode = String(form.employeeCode || '').trim().toUpperCase();
  const staffCode = String(staff.code || '').trim().toUpperCase();
  if (formCode && staffCode && formCode === staffCode) {
    return true;
  }

  return false;
};

/**
 * Đối chiếu chính xác phiếu KPI với đúng kỳ đánh giá VÀ đúng năm học
 */
export const isStaffFormMatchingPeriod = (
  form: KpiStaffForm,
  period?: Pick<KpiStaffPeriod, 'id' | 'academicYear'> | null
): boolean => {
  if (!period || !period.id) return false;
  if (String(form.periodId || '').trim() !== String(period.id).trim()) {
    return false;
  }

  const formYear = normalizeAcademicYear(form.academicYear);
  const periodYear = normalizeAcademicYear(period.academicYear);
  if (formYear && periodYear && formYear !== periodYear) {
    return false;
  }

  return true;
};

/**
 * Tìm phiếu KPI nhân viên ĐANG HOẠT ĐỘNG của một nhân viên trong đúng kỳ đánh giá & năm học.
 * - Phiếu thuộc kỳ khác hoặc năm học khác sẽ KHÔNG khớp.
 * - Phiếu đã xóa / đã hủy sẽ KHÔNG khớp (cho phép tạo lại).
 */
export const findExistingStaffFormForPeriod = (
  forms: KpiStaffForm[],
  staff: Pick<Teacher, 'id' | 'code'>,
  period?: Pick<KpiStaffPeriod, 'id' | 'academicYear'> | null
): KpiStaffForm | undefined => {
  if (!forms || forms.length === 0 || !staff || !period) return undefined;
  return forms.find(
    f =>
      isActiveStaffKpiForm(f) &&
      isStaffFormMatchingPeriod(f, period) &&
      isStaffFormMatchingEmployee(f, staff)
  );
};

/**
 * Hiển thị tên kỳ đánh giá gọn gàng, tránh lặp "Năm học 2026–2027 - Năm học 2026–2027"
 */
export const formatStaffPeriodLabel = (period: KpiStaffPeriod): string => {
  const name = (period.name || '').trim();
  const year = (period.academicYear || '').trim();
  if (!year) return name;
  const normName = normalizeAcademicYear(name).toLowerCase();
  const normYear = normalizeAcademicYear(year).toLowerCase();
  if (normName.includes(normYear)) {
    return name;
  }
  return `${name} • Năm học ${year}`;
};

/**
 * Khởi tạo dữ liệu phiếu chấm cho một Nhân viên theo bộ Vị trí đã chọn
 */
export const createInitialStaffForm = (
  staff: Teacher,
  period: KpiStaffPeriod,
  positionKey?: StaffPositionKey,
  createdById?: string
): KpiStaffForm => {
  const activeKey = positionKey || detectPositionKey(staff.position || '');
  const posConfig = POSITION_CONFIGS[activeKey];

  const generalItems: KpiStaffScoreItem[] = GENERAL_STAFF_CRITERIA.map(c => ({
    criterionId: c.id,
    code: c.code,
    category: 'A_CHUNG',
    content: c.content,
    maxScore: c.maxScore,
    selfScore: 0,
    evidence: ''
  }));

  const positionItems: KpiStaffScoreItem[] = posConfig.criteria.map(c => ({
    criterionId: c.id,
    code: c.code,
    category: 'B_VI_TRI',
    content: c.content,
    maxScore: c.maxScore,
    selfScore: 0,
    evidence: ''
  }));

  const genSelf = 0;
  const posSelf = 0;
  const nowIso = new Date().toISOString();

  return {
    id: `form_staff_${staff.id}_${period.id}`,
    employeeId: staff.id,
    employeeName: staff.name,
    employeeCode: staff.code,
    employeeUsername: staff.username,
    position: staff.position || posConfig.positionName,
    positionKey: activeKey,
    department: staff.departmentName || 'Tổ Văn phòng',
    departmentId: staff.departmentId || 'd_van_phong',
    evaluatorName: 'TTVP/BGH',
    periodId: period.id,
    periodName: period.name,
    academicYear: period.academicYear,
    periodType: period.periodType || 'month',
    month: period.month,
    semester: period.semester,
    generalItems,
    positionItems,
    generalTotalSelf: genSelf,
    positionTotalSelf: posSelf,
    totalScore: genSelf + posSelf,
    selfClassification: 'Chưa tự đánh giá',
    selfDate: nowIso.split('T')[0],
    status: 'draft',
    isDeleted: false,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: createdById || staff.id
  };
};

export const getClassificationByScore = (score: number): string => {
  if (score >= 90) return 'Hoàn thành xuất sắc nhiệm vụ';
  if (score >= 80) return 'Hoàn thành tốt nhiệm vụ';
  if (score >= 70) return 'Hoàn thành nhiệm vụ';
  if (score > 0) return 'Chưa hoàn thành nhiệm vụ';
  return 'Chưa tự đánh giá';
};

/**
 * Tạo danh sách phiếu KPI mẫu cho 4 nhân viên thực tế (chỉ dùng nội bộ khi cần seed tường minh, không tự bơm vào dữ liệu Firestore)
 */
export const generateDefaultStaffForms = (): KpiStaffForm[] => {
  const staff = DEFAULT_STAFF_MEMBERS;
  const targetPeriods = [
    DEFAULT_STAFF_PERIODS.find(p => p.id === 'period_staff_2026_2027') || DEFAULT_STAFF_PERIODS[0],
    DEFAULT_STAFF_PERIODS.find(p => p.id === 'period_staff_m09_2026') || DEFAULT_STAFF_PERIODS[4]
  ].filter(Boolean);

  const forms: KpiStaffForm[] = [];

  for (const p of targetPeriods) {
    for (const s of staff) {
      forms.push(createInitialStaffForm(s, p));
    }
  }

  return forms;
};

export const DEFAULT_STAFF_FALLBACK_FORMS: KpiStaffForm[] = generateDefaultStaffForms();
