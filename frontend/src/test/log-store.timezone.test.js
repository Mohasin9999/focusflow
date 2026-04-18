import { describe, expect, it } from 'vitest';
import { buildTimestampFromDateAndTime, parseLogTimestamp } from '../utils/logStore';

describe('logStore timezone and date edge cases', () => {
    it('parses date-only values as local calendar dates without UTC shifting', () => {
        const parsed = parseLogTimestamp('2026-03-01');

        expect(parsed).not.toBeNull();
        expect(parsed.getFullYear()).toBe(2026);
        expect(parsed.getMonth()).toBe(2);
        expect(parsed.getDate()).toBe(1);
        expect(parsed.getHours()).toBe(0);
        expect(parsed.getMinutes()).toBe(0);
    });

    it('handles 12 AM and 12 PM boundaries when building timestamps', () => {
        const midnight = parseLogTimestamp(
            buildTimestampFromDateAndTime('2026-03-01', '12:05 AM')
        );
        const noon = parseLogTimestamp(
            buildTimestampFromDateAndTime('2026-03-01', '12:15 PM')
        );

        expect(midnight).not.toBeNull();
        expect(midnight.getFullYear()).toBe(2026);
        expect(midnight.getMonth()).toBe(2);
        expect(midnight.getDate()).toBe(1);
        expect(midnight.getHours()).toBe(0);
        expect(midnight.getMinutes()).toBe(5);

        expect(noon).not.toBeNull();
        expect(noon.getHours()).toBe(12);
        expect(noon.getMinutes()).toBe(15);
    });
});
