import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, BookOpen, Crosshair, Pause, Play, ShieldAlert, TimerReset } from 'lucide-react';
import ProfileModal from '../components/ProfileModal';
import FocusMaterialsReaderModal from '../components/FocusMaterialsReaderModal';
import BrandLogo from '../components/BrandLogo';
import distractionSound from '../assets/distraction-sound.mp4';
import { createSessionLog } from '../utils/logStore';
import { getUserDataOwnerId, getUserInitials, readStoredUser } from '../utils/userProfile';
import { useFocusSession } from '../hooks/useFocusSession';
import { useFocusMaterialsReader } from '../hooks/useFocusMaterialsReader';
import { useStoredLogs } from '../hooks/useStoredLogs';
import { signOutSupabase } from '../utils/supabaseAuth';

export default function FocusTimer() {
    const [user, setUser] = useState(readStoredUser);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const userDataOwnerId = getUserDataOwnerId(user);
    const sessionName = String(location.state?.sessionName || '').trim();
    const { addLog } = useStoredLogs({ userId: userDataOwnerId });
    const warningAudioRef = React.useRef(null);
    const playWarningSound = React.useCallback(() => {
        try {
            const warningAudio = warningAudioRef.current;
            if (warningAudio) {
                warningAudio.loop = true;
                warningAudio.currentTime = 0;
                void warningAudio.play().catch(() => {});
            }

            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                navigator.vibrate([180, 60, 180]);
            }
        } catch (error) {
            console.error('Warning sound error:', error);
        }
    }, []);
    const {
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
    } = useFocusSession({ onDistractionStart: playWarningSound });
    const {
        studyMaterials,
        studyMaterialFolders,
        isStudyMaterialsLoading,
        isReaderOpen,
        selectedMaterialId,
        selectedMaterial,
        viewerMode,
        viewerSrc,
        viewerText,
        viewerStatus,
        setSelectedMaterialId,
        openReader,
        closeReader,
    } = useFocusMaterialsReader({ user, userDataOwnerId });

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const isActive = hasStarted && !isPaused;

    React.useEffect(() => {
        if (!sessionName) {
            navigate('/', { replace: true });
            return;
        }

        if (!hasStarted) {
            startSession();
        }
    }, [hasStarted, navigate, sessionName, startSession]);

    React.useEffect(() => {
        if (typeof Audio === 'undefined') return undefined;

        const warningAudio = new Audio(distractionSound);
        warningAudio.src = distractionSound;
        warningAudio.preload = 'auto';
        warningAudio.volume = 1;
        warningAudio.load();
        warningAudioRef.current = warningAudio;

        return () => {
            if (warningAudioRef.current) {
                warningAudioRef.current.pause();
                warningAudioRef.current.currentTime = 0;
                warningAudioRef.current.loop = false;
                warningAudioRef.current = null;
            }
        };
    }, []);

    React.useEffect(() => {
        const warningAudio = warningAudioRef.current;
        if (!warningAudio) return;

        if (isDistracted) {
            warningAudio.loop = true;
            warningAudio.currentTime = 0;
            void warningAudio.play().catch(() => {});
            return;
        }

        warningAudio.pause();
        warningAudio.currentTime = 0;
        warningAudio.loop = false;
    }, [isDistracted]);

    const handleEndSession = async () => {
        if (!hasStarted) {
            return;
        }

        const sessionLog = createSessionLog({
            durationSecs: timeElapsed,
            distractedSecs: totalDistractedTime,
            timestamp: new Date().toISOString(),
            sessionName,
            notes: sessionName
        });

        let savedSessionLog = sessionLog;
        if (userDataOwnerId) {
            try {
                savedSessionLog = await addLog(sessionLog) || sessionLog;
            } catch (error) {
                console.error('Session save error:', error);
            }
        }

        navigate('/', {
            state: {
                completedSession: {
                    id: savedSessionLog.id,
                    sessionName: savedSessionLog.sessionName,
                    durationSecs: savedSessionLog.durationSecs,
                    distractedSecs: savedSessionLog.distractedSecs,
                }
            }
        });
    };

    const handleLogout = async () => {
        setIsProfileModalOpen(false);
        await signOutSupabase();
        setUser(null);
        closeReader();
        navigate('/');
    };

    const handleOpenReaderFullscreen = React.useCallback(() => {
        suspendDistractionTracking(5000);
    }, [suspendDistractionTracking]);

    // Calculate stroke dasharray for circular progress
    const radius = 160;
    const circumference = 2 * Math.PI * radius;
    const goalTime = 25 * 60;
    const offset = circumference - (Math.min(timeElapsed, goalTime) / goalTime) * circumference;
    const sessionProgressPercent = Math.min(100, Math.round((Math.min(timeElapsed, goalTime) / goalTime) * 100));
    const sessionStatusLabel = isDistracted ? 'Distracted' : isActive ? 'In Progress' : 'Paused';
    const sessionStatusTone = isDistracted
        ? 'border-[rgba(255,106,0,0.18)] bg-[rgba(255,106,0,0.08)] text-[#ffb17e]'
        : isActive
            ? 'border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.08)] text-[var(--ff-accent)]'
            : 'border-white/10 bg-white/6 text-[#d0cbc2]';

    return (
        <div className="ff-dashboard-shell min-h-screen overflow-x-hidden font-sans text-[#f6f2eb]">

            {/* Background decorative glows */}
            <div className="pointer-events-none absolute left-[-15%] top-[-15%] h-[50%] w-[50%] rounded-full bg-[rgba(255,177,20,0.12)] blur-[150px]"></div>
            <div className="pointer-events-none absolute bottom-[-15%] right-[-15%] h-[50%] w-[50%] rounded-full bg-[rgba(255,106,0,0.08)] blur-[150px]"></div>

            {/* Distraction Popup */}
            {showDistractionPopup && (
                <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 animate-bounce-in">
                    <div className="ff-panel-dark flex items-center gap-4 rounded-[1.5rem] border border-[rgba(255,106,0,0.18)] bg-[linear-gradient(135deg,rgba(46,28,23,0.96),rgba(30,24,22,0.96))] p-4 pr-6 shadow-2xl">
                        <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[rgba(255,106,0,0.16)] bg-[rgba(255,106,0,0.12)] text-[#ffb17e]">
                            <AlertCircle size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-[#f6f2eb]">Focus interrupted</h3>
                            <p className="text-sm text-[#b7b0a5]">You lost {Math.floor(lastDistractionDuration / 60) > 0 ? `${Math.floor(lastDistractionDuration / 60)}m ` : ''}{lastDistractionDuration % 60}s of focus time.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Header / Top bar */}
            <header className="fixed top-0 left-0 right-0 p-8 flex justify-between items-start pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        aria-label="Go to home page"
                        className="flex items-center gap-3 rounded-sm text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[rgba(255,177,20,0.28)]"
                    >
                        <BrandLogo wrapperClassName="h-10 w-10 overflow-hidden rounded-sm border border-white/10 bg-[var(--ff-accent)] shadow-[0_10px_20px_rgba(255,177,20,0.24)]" />
                        <span className="text-xl font-bold uppercase tracking-[0.08em] text-[#f7f3ea]">FocusFlow</span>
                    </button>
                </div>

                <div className="flex items-center gap-4 pointer-events-auto">
                    <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-sm border border-[var(--ff-line)] bg-[var(--ff-accent)] text-sm font-bold text-[#141414] shadow-[0_0_0_6px_rgba(255,177,20,0.08)]" onClick={() => setIsProfileModalOpen(true)}>
                        {getUserInitials(user)}
                    </div>
                </div>
            </header>

            {/* Profile Modal */}
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                user={user}
                onLogout={handleLogout}
            />

            <FocusMaterialsReaderModal
                isOpen={isReaderOpen}
                materials={studyMaterials}
                folders={studyMaterialFolders}
                isLoading={isStudyMaterialsLoading}
                selectedMaterialId={selectedMaterialId}
                selectedMaterial={selectedMaterial}
                viewerMode={viewerMode}
                viewerSrc={viewerSrc}
                viewerText={viewerText}
                viewerStatus={viewerStatus}
                onSelectMaterial={setSelectedMaterialId}
                onOpenFullScreen={handleOpenReaderFullscreen}
                onClose={closeReader}
            />

            {/* Main Timer Content */}
            <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-8 pt-24">
                <div className="mb-6 flex w-full flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8f8a82]">Focus Session</p>
                        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#f7f3ea] sm:text-4xl">
                            {sessionName}
                        </h1>
                        <p className="mt-2 text-sm text-[#a9a195]">
                            Stay with the current task and keep the session uninterrupted.
                        </p>
                    </div>
                    <div className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] ${sessionStatusTone}`}>
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            isDistracted ? 'bg-[rgba(255,106,0,0.12)]' : isActive ? 'bg-[rgba(255,177,20,0.12)]' : 'bg-white/10'
                        }`}>
                            <Crosshair size={16} />
                        </span>
                        {sessionStatusLabel}
                    </div>
                </div>

                {/* Circular Progress Container */}
                <div className="ff-panel-dark relative mb-8 w-full overflow-hidden rounded-[2.2rem] px-5 py-6 sm:px-8">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(255,177,20,0.14),transparent_60%)]"></div>
                    <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_320px] lg:items-center">
                        <div className="flex flex-col items-center">
                            <div className="mb-5 flex w-full flex-col gap-3 rounded-[1.2rem] border border-[var(--ff-line)] bg-[rgba(255,177,20,0.08)] px-4 py-3">
                                <div className="flex items-center gap-2 text-[var(--ff-accent)]">
                                    <BookOpen size={16} />
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Study Reader</p>
                                </div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d9d1c4]">
                                    Open your uploaded notes without leaving the session
                                </p>
                                <p className="text-lg font-black uppercase tracking-[0.18em] text-[var(--ff-accent)]">
                                    {studyMaterials.length} file{studyMaterials.length === 1 ? '' : 's'} ready
                                </p>
                                <div className="flex shrink-0 flex-wrap items-center gap-3">
                                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d5cebf]">
                                        Read only
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d5cebf]">
                                        {studyMaterials.length} file{studyMaterials.length === 1 ? '' : 's'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={openReader}
                                        className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,177,20,0.22)] bg-[rgba(255,177,20,0.08)] px-4 py-2.5 text-sm font-semibold text-[var(--ff-accent)] transition-colors hover:bg-[rgba(255,177,20,0.14)] hover:text-[#f7f3ea]"
                                    >
                                        <BookOpen size={16} />
                                        Open Reader
                                    </button>
                                </div>
                            </div>

                            <div className="relative flex items-center justify-center">
                                <svg viewBox="0 0 400 400" className="h-[270px] w-[270px] -rotate-90 transform sm:h-[340px] sm:w-[340px]">
                                    <circle
                                        cx="200"
                                        cy="200"
                                        r={radius}
                                        stroke="currentColor"
                                        strokeWidth="14"
                                        fill="transparent"
                                        className="text-white/5"
                                    />
                                    <circle
                                        cx="200"
                                        cy="200"
                                        r={radius}
                                        stroke="currentColor"
                                        strokeWidth="12"
                                        fill="transparent"
                                        className="text-white/10"
                                    />
                                    <circle
                                        cx="200"
                                        cy="200"
                                        r={radius}
                                        stroke="currentColor"
                                        strokeWidth="13"
                                        fill="transparent"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={offset}
                                        strokeLinecap="round"
                                        className={`${isActive ? 'text-[var(--ff-accent)]' : 'text-[var(--ff-accent-deep)]'} transition-all duration-1000 ease-linear`}
                                    />
                                </svg>

                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                    <span className="mb-2 text-5xl font-black leading-none tracking-tight text-[#f7f3ea] sm:text-7xl">
                                        {formatTime(timeElapsed)}
                                    </span>
                                    <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isDistracted ? 'text-[var(--ff-accent-deep)]' : isActive ? 'text-[var(--ff-accent)]' : 'text-[#8a8a8a]'}`}>
                                        {isDistracted ? 'DISTRACTED' : isActive ? 'IN PROGRESS' : 'PAUSED'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 flex w-full max-w-[420px] flex-col gap-3 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={isPaused ? resumeSession : pauseSession}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-[1rem] border border-white/10 bg-white/6 px-5 py-3.5 text-sm font-bold text-[#f6f2eb] transition-all hover:bg-white/10 active:scale-[0.98]"
                                >
                                    {isPaused ? <Play size={16} /> : <Pause size={16} />}
                                    {isPaused ? 'Resume Session' : 'Pause Session'}
                                </button>
                                <button
                                    onClick={handleEndSession}
                                    disabled={!hasStarted}
                                    className="w-full flex-1 rounded-[1rem] bg-[#f7f3ea] py-3.5 text-sm font-bold text-[#111111] shadow-[0_16px_30px_rgba(0,0,0,0.2)] transition-all hover:bg-[#ffffff] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    End Session
                                </button>
                            </div>
                            <div className="mt-4 rounded-full border border-[var(--ff-line)] bg-[rgba(255,177,20,0.08)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ff-accent)]">
                                25-minute target with distraction tracking • {sessionProgressPercent}% complete
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f8a82]">Session Brief</p>
                                <p className="mt-3 text-lg font-bold text-[#f6f2eb]">{sessionName}</p>
                                <p className="mt-2 text-sm text-[#a59d91]">
                                    This name will be saved with your focus log when you finish the session.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
                                <SessionStatCard
                                    icon={<TimerReset size={18} />}
                                    label="Elapsed"
                                    value={formatTime(timeElapsed)}
                                    tone="accent"
                                />
                                <SessionStatCard
                                    icon={<ShieldAlert size={18} />}
                                    label="Distracted"
                                    value={formatTime(totalDistractedTime)}
                                    tone={totalDistractedTime > 0 ? 'warning' : 'neutral'}
                                />
                                <SessionStatCard
                                    icon={<Crosshair size={18} />}
                                    label="Target"
                                    value="25:00"
                                    tone="neutral"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-[#8f8a82]">
                    Finish to save the session name, focus time, and distraction time to your history
                </p>
            </div>
        </div>
    );
}

function SessionStatCard({ icon, label, value, tone = 'neutral' }) {
    const toneMap = {
        accent: 'border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.08)] text-[var(--ff-accent)]',
        neutral: 'border-white/8 bg-white/6 text-[#f6f2eb]',
        warning: 'border-[rgba(255,106,0,0.16)] bg-[rgba(255,106,0,0.08)] text-[#ffb17e]'
    };

    return (
        <div className="ff-panel-dark-soft rounded-[1.6rem] p-5">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-[1rem] border ${toneMap[tone] || toneMap.neutral}`}>
                {icon}
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8f8a82]">{label}</p>
            <p className="mt-2 text-2xl font-bold text-[#f6f2eb]">{value}</p>
        </div>
    );
}
