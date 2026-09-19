import {
  ConductCategory,
  ConductCriterion,
  ClassInfo,
  Student,
  HomeroomAssignment,
  ConductSettings,
  ClassificationType
} from '../types/homeroom';

export const DEFAULT_CONDUCT_CATEGORIES: ConductCategory[] = [
  { id: 'cat_1', code: 'NH_HT', name: 'NỀN NẾP HỌC TẬP', sortOrder: 1, status: 'active' },
  { id: 'cat_2', code: 'DP_THS', name: 'ĐỒNG PHỤC – THẺ HỌC SINH', sortOrder: 2, status: 'active' },
  { id: 'cat_3', code: 'VS_YT', name: 'VỆ SINH – Ý THỨC', sortOrder: 3, status: 'active' },
  { id: 'cat_4', code: 'DD_UX', name: 'ĐẠO ĐỨC – ỨNG XỬ', sortOrder: 4, status: 'active' },
  { id: 'cat_5', code: 'HT_KT', name: 'HỌC TẬP – KIỂM TRA', sortOrder: 5, status: 'active' },
  { id: 'cat_6', code: 'TN_CKT', name: 'TỆ NẠN – CHẤT KÍCH THÍCH – CHẤT GÂY CHÁY NỔ', sortOrder: 6, status: 'active' },
  { id: 'cat_7', code: 'DT_TB', name: 'ĐIỆN THOẠI – THIẾT BỊ', sortOrder: 7, status: 'active' },
  { id: 'cat_8', code: 'AN_TT', name: 'AN NINH – TRẬT TỰ', sortOrder: 8, status: 'active' },
  { id: 'cat_9', code: 'VH_ND', name: 'VĂN HÓA – NỘI DUNG KHÔNG PHÙ HỢP', sortOrder: 9, status: 'active' },
  { id: 'cat_10', code: 'AT_GT', name: 'AN TOÀN GIAO THÔNG', sortOrder: 10, status: 'active' },
  { id: 'cat_11', code: 'VP_KHAC', name: 'VI PHẠM KHÁC', sortOrder: 11, status: 'active' },
];

