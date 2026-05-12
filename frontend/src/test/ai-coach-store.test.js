import { describe, expect, it } from 'vitest';

import { sanitizeAiCoachText } from '../utils/aiCoachStore';

describe('sanitizeAiCoachText', () => {
    it('rewrites old progress reports into a friendly coach message', () => {
        const report = (
            "Here's your full report: Today's Stats: Focus: 1 min 11 sec Study: 0.0 hrs " +
            'Sleep: 0.0 hrs Distraction: 0 sec Weekly Stats: Focus: 0.1 hrs ' +
            'Progress towards 25 hr goal: 0% Recent Sessions: Math: 40 sec Cse327: 29 sec Math: 10 sec.'
        );

        expect(sanitizeAiCoachText(report, 'ai')).toBe(
            'Here is your focus update. Today you focused for 1 min 11 sec, studied for 0.0 hrs, slept for 0.0 hrs, ' +
            'and had 0 sec of distraction. This week you have completed 0.1 hrs of focus time, which puts you at 0% ' +
            'toward your 25 hr goal. Keep going at a steady pace.'
        );
    });

    it('removes stale recent-session sentences from AI replies', () => {
        const reply = (
            'Today you focused for 1 minute and 33 seconds. ' +
            'Your recent focus sessions were 40 seconds on Math, 29 seconds on Cse327, and 10 seconds on Math.'
        );

        expect(sanitizeAiCoachText(reply, 'ai')).toBe('Today you focused for 1 minute and 33 seconds.');
    });

    it('removes stale today-total focus claims from AI replies', () => {
        const reply = (
            'Great job on your demo session! You added 5 seconds to your day, ' +
            'bringing your total focus today to 1 minute 45 seconds. Keep that momentum going!'
        );

        expect(sanitizeAiCoachText(reply, 'ai')).toBe(
            'Great job on your demo session! You added 5 seconds to your day. Keep that momentum going!'
        );
    });

    it('removes stale accumulated-today focus claims from AI replies', () => {
        const reply = (
            "Great job on that 5-second focus session! You've now accumulated " +
            '1 minute and 55 seconds of focused time today. Keep building on that momentum!'
        );

        expect(sanitizeAiCoachText(reply, 'ai')).toBe(
            'Great job on that 5-second focus session! Keep building on that momentum!'
        );
    });
});
