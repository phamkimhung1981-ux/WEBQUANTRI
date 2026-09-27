export interface ScheduleEvent {
  id: string;
  text: string;
  confidence?: number; // 0.0 to 1.0
  highlight?: 'red' | 'normal';
}

export interface ScheduleDay {
  id: string;
  day_of_week: string; // "Thứ 2", "Thứ 3", ..., "Chủ nhật"
  date: string; // YYYY-MM-DD
  date_str?: string; // "21/9"
  morning_events: ScheduleEvent[];
  afternoon_events: ScheduleEvent[];
  duty_leader: string;
  duty_leader_confidence?: number;
}

export interface WeeklySchedule {
  id: string;
  week_number: string; // "3"
  week_start_date: string; // "2026-09-21"
  week_end_date: string; // "2026-09-27"
  duty_week: string; // "12C"
  school_year: string; // "2026-2027"
  title: string; // "LỊCH CÔNG TÁC TUẦN 3"
  header_text?: string;
  days: ScheduleDay[];
  footer?: {
    working_time?: string;
    recipients?: string;
    principal_name?: string;
  };
  original_images?: string[]; // base64 preview or reference image URLs
  created_at?: string;
  created_by?: string;
}