export const DEFAULT_CONDUCT_CRITERIA: ConductCriterion[] = [
  // Nhóm 1: NỀN NẾP HỌC TẬP
  {
    id: 'crit_strict',
    categoryId: 'cat_1',
    categoryName: 'NỀN NẾP HỌC TẬP',
    code: 'TC00',
    name: 'Học sinh thực hiện nghiêm túc nội quy',
    description: 'Chấp hành nghiêm túc quy định nền nếp, học tập, trang phục và nội quy nhà trường',
    pointType: 'plus',
    defaultPoint: 5,
    severity: 'Nhẹ',
    status: 'active',
    sortOrder: 0
  },
  {
    id: 'crit_1',
    categoryId: 'cat_1',
    categoryName: 'NỀN NẾP HỌC TẬP',
    code: 'TC01',
    name: 'Nghỉ học không phép',
    description: 'Nghỉ học không xin phép hoặc không có giấy tờ xác nhận của phụ huynh',
    pointType: 'minus',
    defaultPoint: -5,
    severity: 'Vừa',
    status: 'active',
    sortOrder: 1
  },
  {
    id: 'crit_2',
    categoryId: 'cat_1',
    categoryName: 'NỀN NẾP HỌC TẬP',
    code: 'TC02',
    name: 'Bỏ tiết',
    description: 'Tự ý rời lớp/trường trong giờ học mà không được sự đồng ý của GV',
    pointType: 'minus',
    defaultPoint: -3,
    severity: 'Vừa',
    status: 'active',
    sortOrder: 2
  },
  {
    id: 'crit_3',
    categoryId: 'cat_1',
    categoryName: 'NỀN NẾP HỌC TẬP',
    code: 'TC03',
    name: 'Vào lớp muộn',
    description: 'Đến trường/vào lớp sau khi có chuông vào học',
    pointType: 'minus',
    defaultPoint: -2,
    severity: 'Nhẹ',
    status: 'active',
    sortOrder: 3
  },
  {
    id: 'crit_4',
    categoryId: 'cat_1',
    categoryName: 'NỀN NẾP HỌC TẬP',
    code: 'TC04',
    name: 'Ghi sổ đầu bài',
    description: 'Bị giáo viên bộ môn ghi tên vào sổ đầu bài do vi phạm trật tự/không chuẩn bị bài',
    pointType: 'minus',
    defaultPoint: -3,
    severity: 'Nhẹ',
    status: 'active',
    sortOrder: 4
  },
  {
    id: 'crit_5',
    categoryId: 'cat_1',
    categoryName: 'NỀN NẾP HỌC TẬP',
    code: 'TC05',
    name: 'Số lần điểm kém',
    description: 'Điểm kiểm tra, hỏi bài cũ đạt dưới 4 điểm',
    pointType: 'minus',
    defaultPoint: -2,
    severity: 'Nhẹ',
    status: 'active',
    sortOrder: 5
  },
  {
    id: 'crit_6',
    categoryId: 'cat_1',
    categoryName: 'NỀN NẾP HỌC TẬP',
    code: 'TC06',
    name: 'Điểm tốt',
    description: 'Đạt điểm giỏi 9-10, hăng hái phát biểu, đạt giải trong kỳ thi, việc tốt',
    pointType: 'plus',
    defaultPoint: 5,
    severity: 'Nhẹ',
    status: 'active',
    sortOrder: 6
  },

  // Nhóm 2: ĐỒNG PHỤC – THẺ HỌC SINH
  {
    id: 'crit_7',
    categoryId: 'cat_2',
    categoryName: 'ĐỒNG PHỤC – THẺ HỌC SINH',
    code: 'TC07',
    name: 'Không mặc đồng phục, đeo thẻ học sinh theo quy định',
    description: 'Mặc sai đồng phục, không đeo thẻ, đi dép lê, tóc nhuộm sặc sỡ',
    pointType: 'minus',
    defaultPoint: -2,
    severity: 'Nhẹ',
    status: 'active',
    sortOrder: 7
  },

  // Nhóm 3: VỆ SINH – Ý THỨC
  {
    id: 'crit_8',
    categoryId: 'cat_3',
    categoryName: 'VỆ SINH – Ý THỨC',
    code: 'TC08',
    name: 'Đổ rác không đúng quy định',
    description: 'Vứt rác bừa bãi trong lớp học, sân trường, không trực nhật đúng lịch',
    pointType: 'minus',
    defaultPoint: -3,
    severity: 'Nhẹ',
    status: 'active',
    sortOrder: 8
  },

  // Nhóm 4: ĐẠO ĐỨC – ỨNG XỬ
  {
    id: 'crit_9',
    categoryId: 'cat_4',
    categoryName: 'ĐẠO ĐỨC – ỨNG XỬ',
    code: 'TC09',
    name: 'Xúc phạm nhân phẩm, danh dự, xâm phạm thân thể giáo viên, cán bộ, nhân viên nhà trường, người khác và học sinh khác',
    description: 'Có hành vi/ngôn từ vô văn hóa, vô lễ, lăng mạ, đe dọa hoặc vô lễ',
    pointType: 'minus',
    defaultPoint: -20,
    severity: 'Rất nghiêm trọng',
    status: 'active',
    sortOrder: 9
  },

  // Nhóm 5: HỌC TẬP – KIỂM TRA
  {
    id: 'crit_10',
    categoryId: 'cat_5',
    categoryName: 'HỌC TẬP – KIỂM TRA',
    code: 'TC10',
    name: 'Gian lận trong học tập, kiểm tra, thi',
    description: 'Sử dụng tài liệu, quay cóp, mang điện thoại vào phòng thi, chép bài bạn',
    pointType: 'minus',
    defaultPoint: -10,
    severity: 'Nghiêm trọng',
    status: 'active',
    sortOrder: 10
  },

  // Nhóm 6: TỆ NẠN – CHẤT KÍCH THÍCH – CHẤT GÂY CHÁY NỔ
  {
    id: 'crit_11',
    categoryId: 'cat_6',
    categoryName: 'TỆ NẠN – CHẤT KÍCH THÍCH – CHẤT GÂY CHÁY NỔ',
    code: 'TC11',
    name: 'Mua bán, sử dụng rượu, bia, thuốc lá, chất gây nghiện, các chất kích thích khác và pháo, các chất gây cháy nổ',
    description: 'Hút thuốc lá/thuốc lá điện tử, uống rượu bia, mang pháo hoặc chất gây nổ vào trường',
    pointType: 'minus',
    defaultPoint: -20,
    severity: 'Rất nghiêm trọng',
    status: 'active',
    sortOrder: 11
  },

  // Nhóm 7: ĐIỆN THOẠI – THIẾT BỊ
  {
    id: 'crit_12',
    categoryId: 'cat_7',
    categoryName: 'ĐIỆN THOẠI – THIẾT BỊ',
    code: 'TC12',
    name: 'Sử dụng điện thoại di động, các thiết bị khác khi đang học tập trên lớp không phục vụ cho việc học tập và không được giáo viên cho phép',
    description: 'Chơi game, lướt mạng, xem video trong giờ học',
    pointType: 'minus',
    defaultPoint: -5,
    severity: 'Vừa',
    status: 'active',
    sortOrder: 12
  },

  // Nhóm 8: AN NINH – TRẬT TỰ
  {
    id: 'crit_13',
    categoryId: 'cat_8',
    categoryName: 'AN NINH – TRẬT TỰ',
    code: 'TC13',
    name: 'Đánh nhau, gây rối trật tự, an ninh trong nhà trường và nơi công cộng',
    description: 'Tụ tập xô xát, gây rối trật tự, lôi kéo người bên ngoài vào trường',
    pointType: 'minus',
    defaultPoint: -20,
    severity: 'Rất nghiêm trọng',
    status: 'active',
    sortOrder: 13
  },

  // Nhóm 9: VĂN HÓA – NỘI DUNG KHÔNG PHÙ HỢP
  {
    id: 'crit_14',
    categoryId: 'cat_9',
    categoryName: 'VĂN HÓA – NỘI DUNG KHÔNG PHÙ HỢP',
    code: 'TC14',
    name: 'Sử dụng, trao đổi sản phẩm văn hóa có nội dung kích động bạo lực, đồi trụy; sử dụng đồ chơi hoặc chơi trò chơi có hại cho sự phát triển lành mạnh của bản thân',
    description: 'Truyền bá ấn phẩm độc hại, game cờ bạc, trò chơi nguy hiểm',
    pointType: 'minus',
    defaultPoint: -10,
    severity: 'Nghiêm trọng',
    status: 'active',
    sortOrder: 14
  },

  // Nhóm 10: AN TOÀN GIAO THÔNG
  {
    id: 'crit_15',
    categoryId: 'cat_10',
    categoryName: 'AN TOÀN GIAO THÔNG',
    code: 'TC15',
    name: 'Đi xe máy trong trường và để xe không đúng nơi quy định, không đội mũ bảo hiểm',
    description: 'Vi phạm luật giao thông đường bộ, kẹp 3, không đội mũ bảo hiểm khi đi xe máy/xe đạp điện',
    pointType: 'minus',
    defaultPoint: -5,
    severity: 'Vừa',
    status: 'active',
    sortOrder: 15
  },

  // Nhóm 11: VI PHẠM KHÁC
  {
    id: 'crit_16',
    categoryId: 'cat_11',
    categoryName: 'VI PHẠM KHÁC',
    code: 'TC16',
    name: 'Học sinh không được vi phạm những hành vi bị nghiêm cấm khác theo quy định của pháp luật, nội quy nhà trường',
    description: 'Các hành vi vi phạm pháp luật hoặc quy định khác chưa liệt kê ở trên',
    pointType: 'minus',
    defaultPoint: -5,
    severity: 'Vừa',
    status: 'active',
    sortOrder: 16
  }
];

