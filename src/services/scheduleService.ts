import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WeeklySchedule } from '../types/schedule';

const COLLECTION_NAME = 'weekly_schedules';

export const scheduleService = {
  // Fetch all weekly schedules
  async getWeeklySchedules(): Promise<WeeklySchedule[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(q);
      const list: WeeklySchedule[] = [];
      querySnapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as WeeklySchedule);
      });
      return list;
    } catch (error) {
      console.warn('Error getting weekly schedules from Firestore, falling back to LocalStorage:', error);
      const localData = localStorage.getItem('school_weekly_schedules');
      if (localData) {
        return JSON.parse(localData);
      }
      return [];
    }
  },

  // Save or Update a Weekly Schedule
  async saveWeeklySchedule(schedule: WeeklySchedule): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, schedule.id);
      const dataToSave = {
        ...schedule,
        created_at: schedule.created_at || new Date().toISOString()
      };
      await setDoc(docRef, dataToSave, { merge: true });

      // Sync with localStorage as fallback cache
      const list = await this.getWeeklySchedules();
      localStorage.setItem('school_weekly_schedules', JSON.stringify(list));
    } catch (error) {
      console.error('Error saving weekly schedule to Firestore:', error);
      // Fallback
      const localData = localStorage.getItem('school_weekly_schedules');
      let list: WeeklySchedule[] = localData ? JSON.parse(localData) : [];
      const idx = list.findIndex(s => s.id === schedule.id);
      if (idx >= 0) {
        list[idx] = schedule;
      } else {
        list.unshift(schedule);
      }
      localStorage.setItem('school_weekly_schedules', JSON.stringify(list));
    }
  },

  // Delete a Weekly Schedule
  async deleteWeeklySchedule(id: string): Promise<void> {
    // 1. Immediately remove from local storage cache
    const localData = localStorage.getItem('school_weekly_schedules');
    if (localData) {
      try {
        const list: WeeklySchedule[] = JSON.parse(localData);
        const filtered = list.filter(s => s.id !== id);
        localStorage.setItem('school_weekly_schedules', JSON.stringify(filtered));
      } catch (err) {
        console.error('Error updating local storage cache on delete:', err);
      }
    }

    // 2. Delete document from Firestore
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.warn('Error deleting weekly schedule from Firestore, proceeding with local deletion:', error);
      // Do not throw error so local cache/UI remains updated and deletion succeeds for the session
    }
  },

  // Check if a schedule for the same week already exists
  async checkExistingSchedule(weekNumber: string, schoolYear: string, startDate?: string): Promise<WeeklySchedule | null> {
    try {
      const list = await this.getWeeklySchedules();
      const found = list.find(s => 
        s.week_number === weekNumber && 
        s.school_year === schoolYear && 
        (!startDate || s.week_start_date === startDate)
      );
      return found || null;
    } catch {
      return null;
    }
  }
};
