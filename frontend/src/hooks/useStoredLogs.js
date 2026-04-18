import React from 'react';
import { deleteLog, insertLog, readLogsForUser, updateLog } from '../utils/logStore';

export function useStoredLogs({ userId = '', refreshIntervalMs = 0 } = {}) {
    const [logs, setLogs] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState('');

    const refreshLogs = React.useCallback(async () => {
        if (!userId) {
            setLogs([]);
            setError('');
            return [];
        }

        setIsLoading(true);

        try {
            const nextLogs = await readLogsForUser(userId);
            setLogs(nextLogs);
            setError('');
            return nextLogs;
        } catch (refreshError) {
            console.error('Logs load error:', refreshError);
            setLogs([]);
            setError(refreshError?.message || 'Unable to load logs right now.');
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    React.useEffect(() => {
        void refreshLogs();
    }, [refreshLogs]);

    React.useEffect(() => {
        if (!userId || refreshIntervalMs <= 0) return undefined;

        const intervalId = window.setInterval(() => {
            void refreshLogs();
        }, refreshIntervalMs);

        const handleFocus = () => {
            void refreshLogs();
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };
    }, [refreshIntervalMs, refreshLogs, userId]);

    const addLog = React.useCallback(async (log) => {
        const createdLog = await insertLog(userId, log);
        await refreshLogs();
        return createdLog;
    }, [refreshLogs, userId]);

    const updateLogItem = React.useCallback(async (logId, changes) => {
        const updatedLog = await updateLog(userId, logId, changes);
        await refreshLogs();
        return updatedLog;
    }, [refreshLogs, userId]);

    const removeLog = React.useCallback(async (logId) => {
        await deleteLog(userId, logId);
        await refreshLogs();
    }, [refreshLogs, userId]);

    return {
        logs,
        isLoading,
        error,
        refreshLogs,
        addLog,
        updateLogItem,
        removeLog,
    };
}
