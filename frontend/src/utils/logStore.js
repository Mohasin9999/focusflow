import { supabase } from '../lib/supabase';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const LOG_SOURCE_ACTIVITY = 'activity';
export const LOG_SOURCE_SESSION = 'session';

let memoryLogs = [];

function hasValidUserId(userId) {
    return UUID_PATTERN.test(String(userId || '').trim());
}

function hasValidLogId(logId) {
    return UUID_PATTERN.test(String(logId || '').trim());
}

function parseDateValue(value) {
    if (!value) return null;

    if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseClockTime(startTimeStr) {
    if (!startTimeStr || typeof startTimeStr !== 'string') return null;
    const match = startTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3] ? match[3].toUpperCase() : null;

    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (hours > 23 || minutes > 59) return null;

    return { hours, minutes };
}

function normalizeSource(value) {
    const source = String(value || '').trim().toLowerCase();
    if (source === LOG_SOURCE_SESSION || source === 'focussession' || source === 'focus_session' || source === 'focus-session') {
        return LOG_SOURCE_SESSION;
    }
    return LOG_SOURCE_ACTIVITY;
}

function normalizeTypeId(value, source) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'sleep') return 'sleep';
    if (raw === 'study') return 'study';
    if (raw === 'focus' || raw === 'session') return 'focus';
    if (source === LOG_SOURCE_SESSION) return 'focus';
    return 'study';
}

function normalizeSeconds(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0) return 0;
    return Math.round(seconds);
}

function parseDurationToSecs(value) {
    if (typeof value === 'number') return normalizeSeconds(value);
    if (typeof value !== 'string') return 0;

    const trimmed = value.trim();
    if (!trimmed) return 0;

    if (/^\d+(\.\d+)?$/.test(trimmed)) {
        return normalizeSeconds(Number(trimmed));
    }

    const hourMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
    const minuteMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/i);
    const secondMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/i);

    const hours = hourMatch ? Number(hourMatch[1]) : 0;
    const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
    const seconds = secondMatch ? Number(secondMatch[1]) : 0;

    return normalizeSeconds((hours * 3600) + (minutes * 60) + seconds);
}

function toIsoTimestamp(input) {
    const explicitTimestamp = parseDateValue(input?.timestamp);
    if (explicitTimestamp) return explicitTimestamp.toISOString();

    const baseDate = parseDateValue(input?.date);
    if (baseDate) {
        const parsedTime = parseClockTime(input?.startTime);
        if (parsedTime) {
            baseDate.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
        } else {
            baseDate.setHours(23, 59, 59, 999);
        }
        return baseDate.toISOString();
    }

    const numericId = Number(input?.id);
    if (Number.isFinite(numericId) && numericId > 0) {
        const fromId = new Date(numericId);
        if (!Number.isNaN(fromId.getTime())) return fromId.toISOString();
    }

    return new Date().toISOString();
}

