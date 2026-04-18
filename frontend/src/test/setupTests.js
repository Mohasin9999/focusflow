import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

function createStorageMock() {
    const store = new Map();

    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => {
            store.set(String(key), String(value));
        },
        removeItem: (key) => {
            store.delete(String(key));
        },
        clear: () => {
            store.clear();
        },
        key: (index) => Array.from(store.keys())[index] ?? null,
        get length() {
            return store.size;
        }
    };
}

beforeEach(() => {
    const storage = createStorageMock();
    Object.defineProperty(window, 'localStorage', {
        value: storage,
        configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
        value: storage,
        configurable: true,
    });
});

afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
});
