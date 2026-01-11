import {
  startOfWeek,
  addWeeks,
  subWeeks,
  format,
  getISOWeek,
  getYear,
  isToday,
  addDays
} from 'date-fns';
import type { DayOfWeek } from '../types';

/**
 * Get the WeekID in ISO format (e.g., "2026-W15")
 */
export function getWeekId(date: Date = new Date()): string {
  const year = getYear(date);
  const week = getISOWeek(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Parse a WeekID string to a date (returns Monday of that week)
 */
export function parseWeekId(weekId: string): Date {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid weekId format: ${weekId}`);
  }

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // Get Jan 4th of the year (always in week 1 per ISO)
  const jan4 = new Date(year, 0, 4);
  const startOfYear = startOfWeek(jan4, { weekStartsOn: 1 });

  // Add weeks to get to the target week
  return addWeeks(startOfYear, week - 1);
}

/**
 * Get the previous week's WeekID
 */
export function getPreviousWeekId(weekId: string): string {
  const date = parseWeekId(weekId);
  return getWeekId(subWeeks(date, 1));
}

/**
 * Get the next week's WeekID
 */
export function getNextWeekId(weekId: string): string {
  const date = parseWeekId(weekId);
  return getWeekId(addWeeks(date, 1));
}

/**
 * Get date range string for display (e.g., "Jan 6 - Jan 12, 2026")
 */
export function getWeekDisplayRange(weekId: string): string {
  const start = parseWeekId(weekId);
  const end = addDays(start, 6);

  const startMonth = format(start, 'MMM');
  const endMonth = format(end, 'MMM');
  const startDay = format(start, 'd');
  const endDay = format(end, 'd');
  const year = format(end, 'yyyy');

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

/**
 * Get all days of a week with their dates
 */
export function getWeekDays(weekId: string): { day: DayOfWeek; date: Date; isToday: boolean }[] {
  const startDate = parseWeekId(weekId);
  const days: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return days.map((day, index) => {
    const date = addDays(startDate, index);
    return {
      day,
      date,
      isToday: isToday(date)
    };
  });
}

/**
 * Format a date for display (e.g., "Mon 6")
 */
export function formatDayShort(date: Date): string {
  return format(date, 'EEE d');
}

/**
 * Format a date for full display (e.g., "Monday, January 6")
 */
export function formatDayFull(date: Date): string {
  return format(date, 'EEEE, MMMM d');
}

/**
 * Check if a date is today
 */
export function checkIsToday(date: Date): boolean {
  return isToday(date);
}

/**
 * Get today's day of week
 */
export function getTodayDayOfWeek(): DayOfWeek {
  const today = new Date();
  const dayIndex = today.getDay();
  const days: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Convert Sunday (0) to our Mon-Sun format
  return dayIndex === 0 ? 'Sun' : days[dayIndex] as DayOfWeek;
}

/**
 * Check if a weekId is the current week
 */
export function isCurrentWeek(weekId: string): boolean {
  return weekId === getWeekId(new Date());
}
