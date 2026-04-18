let currentUserCache = null;

export function readStoredUser() {
    return currentUserCache;
}

export function writeStoredUser(user) {
    currentUserCache = user && typeof user === 'object' ? user : null;
    return currentUserCache;
}

export function clearStoredUser() {
    currentUserCache = null;
}

export function getUserInitials(user, fallback = 'U') {
    const name = user?.fullName || user?.name || '';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return fallback;
    return parts.map((part) => part[0]).join('').toUpperCase();
}

export function getUserGreetingName(user, fallback = 'there') {
    const fullName = user?.fullName || user?.name || '';
    const firstName = fullName.split(' ').filter(Boolean)[0];
    return firstName || fallback;
}

export function getUserStorageScope(user) {
    const identifier = user?.email || user?.id || user?.fullName || 'guest';
    return String(identifier).trim().toLowerCase() || 'guest';
}

export function getUserDataOwnerId(user) {
    const identifier = String(user?.id || '').trim();
    return identifier || '';
}

export function seedStoredUserForTests(user) {
    return writeStoredUser(user);
}
