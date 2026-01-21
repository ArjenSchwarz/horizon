import { describe, it, expect } from 'vitest';
import { getMonday, formatWeekRange, isSameDay, formatDateISO } from './date-utils.js';

describe('getMonday', () => {
  it('returns same day for a Monday', () => {
    const monday = new Date(2025, 0, 13); // Jan 13, 2025 is a Monday
    const result = getMonday(monday);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(13);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('returns previous Monday for a Sunday', () => {
    const sunday = new Date(2025, 0, 19); // Jan 19, 2025 is a Sunday
    const result = getMonday(sunday);
    expect(result.getDate()).toBe(13); // Should be Jan 13
  });

  it('returns previous Monday for mid-week days', () => {
    const wednesday = new Date(2025, 0, 15); // Jan 15, 2025 is a Wednesday
    const result = getMonday(wednesday);
    expect(result.getDate()).toBe(13);

    const saturday = new Date(2025, 0, 18); // Jan 18, 2025 is a Saturday
    const result2 = getMonday(saturday);
    expect(result2.getDate()).toBe(13);
  });

  it('handles year boundary (Sunday in new year)', () => {
    // Dec 29, 2024 is a Sunday, Monday should be Dec 23, 2024
    const sundayNewYear = new Date(2024, 11, 29);
    const result = getMonday(sundayNewYear);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(11);
    expect(result.getDate()).toBe(23);
  });

  it('handles week spanning two years', () => {
    // Jan 1, 2025 is a Wednesday, Monday should be Dec 30, 2024
    const newYearsDay = new Date(2025, 0, 1);
    const result = getMonday(newYearsDay);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(11);
    expect(result.getDate()).toBe(30);
  });

  it('sets time to midnight', () => {
    const dateWithTime = new Date(2025, 0, 15, 14, 30, 45);
    const result = getMonday(dateWithTime);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('does not mutate the input date', () => {
    const original = new Date(2025, 0, 15, 10, 30);
    const originalTime = original.getTime();
    getMonday(original);
    expect(original.getTime()).toBe(originalTime);
  });
});

describe('formatWeekRange', () => {
  it('formats week within same month', () => {
    const monday = new Date(2025, 0, 13); // Jan 13-19
    expect(formatWeekRange(monday)).toBe('Jan 13 - 19');
  });

  it('formats week spanning two months', () => {
    const monday = new Date(2025, 0, 27); // Jan 27 - Feb 2
    expect(formatWeekRange(monday)).toBe('Jan 27 - Feb 2');
  });

  it('formats week spanning two years', () => {
    const monday = new Date(2024, 11, 30); // Dec 30 - Jan 5
    expect(formatWeekRange(monday)).toBe('Dec 30 - Jan 5');
  });

  it('formats week at start of month', () => {
    const monday = new Date(2025, 1, 3); // Feb 3-9
    expect(formatWeekRange(monday)).toBe('Feb 3 - 9');
  });

  it('handles single digit days', () => {
    const monday = new Date(2025, 2, 3); // Mar 3-9
    expect(formatWeekRange(monday)).toBe('Mar 3 - 9');
  });
});

describe('isSameDay', () => {
  it('returns true for same calendar day', () => {
    const date1 = new Date(2025, 0, 15, 10, 30);
    const date2 = new Date(2025, 0, 15, 22, 45);
    expect(isSameDay(date1, date2)).toBe(true);
  });

  it('returns false for different days', () => {
    const date1 = new Date(2025, 0, 15);
    const date2 = new Date(2025, 0, 16);
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('returns false for same day different month', () => {
    const date1 = new Date(2025, 0, 15);
    const date2 = new Date(2025, 1, 15);
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('returns false for same day different year', () => {
    const date1 = new Date(2024, 0, 15);
    const date2 = new Date(2025, 0, 15);
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('handles midnight edge case', () => {
    const midnight = new Date(2025, 0, 15, 0, 0, 0);
    const beforeMidnight = new Date(2025, 0, 14, 23, 59, 59);
    expect(isSameDay(midnight, beforeMidnight)).toBe(false);
  });
});

describe('formatDateISO', () => {
  it('formats date as YYYY-MM-DD', () => {
    const date = new Date(2025, 0, 15);
    expect(formatDateISO(date)).toBe('2025-01-15');
  });

  it('pads single digit month', () => {
    const date = new Date(2025, 0, 15); // January = month 0
    expect(formatDateISO(date)).toBe('2025-01-15');
  });

  it('pads single digit day', () => {
    const date = new Date(2025, 0, 5);
    expect(formatDateISO(date)).toBe('2025-01-05');
  });

  it('handles December', () => {
    const date = new Date(2025, 11, 25);
    expect(formatDateISO(date)).toBe('2025-12-25');
  });

  it('handles end of year', () => {
    const date = new Date(2025, 11, 31);
    expect(formatDateISO(date)).toBe('2025-12-31');
  });
});
