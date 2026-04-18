import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Home as HomeIcon,
    Clock,
    BarChart2,
    Bot,
    User,
    Power,
    Bell,
    Plus,
    Moon,
    BookOpen,
    Target,
    AlertCircle,
    Layout,
    Sparkles,
    Zap,
    Send,
    Menu,
    Smile,
    ChevronRight
} from 'lucide-react';
import ProfileModal from '../components/ProfileModal';
import AuthModal from '../components/AuthModal';
import BrandLogo from '../components/BrandLogo';
import StudyMaterialsModal from '../components/StudyMaterialsModal';
import {
    formatSecondsToHoursAndMinutes,
    isSessionSource,
    parseLogTimestamp
} from '../utils/logStore';
import {
    buildHomeDashboardData,
    DEFAULT_GOAL_PRESET,
    formatFocusTime,
    getGoalHoursForPreset,
    GOAL_PRESETS
} from '../utils/homeDashboard';
import {
    getUserDataOwnerId,
    getUserGreetingName,
    getUserInitials,
    readStoredUser
} from '../utils/userProfile';
import { formatMaterialSize, formatMaterialTimestamp } from '../utils/studyMaterialsStore';
import { useStoredLogs } from '../hooks/useStoredLogs';
import { getProfile, updateWeeklyGoalPreset } from '../utils/profileStore';
import { useStudyMaterialsManager } from '../hooks/useStudyMaterialsManager';
import { signOutSupabase } from '../utils/supabaseAuth';

