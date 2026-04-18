import {
    formatSecondsToCompactLabel,
    formatSecondsToHoursAndMinutes,
    isSessionSource,
    parseLogTimestamp
} from './logStore';
import { getDateKey } from './dateTime';

export function getLogDateTime(log) {
    return parseLogTimestamp(log?.timestamp);
}

export function sortLogsByTimestampDesc(a, b) {
    const timeA = getLogDateTime(a)?.getTime() || 0;
    const timeB = getLogDateTime(b)?.getTime() || 0;
    return timeB - timeA;
}

export function getLogKey(log) {
    return `${log.source}-${log.id}`;
}

export function getTypeLabel(typeId) {
    if (typeId === 'sleep') return 'Sleep';
    if (typeId === 'focus') return 'Focus';
    return 'Study';
}

export function getDateInputValueFromTimestamp(timestamp) {
    const date = parseLogTimestamp(timestamp);
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatDateDisplay(timestamp) {
    const date = parseLogTimestamp(timestamp);
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatTimeDisplay(timestamp) {
    const date = parseLogTimestamp(timestamp);
    if (!date) return '--:--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function getVisiblePageNumbers(currentPage, totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 4) {
        return [1, 2, 3, 4, 5, 'ellipsis-right', totalPages];
    }

    if (currentPage >= totalPages - 3) {
        return [1, 'ellipsis-left', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, 'ellipsis-left', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-right', totalPages];
}

export function getSearchDurationLabel(log) {
    if (isSessionSource(log.source)) {
        return `focus ${formatSecondsToCompactLabel(log.durationSecs)} distracted ${formatSecondsToCompactLabel(log.distractedSecs)}`;
    }

    return formatSecondsToHoursAndMinutes(log.durationSecs);
}

export function matchesActivityTypeFilter(log, activityTypeFilter) {
    if (activityTypeFilter === 'all') return true;
    if (activityTypeFilter === 'session') return isSessionSource(log.source);
    return log.typeId === activityTypeFilter;
}

export function withSessionNumbers(logs) {
    const sessionsByDay = new Map();

    logs.forEach((log, index) => {
        if (!isSessionSource(log.source)) return;
        const date = getLogDateTime(log);
        if (!date) return;

        const dayKey = getDateKey(date);
        if (!sessionsByDay.has(dayKey)) {
            sessionsByDay.set(dayKey, []);
        }

        sessionsByDay.get(dayKey).push({
            index,
            timestampMs: date.getTime()
        });
    });

    const sessionNumberByIndex = new Map();
    sessionsByDay.forEach((sessions) => {
        sessions
            .sort((a, b) => a.timestampMs - b.timestampMs || a.index - b.index)
            .forEach((session, sessionIndex) => {
                sessionNumberByIndex.set(session.index, sessionIndex + 1);
            });
    });

    return logs.map((log, index) => {
        if (!isSessionSource(log.source)) return log;
        const sessionNumber = sessionNumberByIndex.get(index);
        if (!sessionNumber) return log;
        return { ...log, sessionNumber };
    });
}
