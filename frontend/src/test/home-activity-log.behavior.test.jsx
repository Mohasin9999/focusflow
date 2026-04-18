import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '../pages/Home';
import ActivityLog from '../pages/ActivityLog';
import { seedStoredUserForTests } from '../utils/userProfile';

let currentLogs = [];

vi.mock('../hooks/useStoredLogs', () => ({
    useStoredLogs: () => ({
        logs: currentLogs,
        isLoading: false,
        error: '',
        refreshLogs: vi.fn(),
        addLog: vi.fn(),
        updateLogItem: vi.fn(),
        removeLog: vi.fn(),
    })
}));

vi.mock('../hooks/useStudyMaterialsManager', () => ({
    useStudyMaterialsManager: () => ({
        studyMaterials: [],
        studyMaterialFolders: [],
        isStudyMaterialsLoading: false,
        isStudyMaterialsUploading: false,
        studyMaterialsStatus: '',
        setStudyMaterialsStatus: vi.fn(),
        loadStudyMaterials: vi.fn(),
        uploadStudyMaterials: vi.fn(),
        createFolder: vi.fn(),
        removeMaterial: vi.fn(),
        removeFolder: vi.fn(),
        renameFolder: vi.fn(),
        moveMaterial: vi.fn(),
    })
}));

vi.mock('../utils/profileStore', () => ({
    getProfile: vi.fn(async () => ({
        id: '11111111-1111-4111-8111-111111111111',
        fullName: 'Test User',
        email: 'test@example.com',
        age: '',
        occupation: '',
        weeklyGoalPreset: 'average',
    })),
    updateWeeklyGoalPreset: vi.fn(async (_userId, nextPreset) => ({
        id: '11111111-1111-4111-8111-111111111111',
        fullName: 'Test User',
        email: 'test@example.com',
        age: '',
        occupation: '',
        weeklyGoalPreset: nextPreset,
    })),
}));

vi.mock('../utils/supabaseAuth', async () => {
    const actual = await vi.importActual('../utils/supabaseAuth');
    return {
        ...actual,
        signOutSupabase: vi.fn(async () => {}),
    };
});

function seedUser() {
    seedStoredUserForTests({
        id: '11111111-1111-4111-8111-111111111111',
        fullName: 'Test User',
        email: 'test@example.com',
    });
}

function buildLog({
    id,
    source = 'activity',
    timestamp,
    typeId = 'study',
    durationSecs = 0,
    distractedSecs = 0,
    notes = ''
}) {
    return {
        id: String(id),
        source,
        timestamp,
        typeId,
        durationSecs,
        distractedSecs,
        notes
    };
}

function setLogs(logs) {
    currentLogs = logs;
}

function getRecentActivitiesCard() {
    const heading = screen.getByRole('heading', { name: 'Recent Activities' });
    const card = heading.closest('section');
    if (!card) {
        throw new Error('Recent activities card not found');
    }
    return card;
}

