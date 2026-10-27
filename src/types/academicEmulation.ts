export interface ClassAcademicEmulationRecord {
  id: string; // `${schoolYear}_w${weekNumber}_${classId}`
  schoolYear: string;
  weekNumber: number;
  monthNumber: number;
  classId: string;
  className: string;

  // Thống kê giờ học & nền nếp học tập
  goodLessons: number; // Giờ học Tốt (không cộng, không trừ)
  fairLessons: number; // Giờ học Khá (trừ 1đ/giờ)
  avgLessons: number; // Giờ học Tb (trừ 3đ/giờ)
  weakLessons: number; // Giờ học Yếu (trừ 5đ/giờ)
  goodDays: number; // Ngày học tốt (cộng 10đ/ngày nếu cả ngày đạt giờ tốt)
  goodWeeks: number; // Tuần học tốt (cộng 20đ/tuần nếu cả tuần toàn giờ tốt, không có giờ khá/tb/yếu)
  goodMarks: number; // Lượt học sinh đạt điểm 8, 9, 10 (cộng 2đ/lượt)
  badMarks: number; // Lượt học sinh có điểm dưới 5 (trừ 2đ/lượt)

  // Chi tiết điểm cộng
  bonusGoodMarks?: number; // goodMarks * 2
  bonusGoodDays?: number; // goodDays * 10
  bonusGoodWeeks?: number; // goodWeeks * 20
  bonusPoints?: number; // Tổng điểm cộng

  // Chi tiết điểm trừ
  deductFairLessons?: number; // fairLessons * 1
  deductAvgLessons?: number; // avgLessons * 3
  deductWeakLessons?: number; // weakLessons * 5
  deductLessonTotal?: number; // Tổng trừ giờ học
  deductBadMarks?: number; // badMarks * 2
  deductionPoints?: number; // Tổng điểm trừ

  // Tổng kết
  totalScore?: number; // 100 + bonusPoints - deductionPoints
  classification?: string; // Tốt / Khá / Đạt / Chưa đạt
  updatedAt: string;
}

export interface AcademicEmulationConfig {
  id: string;
  schoolYear: string;
  baseScore: number; // Điểm chuẩn ban đầu (mặc định 100)
  pointPerGoodLesson: number; // Giờ tốt (mặc định 0)
  pointPerFairLesson: number; // Trừ giờ khá (mặc định 1)
  pointPerAvgLesson: number; // Trừ giờ TB (mặc định 3)
  pointPerWeakLesson: number; // Trừ giờ yếu (mặc định 5)
  pointPerGoodDay: number; // Cộng ngày học tốt (mặc định 10)
  pointPerGoodWeek: number; // Cộng tuần học tốt (mặc định 20)
  pointPerGoodMark: number; // Cộng điểm 8, 9, 10 (mặc định 2)
  pointPerBadMark: number; // Trừ điểm < 5 (mặc định 2)
  thresholdExcellent: number; // Ngưỡng Tốt (>= 110)
  thresholdGood: number; // Ngưỡng Khá (>= 95)
  thresholdPass: number; // Ngưỡng Đạt (>= 80)
}

export const DEFAULT_EMULATION_CONFIG: AcademicEmulationConfig = {
  id: "default_emulation_config",
  schoolYear: "2026–2027",
  baseScore: 100,
  pointPerGoodLesson: 0,
  pointPerFairLesson: 1,
  pointPerAvgLesson: 3,
  pointPerWeakLesson: 5,
  pointPerGoodDay: 10,
  pointPerGoodWeek: 20,
  pointPerGoodMark: 2,
  pointPerBadMark: 2,
  thresholdExcellent: 110,
  thresholdGood: 95,
  thresholdPass: 80
};

export interface MonthlyEmulationSummary {
  classId: string;
  className: string;
  monthNumber: number;
  schoolYear: string;
  targetWeeks: number[];
  weekRecords: Record<number, ClassAcademicEmulationRecord | undefined>;
  weekScores: { weekNumber: number; score: number; hasRecord: boolean }[];
  totalScore: number;
  weekCount: number;
  averageScore: number;
  classification: string;
  rank: number;
  // Accumulated statistics in month
  totalGoodLessons: number;
  totalFairLessons: number;
  totalAvgLessons: number;
  totalWeakLessons: number;
  totalGoodDays: number;
  totalGoodWeeks: number;
  totalGoodMarks: number;
  totalBadMarks: number;
  totalBonusPoints: number;
  totalDeductionPoints: number;
}

