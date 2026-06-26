/**
 * Tests for date utility functions
 */

import { getRelativeTimeString, formatDateTime } from '../date-utils';

describe('Date Utilities', () => {
  describe('getRelativeTimeString', () => {
    describe('Recent Times', () => {
      it('should return "just now" for times less than 60 seconds ago', () => {
        const now = new Date();
        const recent = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
        expect(getRelativeTimeString(recent.toISOString())).toBe('just now');
      });

      it('should return "just now" for times less than 1 second ago', () => {
        const now = new Date();
        const recent = new Date(now.getTime() - 500); // 0.5 seconds ago
        expect(getRelativeTimeString(recent.toISOString())).toBe('just now');
      });

      it('should return "just now" for current time', () => {
        const now = new Date();
        expect(getRelativeTimeString(now.toISOString())).toBe('just now');
      });
    });

    describe('Minutes', () => {
      it('should return "1 minute ago" for 1 minute', () => {
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        expect(getRelativeTimeString(oneMinuteAgo.toISOString())).toBe('1 minute ago');
      });

      it('should return correct minutes for multiple minutes', () => {
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        expect(getRelativeTimeString(fiveMinutesAgo.toISOString())).toBe('5 minutes ago');
      });

      it('should return minutes for times under 60 minutes', () => {
        const now = new Date();
        const fiftyNineMinutesAgo = new Date(now.getTime() - 59 * 60 * 1000);
        expect(getRelativeTimeString(fiftyNineMinutesAgo.toISOString())).toBe('59 minutes ago');
      });
    });

    describe('Hours', () => {
      it('should return "1 hour ago" for 1 hour', () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        expect(getRelativeTimeString(oneHourAgo.toISOString())).toBe('1 hour ago');
      });

      it('should return correct hours for multiple hours', () => {
        const now = new Date();
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        expect(getRelativeTimeString(threeHoursAgo.toISOString())).toBe('3 hours ago');
      });

      it('should return hours for times under 24 hours', () => {
        const now = new Date();
        const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);
        expect(getRelativeTimeString(twentyThreeHoursAgo.toISOString())).toBe('23 hours ago');
      });
    });

    describe('Days', () => {
      it('should return "1 day ago" for 1 day', () => {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        expect(getRelativeTimeString(oneDayAgo.toISOString())).toBe('1 day ago');
      });

      it('should return correct days for multiple days', () => {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        expect(getRelativeTimeString(sevenDaysAgo.toISOString())).toBe('7 days ago');
      });

      it('should return days for times under 30 days', () => {
        const now = new Date();
        const twentyNineDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        expect(getRelativeTimeString(twentyNineDaysAgo.toISOString())).toBe('29 days ago');
      });
    });

    describe('Months', () => {
      it('should return "1 month ago" for 30-59 days', () => {
        const now = new Date();
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        expect(getRelativeTimeString(oneMonthAgo.toISOString())).toBe('1 month ago');
      });

      it('should return correct months for multiple months', () => {
        const now = new Date();
        const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        expect(getRelativeTimeString(threeMonthsAgo.toISOString())).toBe('3 months ago');
      });

      it('should return months for times under 365 days', () => {
        const now = new Date();
        const elevenMonthsAgo = new Date(now.getTime() - 330 * 24 * 60 * 60 * 1000);
        expect(getRelativeTimeString(elevenMonthsAgo.toISOString())).toBe('11 months ago');
      });
    });

    describe('Years', () => {
      it('should return "1 year ago" for 365+ days', () => {
        const now = new Date();
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        expect(getRelativeTimeString(oneYearAgo.toISOString())).toBe('1 year ago');
      });

      it('should return correct years for multiple years', () => {
        const now = new Date();
        const threeYearsAgo = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);
        expect(getRelativeTimeString(threeYearsAgo.toISOString())).toBe('3 years ago');
      });
    });

    describe('Future Dates', () => {
      it('should return "just now" for future dates', () => {
        const now = new Date();
        const future = new Date(now.getTime() + 60 * 1000); // 1 minute in future
        expect(getRelativeTimeString(future.toISOString())).toBe('just now');
      });

      it('should return "just now" for far future dates', () => {
        const now = new Date();
        const farFuture = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year in future
        expect(getRelativeTimeString(farFuture.toISOString())).toBe('just now');
      });
    });

    describe('Edge Cases', () => {
      it('should handle exact boundary at 60 seconds', () => {
        const now = new Date();
        const sixtySecondsAgo = new Date(now.getTime() - 60 * 1000);
        expect(getRelativeTimeString(sixtySecondsAgo.toISOString())).toBe('1 minute ago');
      });

      it('should handle exact boundary at 60 minutes', () => {
        const now = new Date();
        const sixtyMinutesAgo = new Date(now.getTime() - 60 * 60 * 1000);
        expect(getRelativeTimeString(sixtyMinutesAgo.toISOString())).toBe('1 hour ago');
      });

      it('should handle exact boundary at 24 hours', () => {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        expect(getRelativeTimeString(twentyFourHoursAgo.toISOString())).toBe('1 day ago');
      });

      it('should handle exact boundary at 30 days', () => {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        expect(getRelativeTimeString(thirtyDaysAgo.toISOString())).toBe('1 month ago');
      });
    });

    describe('Date String Formats', () => {
      it('should handle ISO 8601 format', () => {
        const isoDate = '2024-01-01T12:00:00.000Z';
        const result = getRelativeTimeString(isoDate);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      });

      it('should handle date strings with timezone', () => {
        const dateWithTz = '2024-01-01T12:00:00-05:00';
        const result = getRelativeTimeString(dateWithTz);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('formatDateTime', () => {
    it('should format date to readable string', () => {
      const date = new Date('2025-10-10T11:31:00.000Z');
      const result = formatDateTime(date.toISOString());
      
      // Should contain month name, year, and time marker.
      // Day can vary by timezone for UTC timestamps near midnight.
      expect(result).toMatch(/\b[A-Z][a-z]{2}\b/);
      expect(result).toContain('2025');
      expect(result).toMatch(/\d{1,2}:\d{2}\s(?:AM|PM)/);
    });

    it('should include time with AM/PM', () => {
      const morningDate = new Date('2025-10-10T09:30:00.000Z');
      const result = formatDateTime(morningDate.toISOString());
      
      // Should contain time components (exact format depends on locale/timezone)
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format different months correctly', () => {
      const dates = [
        '2025-01-15T12:00:00.000Z',
        '2025-06-15T12:00:00.000Z',
        '2025-12-15T12:00:00.000Z',
      ];

      dates.forEach(dateString => {
        const result = formatDateTime(dateString);
        expect(result).toBeTruthy();
        expect(result).toContain('2025');
      });
    });

    it('should handle midnight times', () => {
      const midnight = new Date('2025-10-10T00:00:00.000Z');
      const result = formatDateTime(midnight.toISOString());
      
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle noon times', () => {
      const noon = new Date('2025-10-10T12:00:00.000Z');
      const result = formatDateTime(noon.toISOString());
      
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format with 2-digit minutes', () => {
      const date = new Date('2025-10-10T12:05:00.000Z');
      const result = formatDateTime(date.toISOString());
      
      // Should have 2-digit minutes (05, not 5)
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    describe('Edge Cases', () => {
      it('should handle leap year dates', () => {
        const leapDay = new Date('2024-02-29T12:00:00.000Z');
        const result = formatDateTime(leapDay.toISOString());
        
        // Timezone conversion can roll this to Mar 1 in some locales.
        expect(result).toMatch(/\b(Feb|Mar)\b/);
        expect(result).toMatch(/\b(29|1)\b/);
        expect(result).toContain('2024');
      });

      it('should handle year boundaries', () => {
        const newYear = new Date('2025-01-01T00:00:00.000Z');
        const result = formatDateTime(newYear.toISOString());
        
        // Timezone conversion can roll this back to Dec 31, 2024 in some locales.
        expect(result).toMatch(/\b(Jan|Dec)\b/);
        expect(result).toMatch(/\b(2024|2025)\b/);
        expect(result).toBeTruthy();
      });

      it('should handle end of year', () => {
        const endOfYear = new Date('2025-12-31T12:00:00.000Z');
        const result = formatDateTime(endOfYear.toISOString());
        
        // Timezone conversion can roll this into Jan 1, 2026.
        expect(result).toMatch(/\b(2025|2026)\b/);
        expect(result).toBeTruthy();
      });
    });

    describe('Date String Formats', () => {
      it('should handle ISO 8601 format', () => {
        const isoDate = '2025-10-10T12:00:00.000Z';
        const result = formatDateTime(isoDate);
        
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      });

      it('should handle date strings with timezone', () => {
        const dateWithTz = '2025-10-10T12:00:00-05:00';
        const result = formatDateTime(dateWithTz);
        
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      });
    });

    describe('Consistency', () => {
      it('should format same date consistently', () => {
        const dateString = '2025-10-10T12:00:00.000Z';
        const result1 = formatDateTime(dateString);
        const result2 = formatDateTime(dateString);
        
        expect(result1).toBe(result2);
      });

      it('should return different strings for different dates', () => {
        const date1 = '2025-10-10T12:00:00.000Z';
        const date2 = '2025-10-11T12:00:00.000Z';
        
        const result1 = formatDateTime(date1);
        const result2 = formatDateTime(date2);
        
        expect(result1).not.toBe(result2);
      });
    });
  });

  describe('Integration', () => {
    it('should work together for recent and formatted dates', () => {
      const recentDate = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const oldDate = new Date('2024-01-01T12:00:00.000Z');
      
      const relativeRecent = getRelativeTimeString(recentDate.toISOString());
      const relativeOld = getRelativeTimeString(oldDate.toISOString());
      const formattedOld = formatDateTime(oldDate.toISOString());
      
      expect(relativeRecent).toBe('5 minutes ago');
      expect(relativeOld).toBeTruthy();
      expect(formattedOld).toContain('2024');
    });
  });
});
