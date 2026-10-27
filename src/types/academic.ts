export type SemesterType = 'HK1' | 'HK2' | 'CaNam';

export interface SubjectScore {
  subjectId: string;
  subjectName: string;
  oralScore?: number; // Điểm miệng
  test15Min?: number; // Điểm 15 phút
  test45Min?: number; // Điểm giữa kỳ / 1 tiết
  semesterScore?: number; // Điểm cuối kỳ
  avgScore?: number; // Trung bình môn
  teacherComment?: string;
}

export interface StudentAcademicRecord {
  id: string;
  schoolYear: string; // "2026–2027"
  semester: SemesterType;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  subjects: Record<string, SubjectScore>;
  overallAvg?: number;
  academicRank?: 'Giỏi' | 'Khá' | 'Đạt' | 'Chưa đạt';
  conductRank?: 'Tốt' | 'Khá' | 'Đạt' | 'Chưa đạt';
  teacherRemarks?: string;
  updatedAt: string;
}

export interface ClassAcademicSummary {
  classId: string;
  className: string;
  grade: number;
  totalStudents: number;
  excellentCount: number;
  goodCount: number;
  passCount: number;
  failCount: number;
  classAvgScore: number;
}
