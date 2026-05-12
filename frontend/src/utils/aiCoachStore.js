import { supabase } from '../lib/supabase';

const AI_COACH_MESSAGES_TABLE = 'ai_coach_messages';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NEXT_STEP_LABEL_PATTERN = /\s*\**\s*next step\s*:\s*\**\s*/gi;
const LEGACY_PROGRESS_REPORT_PATTERN = /^(?:here's your full report:\s*)?today's stats:\s*focus:\s*(.+?)\s+study:\s*(.+?)\s+sleep:\s*(.+?)\s+distraction:\s*(.+?)\s+weekly stats:\s*focus:\s*(.+?)\s+progress towards?\s+(.+?)\s+goal:\s*(.+?)\s+recent sessions:\s*(.+)$/i;
const RECENT_SESSION_SENTENCE_PATTERN = /\s*(?:your\s+)?recent\s+(?:focus\s+)?sessions?\s+(?:were|are|include|included)\s+[^.?!]*(?:[.?!]|$)/gi;
const TODAY_TOTAL_FOCUS_PATTERN = /\s*(?:,?\s*(?:bringing|which brings|that brings|bringing your|bringing you to)\s+[^.?!]*total\s+focus\s+today\s+to\s+[^.?!]*(?:[.?!]|$)|(?:that\s+)?brings\s+your\s+total\s+focus\s+today\s+to\s+[^.?!]*(?:[.?!]|$)|(?:you(?:'|’)ve|you have)\s+now\s+(?:accumulated|focused|completed|logged)[^.?!]*(?:focused\s+time|focus\s+time|focus)[^.?!]*today[^.?!]*(?:[.?!]|$))/gi;
export const AI_COACH_MESSAGE_LIMIT = 50;

function isValidUserId(value) {
    return UUID_PATTERN.test(String(value || '').trim());
}

function requireSupabase() {
    if (!supabase) {
        throw new Error('Supabase is not configured.');
    }

    return supabase;
}

function formatLegacyProgressReport(text) {
    const match = text.replace(/\s+/g, ' ').trim().match(LEGACY_PROGRESS_REPORT_PATTERN);
    if (!match) {
        return text;
    }

    const [, focus, study, sleep, distraction, weeklyFocus, goalLabel, progress] = match;

    return (
        `Here is your focus update. Today you focused for ${focus}, studied for ${study}, slept for ${sleep}, ` +
        `and had ${distraction} of distraction. This week you have completed ${weeklyFocus} of focus time, ` +
        `which puts you at ${progress} toward your ${goalLabel} goal. Keep going at a steady pace.`
    );
}

export function sanitizeAiCoachText(text, sender = 'ai') {
    const normalizedText = String(text || '').trim();
    if (sender !== 'ai') {
        return normalizedText;
    }

    const plainText = normalizedText
        .replace(NEXT_STEP_LABEL_PATTERN, ' ')
        .replace(RECENT_SESSION_SENTENCE_PATTERN, ' ')
        .replace(TODAY_TOTAL_FOCUS_PATTERN, ' ')
        .replace(/\*/g, '')
        .replace(/^\s*[-•]\s+/gm, '')
        .replace(/([a-z0-9])\s+(Keep that momentum)/g, '$1. $2')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return formatLegacyProgressReport(plainText);
}

function mapMessageRecord(record) {
    if (!record) return null;

    const sender = record.role === 'assistant' ? 'ai' : 'user';

    return {
        id: record.id,
        sender,
        text: sanitizeAiCoachText(record.content, sender),
        createdAt: record.created_at || '',
    };
}

export async function listAiCoachMessages(userId) {
    if (!isValidUserId(userId)) return [];

    const client = requireSupabase();
    const { data, error } = await client
        .from(AI_COACH_MESSAGES_TABLE)
        .select('id, role, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(AI_COACH_MESSAGE_LIMIT);

    if (error) {
        throw new Error(error.message || 'Unable to load AI coach messages.');
    }

    return (data || []).map(mapMessageRecord).filter(Boolean);
}

export async function insertAiCoachMessage(userId, sender, text) {
    if (!isValidUserId(userId)) {
        throw new Error('A valid user is required.');
    }

    const normalizedText = sanitizeAiCoachText(text, sender);
    if (!normalizedText) {
        throw new Error('Message content is required.');
    }

    const role = sender === 'ai' ? 'assistant' : 'user';
    const client = requireSupabase();
    const { data, error } = await client
        .from(AI_COACH_MESSAGES_TABLE)
        .insert({
            user_id: userId,
            role,
            content: normalizedText,
        })
        .select('id, role, content, created_at')
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Unable to save AI coach message.');
    }

    return mapMessageRecord(data) || {
        id: '',
        sender: role === 'assistant' ? 'ai' : 'user',
        text: normalizedText,
        createdAt: '',
    };
}

export async function clearAiCoachMessages(userId) {
    if (!isValidUserId(userId)) return;

    const client = requireSupabase();
    const { error } = await client
        .from(AI_COACH_MESSAGES_TABLE)
        .delete()
        .eq('user_id', userId);

    if (error) {
        throw new Error(error.message || 'Unable to clear AI coach messages.');
    }
}
