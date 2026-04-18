import React from 'react';

const DISTRACTION_POPUP_DURATION_MS = 5000;

export function useFocusSession({ onDistractionStart } = {}) {
    const [timeElapsed, setTimeElapsed] = React.useState(0);
    const [hasStarted, setHasStarted] = React.useState(false);
    const [isPaused, setIsPaused] = React.useState(false);
    const [isDistracted, setIsDistracted] = React.useState(false);
    const [totalDistractedTime, setTotalDistractedTime] = React.useState(0);
    const [showDistractionPopup, setShowDistractionPopup] = React.useState(false);
    const [lastDistractionDuration, setLastDistractionDuration] = React.useState(0);

    const timerRef = React.useRef(null);
    const distractionStartRef = React.useRef(null);
    const popupTimeoutRef = React.useRef(null);
    const suspendDistractionUntilRef = React.useRef(0);
    const isDistractedRef = React.useRef(false);

    React.useEffect(() => {
        if (hasStarted && !isPaused && !isDistracted) {
            timerRef.current = window.setInterval(() => {
                setTimeElapsed((previousTime) => previousTime + 1);
            }, 1000);
        } else {
            window.clearInterval(timerRef.current);
        }

        return () => window.clearInterval(timerRef.current);
    }, [hasStarted, isDistracted, isPaused]);

    const clearDistractionState = React.useCallback(() => {
        isDistractedRef.current = false;
        distractionStartRef.current = null;
        setIsDistracted(false);
    }, []);

    React.useEffect(() => {
        const startDistraction = () => {
            if (
                !hasStarted
                || isPaused
                || Date.now() < suspendDistractionUntilRef.current
                || isDistractedRef.current
            ) {
                return;
            }

            isDistractedRef.current = true;
            distractionStartRef.current = Date.now();
            onDistractionStart?.();
            setIsDistracted(true);
        };

        const endDistraction = () => {
            if (!distractionStartRef.current) return;

            const duration = Math.floor((Date.now() - distractionStartRef.current) / 1000);
            distractionStartRef.current = null;
            isDistractedRef.current = false;

            if (duration > 0) {
                setTotalDistractedTime((previousTime) => previousTime + duration);
                setLastDistractionDuration(duration);
                setShowDistractionPopup(true);

                window.clearTimeout(popupTimeoutRef.current);
                popupTimeoutRef.current = window.setTimeout(() => {
                    setShowDistractionPopup(false);
                }, DISTRACTION_POPUP_DURATION_MS);
            }

            setIsDistracted(false);
        };

        const handleVisibilityChange = () => {
            if (!hasStarted || isPaused) return;
            if (Date.now() < suspendDistractionUntilRef.current) return;

            if (document.hidden) {
                startDistraction();
                return;
            }

            if (document.hasFocus()) {
                endDistraction();
            }
        };

        const handleBlur = () => startDistraction();
        const handleFocus = () => endDistraction();

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            window.clearInterval(timerRef.current);
            window.clearTimeout(popupTimeoutRef.current);
        };
    }, [clearDistractionState, hasStarted, isPaused, onDistractionStart]);

    const suspendDistractionTracking = React.useCallback((durationMs) => {
        suspendDistractionUntilRef.current = Date.now() + durationMs;
        clearDistractionState();
    }, [clearDistractionState]);

    const startSession = React.useCallback(() => {
        setHasStarted(true);
        setIsPaused(false);
    }, []);

    const pauseSession = React.useCallback(() => {
        window.clearInterval(timerRef.current);
        setIsPaused(true);
        clearDistractionState();
    }, [clearDistractionState]);

    const resumeSession = React.useCallback(() => {
        setIsPaused(false);
    }, []);

    return {
        timeElapsed,
        hasStarted,
        isPaused,
        isDistracted,
        totalDistractedTime,
        showDistractionPopup,
        lastDistractionDuration,
        startSession,
        pauseSession,
        resumeSession,
        suspendDistractionTracking,
    };
}
