import { describe, expect, it } from 'vitest';
import { buildHomeDashboardData } from '../utils/homeDashboard';

function buildLog({ id, timestamp, typeId, durationSecs = 0, distractedSecs = 0 }) {
    return {
        id: String(id),
        source: typeId === 'focus' ? 'session' : 'activity',
        timestamp,
        typeId,
        durationSecs,
        distractedSecs,
        notes: ''
    };
}

describe('homeDashboard rolling weekly summary', () => {
    it('keeps data in current summary for the latest 7-day window', () => {
        const now = new Date(2026, 2, 1, 12, 0, 0);
        const logs = [
            buildLog({
                id: 1,
                typeId: 'study',
                timestamp: new Date(2026, 1, 23, 9, 0, 0).toISOString(),
                durationSecs: 3600
            }),
            buildLog({
                id: 2,
                typeId: 'focus',
                timestamp: new Date(2026, 1, 28, 9, 0, 0).toISOString(),
                durationSecs: 1800,
                distractedSecs: 600
            }),
            buildLog({
                id: 3,
                typeId: 'sleep',
                timestamp: new Date(2026, 1, 22, 9, 0, 0).toISOString(),
                durationSecs: 7200
            })
        ];

        const data = buildHomeDashboardData(logs, 25, now);

        expect(data.stats.studyWeekly).toBe('1.0');
        expect(data.stats.focusWeeklySecs).toBe(1800);
        expect(data.stats.distractionWeeklySecs).toBe(600);
        expect(data.stats.sleepWeekly).toBe('0.0');
        expect(data.weeklyHistory).toHaveLength(1);
        expect(data.weeklyHistory[0].sleep).toBe('2.0');
    });

    it('moves completed 7-day data to history and resets current summary', () => {
        const now = new Date(2026, 2, 1, 12, 0, 0);
        const logs = [
            buildLog({
                id: 11,
                typeId: 'study',
                timestamp: new Date(2026, 1, 22, 9, 0, 0).toISOString(),
                durationSecs: 7200
            }),
            buildLog({
                id: 12,
                typeId: 'focus',
                timestamp: new Date(2026, 1, 22, 11, 0, 0).toISOString(),
                durationSecs: 3600
            })
        ];

        const data = buildHomeDashboardData(logs, 25, now);

        expect(data.stats.studyWeekly).toBe('0.0');
        expect(data.stats.focusWeeklySecs).toBe(0);
        expect(data.weeklyHistory).toHaveLength(1);
        expect(data.weeklyHistory[0].study).toBe('2.0');
        expect(data.weeklyHistory[0].focus.value).toBe('1.0');
    });
});
