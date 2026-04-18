import { parseLogTimestamp } from './logStore';
import { withSessionNumbers } from './activityLogView';
import {
    formatWeekRange,
    getDateKey,
    isSameLocalDay
} from './dateTime';

export const GOAL_PRESETS = {
    beginner: { label: 'Beginner', hours: 15 },
    average: { label: 'Average', hours: 25 },
    intensive: { label: 'Intensive', hours: 40 }
};

export const DEFAULT_GOAL_PRESET = 'average';

const DISTRACTION_PENALTY_WEIGHT = 0.5;
const RECENT_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ROLLING_WEEK_DAYS = 7;

export function getGoalHoursForPreset(preset) {
    return GOAL_PRESETS[preset]?.hours || GOAL_PRESETS[DEFAULT_GOAL_PRESET].hours;
}

export function getNearestPresetFromHours(hours) {
    const parsedHours = Number(hours);
    if (!Number.isFinite(parsedHours)) return DEFAULT_GOAL_PRESET;

    return Object.entries(GOAL_PRESETS)
        .sort(([, a], [, b]) => Math.abs(a.hours - parsedHours) - Math.abs(b.hours - parsedHours))[0][0];
}

export function formatFocusTime(seconds) {
    if (!seconds) return { value: '0', unit: 'min' };
    if (seconds < 60) return { value: seconds, unit: 'sec' };
    if (seconds < 3600) return { value: Math.floor(seconds / 60), unit: 'min' };
    return { value: (seconds / 3600).toFixed(1), unit: 'hrs' };
}

export function calculateEffectiveFocusHours(focusSecs, distractedSecs) {
    const focusHours = Math.max(0, (Number(focusSecs) || 0) / 3600);
    const distractionHours = Math.max(0, (Number(distractedSecs) || 0) / 3600);
    const penaltyHours = Math.min(focusHours, distractionHours * DISTRACTION_PENALTY_WEIGHT);
    return Math.max(0, focusHours - penaltyHours);
}

function buildWeeklyHistory(weekBuckets, safeGoalHours) {
    return Array.from(weekBuckets.values())
        .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
        .slice(0, 4)
        .map((week) => {
            const effectiveFocusHours = calculateEffectiveFocusHours(week.focusSecs, week.distractionSecs);
            return {
                key: week.key,
                label: formatWeekRange(week.weekStart),
                study: week.study.toFixed(1),
                sleep: week.sleep.toFixed(1),
                focus: formatFocusTime(week.focusSecs),
                distraction: formatFocusTime(week.distractionSecs),
                productiveHours: effectiveFocusHours.toFixed(1),
                goalPercent: Math.min(100, Math.round((effectiveFocusHours / safeGoalHours) * 100))
            };
        });
}

function buildRecentActivities(logs, now) {
    const nowMs = now.getTime();
    const allActivities = logs
        .map((activity) => {
            const activityDate = parseLogTimestamp(activity.timestamp);
            return {
                ...activity,
                _activityTime: activityDate ? activityDate.getTime() : 0
            };
        })
        .filter((activity) => (
            activity._activityTime > 0
            && nowMs >= activity._activityTime
            && (nowMs - activity._activityTime) <= RECENT_ACTIVITY_WINDOW_MS
        ))
        .sort((a, b) => b._activityTime - a._activityTime)
        .slice(0, 5)
        .map((activity) => {
            const activityWithoutTime = { ...activity };
            delete activityWithoutTime._activityTime;
            return activityWithoutTime;
        });

    return withSessionNumbers(allActivities);
}

export function buildHomeDashboardData(logs, safeGoalHours, now = new Date()) {
    let sleepToday = 0;
    let studyToday = 0;
    let focusTodaySecs = 0;
    let distractionTodaySecs = 0;
    let sleepWeekly = 0;
    let studyWeekly = 0;
    let focusWeeklySecs = 0;
    let distractionWeeklySecs = 0;
    const weekBuckets = new Map();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const getRollingWeekIndex = (dateObj) => {
        const logDay = new Date(dateObj);
        logDay.setHours(0, 0, 0, 0);

        const diffMs = todayStart.getTime() - logDay.getTime();
        if (diffMs < 0) return null;

        const dayDiff = Math.floor(diffMs / MS_PER_DAY);
        return Math.floor(dayDiff / ROLLING_WEEK_DAYS);
    };

    const getWeekBucket = (rollingWeekIndex) => {
        if (rollingWeekIndex === null || rollingWeekIndex < 1) return null;

        const weekStart = new Date(todayStart);
        weekStart.setDate(todayStart.getDate() - ((rollingWeekIndex * ROLLING_WEEK_DAYS) + (ROLLING_WEEK_DAYS - 1)));
        const weekKey = getDateKey(weekStart);

        if (!weekBuckets.has(weekKey)) {
            weekBuckets.set(weekKey, {
                key: weekKey,
                weekStart,
                study: 0,
                sleep: 0,
                focusSecs: 0,
                distractionSecs: 0
            });
        }

        return weekBuckets.get(weekKey);
    };

    logs.forEach((log) => {
        const logDateObj = parseLogTimestamp(log.timestamp);
        if (!logDateObj) return;

        const durationSecs = Number(log.durationSecs) || 0;
        const durationHours = durationSecs / 3600;
        const distractedSecs = Number(log.distractedSecs) || 0;
        const isToday = isSameLocalDay(logDateObj, now);
        const rollingWeekIndex = getRollingWeekIndex(logDateObj);
        const isThisWeek = rollingWeekIndex === 0;
        const weekBucket = getWeekBucket(rollingWeekIndex);

        if (log.typeId === 'sleep') {
            if (isToday) sleepToday += durationHours;
            if (isThisWeek) sleepWeekly += durationHours;
            if (weekBucket) weekBucket.sleep += durationHours;
            return;
        }

        if (log.typeId === 'study') {
            if (isToday) studyToday += durationHours;
            if (isThisWeek) studyWeekly += durationHours;
            if (weekBucket) weekBucket.study += durationHours;
            return;
        }

        if (log.typeId === 'focus') {
            if (isToday) {
                focusTodaySecs += durationSecs;
                distractionTodaySecs += distractedSecs;
            }

            if (isThisWeek) {
                focusWeeklySecs += durationSecs;
                distractionWeeklySecs += distractedSecs;
            }

            if (weekBucket) {
                weekBucket.focusSecs += durationSecs;
                weekBucket.distractionSecs += distractedSecs;
            }
        }
    });

    return {
        stats: {
            sleepToday: sleepToday.toFixed(1),
            studyToday: studyToday.toFixed(1),
            focusTodaySecs,
            distractionTodaySecs,
            sleepWeekly: sleepWeekly.toFixed(1),
            studyWeekly: studyWeekly.toFixed(1),
            focusWeeklySecs,
            distractionWeeklySecs
        },
        weeklyHistory: buildWeeklyHistory(weekBuckets, safeGoalHours),
        recentActivities: buildRecentActivities(logs, now)
    };
}
