import * as XLSX from 'xlsx';
import { Student, TeacherAssessment, ConductEvaluation, RatingTierItem } from '../types/homeroom';
import { YouthViolationRecord } from '../types/youthDiscipline';

/**
 * Export student list of a class to Excel
 */
export function exportStudentListToExcel(className: string, schoolYear: string, students: Student[]) {
  const excelData: any[] = [];

  // Title headers
  excelData.push(['TRƯỜNG THPT SƠN LƯƠNG']);
  excelData.push([`DANH SÁCH HỌC SINH LỚP ${className.toUpperCase()}`]);
  excelData.push([`Năm học: ${schoolYear} | Tổng số: ${students.length} học sinh`]);
  excelData.push([]); // blank line

  // Column Headers
  excelData.push([
    'STT',
    'Mã học sinh',
    'Họ và tên',
    'Giới tính',
    'Ngày sinh',
    'Lớp',
    'SĐT Phụ huynh',
    'Họ tên Phụ huynh',
    'Địa chỉ'
  ]);

  // Data rows
  students.forEach((s, idx) => {
    excelData.push([
      s.stt || idx + 1,
      s.code || '',
      s.name || '',
      s.gender || 'Nam',
      s.dob || '',
      s.className || className,
      s.parentPhone || '',
      s.parentName || '',
      s.address || ''
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // Column widths
  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 16 }, // Mã HS
    { wch: 24 }, // Họ tên
    { wch: 10 }, // Giới tính
    { wch: 14 }, // Ngày sinh
    { wch: 10 }, // Lớp
    { wch: 16 }, // SĐT PH
    { wch: 22 }, // Họ tên PH
    { wch: 30 }  // Địa chỉ
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Danh sách ${className}`);

  const fileName = `Danh_sach_hoc_sinh_${className}_${schoolYear.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Download sample Excel template for importing students
 */
export function downloadStudentTemplateExcel(className: string = '11A') {
  const excelData: any[] = [];

  excelData.push([
    'STT',
    'Mã học sinh',
    'Họ và tên',
    'Giới tính',
    'Ngày sinh (YYYY-MM-DD)',
    'Lớp',
    'SĐT Phụ huynh',
    'Họ tên Phụ huynh',
    'Địa chỉ'
  ]);

  // Sample data rows with real vnEdu/MOET style 10-digit student ID
  excelData.push([
    1,
    '2500809299',
    'Nguyễn Văn An',
    'Nam',
    '2009-05-15',
    className,
    '0912345678',
    'Nguyễn Văn Bằng',
    'Thôn 1, Sơn Lương, Văn Chấn'
  ]);
  excelData.push([
    2,
    '2500809300',
    'Trần Thị Bình',
    'Nữ',
    '2009-08-20',
    className,
    '0987654321',
    'Trần Văn Cường',
    'Thôn 2, Sơn Lương, Văn Chấn'
  ]);
  excelData.push([
    3,
    '2500809301',
    'Lê Hoàng Cường',
    'Nam',
    '2009-11-12',
    className,
    '0934567890',
    'Lê Văn Dũng',
    'Thôn 3, Sơn Lương, Văn Chấn'
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 24 },
    { wch: 10 },
    { wch: 22 },
    { wch: 10 },
    { wch: 16 },
    { wch: 22 },
    { wch: 30 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau_Nhap_Hoc_Sinh');

  XLSX.writeFile(workbook, `Mau_Nhap_Danh_Sach_Hoc_Sinh_${className}.xlsx`);
}

export interface ParsedStudentRow {
  excelRowIndex: number;
  stt?: number | string;
  code: string;
  name: string;
  gender: 'Nam' | 'Nữ';
  dob: string;
  className?: string;
  grade?: number;
  parentPhone?: string;
  parentName?: string;
  address?: string;
  isValid: boolean;
  error?: string;
  errorColumn?: string;
  isDuplicateInFile?: boolean;
}

export interface ExcelParseResult {
  rows: ParsedStudentRow[];
  totalRows: number;
  validRows: ParsedStudentRow[];
  invalidRows: ParsedStudentRow[];
  byClass: Record<string, number>;
  duplicateCodesInFile: string[];
  headerRowIndex: number;
}

/**
 * Helper to normalize header text:
 * Trim, replace multiple whitespaces with single space, lower case, strip accents.
 */
export function normalizeHeaderKey(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim().replace(/\s+/g, ' ').toLowerCase();
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
}

/**
 * Header verification helpers with flexible semantic aliases
 */
export function isSttHeader(h: string): boolean {
  const k = normalizeHeaderKey(h);
  return k === 'stt' || k === 'so thu tu' || k === 'so_tt' || k === 'sott' || k === 'no.' || k === 'no' || k === 'index' || k === 'tt';
}

export function isCodeHeader(h: string): boolean {
  const k = normalizeHeaderKey(h);
  if (isSttHeader(h)) return false;
  if (k.includes('phu huynh') || k.includes('parent') || k.includes('cha') || k.includes('me') || k.includes('bo')) return false;

  const exacts = [
    'ma hs', 'ma_hs', 'ma hoc sinh', 'ma_hoc_sinh', 'mahs', 'mahocsinh',
    'ma dinh danh', 'so dinh danh', 'ma so hs', 'ma so hoc sinh', 'ma so', 'maso',
    'ma hssv', 'mahssv', 'student id', 'student_id', 'studentid', 'id hs', 'id_hs', 'code', 'ma'
  ];
  if (exacts.includes(k)) return true;

  return (k.includes('ma hs') || k.includes('ma hoc sinh') || k.includes('mã hs') || k.includes('ma dinh danh') || k.includes('so dinh danh')) && !k.includes('phu huynh');
}

export function isFullNameHeader(h: string): boolean {
  const k = normalizeHeaderKey(h);
  if (isSttHeader(h) || isCodeHeader(h)) return false;
  if (k.includes('phu huynh') || k.includes('parent') || k.includes('cha') || k.includes('me') || k.includes('bo')) return false;

  const exacts = [
    'ho va ten', 'ho va ten hoc sinh', 'ho ten', 'ho ten hoc sinh',
    'ten hoc sinh', 'full name', 'fullname', 'ho & ten', 'ho, ten', 'ho  ten'
  ];
  if (exacts.includes(k)) return true;

  if (k.includes('ho') && k.includes('ten')) return true;
  if (k.includes('fullname') || k.includes('full name')) return true;

  return false;
}

export function isHoHeader(h: string): boolean {
  const k = normalizeHeaderKey(h);
  if (isSttHeader(h) || isCodeHeader(h) || isFullNameHeader(h)) return false;
  if (k.includes('phu huynh') || k.includes('parent') || k.includes('cha') || k.includes('me')) return false;

  const exacts = ['ho', 'ho dem', 'ho va ten dem', 'ho lot', 'last name', 'lastname', 'surname'];
  if (exacts.includes(k)) return true;

  return k === 'ho' || k.startsWith('ho dem') || k.startsWith('ho lot') || k.startsWith('ho va ten dem');
}

export function isTenHeader(h: string): boolean {
  const k = normalizeHeaderKey(h);
  if (isSttHeader(h) || isCodeHeader(h) || isFullNameHeader(h)) return false;
  if (k.includes('phu huynh') || k.includes('parent') || k.includes('cha') || k.includes('me') || k.includes('truong') || k.includes('lop') || k.includes('khoi')) return false;

  const exacts = ['ten', 'ten hs', 'first name', 'firstname', 'given name'];
  if (exacts.includes(k)) return true;

  return k === 'ten' || k === 'ten hs';
}

export function isClassHeader(h: string): boolean {
  const k = normalizeHeaderKey(h);
  if (isFullNameHeader(h) || isCodeHeader(h)) return false;
  const exacts = ['lop', 'lop hoc', 'ten lop', 'class', 'class name', 'classname', 'chi doan', 'chi doan/lop'];
  if (exacts.includes(k)) return true;
  return k === 'lop' || k === 'lop hoc' || k === 'ten lop';
}

export function isGradeHeader(h: string): boolean {
  const k = normalizeHeaderKey(h);
  const exacts = ['khoi', 'khoi hoc', 'khoi lop', 'grade'];
  return exacts.includes(k) || k === 'khoi';
}

export function isGenderHeader(h: string): boolean {
  const k = normalizeHeaderKey(h);
  return k.includes('gioi tinh') || k === 'gioi' || k === 'gender' || k === 'sex' || k === 'phai';
}

export function isDobHeader(h: string): boolean {
  const k = normalizeHeaderKey(h);
  return k.includes('ngay sinh') || k.includes('sinh ngay') || k.includes('dob') || k.includes('date of birth') || k.includes('birth') || k.includes('sinh nhat');
}

export function isParentPhoneHeader(h: string): boolean {
  const k = normalizeHeaderKey(h);
  return k.includes('sdt') || k.includes('dien thoai') || k.includes('phone') || k.includes('tel') || k.includes('mobile');
}

export function isParentNameHeader(h: string): boolean {
  const k = normalizeHeaderKey(h);
  return (k.includes('phu huynh') || k.includes('parent') || k.includes('cha') || k.includes('me') || k.includes('bo')) && !isParentPhoneHeader(h);
}

export function isAddressHeader(h: string): boolean {
  const k = normalizeHeaderKey(h);
  return k.includes('dia chi') || k.includes('thuong tru') || k.includes('ho khau') || k.includes('noi o') || k.includes('address');
}

/**
 * Check if a string looks like a human name (contains letters, not pure numbers)
 */
function isHumanName(val: string): boolean {
  const str = String(val || '').trim();
  if (!str) return false;
  if (/^\d+$/.test(str)) return false;
  // Has letters (including Vietnamese accents)
  return /[a-zA-ZàáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/i.test(str);
}

/**
 * Validate a parsed student row
 */
export function validateParsedStudent(row: { code: string; name: string; excelRowIndex?: number }): { isValid: boolean; error?: string; errorColumn?: string } {
  const nameTrim = String(row.name || '').trim();
  const codeTrim = String(row.code || '').trim();
  const rowIdx = row.excelRowIndex ? `Dòng ${row.excelRowIndex}: ` : '';

  if (!nameTrim) {
    return { isValid: false, error: `${rowIdx}Họ và tên không được bỏ trống.`, errorColumn: 'Họ và tên' };
  }

  if (/^\d+$/.test(nameTrim)) {
    return { isValid: false, error: `${rowIdx}Họ và tên chỉ chứa chữ số (Cột Họ và tên bị gán sai cột với Mã HS).`, errorColumn: 'Họ và tên' };
  }

  if (!isHumanName(nameTrim)) {
    return { isValid: false, error: `${rowIdx}Họ và tên không chứa ký tự chữ hợp lệ.`, errorColumn: 'Họ và tên' };
  }

  if (nameTrim === codeTrim && nameTrim.length > 0) {
    return { isValid: false, error: `${rowIdx}Họ và tên trùng hoàn toàn với Mã học sinh (${nameTrim}).`, errorColumn: 'Họ và tên' };
  }

  return { isValid: true };
}

/**
 * Parse uploaded Excel file into structured verification result with dynamic header detection,
 * semantic column mapping, and automatic anti-swap protection.
 */
export function parseStudentExcelFile(file: File, defaultClassName?: string): Promise<ExcelParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!jsonData || jsonData.length === 0) {
          resolve({
            rows: [],
            totalRows: 0,
            validRows: [],
            invalidRows: [],
            byClass: {},
            duplicateCodesInFile: [],
            headerRowIndex: 0
          });
          return;
        }

        // 1. Dynamic Header Row Detection: scan rows 0..30 to find the best header row
        let bestHeaderRowIdx = -1;
        let maxScore = -1;

        const maxRowsToScan = Math.min(30, jsonData.length);
        for (let r = 0; r < maxRowsToScan; r++) {
          const row = jsonData[r];
          if (!row || !Array.isArray(row) || row.length === 0) continue;

          let score = 0;
          let hasName = false;
          let hasCode = false;
          let hasStt = false;
          let hasClass = false;
          let hasGender = false;
          let hasDob = false;

          row.forEach(cell => {
            const cellStr = String(cell || '');
            if (isFullNameHeader(cellStr) || isHoHeader(cellStr) || isTenHeader(cellStr)) hasName = true;
            if (isCodeHeader(cellStr)) hasCode = true;
            if (isSttHeader(cellStr)) hasStt = true;
            if (isClassHeader(cellStr)) hasClass = true;
            if (isGenderHeader(cellStr)) hasGender = true;
            if (isDobHeader(cellStr)) hasDob = true;
          });

          if (hasName) score += 10;
          if (hasCode) score += 6;
          if (hasClass) score += 4;
          if (hasStt) score += 3;
          if (hasGender) score += 3;
          if (hasDob) score += 3;

          if (score > maxScore) {
            maxScore = score;
            bestHeaderRowIdx = r;
          }
        }

        const headerRowIdx = (bestHeaderRowIdx >= 0 && maxScore >= 4) ? bestHeaderRowIdx : 0;
        const headers: string[] = (jsonData[headerRowIdx] || []).map(h => String(h || '').trim());

        // Also check if the row immediately following headerRowIdx is a sub-header (e.g. split Ho / Ten)
        let subHeaders: string[] = [];
        if (headerRowIdx + 1 < jsonData.length) {
          const nextRow = jsonData[headerRowIdx + 1];
          if (Array.isArray(nextRow) && nextRow.some(c => isTenHeader(String(c || '')) || isHoHeader(String(c || '')))) {
            subHeaders = nextRow.map(h => String(h || '').trim());
          }
        }

        // 2. Identify Column Indices by Header Name
        let fullNameCol = headers.findIndex(h => isFullNameHeader(h));
        let hoCol = headers.findIndex(h => isHoHeader(h));
        let tenCol = headers.findIndex(h => isTenHeader(h));
        let codeCol = headers.findIndex(h => isCodeHeader(h));
        let classCol = headers.findIndex(h => isClassHeader(h));
        let gradeCol = headers.findIndex(h => isGradeHeader(h));
        let sttCol = headers.findIndex(h => isSttHeader(h));
        let genderCol = headers.findIndex(h => isGenderHeader(h));
        let dobCol = headers.findIndex(h => isDobHeader(h));
        let parentPhoneCol = headers.findIndex(h => isParentPhoneHeader(h));
        let parentNameCol = headers.findIndex(h => isParentNameHeader(h));
        let addressCol = headers.findIndex(h => isAddressHeader(h));

        // Check sub-headers if ho/ten not found
        if (subHeaders.length > 0) {
          if (hoCol === -1) hoCol = subHeaders.findIndex(h => isHoHeader(h));
          if (tenCol === -1) tenCol = subHeaders.findIndex(h => isTenHeader(h));
          if (fullNameCol === -1) fullNameCol = subHeaders.findIndex(h => isFullNameHeader(h));
        }

        // Fallback: if fullNameCol is not found and no separate ho/ten columns found, look for candidate column containing "ten" or "name"
        if (fullNameCol === -1 && (hoCol === -1 || tenCol === -1)) {
          fullNameCol = headers.findIndex((h, idx) => {
            if (idx === sttCol || idx === codeCol || idx === classCol || idx === gradeCol || idx === genderCol || idx === dobCol || idx === parentPhoneCol || idx === parentNameCol || idx === addressCol) {
              return false;
            }
            const k = normalizeHeaderKey(h);
            return k.includes('ten') || k.includes('name');
          });
        }

        const dataStartRow = subHeaders.length > 0 ? headerRowIdx + 2 : headerRowIdx + 1;
        const parsedStudents: ParsedStudentRow[] = [];
        const codeCounts: Record<string, number> = {};

        // 3. Process Data Rows
        for (let r = dataStartRow; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (!row || !Array.isArray(row) || row.length === 0) continue;

          // Check if row has any non-empty cell
          const hasAnyData = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
          if (!hasAnyData) continue;

          const excelRowIndex = r + 1;

          // Extract STT
          let sttVal: string | number | undefined = undefined;
          if (sttCol >= 0 && row[sttCol] !== undefined && row[sttCol] !== null) {
            const rawStt = String(row[sttCol]).trim();
            if (/^\d+$/.test(rawStt)) sttVal = Number(rawStt);
            else if (rawStt) sttVal = rawStt;
          }

          // Extract Code
          let codeVal = codeCol >= 0 && row[codeCol] !== undefined && row[codeCol] !== null ? String(row[codeCol]).trim() : '';

          // Extract Full Name
          let nameVal = '';
          if (fullNameCol >= 0 && row[fullNameCol] !== undefined && row[fullNameCol] !== null) {
            nameVal = String(row[fullNameCol]).trim();
          } else if (hoCol >= 0 && tenCol >= 0) {
            const ho = String(row[hoCol] || '').trim();
            const ten = String(row[tenCol] || '').trim();
            nameVal = [ho, ten].filter(Boolean).join(' ');
          }

          // Collapse internal whitespaces
          nameVal = nameVal.replace(/\s+/g, ' ').trim();
          codeVal = codeVal.replace(/\s+/g, ' ').trim();

          // Skip non-student header/footer summary lines
          const normName = normalizeHeaderKey(nameVal);
          const normCode = normalizeHeaderKey(codeVal);
          if (
            normName.includes('tong so') ||
            normName.includes('danh sach') ||
            normName.includes('giao vien chu nhiem') ||
            normName.includes('nguoi lap bang') ||
            normName.startsWith('ngay ') ||
            normName === 'stt' ||
            normCode.includes('tong so')
          ) {
            continue;
          }

          // -------------------------------------------------------------
          // SMART ANTI-SWAP PROTECTION (Requirement 3)
          // If nameVal is purely numeric (e.g. "2500809299") AND codeVal is a human name (e.g. "Nguyễn Văn A"):
          // The columns were inverted in Excel or mapped backwards -> auto-correct them!
          // -------------------------------------------------------------
          if (/^\d+$/.test(nameVal) && isHumanName(codeVal)) {
            const temp = nameVal;
            nameVal = codeVal;
            codeVal = temp;
          }

          // If nameVal is still purely numeric or empty, look for any other cell in this row that contains a human name
          if (!isHumanName(nameVal)) {
            const candidateCell = row.find((cell, cellIdx) => {
              if (cellIdx === codeCol || cellIdx === sttCol || cellIdx === classCol || cellIdx === gradeCol || cellIdx === dobCol) return false;
              const cellStr = String(cell || '').trim();
              return isHumanName(cellStr) && cellStr.split(/\s+/).length >= 2;
            });
            if (candidateCell) {
              nameVal = String(candidateCell).trim().replace(/\s+/g, ' ');
            }
          }

          // Extract Class
          let rowClassName = '';
          if (classCol >= 0 && row[classCol] !== undefined && row[classCol] !== null) {
            rowClassName = String(row[classCol]).trim().toUpperCase();
          }
          if (!rowClassName && defaultClassName) {
            rowClassName = defaultClassName.trim().toUpperCase();
          }

          // Extract Grade
          let rowGrade: number | undefined = undefined;
          if (gradeCol >= 0 && row[gradeCol] !== undefined && row[gradeCol] !== null) {
            const rawG = parseInt(String(row[gradeCol]).replace(/\D/g, ''), 10);
            if (!isNaN(rawG) && [10, 11, 12].includes(rawG)) rowGrade = rawG;
          }
          if (!rowGrade && rowClassName) {
            const match = rowClassName.match(/^(10|11|12)/);
            if (match) rowGrade = Number(match[1]);
          }

          // Validate name & code
          const validation = validateParsedStudent({ code: codeVal, name: nameVal, excelRowIndex });
          let isValid = validation.isValid;
          let error = validation.error;
          let errorColumn = validation.errorColumn;

          // If codeVal is empty, check if we can synthesize a fallback code
          if (!codeVal) {
            if (isValid) {
              const fallbackNum = parsedStudents.length + 1;
              codeVal = `HS${rowClassName ? rowClassName.replace(/[^a-zA-Z0-9]/g, '') : ''}${String(fallbackNum).padStart(3, '0')}`;
            } else {
              codeVal = `HS_ERR_${excelRowIndex}`;
            }
          }

          // Extract Gender
          let genderRaw = genderCol >= 0 ? String(row[genderCol] || '').trim().toLowerCase() : '';
          let gender: 'Nam' | 'Nữ' = 'Nam';
          if (genderRaw.includes('nữ') || genderRaw.includes('nu') || genderRaw === 'f' || genderRaw === 'female') {
            gender = 'Nữ';
          }

          // Extract DOB
          let dobVal = dobCol >= 0 ? String(row[dobCol] || '').trim() : '';
          if (dobCol >= 0 && typeof row[dobCol] === 'number') {
            const dateObj = XLSX.SSF.parse_date_code(row[dobCol]);
            if (dateObj) {
              dobVal = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
            }
          }
          if (dobVal && dobVal.includes('/')) {
            const parts = dobVal.split('/');
            if (parts.length === 3) {
              const d = parts[0].padStart(2, '0');
              const m = parts[1].padStart(2, '0');
              const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              dobVal = `${y}-${m}-${d}`;
            }
          }
          if (!dobVal) dobVal = '2009-01-01';

          // Extract Parent info & Address
          const parentPhoneVal = parentPhoneCol >= 0 ? String(row[parentPhoneCol] || '').trim() : '';
          const parentNameVal = parentNameCol >= 0 ? String(row[parentNameCol] || '').trim() : '';
          const addressVal = addressCol >= 0 ? String(row[addressCol] || '').trim() : '';

          // Track duplicate codes in file
          if (codeVal) {
            codeCounts[codeVal] = (codeCounts[codeVal] || 0) + 1;
          }

          parsedStudents.push({
            excelRowIndex,
            stt: sttVal || parsedStudents.length + 1,
            code: codeVal,
            name: nameVal,
            gender,
            dob: dobVal,
            className: rowClassName || defaultClassName,
            grade: rowGrade,
            parentPhone: parentPhoneVal || undefined,
            parentName: parentNameVal || undefined,
            address: addressVal || undefined,
            isValid,
            error,
            errorColumn
          });
        }

        // Mark duplicate codes within the file
        const duplicateCodesInFile: string[] = [];
        Object.entries(codeCounts).forEach(([c, count]) => {
          if (count > 1) duplicateCodesInFile.push(c);
        });

        parsedStudents.forEach(s => {
          if (s.code && codeCounts[s.code] > 1) {
            s.isDuplicateInFile = true;
          }
        });

        // Compute byClass summary
        const byClass: Record<string, number> = {};
        parsedStudents.forEach(s => {
          const cName = s.className || defaultClassName || 'Chưa phân lớp';
          byClass[cName] = (byClass[cName] || 0) + 1;
        });

        const validRows = parsedStudents.filter(r => r.isValid);
        const invalidRows = parsedStudents.filter(r => !r.isValid);

        resolve({
          rows: parsedStudents,
          totalRows: parsedStudents.length,
          validRows,
          invalidRows,
          byClass,
          duplicateCodesInFile,
          headerRowIndex: headerRowIdx
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

export interface ExportClassificationResultsParams {
  className: string;
  schoolYear: string;
  homeroomTeacherName?: string;
  periodScope: 'week' | 'month' | 'year';
  selectedMonth: string; // e.g. "Tháng 09", "Tháng 10"
  selectedWeek: number; // e.g. 4
  students: Student[];
  studentScores: Map<string, {
    totalScore: number;
    classification: string;
    totalPlus: number;
    totalMinus: number;
    violationCount: number;
    violations: YouthViolationRecord[];
  }>;
  teacherAssessments?: TeacherAssessment[];
  evaluations?: ConductEvaluation[];
  ratingTiers?: RatingTierItem[];
}

/**
 * Xuất kết quả xếp loại học sinh theo lớp và kỳ đánh giá (Tháng / Tuần / Cả năm)
 * Tên file: Ket_qua_xep_loai_HS_Lop_[Lop]_[Ky_danh_gia].xlsx
 */
export function exportClassificationResultsToExcel({
  className,
  schoolYear,
  homeroomTeacherName,
  periodScope,
  selectedMonth,
  selectedWeek,
  students,
  studentScores,
  teacherAssessments = [],
  evaluations = [],
  ratingTiers = []
}: ExportClassificationResultsParams) {
  if (!students || students.length === 0) {
    alert(`Lớp ${className} hiện chưa có học sinh để xuất kết quả xếp loại.`);
    return;
  }

  const cleanYear = (schoolYear || '2026-2027').replace(/[\u2010-\u2015]/g, '-').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanClass = (className || 'Lop').replace(/[^a-zA-Z0-9]/g, '_');

  let periodLabel = '';
  let periodFilePart = '';

  const monthNum = parseInt((selectedMonth || '').replace(/\D/g, ''), 10) || 9;
  const monthStrFormatted = String(monthNum).padStart(2, '0');

  if (periodScope === 'month') {
    periodLabel = `Tháng ${monthStrFormatted} (Năm học ${schoolYear})`;
    periodFilePart = `Thang_${monthStrFormatted}_${cleanYear}`;
  } else if (periodScope === 'week') {
    const weekStrFormatted = String(selectedWeek).padStart(2, '0');
    periodLabel = `Tuần ${weekStrFormatted} (Tháng ${monthStrFormatted}, Năm học ${schoolYear})`;
    periodFilePart = `Tuan_${weekStrFormatted}_${cleanYear}`;
  } else {
    periodLabel = `Cả năm học ${schoolYear}`;
    periodFilePart = `Ca_nam_hoc_${cleanYear}`;
  }

  const fileName = `Ket_qua_xep_loai_HS_Lop_${cleanClass}_${periodFilePart}.xlsx`;

  const now = new Date();
  const dayStr = String(now.getDate()).padStart(2, '0');
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const yearStr = String(now.getFullYear());
  const reportDate = `${dayStr}/${monthStr}/${yearStr}`;

  const excelData: any[][] = [];

  // Header Rows
  excelData.push(['TRƯỜNG THPT SƠN LƯƠNG']);
  excelData.push(['DANH SÁCH KẾT QUẢ XẾP LOẠI HỌC SINH']);
  excelData.push([`Lớp: ${className} | Giáo viên chủ nhiệm: ${homeroomTeacherName || 'Chưa phân công'}`]);
  excelData.push([`Kỳ đánh giá: ${periodLabel} | Năm học: ${schoolYear}`]);
  excelData.push([`Ngày xuất báo cáo: ${reportDate} | Tổng số: ${students.length} học sinh`]);
  excelData.push([]); // Blank row

  // 9 Columns Header (Row 7 in 1-based index)
  excelData.push([
    'STT',
    'Mã học sinh',
    'Họ và tên',
    'Giới tính',
    'Lớp',
    'Tổng điểm trừ trong kỳ',
    'Điểm rèn luyện',
    'Xếp loại học sinh',
    'Ghi chú'
  ]);

  const normYear = (schoolYear || '').replace(/[\u2010-\u2015]/g, '-').trim();

  // Populate data rows
  students.forEach((s, idx) => {
    const scoreInfo = studentScores.get(s.id);

    // 1. Check teacher assessment for this student in this period
    const stAssessment = (teacherAssessments || []).find(a => {
      if (a.studentId !== s.id) return false;
      if (a.schoolYear) {
        const aYear = a.schoolYear.replace(/[\u2010-\u2015]/g, '-').trim();
        if (normYear && aYear && aYear !== normYear) return false;
      }
      if (periodScope === 'month') {
        return Number(a.monthNumber) === monthNum || a.month === selectedMonth;
      }
      if (periodScope === 'week') {
        return Number(a.monthNumber) === monthNum || a.month === selectedMonth;
      }
      return true; // For 'year', any assessment in this school year
    });

    // 2. Check conduct evaluation for this student in this period
    const evalItem = (evaluations || []).find(e => {
      if (e.studentId !== s.id) return false;
      if (e.schoolYear) {
        const eYear = e.schoolYear.replace(/[\u2010-\u2015]/g, '-').trim();
        if (normYear && eYear && eYear !== normYear) return false;
      }
      if (periodScope === 'month') {
        return e.period === selectedMonth || e.period?.includes(selectedMonth);
      }
      return true;
    });

    // 3. Check violations
    const hasViolations = Boolean(scoreInfo && (scoreInfo.violationCount > 0 || scoreInfo.totalMinus > 0));

    // A student has evaluation data if they have a saved teacher assessment, evaluation record, or registered violations
    const hasEvaluationData = Boolean(stAssessment || evalItem || hasViolations);

    let totalMinusVal: number | string = 0;
    let trainingScoreVal: number | string = 'Chưa có dữ liệu';
    let classificationVal: string = 'Chưa có dữ liệu';
    let noteVal: string = '';

    if (hasEvaluationData) {
      const minus = scoreInfo ? scoreInfo.totalMinus : 0;
      totalMinusVal = minus > 0 ? -minus : 0;

      const score = scoreInfo ? scoreInfo.totalScore : 100;
      trainingScoreVal = score;

      const savedRating =
        stAssessment?.bghAdjustedRating ||
        stAssessment?.teacherProposedRating ||
        stAssessment?.levelRating ||
        evalItem?.classification ||
        evalItem?.proposedClassification;

      classificationVal = savedRating || scoreInfo?.classification || 'Tốt';

      // Build informative note
      const notes: string[] = [];
      if (stAssessment?.comment && stAssessment.comment.trim()) {
        notes.push(stAssessment.comment.trim());
      }
      if (evalItem?.teacherComment && evalItem.teacherComment.trim() && evalItem.teacherComment.trim() !== stAssessment?.comment?.trim()) {
        notes.push(evalItem.teacherComment.trim());
      }
      if (stAssessment?.bghComment && stAssessment.bghComment.trim()) {
        notes.push(`BGH: ${stAssessment.bghComment.trim()}`);
      }
      if (stAssessment?.needsMonitoring) {
        notes.push('Cần theo dõi');
      }
      if (hasViolations && notes.length === 0) {
        const vSummary = (scoreInfo?.violations || [])
          .slice(0, 2)
          .map(v => v.criterionName || v.content)
          .filter(Boolean)
          .join('; ');
        notes.push(vSummary ? `Vi phạm: ${vSummary}` : `${scoreInfo?.violationCount} vi phạm`);
      }
      noteVal = notes.join(' | ');
    } else {
      totalMinusVal = 0;
      trainingScoreVal = 'Chưa có dữ liệu';
      classificationVal = 'Chưa có dữ liệu';
      noteVal = 'Chưa có dữ liệu đánh giá';
    }

    excelData.push([
      s.stt !== undefined && s.stt !== '' ? s.stt : (idx + 1),
      s.code || '',
      s.full_name || s.fullName || s.name || '',
      s.gender || 'Nam',
      s.className || className,
      totalMinusVal,
      trainingScoreVal,
      classificationVal,
      noteVal
    ]);
  });

  // Footer / Signatures
  excelData.push([]);
  excelData.push(['', '', '', '', '', '', '', 'Sơn Lương, ngày ' + dayStr + ' tháng ' + monthStr + ' năm ' + yearStr]);
  excelData.push(['', '', '', '', '', '', '', 'GIÁO VIÊN CHỦ NHIỆM']);
  excelData.push(['', '', '', '', '', '', '', '(Ký và ghi rõ họ tên)']);
  excelData.push([]);
  excelData.push([]);
  excelData.push(['', '', '', '', '', '', '', homeroomTeacherName || '']);

  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // Column widths
  worksheet['!cols'] = [
    { wch: 6 },  // 1. STT
    { wch: 16 }, // 2. Mã học sinh
    { wch: 25 }, // 3. Họ và tên
    { wch: 12 }, // 4. Giới tính
    { wch: 10 }, // 5. Lớp
    { wch: 22 }, // 6. Tổng điểm trừ trong kỳ
    { wch: 20 }, // 7. Điểm rèn luyện
    { wch: 20 }, // 8. Xếp loại học sinh
    { wch: 35 }  // 9. Ghi chú
  ];

  // AutoFilter for data columns from row 7 (index 6) to end of students
  const headerRowIdx = 7;
  const lastDataRowIdx = headerRowIdx + students.length;
  worksheet['!autofilter'] = { ref: `A${headerRowIdx}:I${lastDataRowIdx}` };

  // Freeze pane (freeze header row 7 so rows 1-7 stay fixed while scrolling)
  worksheet['!views'] = [{ state: 'frozen', ySplit: headerRowIdx, xSplit: 0, activeCell: `A${headerRowIdx + 1}` }];

  // Page setup: A4 Landscape
  worksheet['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 9
  };

  // Title Merges
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 8 } }
  ];

  const workbook = XLSX.utils.book_new();
  const sheetName = `Xếp loại ${className}`.slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  XLSX.writeFile(workbook, fileName);
}