export const DEFAULT_CLASSES: ClassInfo[] = [
  { id: 'class_10a1', name: '10A1', grade: 10, schoolYear: '2026–2027', homeroomTeacherId: 't1', homeroomTeacherName: 'Nguyễn Thị A', room: 'Phòng 101', totalStudents: 38 },
  { id: 'class_10a2', name: '10A2', grade: 10, schoolYear: '2026–2027', homeroomTeacherId: 't2', homeroomTeacherName: 'Trần Văn B', room: 'Phòng 102', totalStudents: 36 },
  { id: 'class_10a3', name: '10A3', grade: 10, schoolYear: '2026–2027', homeroomTeacherId: 't3', homeroomTeacherName: 'Lê Thị C', room: 'Phòng 103', totalStudents: 35 },
  { id: 'class_11a1', name: '11A1', grade: 11, schoolYear: '2026–2027', homeroomTeacherId: 't4', homeroomTeacherName: 'Phạm Văn D', room: 'Phòng 201', totalStudents: 40 },
  { id: 'class_11a2', name: '11A2', grade: 11, schoolYear: '2026–2027', homeroomTeacherId: 't5', homeroomTeacherName: 'Hoàng Thị E', room: 'Phòng 202', totalStudents: 37 },
  { id: 'class_12a1', name: '12A1', grade: 12, schoolYear: '2026–2027', homeroomTeacherId: 't6', homeroomTeacherName: 'Đặng Văn F', room: 'Phòng 301', totalStudents: 42 }
];