function createId(source, index = 0) {
    return `${source}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLogEntry(entry, index = 0) {
    if (!entry || typeof entry !== 'object') return null;

    const source = normalizeSource(entry.source);
    const typeId = normalizeTypeId(entry.typeId || entry.type, source);

    return {
        id: entry.id !== undefined && entry.id !== null && String(entry.id).trim() !== ''
            ? String(entry.id)
            : createId(source, index),
        source,
        timestamp: toIsoTimestamp(entry),
        typeId,
        durationSecs: parseDurationToSecs(entry.durationSecs ?? entry.duration),
        distractedSecs: normalizeSeconds(entry.distractedSecs ?? entry.distractedTime),
        sessionName: typeof entry.sessionName === 'string' ? entry.sessionName : '',
        notes: typeof entry.notes === 'string' ? entry.notes : ''
    };
}

function sortLogsByTimestampDesc(a, b) {
    const timeA = parseDateValue(a?.timestamp)?.getTime() || 0;
    const timeB = parseDateValue(b?.timestamp)?.getTime() || 0;
    return timeB - timeA;
}

function normalizeLogsCollection(logs) {
    return (Array.isArray(logs) ? logs : [])
        .map((log, index) => normalizeLogEntry(log, index))
        .filter(Boolean)
        .sort(sortLogsByTimestampDesc);
}

function mapSupabaseLog(record) {
    return normalizeLogEntry({
        id: record.id,
        source: record.source,
        timestamp: record.timestamp,
        typeId: record.type_id,
        durationSecs: record.duration_secs,
        distractedSecs: record.distracted_secs,
        sessionName: record.session_name,
        notes: record.notes,
    });
}

function toSupabaseLogPayload(userId, log) {
    const payload = {
        user_id: userId,
        source: log.source,
        type_id: log.typeId,
        duration_secs: log.durationSecs,
        distracted_secs: log.distractedSecs,
        session_name: log.sessionName || '',
        notes: log.notes || '',
        timestamp: log.timestamp,
    };

    if (hasValidLogId(log.id)) {
        payload.id = log.id;
    }

    return payload;
}

async function listSupabaseLogs(userId) {
    const { data, error } = await supabase
        .from('logs')
        .select('id, source, type_id, duration_secs, distracted_secs, session_name, notes, timestamp')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

    if (error) {
        throw new Error(error.message || 'Unable to read logs.');
    }

    return (data || []).map(mapSupabaseLog).filter(Boolean).sort(sortLogsByTimestampDesc);
}

export async function readLogsForUser(userId = '') {
    if (!supabase || !hasValidUserId(userId)) {
        memoryLogs = [];
        return [];
    }

    const supabaseLogs = await listSupabaseLogs(userId);
    memoryLogs = supabaseLogs;
    return supabaseLogs;
}

export async function insertLog(userId, log) {
    const normalizedLog = normalizeLogEntry(log);
    if (!normalizedLog) return null;

    if (!supabase || !hasValidUserId(userId)) {
        throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
        .from('logs')
        .insert(toSupabaseLogPayload(userId, normalizedLog))
        .select('id, source, type_id, duration_secs, distracted_secs, session_name, notes, timestamp')
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Unable to save the log.');
    }

    return data ? mapSupabaseLog(data) : normalizedLog;
}

export async function updateLog(userId, logId, changes) {
    if (!supabase || !hasValidUserId(userId)) {
        throw new Error('Supabase is not configured.');
    }

    const patch = {};
    if (changes.source !== undefined) patch.source = normalizeSource(changes.source);
    if (changes.typeId !== undefined || changes.type !== undefined) {
        patch.type_id = normalizeTypeId(changes.typeId ?? changes.type, changes.source);
    }
    if (changes.durationSecs !== undefined || changes.duration !== undefined) {
        patch.duration_secs = parseDurationToSecs(changes.durationSecs ?? changes.duration);
    }
    if (changes.distractedSecs !== undefined || changes.distractedTime !== undefined) {
        patch.distracted_secs = normalizeSeconds(changes.distractedSecs ?? changes.distractedTime);
    }
    if (changes.sessionName !== undefined) patch.session_name = typeof changes.sessionName === 'string' ? changes.sessionName : '';
    if (changes.notes !== undefined) patch.notes = typeof changes.notes === 'string' ? changes.notes : '';
    if (changes.timestamp !== undefined || changes.date !== undefined) {
        patch.timestamp = toIsoTimestamp(changes);
    }

    const { data, error } = await supabase
        .from('logs')
        .update(patch)
        .eq('user_id', userId)
        .eq('id', logId)
        .select('id, source, type_id, duration_secs, distracted_secs, session_name, notes, timestamp')
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Unable to update the log.');
    }

    return data ? mapSupabaseLog(data) : null;
}

export async function deleteLog(userId, logId) {
    if (!supabase || !hasValidUserId(userId)) {
        throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase
        .from('logs')
        .delete()
        .eq('user_id', userId)
        .eq('id', logId);

    if (error) {
        throw new Error(error.message || 'Unable to delete the log.');
    }
}

export function createActivityLog({ typeId, durationSecs, timestamp, notes = '' }) {
    return normalizeLogEntry({
        id: createId(LOG_SOURCE_ACTIVITY),
        source: LOG_SOURCE_ACTIVITY,
        typeId,
        durationSecs,
        timestamp: timestamp || new Date().toISOString(),
        notes
    });
}

export function createSessionLog({ durationSecs, distractedSecs, timestamp, sessionName = '', notes = '' }) {
    return normalizeLogEntry({
        id: createId(LOG_SOURCE_SESSION),
        source: LOG_SOURCE_SESSION,
        typeId: 'focus',
        durationSecs,
        distractedSecs,
        timestamp: timestamp || new Date().toISOString(),
        sessionName,
        notes
    });
}

export function isSessionSource(source) {
    return normalizeSource(source) === LOG_SOURCE_SESSION;
}

export function parseLogTimestamp(timestamp) {
    return parseDateValue(timestamp);
}

export function formatSecondsToHoursAndMinutes(seconds) {
    const safeSecs = normalizeSeconds(seconds);
    const hours = Math.floor(safeSecs / 3600);
    const minutes = Math.floor((safeSecs % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

export function formatSecondsToCompactLabel(seconds) {
    const safeSecs = normalizeSeconds(seconds);
    if (safeSecs === 0) return '0min';
    if (safeSecs < 60) return `${safeSecs}sec`;
    if (safeSecs < 3600) return `${Math.floor(safeSecs / 60)}min`;
    return `${(safeSecs / 3600).toFixed(1).replace('.0', '')}hr`;
}

export function buildTimestampFromDateAndTime(dateValue, startTimeValue) {
    const baseDate = parseDateValue(dateValue);
    if (!baseDate) return new Date().toISOString();

    const parsedTime = parseClockTime(startTimeValue);
    if (parsedTime) {
        baseDate.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
    }
    return baseDate.toISOString();
}

export function seedLogsForTests(logs) {
    memoryLogs = normalizeLogsCollection(logs);
    return memoryLogs;
}
