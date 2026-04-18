import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { getProfile } from './profileStore';
import { clearStoredUser, readStoredUser, writeStoredUser } from './userProfile';

function readMetadata(user) {
    return user?.user_metadata || {};
}

export function normalizeSupabaseUser(user) {
    if (!user) return null;

    const metadata = readMetadata(user);
    return {
        id: user.id,
        fullName: metadata.full_name || metadata.fullName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        age: metadata.age ?? '',
        occupation: metadata.occupation || '',
    };
}

async function hydrateUserProfile(user) {
    if (!user?.id) return null;

    try {
        const profile = await getProfile(user.id);
        return writeStoredUser(profile || user);
    } catch (error) {
        console.error('Supabase profile hydrate error:', error);
        return writeStoredUser(user);
    }
}

export function syncStoredUserFromSession(session) {
    const normalizedUser = normalizeSupabaseUser(session?.user);

    if (!normalizedUser) {
        clearStoredUser();
        return null;
    }

    return writeStoredUser(normalizedUser);
}

export async function bootstrapStoredUserFromSession() {
    if (!hasSupabaseConfig || !supabase) {
        return readStoredUser();
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Supabase session bootstrap error:', error);
        return readStoredUser();
    }

    const normalizedUser = syncStoredUserFromSession(data.session);
    return hydrateUserProfile(normalizedUser);
}

export function subscribeToAuthChanges(onUserChange) {
    if (!hasSupabaseConfig || !supabase) {
        return () => {};
    }

    const {
        data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
        const normalizedUser = syncStoredUserFromSession(session);
        if (!normalizedUser) {
            onUserChange?.(null);
            return;
        }

        void hydrateUserProfile(normalizedUser).then((user) => {
            onUserChange?.(user);
        });
    });

    return () => subscription.unsubscribe();
}

export async function signInWithSupabase({ email, password }) {
    if (!supabase) {
        throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const normalizedUser = syncStoredUserFromSession(data.session);
    return {
        user: await hydrateUserProfile(normalizedUser),
        requiresEmailConfirmation: false,
    };
}

export async function signUpWithSupabase({ fullName, age, occupation, email, password }) {
    if (!supabase) {
        throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                age,
                occupation,
            }
        }
    });

    if (error) throw error;

    const normalizedUser = data.session
        ? syncStoredUserFromSession(data.session)
        : normalizeSupabaseUser(data.user);

    return {
        user: data.session ? await hydrateUserProfile(normalizedUser) : normalizedUser,
        requiresEmailConfirmation: !data.session,
    };
}

export async function signOutSupabase() {
    if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Supabase sign out error:', error);
        }
    }

    clearStoredUser();
}

export async function getCurrentSupabaseUser() {
    if (!hasSupabaseConfig || !supabase) {
        return readStoredUser();
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Supabase get user error:', error);
        return null;
    }

    const normalizedUser = normalizeSupabaseUser(data.user);
    return hydrateUserProfile(normalizedUser);
}