export const SAMPLE_STUDENTS: Student[] = [
  { id: 'std_10a1_01', classId: 'class_10a1', className: '10A1', code: 'HS10A101', name: 'Nguyễn Văn A', gender: 'Nam', dob: '2011-03-15', parentPhone: '0912345678', parentName: 'Nguyễn Văn Hùng', address: 'Sơn Lương, Văn Chấn, Yên Bái' },
  { id: 'std_10a1_02', classId: 'class_10a1', className: '10A1', code: 'HS10A102', name: 'Trần Thị B', gender: 'Nữ', dob: '2011-05-20', parentPhone: '0912345679', parentName: 'Trần Văn Long', address: 'Sơn Lương, Văn Chấn, Yên Bái' },
  { id: 'std_10a1_03', classId: 'class_10a1', className: '10A1', code: 'HS10A103', name: 'Lê Hoàng C', gender: 'Nam', dob: '2011-08-10', parentPhone: '0912345680', parentName: 'Lê Văn Nam', address: 'Sơn Lương, Văn Chấn, Yên Bái' },
  { id: 'std_10a1_04', classId: 'class_10a1', className: '10A1', code: 'HS10A104', name: 'Phạm Minh D', gender: 'Nam', dob: '2011-01-12', parentPhone: '0912345681', parentName: 'Phạm Văn Thành', address: 'Sơn Lương, Văn Chấn, Yên Bái' },
  { id: 'std_10a1_05', classId: 'class_10a1', className: '10A1', code: 'HS10A105', name: 'Hoàng Ngọc E', gender: 'Nữ', dob: '2011-09-28', parentPhone: '0912345682', parentName: 'Hoàng Văn Phúc', address: 'Sơn Lương, Văn Chấn, Yên Bái' },
  { id: 'std_10a1_06', classId: 'class_10a1', className: '10A1', code: 'HS10A106', name: 'Đỗ Đức F', gender: 'Nam', dob: '2011-11-04', parentPhone: '0912345683', parentName: 'Đỗ Văn Hải', address: 'Sơn Lương, Văn Chấn, Yên Bái' },
  { id: 'std_10a1_07', classId: 'class_10a1', className: '10A1', code: 'HS10A107', name: 'Vũ Thị G', gender: 'Nữ', dob: '2011-02-18', parentPhone: '0912345684', parentName: 'Vũ Văn Bình', address: 'Sơn Lương, Văn Chấn, Yên Bái' },
  { id: 'std_10a1_08', classId: 'class_10a1', className: '10A1', code: 'HS10A108', name: 'Bùi Anh H', gender: 'Nam', dob: '2011-07-22', parentPhone: '0912345685', parentName: 'Bùi Văn Tuấn', address: 'Sơn Lương, Văn Chấn, Yên Bái' },
  { id: 'std_10a1_09', classId: 'class_10a1', className: '10A1', code: 'HS10A109', name: 'Đặng Mai K', gender: 'Nữ', dob: '2011-10-30', parentPhone: '0912345686', parentName: 'Đặng Văn Đức', address: 'Sơn Lương, Văn Chấn, Yên Bái' },
  { id: 'std_10a1_10', classId: 'class_10a1', className: '10A1', code: 'HS10A110', name: 'Ngô Thanh L', gender: 'Nam', dob: '2011-04-14', parentPhone: '0912345687', parentName: 'Ngô Văn Sơn', address: 'Sơn Lương, Văn Chấn, Yên Bái' },

  // 10A2
  { id: 'std_10a2_01', classId: 'class_10a2', className: '10A2', code: 'HS10A201', name: 'Lý Văn M', gender: 'Nam', dob: '2011-06-11', parentPhone: '0912345688', parentName: 'Lý Văn Thái', address: 'Sơn Lương, Văn Chấn, Yên Bái' },
  { id: 'std_10a2_02', classId: 'class_10a2', className: '10A2', code: 'HS10A202', name: 'Nguyễn Thu N', gender: 'Nữ', dob: '2011-09-09', parentPhone: '0912345689', parentName: 'Nguyễn Văn Nghĩa', address: 'Sơn Lương, Văn Chấn, Yên Bái' },

  // 11A1
  { id: 'std_11a1_01', classId: 'class_11a1', className: '11A1', code: 'HS11A101', name: 'Phan Văn P', gender: 'Nam', dob: '2010-01-25', parentPhone: '0912345690', parentName: 'Phan Văn Quý', address: 'Sơn Lương, Văn Chấn, Yên Bái' },
  { id: 'std_11a1_02', classId: 'class_11a1', className: '11A1', code: 'HS11A102', name: 'Trịnh Thị Q', gender: 'Nữ', dob: '2010-12-05', parentPhone: '0912345691', parentName: 'Trịnh Văn Khang', address: 'Sơn Lương, Văn Chấn, Yên Bái' }
];

export const DEFAULT_CONDUCT_SETTINGS: ConductSettings = {
  id: 'default_conduct_settings',
  schoolYear: '2026–2027',
  baseScore: 100,
  thresholds: {
    totMin: 90,
    khaMin: 70,
    datMin: 50
  }
};

/**
 * Calculates student score and classification
 */
export function calculateConductScore(
  baseScore: number,
  totalPlus: number,
  totalMinus: number,
  thresholds = DEFAULT_CONDUCT_SETTINGS.thresholds
): { totalScore: number; classification: ClassificationType } {
  // totalMinus is positive magnitude (e.g. 8 points lost) or negative point sum (e.g. -8)
  const minusMagnitude = Math.abs(totalMinus);
  const totalScore = baseScore + totalPlus - minusMagnitude;

  let classification: ClassificationType = 'Chưa đạt';
  if (totalScore >= thresholds.totMin) {
    classification = 'Tốt';
  } else if (totalScore >= thresholds.khaMin) {
    classification = 'Khá';
  } else if (totalScore >= thresholds.datMin) {
    classification = 'Đạt';
  } else {
    classification = 'Chưa đạt';
  }

  return { totalScore, classification };
}
