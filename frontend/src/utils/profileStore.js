import { supabase } from '../lib/supabase';
import { DEFAULT_GOAL_PRESET, GOAL_PRESETS } from './homeDashboard';

const PROFILES_TABLE = 'profiles';
const USER_SETTINGS_TABLE = 'user_settings';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUserId(value) {
    return UUID_PATTERN.test(String(value || '').trim());
}

function requireSupabase() {
    if (!supabase) {
        throw new Error('Supabase is not configured.');
    }

    return supabase;
}

function normalizeWeeklyGoalPreset(value) {
    const preset = String(value || '').trim();
    return GOAL_PRESETS[preset] ? preset : DEFAULT_GOAL_PRESET;
}

function mapProfileRecord(profileRecord, settingsRecord) {
    if (!profileRecord) return null;

    return {
        id: profileRecord.id,
        fullName: profileRecord.full_name || '',
        age: profileRecord.age ?? '',
        occupation: profileRecord.occupation || '',
        email: profileRecord.email || '',
        weeklyGoalPreset: normalizeWeeklyGoalPreset(
            settingsRecord?.weekly_goal_preset ?? profileRecord.weekly_goal_preset
        ),
    };
}

export async function getProfile(userId) {
    if (!isValidUserId(userId)) return null;

    const client = requireSupabase();
    const [{ data: profileData, error: profileError }, { data: settingsData, error: settingsError }] = await Promise.all([
        client
            .from(PROFILES_TABLE)
            .select('id, full_name, age, occupation, email, weekly_goal_preset')
            .eq('id', userId)
            .maybeSingle(),
        client
            .from(USER_SETTINGS_TABLE)
            .select('user_id, weekly_goal_preset')
            .eq('user_id', userId)
            .maybeSingle()
    ]);

    if (profileError) {
        throw new Error(profileError.message || 'Unable to load your profile.');
    }

    if (settingsError) {
        throw new Error(settingsError.message || 'Unable to load your profile settings.');
    }

    return mapProfileRecord(profileData, settingsData);
}

export async function updateWeeklyGoalPreset(userId, weeklyGoalPreset) {
    if (!isValidUserId(userId)) {
        throw new Error('A valid user is required.');
    }

    const client = requireSupabase();
    const normalizedPreset = normalizeWeeklyGoalPreset(weeklyGoalPreset);
    const { data, error } = await client
        .from(USER_SETTINGS_TABLE)
        .upsert({
            user_id: userId,
            weekly_goal_preset: normalizedPreset,
        }, {
            onConflict: 'user_id'
        })
        .select('user_id, weekly_goal_preset')
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Unable to save your weekly goal right now.');
    }

    const profile = await getProfile(userId);
    if (!profile) return null;

    return {
        ...profile,
        weeklyGoalPreset: normalizeWeeklyGoalPreset(data?.weekly_goal_preset ?? normalizedPreset),
    };
}
