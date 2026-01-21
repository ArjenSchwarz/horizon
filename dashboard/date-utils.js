/**
 * Date utility functions for week navigation
 * Works both as ES module (for tests) and in browser (via global assignment)
 */

/**
 * Get the Monday of the week containing the given date (ISO 8601 week)
 * @param {Date} date
 * @returns {Date} Monday at midnight in local time
 */
export function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  // day 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // For ISO week, Monday = 0, so adjust: Sunday becomes -6, others subtract (day - 1)
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format a week range for display (e.g., "Jan 13 - 19" or "Jan 27 - Feb 2")
 * @param {Date} monday - The Monday starting the week
 * @returns {string}
 */
export function formatWeekRange(monday) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startMonth = monday.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = sunday.toLocaleDateString('en-US', { month: 'short' });
  const startDay = monday.getDate();
  const endDay = sunday.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

/**
 * Check if two dates represent the same calendar day
 * Compares by Y/M/D components to avoid timezone/DST issues
 * @param {Date} date1
 * @param {Date} date2
 * @returns {boolean}
 */
export function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Format date as YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
export function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