describe('Home and Activity Log behavior', () => {
    beforeEach(() => {
        currentLogs = [];
        seedStoredUserForTests(null);
    });

    it('applies the 24-hour window for Recent Activities', async () => {
        const now = new Date();

        seedUser();
        setLogs([
            buildLog({
                id: 1,
                source: 'session',
                timestamp: new Date(now.getTime() - (1 * 60 * 60 * 1000)).toISOString(),
                typeId: 'focus',
                durationSecs: 600
            }),
            buildLog({
                id: 2,
                source: 'session',
                timestamp: new Date(now.getTime() - (26 * 60 * 60 * 1000)).toISOString(),
                typeId: 'focus',
                durationSecs: 300
            }),
            buildLog({
                id: 3,
                source: 'activity',
                timestamp: new Date(now.getTime() - (2 * 60 * 60 * 1000)).toISOString(),
                typeId: 'sleep',
                durationSecs: 3600
            })
        ]);

        render(
            <MemoryRouter>
                <Home />
            </MemoryRouter>
        );

        const recentCard = getRecentActivitiesCard();

        await waitFor(() => {
            expect(within(recentCard).getByText('Session 1')).toBeInTheDocument();
            expect(within(recentCard).getByText('Sleep')).toBeInTheDocument();
        });

        expect(within(recentCard).queryByText('Session 2')).not.toBeInTheDocument();
    });

    it('numbers same-day sessions with oldest as Session 1 in Recent Activities', async () => {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const timeSinceMidnight = now.getTime() - startOfToday.getTime();
        const safeWindow = Math.max(0, timeSinceMidnight - 1000);
        const newerOffsetMs = Math.min(10 * 60 * 1000, Math.floor(safeWindow / 3));
        let olderOffsetMs = Math.min(30 * 60 * 1000, Math.floor((safeWindow * 2) / 3));
        if (olderOffsetMs <= newerOffsetMs && safeWindow > newerOffsetMs) {
            olderOffsetMs = newerOffsetMs + 1;
        }

        seedUser();
        setLogs([
            buildLog({
                id: 11,
                source: 'session',
                timestamp: new Date(now.getTime() - newerOffsetMs).toISOString(),
                typeId: 'focus',
                durationSecs: 1500
            }),
            buildLog({
                id: 12,
                source: 'activity',
                timestamp: new Date(now.getTime() - (20 * 60 * 1000)).toISOString(),
                typeId: 'study',
                durationSecs: 1800
            }),
            buildLog({
                id: 13,
                source: 'session',
                timestamp: new Date(now.getTime() - olderOffsetMs).toISOString(),
                typeId: 'focus',
                durationSecs: 1200
            })
        ]);

        render(
            <MemoryRouter>
                <Home />
            </MemoryRouter>
        );

        const recentCard = getRecentActivitiesCard();

        await waitFor(() => {
            const sessionLabels = within(recentCard)
                .getAllByText(/^Session \d+$/)
                .map((node) => node.textContent);
            expect(sessionLabels).toEqual(['Session 2', 'Session 1']);
        });
    });

    it('resets session numbering on the next day in Recent Activities', async () => {
        const now = new Date();
        const msInDay = 24 * 60 * 60 * 1000;
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const msSinceMidnight = now.getTime() - startOfToday.getTime();
        const msToYesterday = Math.min((msInDay - 1000), msSinceMidnight + (60 * 60 * 1000));
        const msToToday = Math.min(30 * 60 * 1000, Math.max(0, msSinceMidnight - 1000));

        seedUser();
        setLogs([
            buildLog({
                id: 31,
                source: 'session',
                timestamp: new Date(now.getTime() - msToToday).toISOString(),
                typeId: 'focus',
                durationSecs: 900
            }),
            buildLog({
                id: 32,
                source: 'session',
                timestamp: new Date(now.getTime() - msToYesterday).toISOString(),
                typeId: 'focus',
                durationSecs: 600
            })
        ]);

        render(
            <MemoryRouter>
                <Home />
            </MemoryRouter>
        );

        const recentCard = getRecentActivitiesCard();

        await waitFor(() => {
            const sessionLabels = within(recentCard)
                .getAllByText(/^Session \d+$/)
                .map((node) => node.textContent);
            expect(sessionLabels).toEqual(['Session 1', 'Session 1']);
        });
    });

    it('numbers same-day sessions with oldest as Session 1 in Activity Log', async () => {
        seedUser();
        setLogs([
            buildLog({
                id: 41,
                source: 'session',
                timestamp: new Date(2026, 1, 10, 11, 50, 0).toISOString(),
                typeId: 'focus',
                durationSecs: 900
            }),
            buildLog({
                id: 42,
                source: 'session',
                timestamp: new Date(2026, 1, 10, 11, 30, 0).toISOString(),
                typeId: 'focus',
                durationSecs: 1200
            })
        ]);

        const activityRender = render(
            <MemoryRouter>
                <ActivityLog />
            </MemoryRouter>
        );

        await waitFor(() => {
            const sessionLabels = within(activityRender.container)
                .getAllByText(/^Session \d+$/)
                .map((node) => node.textContent);
            expect(sessionLabels).toEqual(['Session 2', 'Session 1']);
        });
    });

    it('stays in sync between Home and Activity Log after storage updates', async () => {
        const now = new Date();

        seedUser();
        setLogs([]);

        const homeRender = render(
            <MemoryRouter>
                <Home />
            </MemoryRouter>
        );

        const activityRender = render(
            <MemoryRouter>
                <ActivityLog />
            </MemoryRouter>
        );

        setLogs([
            buildLog({
                id: 21,
                source: 'session',
                timestamp: now.toISOString(),
                typeId: 'focus',
                durationSecs: 900,
                distractedSecs: 120
            })
        ]);
        homeRender.rerender(
            <MemoryRouter>
                <Home />
            </MemoryRouter>
        );
        activityRender.rerender(
            <MemoryRouter>
                <ActivityLog />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(within(homeRender.container).getByText('Session 1')).toBeInTheDocument();
            expect(within(activityRender.container).getByText('Session 1')).toBeInTheDocument();
        });
    });
});