export default function Home() {
    const [user, setUser] = React.useState(readStoredUser);
    const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const [chatMessages, setChatMessages] = React.useState([]);
    const [chatInput, setChatInput] = React.useState('');
    const chatScrollRef = React.useRef(null);
    const [isHistoryPopupOpen, setIsHistoryPopupOpen] = React.useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
    const [isStudyMaterialsModalOpen, setIsStudyMaterialsModalOpen] = React.useState(false);
    const [isSessionNameModalOpen, setIsSessionNameModalOpen] = React.useState(false);
    const [sessionNameDraft, setSessionNameDraft] = React.useState('');
    const [sessionNameError, setSessionNameError] = React.useState('');
    const [authMode, setAuthMode] = React.useState('signin');
    const [authIntent, setAuthIntent] = React.useState('general');
    const [weeklyGoalPreset, setWeeklyGoalPreset] = React.useState(DEFAULT_GOAL_PRESET);
    const [weeklyGoalStatus, setWeeklyGoalStatus] = React.useState('');
    const navigate = useNavigate();
    const navigateHome = React.useCallback(() => {
        navigate('/');
        setIsSidebarOpen(false);
    }, [navigate]);

    const userDataOwnerId = React.useMemo(
        () => getUserDataOwnerId(user),
        [user]
    );

    React.useEffect(() => {
        setChatMessages([
            {
                text: user
                    ? `Welcome back, ${getUserGreetingName(user)}! Ready to focus today?`
                    : 'Welcome to FocusFlow! Sign in to get personalized productivity insights and smart coaching.',
                sender: 'ai'
            }
        ]);
    }, [user]);

    React.useEffect(() => {
        const chatScrollElement = chatScrollRef.current;
        if (!chatScrollElement) return;

        if (typeof chatScrollElement.scrollTo === 'function') {
            chatScrollElement.scrollTo({
                top: chatScrollElement.scrollHeight,
                behavior: 'smooth'
            });
            return;
        }

        chatScrollElement.scrollTop = chatScrollElement.scrollHeight;
    }, [chatMessages]);

    React.useEffect(() => {
        if (!userDataOwnerId) {
            setWeeklyGoalPreset(DEFAULT_GOAL_PRESET);
            setWeeklyGoalStatus('');
            return;
        }

        let isCancelled = false;

        const loadProfile = async () => {
            try {
                const profile = await getProfile(userDataOwnerId);
                if (isCancelled) return;
                setWeeklyGoalPreset(profile?.weeklyGoalPreset || DEFAULT_GOAL_PRESET);
                setWeeklyGoalStatus('');
            } catch (error) {
                if (isCancelled) return;
                console.error('Profile load error:', error);
                setWeeklyGoalPreset(DEFAULT_GOAL_PRESET);
                setWeeklyGoalStatus(error?.message || 'Unable to load your weekly goal right now.');
            }
        };

        void loadProfile();

        return () => {
            isCancelled = true;
        };
    }, [userDataOwnerId]);

    const { logs } = useStoredLogs({ userId: userDataOwnerId });
    const [dashboardNow, setDashboardNow] = React.useState(() => new Date());

    React.useEffect(() => {
        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 0, 0);
        const timeoutMs = nextMidnight.getTime() - now.getTime();
        let intervalId = null;

        const timeoutId = window.setTimeout(() => {
            setDashboardNow(new Date());
            intervalId = window.setInterval(() => setDashboardNow(new Date()), 24 * 60 * 60 * 1000);
        }, timeoutMs);

        return () => {
            window.clearTimeout(timeoutId);
            if (intervalId) window.clearInterval(intervalId);
        };
    }, [logs]);

    const safeGoalHours = getGoalHoursForPreset(weeklyGoalPreset);
    const {
        stats,
        weeklyHistory,
        recentActivities
    } = React.useMemo(() => (
        buildHomeDashboardData(logs, safeGoalHours, dashboardNow)
    ), [dashboardNow, logs, safeGoalHours]);

    const {
        studyMaterials,
        studyMaterialFolders,
        isStudyMaterialsLoading,
        isStudyMaterialsUploading,
        studyMaterialsStatus,
        setStudyMaterialsStatus,
        loadStudyMaterials,
        uploadStudyMaterials,
        createFolder,
        removeMaterial,
        removeFolder,
        renameFolder,
        moveMaterial,
    } = useStudyMaterialsManager({ user, userDataOwnerId });

    const handleSendMessage = () => {
        if (!chatInput.trim()) return;

        const userMsg = { text: chatInput, sender: 'user' };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');

        // Simulate AI Response
        setTimeout(() => {
            setChatMessages(prev => [...prev, {
                text: "That sounds like a productive plan! Based on your recent focus trends, I suggest working in 25-minute blocks with short breaks. Would you like me to guide you through a session?",
                sender: 'ai'
            }]);
        }, 1000);
    };

    const handleLogout = async () => {
        setIsProfileModalOpen(false);
        setIsSidebarOpen(false);
        await signOutSupabase();
        setUser(null);
        navigate('/');
    };

    React.useEffect(() => {
        if (!user) {
            setIsStudyMaterialsModalOpen(false);
        }
    }, [user]);


    const openAuthModal = React.useCallback((nextMode = 'signin', nextIntent = 'general') => {
        setAuthMode(nextMode);
        setAuthIntent(nextIntent);
        setIsAuthModalOpen(true);
        setIsSidebarOpen(false);
    }, []);

    const closeAuthModal = React.useCallback(() => {
        setIsAuthModalOpen(false);
        setAuthIntent('general');
    }, []);

    const handleAuthSuccess = React.useCallback((nextUser) => {
        const shouldStartFocus = authIntent === 'focus';
        const shouldOpenMaterials = authIntent === 'materials';
        setUser(nextUser);
        setIsAuthModalOpen(false);
        setAuthIntent('general');

        if (shouldStartFocus) {
            setSessionNameError('');
            setSessionNameDraft('');
            setIsSessionNameModalOpen(true);
            return;
        }

        if (shouldOpenMaterials) {
            setIsStudyMaterialsModalOpen(true);
        }
    }, [authIntent]);

    const handleWeeklyGoalChange = React.useCallback(async (nextPreset) => {
        setWeeklyGoalPreset(nextPreset);

        if (!userDataOwnerId) {
            return;
        }

        try {
            const updatedProfile = await updateWeeklyGoalPreset(userDataOwnerId, nextPreset);
            setUser((previousUser) => (
                updatedProfile
                    ? { ...(previousUser || {}), ...updatedProfile }
                    : previousUser
            ));
            setWeeklyGoalStatus('');
        } catch (error) {
            console.error('Weekly goal update error:', error);
            const fallbackPreset = user?.weeklyGoalPreset || DEFAULT_GOAL_PRESET;
            setWeeklyGoalPreset(fallbackPreset);
            setWeeklyGoalStatus(error?.message || 'Unable to save your weekly goal right now.');
        }
    }, [user?.weeklyGoalPreset, userDataOwnerId]);

    const handleStartFocusSession = React.useCallback(() => {
        if (user) {
            setSessionNameError('');
            setSessionNameDraft('');
            setIsSessionNameModalOpen(true);
            return;
        }

        openAuthModal('signin', 'focus');
    }, [openAuthModal, user]);

    const handleCloseSessionNameModal = React.useCallback(() => {
        setIsSessionNameModalOpen(false);
        setSessionNameDraft('');
        setSessionNameError('');
    }, []);

    const handleConfirmSessionName = React.useCallback(() => {
        const trimmedSessionName = sessionNameDraft.trim();
        if (!trimmedSessionName) {
            setSessionNameError('Write a session name before continuing.');
            return;
        }

        setIsSessionNameModalOpen(false);
        setSessionNameDraft('');
        setSessionNameError('');
        navigate('/focus-timer', {
            state: {
                sessionName: trimmedSessionName,
            }
        });
    }, [navigate, sessionNameDraft]);

    const handleOpenStudyMaterials = React.useCallback(() => {
        if (!user) {
            openAuthModal('signin', 'materials');
            return;
        }

        setStudyMaterialsStatus('');
        setIsStudyMaterialsModalOpen(true);
        void loadStudyMaterials();
    }, [loadStudyMaterials, openAuthModal, setStudyMaterialsStatus, user]);

    const handleUploadStudyMaterials = React.useCallback(async (files, options = {}) => {
        if (!user) {
            openAuthModal('signin', 'materials');
            return;
        }

        try {
            await uploadStudyMaterials(files, options);
        } catch {
            // Upload hook manages its own error + status state.
        }
    }, [openAuthModal, uploadStudyMaterials, user]);

    const handleCreateStudyMaterialFolder = React.useCallback(async (folderName) => {
        return createFolder(folderName);
    }, [createFolder]);

    const handleRemoveStudyMaterial = React.useCallback(async (materialId) => {
        await removeMaterial(materialId);
    }, [removeMaterial]);

    const handleRemoveStudyMaterialFolder = React.useCallback(async (folderId) => {
        await removeFolder(folderId);
    }, [removeFolder]);

    const handleRenameStudyMaterialFolder = React.useCallback(async (folderId, nextName) => {
        return renameFolder(folderId, nextName);
    }, [renameFolder]);

    const handleMoveStudyMaterial = React.useCallback(async (materialId, nextFolderId) => {
        await moveMaterial(materialId, nextFolderId);
    }, [moveMaterial]);

    const weeklyProgressHours = React.useMemo(() => {
        if (!user) return 0;
        return Math.max(0, (Number(stats.focusWeeklySecs) || 0) / 3600);
    }, [user, stats.focusWeeklySecs]);

    const weeklyGoalProgressPercent = Math.min(100, Math.round((weeklyProgressHours / safeGoalHours) * 100));
    const weeklyGoalProgressWidth = Math.min(100, (weeklyProgressHours / safeGoalHours) * 100);
    const studyMaterialsPreview = React.useMemo(() => studyMaterials.slice(0, 2), [studyMaterials]);
    const recentActivitiesPreview = React.useMemo(() => recentActivities.slice(0, 3), [recentActivities]);

    return (
        <div className="flex h-screen bg-[var(--ff-sand)] text-[#f7f3ea]">
            <AuthModal
                isOpen={isAuthModalOpen}
                mode={authMode}
                intent={authIntent}
                onModeChange={setAuthMode}
                onClose={closeAuthModal}
                onSuccess={handleAuthSuccess}
            />
            <StudyMaterialsModal
                isOpen={isStudyMaterialsModalOpen}
                materials={studyMaterials}
                folders={studyMaterialFolders}
                isLoading={isStudyMaterialsLoading}
                isUploading={isStudyMaterialsUploading}
                statusMessage={studyMaterialsStatus}
                onClose={() => setIsStudyMaterialsModalOpen(false)}
                onUpload={handleUploadStudyMaterials}
                onCreateFolder={handleCreateStudyMaterialFolder}
                onRemoveFolder={handleRemoveStudyMaterialFolder}
                onRenameFolder={handleRenameStudyMaterialFolder}
                onMoveMaterial={handleMoveStudyMaterial}
                onRemove={handleRemoveStudyMaterial}
            />

            {/* Sidebar Overlay/Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar - only show if user is logged in */}
            {user && (
                <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
                    {/* Logo & Close Button */}
                    <div className="p-6 flex items-center justify-between border-b border-black/5 bg-[rgba(255,255,255,0.86)]">
                        <button
                            type="button"
                            onClick={navigateHome}
                            aria-label="Go to home page"
                            className="flex items-center gap-3 rounded-sm text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[rgba(255,177,20,0.32)]"
                        >
                            <BrandLogo wrapperClassName="w-12 h-12 rounded-sm overflow-hidden bg-[var(--ff-accent)] shadow-[0_10px_25px_rgba(255,177,20,0.25)] border border-black/5" />
                            <span className="text-xl font-bold tracking-tight text-[#141414]">FocusFlow</span>
                        </button>
                        <button
                            className="lg:hidden p-2 text-[#6c6c6c] hover:text-[#181818] transition-colors"
                            onClick={() => setIsSidebarOpen(false)}
                        >
                            <Plus size={20} className="rotate-45" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 space-y-2 mt-4">
                        <NavItem icon={<HomeIcon size={20} />} label="Homepage" active onClick={() => { navigate('/'); setIsSidebarOpen(false); }} />
                        <NavItem icon={<Layout size={20} />} label="Activity Log" onClick={() => { navigate('/activity-log'); setIsSidebarOpen(false); }} />
                        <NavItem
                            icon={<User size={20} />}
                            label="Profile"
                            onClick={() => { setIsProfileModalOpen(true); setIsSidebarOpen(false); }}
                        />
                    </nav>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-gray-100 space-y-1">
                        <NavItem
                            icon={<Power size={20} />}
                            label="Logout"
                            className="text-rose-500 hover:bg-rose-50"
                            onClick={() => {
                                handleLogout();
                                setIsSidebarOpen(false);
                            }}
                        />
                    </div>
                </aside>
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto ff-dashboard-shell-soft">
                {/* Header */}
                <header className="sticky top-0 z-10 border-b border-white/10 bg-[#141414]/84 px-6 py-4 shadow-[0_18px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:px-8">
                    <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {user ? (
                            <button
                                className="rounded-sm border border-white/10 bg-white/5 p-2 text-[#b0b0b0] hover:border-[var(--ff-line)] hover:text-[var(--ff-accent)] hover:bg-white/10 transition-colors"
                                onClick={() => setIsSidebarOpen(true)}
                            >
                                <Menu size={22} />
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={navigateHome}
                            aria-label="Go to home page"
                            className="flex items-center gap-3 rounded-sm text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[rgba(255,177,20,0.28)]"
                        >
                            <BrandLogo wrapperClassName="w-10 h-10 rounded-sm overflow-hidden bg-[var(--ff-accent)] shadow-[0_10px_20px_rgba(255,177,20,0.24)] border border-white/10" />
                            <div>
                                <span className="block text-xl font-bold tracking-[0.08em] uppercase text-[#f6f2eb]">FocusFlow</span>
                                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8f8a82] sm:block">
                                    Deep Work Dashboard
                                </span>
                            </div>
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        {user && (
                            <button className="relative rounded-sm border border-white/10 bg-white/5 p-2 text-[#b3b3b3] hover:border-[var(--ff-line)] hover:text-[var(--ff-accent)] transition-colors">
                                <Bell size={20} />
                                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--ff-accent)] border border-[#1a1a1a]"></span>
                            </button>
                        )}

                        {user ? (
                            <div
                                onClick={() => setIsProfileModalOpen(true)}
                                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-sm border border-[var(--ff-line)] bg-[var(--ff-accent)] text-sm font-bold text-[#121212] shadow-[0_0_0_6px_rgba(255,177,20,0.08)] transition-all hover:-translate-y-0.5"
                            >
                                {getUserInitials(user)}
                            </div>
                        ) : (
                            <button
                                onClick={() => openAuthModal('signin', 'general')}
                                className="rounded-sm bg-[var(--ff-accent)] px-4 py-2 text-sm font-medium text-[#111111] hover:bg-[#ffc13b] transition-colors"
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                    </div>
                </header>

                <div className="mx-auto max-w-[88rem] space-y-7 px-6 py-7 sm:px-8">

                    {/* Hero Section & Right Grid layout */}
                    <div className="grid grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1.24fr)_minmax(340px,0.9fr)]">

                        {/* Left Column (Hero + Stats) */}
                        <div className="space-y-7">

                            {/* Hero Card */}
                            <div className="ff-panel-light relative overflow-hidden rounded-[2.2rem] p-8 text-[#191919] sm:p-9">
                                <div className="absolute inset-y-0 right-0 w-56 bg-gradient-to-l from-[rgba(255,177,20,0.16)] to-transparent"></div>
                                <div className="absolute right-0 top-0 p-10 opacity-[0.06]">
                                    <Zap size={112} />
                                </div>
                                <div className="relative max-w-[44rem]">
                                    <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7a7168]">
                                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--ff-accent)]"></span>
                                        Focus Workspace
                                    </div>
                                    <h2 className="ff-text-balance mt-4 max-w-2xl text-[2.55rem] font-bold leading-[0.94] tracking-[-0.05em] sm:text-[3.05rem]">
                                        Calm control over study, sleep, and deep work.
                                    </h2>
                                    <p className="mt-4 max-w-[34rem] text-[15px] leading-7 text-[#66615a]">
                                        Start a focus block fast and keep your study essentials close in one calm daily workspace.
                                    </p>

                                    <div className="mt-7 flex flex-wrap gap-3">
                                        <button
                                            onClick={handleStartFocusSession}
                                            className="ff-button-dark inline-flex min-h-[3.7rem] items-center gap-2 rounded-full px-8 py-3.5 text-base font-bold tracking-[0.01em] transition-all"
                                        >
                                            Start Focus Session
                                        </button>
                                        <button
                                            onClick={handleOpenStudyMaterials}
                                            className="inline-flex min-h-[3.35rem] items-center gap-2 rounded-full border border-black/8 bg-white/74 px-6 py-3 text-sm font-semibold text-[#1d1a17] transition-colors hover:bg-white"
                                        >
                                            Study Materials
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2">
                                    <HeroPill
                                        icon={<Target size={14} />}
                                        label={user ? `${weeklyGoalProgressPercent}% weekly goal` : 'Goal tracking ready'}
                                    />
                                    <HeroPill
                                        icon={<BookOpen size={14} />}
                                        label={user ? `${studyMaterials.length} study files` : 'Materials locker'}
                                    />
                                </div>
                            </div>

                            {/* Today's Stats Grid */}
                            <div>
                                <div className="mb-4 flex items-start gap-3">
                                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[1rem] border border-[var(--ff-line)] bg-[rgba(255,177,20,0.1)] text-[var(--ff-accent)]">
                                        <BarChart2 size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-[#f1ede5]">Today&apos;s stats</h3>
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8f8a82]">A quick read on your current day</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <StatCard
                                        icon={<Moon size={20} className="text-[#9cb2c8]" />}
                                        label="Sleep"
                                        value={user ? stats.sleepToday : "0"}
                                        unit="hrs"
                                        tone="sleep"
                                    />
                                    <StatCard
                                        icon={<BookOpen size={20} className="text-[var(--ff-accent)]" />}
                                        label="Study"
                                        value={user ? stats.studyToday : "0"}
                                        unit="hrs"
                                        tone="study"
                                    />
                                    <StatCard
                                        icon={<Target size={20} className="text-[#ece5d8]" />}
                                        label="Focus"
                                        value={user ? `${Math.floor(stats.focusTodaySecs / 60)}:${String(stats.focusTodaySecs % 60).padStart(2, '0')}` : "0:00"}
                                        unit="min.sec"
                                        tone="focus"
                                    />
                                    <StatCard
                                        icon={<AlertCircle size={20} className="text-[var(--ff-accent-deep)]" />}
                                        label="Distract"
                                        value={user ? `${Math.floor(stats.distractionTodaySecs / 60)}:${String(stats.distractionTodaySecs % 60).padStart(2, '0')}` : "0:00"}
                                        unit="min.sec"
                                        tone="distract"
                                    />
                                </div>
                            </div>


                            {/* Weekly Goal */}
                            <div className="ff-panel-dark rounded-[2rem] p-6 text-[#f6f2eb]">
                                <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-[#f7f3ea]">Weekly Goal Progress</h3>
                                        <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[#8f8a82]">Your focus target for this week</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d8d8d]">Goal</label>
                                        <div className="relative">
                                            <select
                                                value={weeklyGoalPreset}
                                                onChange={(e) => {
                                                    void handleWeeklyGoalChange(e.target.value);
                                                }}
                                                className="ff-input-dark appearance-none rounded-full py-2 pl-3 pr-8 text-xs font-semibold"
                                            >
                                                {Object.entries(GOAL_PRESETS).map(([presetKey, preset]) => (
                                                    <option key={presetKey} value={presetKey}>
                                                        {preset.label} ({preset.hours}h)
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronRight className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-[#8b8b8b]" size={14} />
                                        </div>
                                        <span className="text-sm font-medium text-[var(--ff-accent)]">
                                            {user ? weeklyGoalProgressPercent : 0}%
                                        </span>
                                    </div>
                                </div>
                                <p className="mb-5 text-sm text-[#9d9d9d]">
                                    {user
                                        ? `${weeklyProgressHours.toFixed(1)} / ${safeGoalHours} hrs completed`
                                        : `0 / ${safeGoalHours} hrs completed`
                                    }
                                </p>
                                <div className="h-3 overflow-hidden rounded-full bg-white/6">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-[var(--ff-accent)] to-[var(--ff-accent-deep)] transition-all duration-500"
                                        style={{
                                            width: user
                                                ? `${weeklyGoalProgressWidth}%`
                                                : "0%"
                                        }}
                                    ></div>
                                </div>
                                {weeklyGoalStatus ? (
                                    <p className="mt-3 text-xs text-[#ffb17e]">{weeklyGoalStatus}</p>
                                ) : null}
                            </div>

                            {/* Recent Activities */}
                            <section className="ff-panel-dark flex flex-col rounded-[2rem] p-6 text-[#f6f2eb]">
                                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/8 bg-white/6 text-[var(--ff-accent)] shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
                                            <Layout size={18} />
                                        </div>
                                        <div>
                                            <h3 id="recent-activities-heading" className="text-lg font-bold text-[#f6f2eb]">Recent Activities</h3>
                                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8f8a82]">
                                                {user ? 'Latest sessions and manual entries at a glance' : 'Sign in to unlock your timeline'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d5cebf]">
                                            {user ? `${recentActivities.length} logged` : 'Guest mode'}
                                        </span>
                                        {user ? (
                                            <button
                                                onClick={() => navigate('/activity-log')}
                                                className="group inline-flex items-center gap-1 rounded-full border border-[rgba(255,177,20,0.24)] bg-[rgba(255,177,20,0.08)] px-4 py-2 text-sm font-semibold text-[var(--ff-accent)] transition-colors hover:bg-[rgba(255,177,20,0.14)] hover:text-[#f7f3ea]"
                                            >
                                                View All <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => openAuthModal('signin', 'general')}
                                                className="rounded-full border border-[rgba(255,177,20,0.24)] bg-[rgba(255,177,20,0.08)] px-4 py-2 text-sm font-semibold text-[var(--ff-accent)] transition-colors hover:bg-[rgba(255,177,20,0.14)] hover:text-[#f7f3ea]"
                                            >
                                                Sign In
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {user && recentActivities.length > 0 ? (
                                        recentActivitiesPreview.map((activity) => (
                                            <ActivityItem key={`${activity.source}-${activity.id}`} activity={activity} formatFocusTime={formatFocusTime} />
                                        ))
                                    ) : user ? (
                                        <div className="flex min-h-[12rem] h-full flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-6 py-8 text-center text-[#beb6a9]">
                                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1rem] border border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.1)] text-[var(--ff-accent)] shadow-[0_12px_24px_rgba(255,177,20,0.08)]">
                                                <Layout size={20} />
                                            </div>
                                            <p className="text-sm font-semibold text-[#f6f2eb]">No recent activities yet.</p>
                                            <p className="mt-1 text-xs text-[#8f8a82]">Start a focus session or add a log entry to build your timeline.</p>
                                        </div>
                                    ) : (
                                        <div className="flex min-h-[12rem] h-full flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-6 py-8 text-center text-[#beb6a9]">
                                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1rem] border border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.1)] shadow-[0_12px_24px_rgba(255,177,20,0.08)]">
                                                <Layout size={20} className="text-[var(--ff-accent)]" />
                                            </div>
                                            <p className="text-sm font-semibold text-[#f6f2eb]">Your activity feed appears here after sign in.</p>
                                            <p className="mt-1 text-xs text-[#8f8a82]">Log in to view your sessions, study entries, and weekly momentum in one place.</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                        </div>

                        {/* Right Column (Weekly Summary & AI) */}
                        <div className="space-y-7">

                            {/* Weekly Summary */}
                            <div className="ff-panel-dark rounded-[2rem] p-6 text-[#f6f2eb]">
                                <div className="mb-6 flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-[#f6f2eb]">This Week&apos;s Summary</h3>
                                        <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[#8f8a82]">Your totals across study, focus, sleep, and distractions</p>
                                    </div>
                                    <button
                                        onClick={() => setIsHistoryPopupOpen(true)}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ff-line)] bg-[rgba(255,177,20,0.08)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ff-accent)] transition-colors hover:bg-[rgba(255,177,20,0.16)]"
                                    >
                                        <Clock size={14} />
                                        History
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <SummaryCard
                                        icon={<BookOpen size={18} />}
                                        label="Total Study"
                                        value={user ? stats.studyWeekly : "0"}
                                        unit="hrs"
                                        tone="accent"
                                    />
                                    <SummaryCard
                                        icon={<Target size={18} />}
                                        label="Focus Time"
                                        value={user ? formatFocusTime(stats.focusWeeklySecs).value : "0"}
                                        unit={user ? formatFocusTime(stats.focusWeeklySecs).unit : "min"}
                                        tone="neutral"
                                    />
                                    <SummaryCard
                                        icon={<AlertCircle size={18} />}
                                        label="Distractions"
                                        value={user ? formatFocusTime(stats.distractionWeeklySecs).value : "0"}
                                        unit={user ? formatFocusTime(stats.distractionWeeklySecs).unit : "min"}
                                        tone="warning"
                                    />
                                    <SummaryCard
                                        icon={<Moon size={18} />}
                                        label="Total Sleep"
                                        value={user ? stats.sleepWeekly : "0"}
                                        unit="hrs"
                                        tone="neutral"
                                    />
                                </div>
                            </div>

                            {/* AI Coach */}
                            <div>
                                <div className="mb-4 flex items-start gap-3">
                                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[1rem] border border-[var(--ff-line)] bg-[rgba(255,177,20,0.1)] text-[var(--ff-accent)]">
                                        <Bot size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-[#f6f2eb]">AI Productivity Coach</h3>
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8f8a82]">Ask for quick support without leaving the dashboard</p>
                                    </div>
                                </div>
                                <div className="ff-panel-dark relative flex h-[388px] flex-col rounded-[2rem] p-6">
                                    <div className="mb-4 flex items-start justify-between gap-4 flex-shrink-0">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[var(--ff-accent)] text-[#111] shadow-[0_12px_30px_rgba(255,177,20,0.24)]">
                                                <Sparkles size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-[#f6f2eb]">Ready to help</h4>
                                                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8f8a82]">Based on your latest focus data</p>
                                            </div>
                                        </div>
                                        <span className="rounded-full border border-[rgba(255,255,255,0.1)] bg-white/6 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#dad2c6]">
                                            Coach
                                        </span>
                                    </div>

                                    <div className="mb-4 flex flex-wrap gap-2 flex-shrink-0">
                                        <Chip label="Plan next hour" icon={<Sparkles size={12} />} />
                                        <Chip label="Refocus now" icon={<Target size={12} />} />
                                    </div>

                                    <div
                                        ref={chatScrollRef}
                                        className="ff-panel-dark-soft mb-4 flex-1 space-y-3 overflow-y-auto rounded-[1.75rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 pr-2 custom-scrollbar"
                                    >
                                        {chatMessages.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${msg.sender === 'user'
                                                    ? 'rounded-tr-none bg-[var(--ff-accent)] text-[#111111] shadow-[0_12px_30px_rgba(255,177,20,0.18)]'
                                                    : 'rounded-tl-none border border-white/8 bg-white/7 text-[#d8d1c7]'
                                                    }`}>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-2 flex-shrink-0">
                                        <textarea
                                            id="coach-prompt"
                                            name="message"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }
                                            }}
                                            placeholder="Ask for a next-step plan..."
                                            autoComplete="off"
                                            autoCorrect="off"
                                            autoCapitalize="sentences"
                                            spellCheck={false}
                                            rows={1}
                                            enterKeyHint="send"
                                            data-lpignore="true"
                                            data-1p-ignore="true"
                                            data-bwignore="true"
                                            data-form-type="other"
                                            className="ff-input-dark flex-1 resize-none rounded-[1rem] px-4 py-3 text-sm leading-6 transition-all"
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            className="ff-button-accent flex h-12 w-12 items-center justify-center rounded-[1rem] text-[#141414] transition-all active:scale-95"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Study Materials */}
                            <div className="ff-panel-dark flex flex-col rounded-[2rem] p-6 text-[#f6f2eb]">
                                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/8 bg-white/6 text-[var(--ff-accent)] shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
                                            <BookOpen size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-[#f6f2eb]">Study Materials</h3>
                                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8f8a82]">
                                                {user ? 'Keep your notes, docs, and slides tidy and close' : 'Sign in to build your study library'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d5cebf]">
                                            {user ? `${studyMaterials.length} stored` : 'Locked'}
                                        </span>
                                        <button
                                            onClick={handleOpenStudyMaterials}
                                            className="group inline-flex items-center gap-1 rounded-full border border-[rgba(255,177,20,0.24)] bg-[rgba(255,177,20,0.08)] px-4 py-2 text-sm font-semibold text-[var(--ff-accent)] transition-colors hover:bg-[rgba(255,177,20,0.14)] hover:text-[#f7f3ea]"
                                        >
                                            {user ? 'Open Library' : 'Sign In'}
                                            <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    {user ? (
                                        studyMaterials.length > 0 ? (
                                            <div className="space-y-3">
                                                {studyMaterialsPreview.map((material) => (
                                                    <div
                                                        key={material.id}
                                                        className="group flex flex-col gap-4 rounded-[1.3rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 transition-colors hover:border-[rgba(255,177,20,0.2)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] sm:flex-row sm:items-center sm:justify-between"
                                                    >
                                                        <div className="flex items-center gap-4 min-w-0">
                                                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[1rem] border border-[rgba(255,177,20,0.16)] bg-[rgba(255,177,20,0.1)] text-[var(--ff-accent)] shadow-[0_8px_18px_rgba(255,177,20,0.08)] transition-transform group-hover:scale-105">
                                                                <BookOpen size={16} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-bold text-[#f6f2eb]" title={material.name}>
                                                                    {material.name}
                                                                </p>
                                                                <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#8f8a82]">
                                                                    Added {formatMaterialTimestamp(material.uploadedAt)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d5cebf]">
                                                                {formatMaterialSize(material.size)}
                                                            </span>
                                                            <span className="rounded-full border border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.08)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ff-accent)]">
                                                                {material.type?.split('/')[1] || material.type || 'file'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}

                                                {studyMaterials.length > studyMaterialsPreview.length ? (
                                                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8f8a82]">
                                                        +{studyMaterials.length - studyMaterialsPreview.length} more in your library
                                                    </p>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <div className="flex min-h-[12rem] h-full flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-6 py-8 text-center text-[#beb6a9]">
                                                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1rem] border border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.1)] text-[var(--ff-accent)] shadow-[0_12px_24px_rgba(255,177,20,0.08)]">
                                                    <BookOpen size={20} />
                                                </div>
                                                <p className="text-sm font-semibold text-[#f6f2eb]">No study materials uploaded yet.</p>
                                                <p className="mt-1 text-xs text-[#8f8a82]">Upload your first set of notes, slides, or PDFs to keep them ready inside FocusFlow.</p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="flex min-h-[12rem] h-full flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-6 py-8 text-center text-[#beb6a9]">
                                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1rem] border border-[rgba(255,177,20,0.18)] bg-[rgba(255,177,20,0.1)] shadow-[0_12px_24px_rgba(255,177,20,0.08)]">
                                                <BookOpen size={20} className="text-[var(--ff-accent)]" />
                                            </div>
                                            <p className="text-sm font-semibold text-[#f6f2eb]">Upload materials after signing in.</p>
                                            <p className="mt-1 text-xs text-[#8f8a82]">Keep study documents and reference files together in one clean workspace.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </main>

            {isHistoryPopupOpen && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
                    onClick={() => setIsHistoryPopupOpen(false)}
                >
                    <div
                        className="ff-panel-dark max-h-[80vh] w-full max-w-md overflow-y-auto rounded-[2rem] p-5 text-[#f6f2eb] shadow-[0_28px_70px_rgba(0,0,0,0.32)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[rgba(255,177,20,0.12)] text-[var(--ff-accent)]">
                                    <Clock size={16} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-[#f6f2eb]">History</h4>
                                    <p className="text-[11px] text-[#9e9e9e]">Previous weeks summary</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsHistoryPopupOpen(false)}
                                className="rounded-sm p-2 text-[#8f8f8f] transition-colors hover:bg-white/6 hover:text-[var(--ff-accent)]"
                            >
                                <Plus size={16} className="rotate-45" />
                            </button>
                        </div>

                        {user && weeklyHistory.length > 0 ? (
                            <div className="space-y-3">
                                {weeklyHistory.map(week => (
                                    <div key={week.key} className="rounded-[1.6rem] border border-white/8 bg-white/6 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9f9f9f]">{week.label}</p>
                                                <p className="mt-0.5 text-sm font-bold text-[#f3eee6]">{week.productiveHours}h productive</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#767676]">Goal</p>
                                                <p className="text-sm font-bold text-[var(--ff-accent)]">{week.goalPercent}%</p>
                                            </div>
                                        </div>

                                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-[var(--ff-accent)] to-[var(--ff-accent-deep)] transition-all duration-500"
                                                style={{ width: `${week.goalPercent}%` }}
                                            />
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <HistoryStatPill label="Study" value={`${week.study}h`} tone="indigo" />
                                            <HistoryStatPill label="Sleep" value={`${week.sleep}h`} tone="blue" />
                                            <HistoryStatPill label="Focus" value={`${week.focus.value}${week.focus.unit}`} tone="violet" />
                                            <HistoryStatPill label="Distract" value={`${week.distraction.value}${week.distraction.unit}`} tone="amber" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-3 py-3 text-xs text-[#9f9f9f]">
                                No previous week summaries yet.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Profile Modal */}
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                user={user}
                onLogout={handleLogout}
            />

            {isSessionNameModalOpen ? (
                <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[rgba(12,12,12,0.62)] p-4 backdrop-blur-md">
                    <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#171717] p-6 text-[#f6f2eb] shadow-[0_40px_100px_rgba(0,0,0,0.36)]">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8f8a82]">Focus Setup</p>
                                <h3 className="mt-2 text-2xl font-bold">Name this session before you start</h3>
                                <p className="mt-2 text-sm text-[#b7b0a5]">
                                    This title will travel with the session into your focus history.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseSessionNameModal}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#d0cbc2] transition-colors hover:bg-white/10"
                            >
                                Close
                            </button>
                        </div>

                        <div className="mt-6">
                            <label className="block text-left">
                                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#8f8a82]">
                                    Session Name
                                </span>
                                <input
                                    type="text"
                                    value={sessionNameDraft}
                                    onChange={(event) => {
                                        setSessionNameDraft(event.target.value);
                                        if (sessionNameError) {
                                            setSessionNameError('');
                                        }
                                    }}
                                    placeholder="Example: Physics revision sprint"
                                    className="ff-input-dark w-full rounded-[1rem] px-4 py-3 text-sm text-[#f6f2eb]"
                                    autoFocus
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    data-lpignore="true"
                                    data-1p-ignore="true"
                                    data-bwignore="true"
                                />
                            </label>
                            {sessionNameError ? (
                                <p className="mt-3 text-sm font-medium text-[#ffb17e]">{sessionNameError}</p>
                            ) : null}
                        </div>

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleCloseSessionNameModal}
                                className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-[#d0cbc2] transition-colors hover:bg-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSessionName}
                                className="rounded-[1rem] bg-[var(--ff-accent)] px-5 py-3 text-sm font-bold text-[#161616] transition-all hover:brightness-105 active:scale-[0.98]"
                            >
                                Continue to Timer
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

// Components

function NavItem({ icon, label, active, hasNotification, onClick }) {
    return (
        <div
            onClick={onClick}
            className={`group flex cursor-pointer items-center justify-between rounded-sm px-4 py-3 transition-all duration-200 ${active ? 'bg-[var(--ff-accent)] text-[#111111] shadow-[0_14px_28px_rgba(255,177,20,0.22)]' : 'text-[#5d5d5d] hover:bg-[rgba(255,177,20,0.08)] hover:text-[#111111]'}`}
        >
            <div className="flex items-center gap-3">
                {icon}
                <span className="font-medium text-sm">{label}</span>
            </div>
            {hasNotification && (
                <div className={`h-2 w-2 rounded-full ${active ? 'bg-[#111111]' : 'bg-[var(--ff-accent-deep)]'}`}></div>
            )}
        </div>
    )
}

function HeroPill({ icon, label }) {
    return (
        <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#746a5f]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-black/6 bg-white/66 text-[#8d6420]">
                {icon}
            </span>
            <span>{label}</span>
        </div>
    );
}

function StatCard({ icon, label, value, unit, tone = 'focus' }) {
    const toneMap = {
        sleep: {
            panel: 'border-[rgba(97,115,138,0.16)] bg-[linear-gradient(135deg,rgba(36,42,49,0.96),rgba(24,28,33,0.96))]',
            iconWrap: 'border-[rgba(97,115,138,0.22)] bg-[rgba(97,115,138,0.14)]',
            label: 'text-[#9fb0c3]',
            unit: 'text-[#8c99a8]',
        },
        study: {
            panel: 'border-[rgba(255,177,20,0.16)] bg-[linear-gradient(135deg,rgba(43,36,26,0.96),rgba(30,28,26,0.96))]',
            iconWrap: 'border-[rgba(255,177,20,0.22)] bg-[rgba(255,177,20,0.14)]',
            label: 'text-[#f0c56e]',
            unit: 'text-[#b6a489]',
        },
        focus: {
            panel: 'border-white/10 bg-[linear-gradient(135deg,rgba(46,46,46,0.94),rgba(28,28,28,0.94))]',
            iconWrap: 'border-white/10 bg-white/8',
            label: 'text-[#ddd4c8]',
            unit: 'text-[#9c9388]',
        },
        distract: {
            panel: 'border-[rgba(255,106,0,0.16)] bg-[linear-gradient(135deg,rgba(47,29,23,0.96),rgba(31,24,22,0.96))]',
            iconWrap: 'border-[rgba(255,106,0,0.22)] bg-[rgba(255,106,0,0.12)]',
            label: 'text-[#ffb17e]',
            unit: 'text-[#c59d82]',
        }
    };
    const styles = toneMap[tone] || toneMap.focus;

    return (
        <div className={`flex items-center gap-4 rounded-[1.6rem] border p-5 text-[#f5f1e7] ${styles.panel}`}>
            <div className={`flex h-12 w-12 items-center justify-center rounded-sm ${styles.iconWrap}`}>
                {icon}
            </div>
            <div>
                <p className={`text-sm font-medium uppercase tracking-[0.18em] ${styles.label}`}>{label}</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-[#f6f2eb]">{value}</span>
                    <span className={`text-xs ${styles.unit}`}>{unit}</span>
                </div>
            </div>
        </div>
    )
}

function SummaryCard({ icon, label, value, unit, tone = 'neutral' }) {
    const toneMap = {
        accent: {
            panel: 'bg-[rgba(255,177,20,0.08)] border-[rgba(255,177,20,0.16)]',
            icon: 'bg-[rgba(255,177,20,0.12)] text-[var(--ff-accent)]',
        },
        neutral: {
            panel: 'bg-white/5 border-white/8',
            icon: 'bg-white/8 text-[#f6f2eb]',
        },
        warning: {
            panel: 'bg-[rgba(255,106,0,0.08)] border-[rgba(255,106,0,0.16)]',
            icon: 'bg-[rgba(255,106,0,0.12)] text-[#ffb17e]',
        }
    };
    const styles = toneMap[tone] || toneMap.neutral;

    return (
        <div className={`rounded-[1.4rem] border p-4 ${styles.panel}`}>
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-[1rem] ${styles.icon}`}>
                {icon}
            </div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-[#8f8f8f]">{label}</p>
            <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-[#f5f1e7]">{value}</span>
                <span className="text-xs text-[#9b9b9b]">{unit}</span>
            </div>
        </div>
    )
}

function HistoryStatPill({ label, value, tone = "indigo" }) {
    const toneMap = {
        indigo: 'bg-[rgba(255,177,20,0.08)] text-[#f4ead9] border-[rgba(255,177,20,0.18)]',
        blue: 'bg-white/5 text-[#ece5d8] border-white/10',
        violet: 'bg-[rgba(255,255,255,0.06)] text-[#ece5d8] border-white/10',
        amber: 'bg-[rgba(255,106,0,0.1)] text-[#ffb17e] border-[rgba(255,106,0,0.22)]'
    };

    return (
        <div className={`rounded-xl border px-2.5 py-2 ${toneMap[tone] || toneMap.indigo}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
            <p className="text-xs font-bold mt-0.5">{value}</p>
        </div>
    );
}

function Chip({ label, icon }) {
    return (
        <button className="ff-chip-dark inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-medium tracking-[0.08em] transition-colors hover:border-[var(--ff-line)] hover:text-[var(--ff-accent)]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(255,177,20,0.08)] text-[var(--ff-accent)]">
                {icon}
            </span>
            {label}
        </button>
    )
}

function ActivityItem({ activity, formatFocusTime }) {
    const icons = {
        study: <BookOpen size={16} className="text-[var(--ff-accent)]" />,
        sleep: <Smile size={16} className="text-[#9fb0c3]" />,
        focus: <Clock size={16} className="text-[#ddd4c8]" />,
        distract: <AlertCircle size={16} className="text-[#ffb17e]" />
    };

    const colors = {
        study: 'bg-[rgba(255,177,20,0.12)]',
        sleep: 'bg-[rgba(97,115,138,0.16)]',
        focus: 'bg-[rgba(255,255,255,0.06)]',
        distract: 'bg-[rgba(255,106,0,0.16)]'
    };

    const icon = icons[activity.typeId] || icons.study;
    const color = colors[activity.typeId] || colors.study;
    const badgeTone = activity.typeId === 'distract'
        ? 'border-[rgba(255,106,0,0.18)] bg-[rgba(255,106,0,0.12)] text-[#ffb17e]'
        : 'border-[rgba(255,177,20,0.2)] bg-[rgba(255,177,20,0.08)] text-[var(--ff-accent)]';
    const isSession = isSessionSource(activity.source);
    const savedSessionName = String(activity.sessionName || activity.notes || '').trim();
    const activityTitle = isSession
        ? (savedSessionName || `Session ${activity.sessionNumber || 1}`)
        : (activity.typeId ? `${activity.typeId.charAt(0).toUpperCase()}${activity.typeId.slice(1)}` : 'Study');
    const activitySourceLabel = isSession ? 'Focus Timer' : 'Manual Log';

    const activityDate = parseLogTimestamp(activity.timestamp);
    const startTimeLabel = activityDate
        ? activityDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '--:--';

    const focusDuration = formatFocusTime(Number(activity.durationSecs) || 0);
    const distractedDuration = formatFocusTime(Number(activity.distractedSecs) || 0);
    const displayDuration = isSession
        ? `${focusDuration.value}${focusDuration.unit}`
        : formatSecondsToHoursAndMinutes(activity.durationSecs);

    return (
        <div className="group flex flex-col gap-4 rounded-[1.3rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 transition-colors hover:border-[rgba(255,177,20,0.22)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-[1rem] border border-white/8 ${color} shadow-[0_8px_18px_rgba(0,0,0,0.14)] transition-transform group-hover:scale-105`}>
                    {icon}
                </div>
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-[#f6f2eb] transition-colors group-hover:text-[var(--ff-accent)]">{activityTitle}</h4>
                        <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#cac2b6]">
                            {activitySourceLabel}
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#8f8a82]">{startTimeLabel}</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ${badgeTone}`}>
                    {isSession ? `Focus ${displayDuration}` : displayDuration}
                </span>
                {isSession && (
                    <span className="rounded-full border border-[rgba(255,106,0,0.16)] bg-[rgba(255,106,0,0.12)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#ffb17e]">
                        Distracted {distractedDuration.value}{distractedDuration.unit}
                    </span>
                )}
            </div>
        </div>
    );
}
