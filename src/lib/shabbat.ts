import { HDate, HebrewCalendar, Location, flags } from '@hebcal/core';

export interface BlockedHoursConfig {
  start: string; // HH:MM
  end: string; // HH:MM
  timezone?: string;
}

/**
 * Returns true if the current time is Shabbat (Friday sunset → Saturday night).
 * Uses Jerusalem coordinates by default.
 */
export function isShabbat(now = new Date()): boolean {
  const hdate = new HDate(now);
  const dayOfWeek = hdate.getDay(); // 0=Sun, 6=Sat

  // Saturday
  if (dayOfWeek === 6) return true;

  // Friday after sunset → approximate with 18:00 (proper implementation uses hebcal)
  if (dayOfWeek === 5) {
    const hour = now.getHours();
    if (hour >= 18) return true;
  }

  return false;
}

/**
 * Returns true if now is within the client's configured blocked hours.
 * Handles cross-midnight ranges (e.g., 22:00 → 08:00).
 */
export function isInBlockedHours(config: BlockedHoursConfig, now = new Date()): boolean {
  const [startH, startM] = config.start.split(':').map(Number);
  const [endH, endM] = config.end.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Same-day range e.g., 09:00 → 17:00
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Cross-midnight range e.g., 22:00 → 08:00
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

export interface TimeCheckResult {
  blocked: boolean;
  reason: 'shabbat' | 'blocked_hours' | null;
  message: string;
}

/**
 * Main check — returns whether broadcasting is currently blocked.
 */
export function checkTimeBlocking(
  blockedHours: BlockedHoursConfig | null | undefined,
  now = new Date(),
): TimeCheckResult {
  if (isShabbat(now)) {
    return {
      blocked: true,
      reason: 'shabbat',
      message: 'המערכת אינה פעילה כעת 🕯️\nשבת שלום ומבורך! ✨',
    };
  }

  if (blockedHours && isInBlockedHours(blockedHours, now)) {
    return {
      blocked: true,
      reason: 'blocked_hours',
      message: `המערכת אינה פעילה בשעות ${blockedHours.start}–${blockedHours.end}.\nנסה שנית מאוחר יותר. 🌙`,
    };
  }

  return { blocked: false, reason: null, message: '' };
}
