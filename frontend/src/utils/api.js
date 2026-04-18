function trimTrailingSlash(value) {
    return value.replace(/\/+$/, '');
}

export function getApiUrl(path) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const configuredBaseUrl = trimTrailingSlash(
        String(import.meta.env.VITE_API_BASE_URL || '')
    );

    if (!configuredBaseUrl) {
        return normalizedPath;
    }

    return `${configuredBaseUrl}${normalizedPath}`;
}

export async function readJsonResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        return {};
    }

    try {
        return await response.json();
    } catch {
        return {};
    }
}
