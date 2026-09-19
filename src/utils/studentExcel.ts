import * as XLSX from 'xlsx';
import { Student } from '../types/homeroom';

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
    'SĐT Phụ huynh',
    'Họ tên Phụ huynh',
    'Địa chỉ'
  ]);

  // Data rows
  students.forEach((s, idx) => {
    excelData.push([
      idx + 1,
      s.code || '',
      s.name || '',
      s.gender || 'Nam',
      s.dob || '',
      s.parentPhone || '',
      s.parentName || '',
      s.address || ''
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // Column widths
  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 14 }, // Mã HS
    { wch: 24 }, // Họ tên
    { wch: 10 }, // Giới tính
    { wch: 14 }, // Ngày sinh
    { wch: 16 }, // SĐT PH
    { wch: 22 }, // Họ tên PH
    { wch: 30 }  // Địa chỉ
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Danh sách ${className}`);

  const fileName = `Danh_sach_hoc_sing_${className}_${schoolYear.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Download sample Excel template for importing students
 */
export function downloadStudentTemplateExcel(className: string = '10A1') {
  const excelData: any[] = [];

  excelData.push([
    'STT',
    'Mã học sinh',
    'Họ và tên',
    'Giới tính',
    'Ngày sinh (YYYY-MM-DD)',
    'SĐT Phụ huynh',
    'Họ tên Phụ huynh',
    'Địa chỉ'
  ]);

  // Sample data rows
  excelData.push([
    1,
    `2500794869`,
    'Nguyễn Văn An',
    'Nam',
    '2010-05-15',
    '0912345678',
    'Nguyễn Văn Bằng',
    'Thôn 1, Sơn Lương, Văn Chấn'
  ]);
  excelData.push([
    2,
    `2500801969`,
    'Trần Thị Bình',
    'Nữ',
    '2010-08-20',
    '0987654321',
    'Trần Văn Cường',
    'Thôn 2, Sơn Lương, Văn Chấn'
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 24 },
    { wch: 10 },
    { wch: 22 },
    { wch: 16 },
    { wch: 22 },
    { wch: 30 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau_Nhap_Hoc_Sinh');

  XLSX.writeFile(workbook, `Mau_Nhap_Danh_Sach_Hoc_Sinh_${className}.xlsx`);
}

export interface ParsedStudentRow {
  code: string;
  name: string;
  gender: 'Nam' | 'Nữ';
  dob: string;
  parentPhone?: string;
  parentName?: string;
  address?: string;
  isValid: boolean;
  error?: string;
}

/**
 * Header verification helpers with flexible aliases and anti-collision checks
 */
export function isCodeHeader(h: string): boolean {
  const norm = String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const exactMatches = ['mã hs', 'ma hs', 'mã học sinh', 'ma hoc sinh', 'student id', 'student_id', 'id', 'mã', 'ma'];
  if (exactMatches.includes(norm)) return true;
  return (norm.includes('mã') || norm.includes('ma') || norm.includes('code') || norm.includes('id')) && 
         !norm.includes('phụ huynh') && !norm.includes('phu huynh');
}

export function isNameHeader(h: string): boolean {
  const norm = String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();
  // CRITICAL: A code header must NEVER be matched as a name header
  if (isCodeHeader(norm)) return false;
  
  const exactMatches = ['họ và tên', 'ho va ten', 'ho và ten', 'họ tên', 'ho ten', 'tên học sinh', 'ten hoc sinh', 'full name', 'fullname', 'tên', 'ten'];
  if (exactMatches.includes(norm)) return true;

  const isParent = norm.includes('phụ huynh') || norm.includes('phu huynh') || norm.includes('cha') || norm.includes('mẹ') || norm.includes('me') || norm.includes('parent');
  if (isParent) return false;

  return norm.includes('họ') || norm.includes('tên') || norm.includes('ten') || norm.includes('name');
}

export function isGenderHeader(h: string): boolean {
  const norm = String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return norm.includes('giới tính') || norm.includes('gioi tinh') || norm.includes('giới') || norm.includes('gender');
}

export function isDobHeader(h: string): boolean {
  const norm = String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return norm.includes('ngày sinh') || norm.includes('ngay sinh') || norm.includes('sinh') || norm.includes('ngày') || norm.includes('ngay') || norm.includes('dob') || norm.includes('birth');
}

export function isParentPhoneHeader(h: string): boolean {
  const norm = String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return norm.includes('sđt') || norm.includes('sdt') || norm.includes('điện thoại') || norm.includes('dien thoai') || norm.includes('phone') || norm.includes('tel');
}

export function isParentNameHeader(h: string): boolean {
  const norm = String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return (norm.includes('phụ huynh') || norm.includes('phu huynh') || norm.includes('cha') || norm.includes('mẹ') || norm.includes('me') || norm.includes('parent')) && !isParentPhoneHeader(norm);
}

export function isAddressHeader(h: string): boolean {
  const norm = String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return norm.includes('địa chỉ') || norm.includes('dia chi') || norm.includes('trú') || norm.includes('tru') || norm.includes('address');
}

/**
 * Validate a parsed student row
 */
export function validateParsedStudent(row: { code: string; name: string }): { isValid: boolean; error?: string } {
  const nameTrim = String(row.name || '').trim();
  const codeTrim = String(row.code || '').trim();

  if (!nameTrim) {
    return { isValid: false, error: 'Họ và tên không được bỏ trống' };
  }

  if (nameTrim === codeTrim) {
    return { isValid: false, error: '⚠️ Trùng khớp: Họ và tên trùng với Mã HS.' };
  }

  if (/^\d+$/.test(nameTrim)) {
    return { isValid: false, error: '⚠️ Lỗi: Họ và tên chỉ chứa chữ số. Cột Họ và tên bị mapping sai.' };
  }

  return { isValid: true };
}

/**
 * Parse uploaded Excel file into array of student objects with built-in validation
 */
export function parseStudentExcelFile(file: File): Promise<ParsedStudentRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          resolve([]);
          return;
        }

        // Find header row (the row containing keywords)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const rowStr = (jsonData[i] || []).join(' ').toLowerCase();
          if (rowStr.includes('họ') || rowStr.includes('tên') || rowStr.includes('mã')) {
            headerRowIdx = i;
            break;
          }
        }

        const headers: string[] = (jsonData[headerRowIdx] || []).map(h => String(h || '').trim());

        // Find column indices using flexible alias verification
        const codeCol = headers.findIndex(h => isCodeHeader(h));
        const nameCol = headers.findIndex(h => isNameHeader(h));
        const genderCol = headers.findIndex(h => isGenderHeader(h));
        const dobCol = headers.findIndex(h => isDobHeader(h));
        const parentPhoneCol = headers.findIndex(h => isParentPhoneHeader(h));
        const parentNameCol = headers.findIndex(h => isParentNameHeader(h));
        const addressCol = headers.findIndex(h => isAddressHeader(h));

        const parsedStudents: ParsedStudentRow[] = [];

        for (let r = headerRowIdx + 1; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (!row || row.length === 0) continue;

          // Extract values
          const nameVal = String(nameCol >= 0 ? row[nameCol] || '' : '').trim();
          if (!nameVal || nameVal.toLowerCase().includes('tổng số') || nameVal.toLowerCase().includes('giáo viên') || nameVal.toLowerCase().includes('stt')) continue;

          const codeVal = String(codeCol >= 0 ? row[codeCol] || '' : '').trim();
          const genderRaw = String(genderCol >= 0 ? row[genderCol] || '' : '').trim().toLowerCase();
          const gender: 'Nam' | 'Nữ' = (genderRaw.includes('nữ') || genderRaw === 'f') ? 'Nữ' : 'Nam';

          let dobVal = String(dobCol >= 0 ? row[dobCol] || '' : '').trim();
          if (typeof row[dobCol] === 'number') {
            const dateObj = XLSX.SSF.parse_date_code(row[dobCol]);
            if (dateObj) {
              dobVal = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
            }
          }

          const parentPhoneVal = String(parentPhoneCol >= 0 ? row[parentPhoneCol] || '' : '').trim();
          const parentNameVal = String(parentNameCol >= 0 ? row[parentNameCol] || '' : '').trim();
          const addressVal = String(addressCol >= 0 ? row[addressCol] || '' : '').trim();

          const validation = validateParsedStudent({ code: codeVal, name: nameVal });

          parsedStudents.push({
            code: codeVal || `HS${Date.now().toString().slice(-4)}${r}`,
            name: nameVal,
            gender,
            dob: dobVal || '2010-01-01',
            parentPhone: parentPhoneVal || undefined,
            parentName: parentNameVal || undefined,
            address: addressVal || undefined,
            isValid: validation.isValid,
            error: validation.error
          });
        }

        resolve(parsedStudents);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
