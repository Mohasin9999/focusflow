import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Home as HomeIcon,
    User,
    Power,
    Bell,
    Plus,
    Search,
    ChevronLeft,
    ChevronRight,
    Ellipsis,
    Edit2,
    Trash2,
    Calendar,
    Clock,
    Layout,
    BookOpen,
    AlertCircle,
    Smile,
    Menu,
} from 'lucide-react';
import ProfileModal from '../components/ProfileModal';
import BrandLogo from '../components/BrandLogo';
import {
    formatSecondsToCompactLabel,
    buildTimestampFromDateAndTime,
    createActivityLog,
    formatSecondsToHoursAndMinutes,
    isSessionSource
} from '../utils/logStore';
import {
    formatDateDisplay,
    formatTimeDisplay,
    getDateInputValueFromTimestamp,
    getLogKey,
    getSearchDurationLabel,
    getTypeLabel,
    getVisiblePageNumbers,
    matchesActivityTypeFilter,
    sortLogsByTimestampDesc,
    withSessionNumbers
} from '../utils/activityLogView';
import { formatDateInputFromDate } from '../utils/dateTime';
import { getUserDataOwnerId, getUserInitials, readStoredUser } from '../utils/userProfile';
import { useStoredLogs } from '../hooks/useStoredLogs';
import { signOutSupabase } from '../utils/supabaseAuth';

const PAGE_SIZE = 10;

function getIconForType(typeId) {
    const iconMap = {
        study: <BookOpen className="text-[var(--ff-accent)]" size={16} />,
        sleep: <Smile className="text-[#9ec5ff]" size={16} />,
        focus: <Clock className="text-[#ffd27a]" size={16} />,
        distract: <AlertCircle className="text-[#ff9f69]" size={16} />
    };
    return iconMap[typeId] || iconMap.study;
}

function getColorForType(typeId) {
    const colorMap = {
        study: 'border-[rgba(255,177,20,0.14)] bg-[rgba(255,177,20,0.1)]',
        sleep: 'border-[rgba(158,197,255,0.16)] bg-[rgba(158,197,255,0.1)]',
        focus: 'border-[rgba(255,210,122,0.16)] bg-[rgba(255,210,122,0.08)]',
        distract: 'border-[rgba(255,159,105,0.16)] bg-[rgba(255,159,105,0.1)]'
    };
    return colorMap[typeId] || colorMap.study;
}

function getDisplayNote(log) {
    const rawNote = String(log?.notes || '').trim();
    const sessionName = String(log?.sessionName || '').trim();

    if (isSessionSource(log?.source) && rawNote && sessionName && rawNote === sessionName) {
        return '';
    }

    return rawNote;
}

export default function ActivityLog() {
    const [user, setUser] = useState(readStoredUser);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [entryMessage, setEntryMessage] = useState('');
    const navigate = useNavigate();
    const navigateHome = React.useCallback(() => {
        navigate('/');
        setIsSidebarOpen(false);
    }, [navigate]);
    const userDataOwnerId = getUserDataOwnerId(user);
    const { logs, addLog, updateLogItem, removeLog, error: logsError } = useStoredLogs({
        userId: userDataOwnerId,
        refreshIntervalMs: 60 * 1000
    });

    const handleLogout = async () => {
        setIsProfileModalOpen(false);
        setIsSidebarOpen(false);
        await signOutSupabase();
        setUser(null);
        navigate('/');
    };

    const [filterActivity, setFilterActivity] = useState('Study');
    const [filterDate, setFilterDate] = useState(() => formatDateInputFromDate(new Date()));
    const [durationHours, setDurationHours] = useState('');
    const [durationMinutes, setDurationMinutes] = useState('');
    const [activityTypeFilter, setActivityTypeFilter] = useState('all');
    const [activityDateFilter, setActivityDateFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editingMode, setEditingMode] = useState('note');
    const [tempNote, setTempNote] = useState('');
    const [openActionMenuId, setOpenActionMenuId] = useState(null);

    const filteredLogs = React.useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        const filtered = logs
            .filter((log) => {
                if (!matchesActivityTypeFilter(log, activityTypeFilter)) return false;
                if (activityDateFilter && getDateInputValueFromTimestamp(log.timestamp) !== activityDateFilter) return false;
                if (!query) return true;

                const activityLabel = isSessionSource(log.source) ? 'session' : getTypeLabel(log.typeId);
                const durationLabel = getSearchDurationLabel(log);
                const haystack = `${formatDateDisplay(log.timestamp)} ${activityLabel} ${formatTimeDisplay(log.timestamp)} ${durationLabel} ${log.notes || ''}`.toLowerCase();
                return haystack.includes(query);
            })
            .sort(sortLogsByTimestampDesc);

        return withSessionNumbers(filtered);
    }, [logs, searchQuery, activityTypeFilter, activityDateFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));

    React.useEffect(() => {
        setCurrentPage((prevPage) => Math.min(prevPage, totalPages));
    }, [totalPages]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, activityTypeFilter, activityDateFilter]);

    const paginatedLogs = React.useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        return filteredLogs.slice(startIndex, startIndex + PAGE_SIZE);
    }, [filteredLogs, currentPage]);

    const paginationRangeText = React.useMemo(() => {
        if (filteredLogs.length === 0) return 'Showing 0 of 0';
        const startItem = ((currentPage - 1) * PAGE_SIZE) + 1;
        const endItem = Math.min(currentPage * PAGE_SIZE, filteredLogs.length);
        return `Showing ${startItem}-${endItem} of ${filteredLogs.length}`;
    }, [filteredLogs.length, currentPage]);

    const activeFilterChips = React.useMemo(() => {
        const chips = [];

        if (searchQuery.trim()) {
            chips.push({
                id: 'search',
                label: `Search: "${searchQuery.trim()}"`,
                onRemove: () => setSearchQuery('')
            });
        }

        if (activityTypeFilter !== 'all') {
            const labelMap = {
                study: 'Study',
                sleep: 'Sleep',
                session: 'Session'
            };
            chips.push({
                id: 'activity',
                label: `Activity: ${labelMap[activityTypeFilter] || activityTypeFilter}`,
                onRemove: () => setActivityTypeFilter('all')
            });
        }

        if (activityDateFilter) {
            chips.push({
                id: 'date',
                label: `Date: ${activityDateFilter}`,
                onRemove: () => setActivityDateFilter('')
            });
        }

        return chips;
    }, [searchQuery, activityTypeFilter, activityDateFilter]);

    const handleAddEntry = async () => {
        if (!userDataOwnerId) {
            setEntryMessage('Sign in to save entries to your workspace.');
            return;
        }

        const typeId = filterActivity === 'Sleep' ? 'sleep' : 'study';
        const parsedHours = parseInt(durationHours, 10);
        const parsedMinutes = parseInt(durationMinutes, 10);
        const safeHours = Number.isNaN(parsedHours) ? 0 : Math.max(0, parsedHours);
        const safeMinutes = Number.isNaN(parsedMinutes) ? 0 : Math.max(0, Math.min(59, parsedMinutes));
        const durationSecs = (safeHours * 3600) + (safeMinutes * 60);

        if (durationSecs <= 0) {
            setEntryMessage('Enter a duration greater than zero.');
            return;
        }

        const nowStartTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const newLog = createActivityLog({
            typeId,
            durationSecs,
            timestamp: buildTimestampFromDateAndTime(filterDate, nowStartTime),
            notes: ''
        });

        try {
            await addLog(newLog);
            setEntryMessage('');
            setDurationHours('');
            setDurationMinutes('');
        } catch (error) {
            console.error('Add entry error:', error);
            setEntryMessage(error?.message || 'Unable to save that entry right now.');
        }
    };

    const startEditingNote = (log) => {
        setOpenActionMenuId(null);
        setEditingMode('note');
        setEditingNoteId(getLogKey(log));
        setTempNote(getDisplayNote(log));
    };

    const startRenamingSession = (log) => {
        setOpenActionMenuId(null);
        setEditingMode('rename');
        setEditingNoteId(getLogKey(log));
        setTempNote(String(log.sessionName || '').trim());
    };

    const saveNote = async (targetLog) => {
        setEditingNoteId(null);

        try {
            await updateLogItem(targetLog.id, {
                source: targetLog.source,
                typeId: targetLog.typeId,
                ...(isSessionSource(targetLog.source) && editingMode === 'rename'
                    ? { sessionName: tempNote }
                    : {}),
                ...(editingMode === 'note'
                    ? { notes: tempNote }
                    : {}),
            });
        } catch (error) {
            console.error('Save note error:', error);
            setEntryMessage(error?.message || 'Unable to update that note right now.');
        }
    };

    const deleteLogEntry = async (targetLog) => {
        setOpenActionMenuId(null);
        try {
            await removeLog(targetLog.id);
        } catch (error) {
            console.error('Delete log error:', error);
            setEntryMessage(error?.message || 'Unable to delete that log right now.');
        }
    };

    React.useEffect(() => {
        const handlePointerDown = () => {
            setOpenActionMenuId(null);
        };

        window.addEventListener('pointerdown', handlePointerDown);
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
        };
    }, []);

    return (
        <div className="flex h-screen bg-[var(--ff-sand)] font-sans text-[#f6f2eb]">
            {/* Sidebar Overlay/Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r border-black/5 bg-[rgba(255,255,255,0.92)] transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex items-center justify-between border-b border-black/5 p-6">
                    <button
                        type="button"
                        onClick={navigateHome}
                        aria-label="Go to home page"
                        className="flex items-center gap-3 rounded-sm text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[rgba(255,177,20,0.32)]"
                    >
                        <BrandLogo wrapperClassName="h-12 w-12 overflow-hidden rounded-sm border border-black/5 bg-[var(--ff-accent)] shadow-[0_10px_24px_rgba(255,177,20,0.24)]" />
                        <span className="text-xl font-bold tracking-tight text-[#151515]">FocusFlow</span>
                    </button>
                    <button
                        className="p-2 text-[#6f6f6f] transition-colors hover:text-[#131313] lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <Plus size={20} className="rotate-45" />
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    <NavItem icon={<HomeIcon size={20} />} label="Homepage" onClick={() => { navigate('/'); setIsSidebarOpen(false); }} />
                    <NavItem icon={<Layout size={20} />} label="Activity Log" active />
                    <NavItem
                        icon={<User size={20} />}
                        label="Profile"
                        onClick={() => { setIsProfileModalOpen(true); setIsSidebarOpen(false); }}
                    />
                </nav>

                <div className="space-y-1 border-t border-black/5 p-4">
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

            {/* Main Content */}
            <main className="ff-dashboard-shell flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* Header */}
                <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#141414]/82 px-8 py-4 backdrop-blur-xl">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <button
                            className="rounded-sm border border-white/10 bg-white/5 p-2 text-[#b3b3b3] transition-colors hover:border-[var(--ff-line)] hover:text-[var(--ff-accent)]"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu size={22} />
                        </button>
                        <button
                            type="button"
                            onClick={navigateHome}
                            aria-label="Go to home page"
                            className="mr-4 flex items-center gap-3 rounded-sm text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[rgba(255,177,20,0.28)]"
                        >
                            <BrandLogo wrapperClassName="h-10 w-10 overflow-hidden rounded-sm border border-white/10 bg-[var(--ff-accent)] shadow-[0_10px_20px_rgba(255,177,20,0.24)]" />
                            <span className="text-xl font-bold uppercase tracking-[0.08em] text-[#f6f2eb]">FocusFlow</span>
                        </button>
                        <div className="flex-1 relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7f7f7f] transition-colors group-focus-within:text-[var(--ff-accent)]" size={18} />
                            <input
                                type="text"
                                placeholder="Search log..."
                                className="w-full rounded-sm border border-white/10 bg-white/6 py-2.5 pl-10 pr-4 text-sm text-[#f2ece2] placeholder:text-[#7e7e7e] outline-none transition-all focus:ring-2 focus:ring-[rgba(255,177,20,0.18)]"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                data-lpignore="true"
                                data-1p-ignore="true"
                                data-bwignore="true"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <button className="relative rounded-sm border border-white/10 bg-white/5 p-2 text-[#b3b3b3] transition-colors hover:border-[var(--ff-line)] hover:text-[var(--ff-accent)]">
                                <Bell size={20} />
                                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-[#151515] bg-[var(--ff-accent)]"></span>
                            </button>
                        </div>
                        <button
                            onClick={() => setIsProfileModalOpen(true)}
                            className="flex h-10 w-10 items-center justify-center rounded-sm border border-[var(--ff-line)] bg-[var(--ff-accent)] text-sm font-bold text-[#141414] shadow-[0_0_0_6px_rgba(255,177,20,0.08)] transition-transform hover:scale-105"
                        >
                            {getUserInitials(user)}
                        </button>
                    </div>
                </header>

                {/* Content */}
                <div className="mx-auto flex-1 w-full max-w-7xl space-y-6 overflow-y-auto p-8">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold uppercase tracking-[0.16em] text-[#f4efe7]">Activity Log</h1>
                            <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[#8f8a82]">Track manual entries, focus sessions, and searchable history</p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#d5cebf]">
                            {filteredLogs.length} total records
                        </div>
                    </div>

                    {(entryMessage || logsError) && (
                        <div className="rounded-2xl border border-[var(--ff-line)] bg-[rgba(255,177,20,0.12)] px-4 py-3 text-sm font-medium text-[#f5d083]">
                            {entryMessage || logsError}
                        </div>
                    )}

                    {/* Filter Bar */}
                    <div className="ff-panel-light rounded-[2rem] p-6 text-[#191919]">
                        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-[#181818]">Quick Log Entry</h2>
                                <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[#857a6f]">Add study or sleep records without leaving the dashboard flow</p>
                            </div>
                            <span className="rounded-full border border-black/8 bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#786d61]">
                                Manual logging
                            </span>
                        </div>
                        <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[180px]">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7f756a]">Activity</label>
                            <div className="relative">
                                <select
                                    value={filterActivity}
                                    onChange={(e) => setFilterActivity(e.target.value)}
                                    className="ff-input-light w-full appearance-none rounded-[1rem] py-3 pl-10 pr-9 text-sm transition-all"
                                >
                                    <option>Study</option>
                                    <option>Sleep</option>
                                </select>
                                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ff-accent)]" size={18} />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <ChevronRight className="rotate-90 text-[#8b8277]" size={16} />
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-w-[180px]">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7f756a]">Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                    className="ff-input-light w-full rounded-[1rem] py-3 pl-10 pr-4 text-sm transition-all"
                                    autoComplete="off"
                                    data-lpignore="true"
                                    data-1p-ignore="true"
                                    data-bwignore="true"
                                />
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d6420] pointer-events-none" size={18} />
                            </div>
                        </div>

                        <div className="flex-[0.8] min-w-[160px]">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7f756a]">Duration</label>
                            <div className="flex items-center gap-1.5">
                                <div className="relative flex-1">
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={durationHours}
                                        onChange={(e) => setDurationHours(e.target.value)}
                                        className="ff-input-light w-full rounded-[1rem] py-3 pl-8 pr-10 text-sm transition-all"
                                        min="0"
                                        autoComplete="off"
                                        data-lpignore="true"
                                        data-1p-ignore="true"
                                        data-bwignore="true"
                                    />
                                    <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8d6420] pointer-events-none" size={14} />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase text-[#8b8277] pointer-events-none">hr</span>
                                </div>
                                <span className="font-bold text-[#b8ad9f]">:</span>
                                <div className="relative flex-1">
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={durationMinutes}
                                        onChange={(e) => setDurationMinutes(e.target.value)}
                                        className="ff-input-light w-full rounded-[1rem] py-3 pl-3 pr-10 text-sm transition-all"
                                        min="0"
                                        max="59"
                                        autoComplete="off"
                                        data-lpignore="true"
                                        data-1p-ignore="true"
                                        data-bwignore="true"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase text-[#8b8277] pointer-events-none">min</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleAddEntry}
                            className="ff-button-dark whitespace-nowrap rounded-[1rem] px-8 py-3 text-sm font-bold uppercase tracking-[0.16em] transition-all active:scale-95"
                        >
                            Add Entry
                        </button>
                        </div>
                    </div>

                    <div className="ff-panel-dark space-y-4 rounded-[2rem] p-5">
                        <div className="mb-1 flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-[#f6f2eb]">Search & Filter</h2>
                                <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[#8f8a82]">Slice your log by activity, date, or keywords</p>
                            </div>
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setActivityTypeFilter('all');
                                    setActivityDateFilter('');
                                }}
                                disabled={activeFilterChips.length === 0}
                                className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#d0cbc2] transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Clear Filters
                            </button>
                        </div>

                        <div className="flex flex-wrap items-end gap-4">
                            <div className="min-w-[180px]">
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#8f8a82]">Filter Activity</label>
                                <div className="relative">
                                    <select
                                        value={activityTypeFilter}
                                        onChange={(e) => setActivityTypeFilter(e.target.value)}
                                        className="ff-input-dark w-full appearance-none rounded-[1rem] py-3 pl-10 pr-8 text-sm transition-all"
                                    >
                                        <option value="all">All</option>
                                        <option value="study">Study</option>
                                        <option value="sleep">Sleep</option>
                                        <option value="session">Session</option>
                                    </select>
                                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ff-accent)] pointer-events-none" size={16} />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <ChevronRight className="rotate-90 text-[#8b8277]" size={14} />
                                    </div>
                                </div>
                            </div>

                            <div className="min-w-[180px]">
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#8f8a82]">Filter Date</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={activityDateFilter}
                                        onChange={(e) => setActivityDateFilter(e.target.value)}
                                        className="ff-input-dark w-full rounded-[1rem] py-3 pl-10 pr-4 text-sm transition-all"
                                        autoComplete="off"
                                        data-lpignore="true"
                                        data-1p-ignore="true"
                                        data-bwignore="true"
                                    />
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ff-accent)] pointer-events-none" size={16} />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8c8c8c]">
                                Active Filters
                            </span>
                            {activeFilterChips.length > 0 ? (
                                activeFilterChips.map((chip) => (
                                    <button
                                        key={chip.id}
                                        onClick={chip.onRemove}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ff-line)] bg-[rgba(255,177,20,0.12)] px-3 py-1.5 text-xs font-semibold text-[var(--ff-accent)] transition-colors hover:bg-[rgba(255,177,20,0.18)]"
                                    >
                                        {chip.label}
                                        <Plus size={12} className="rotate-45" />
                                    </button>
                                ))
                            ) : (
                                <span className="text-xs text-[#8c8c8c]">None</span>
                            )}
                        </div>
                    </div>

                    {/* Table Container */}
                    <div className="ff-panel-dark overflow-hidden rounded-[2rem]">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-[#1d1d1d] px-6 py-4">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[#f6f2eb]">Recorded Timeline</h2>
                                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8f8a82]">Editable notes, sessions, and history</p>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d0cbc2]">
                                {paginationRangeText}
                            </span>
                        </div>
                        <div className="overflow-x-auto overflow-y-auto max-h-[640px]">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-20 bg-[#1f1f1f] shadow-[0_1px_0_0_rgba(255,255,255,0.08)]">
                                    <tr className="border-b border-white/8">
                                        <th className="bg-[#1f1f1f] px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#8c8c8c]">Date</th>
                                        <th className="bg-[#1f1f1f] px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#8c8c8c]">Activity</th>
                                        <th className="bg-[#1f1f1f] px-6 py-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#8c8c8c]">Start Time</th>
                                        <th className="bg-[#1f1f1f] px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#8c8c8c]">Duration</th>
                                        <th className="bg-[#1f1f1f] px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#8c8c8c]">Notes</th>
                                        <th className="bg-[#1f1f1f] px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#8c8c8c]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/6">
                                    {paginatedLogs.length > 0 ? (
                                        paginatedLogs.map((item) => (
                                            <tr key={getLogKey(item)} className="group transition-colors hover:bg-white/4">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-1.5 rounded-full bg-[var(--ff-accent)]"></div>
                                                        <span className="text-sm font-medium text-[#d4cdc2]">{formatDateDisplay(item.timestamp)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${getColorForType(item.typeId)}`}>
                                                            {getIconForType(item.typeId)}
                                                        </div>
                                                        <span className="text-sm font-bold text-[#f5f1e7]">
                                                            {isSessionSource(item.source)
                                                                ? (String(item.sessionName || item.notes || '').trim() || `Session ${item.sessionNumber || 1}`)
                                                                : getTypeLabel(item.typeId)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span className="text-sm text-[#b4b4b4]">{formatTimeDisplay(item.timestamp)}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {isSessionSource(item.source) ? (
                                                        <div className="text-sm leading-5 text-[#b4b4b4]">
                                                            <p>Focus {formatSecondsToCompactLabel(item.durationSecs)}</p>
                                                            <p>Distracted {formatSecondsToCompactLabel(item.distractedSecs)}</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-[#b4b4b4]">{formatSecondsToHoursAndMinutes(item.durationSecs)}</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 min-w-[200px]">
                                                    {editingNoteId === getLogKey(item) ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                value={tempNote}
                                                                onChange={(e) => setTempNote(e.target.value)}
                                                                onKeyDown={(e) => e.key === 'Enter' && saveNote(item)}
                                                                onBlur={() => saveNote(item)}
                                                                className="w-full rounded-sm border border-[var(--ff-line)] bg-white/7 px-3 py-1.5 text-sm text-[#f6f2eb] outline-none focus:ring-1 focus:ring-[var(--ff-accent)]"
                                                                autoComplete="off"
                                                                autoCorrect="off"
                                                                autoCapitalize="sentences"
                                                                spellCheck={false}
                                                                data-lpignore="true"
                                                                data-1p-ignore="true"
                                                                data-bwignore="true"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div
                                                            onClick={() => startEditingNote(item)}
                                                            className="inline-block max-w-xs cursor-text truncate rounded-[0.9rem] border border-white/8 bg-white/6 px-3 py-2 transition-colors hover:border-[var(--ff-line)]"
                                                        >
                                                            {getDisplayNote(item) ? (
                                                                <span className="text-sm text-[#d7d0c5]">{getDisplayNote(item)}</span>
                                                            ) : (
                                                                <span className="text-sm italic text-[#878787]">Add a note...</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="relative flex items-center justify-end opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setOpenActionMenuId((current) => (
                                                                    current === getLogKey(item) ? null : getLogKey(item)
                                                                ));
                                                            }}
                                                            className="rounded-full p-2 text-[#979797] transition-colors hover:bg-white/8 hover:text-[#f6f2eb]"
                                                        >
                                                            <Ellipsis size={18} />
                                                        </button>
                                                        {openActionMenuId === getLogKey(item) ? (
                                                            <div
                                                                className="absolute right-0 top-11 z-30 min-w-[160px] overflow-hidden rounded-[1rem] border border-white/10 bg-[#232323] shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
                                                                onPointerDown={(event) => event.stopPropagation()}
                                                            >
                                                                {isSessionSource(item.source) ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => startRenamingSession(item)}
                                                                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-[#f1ebe0] transition-colors hover:bg-white/8"
                                                                    >
                                                                        <Edit2 size={15} />
                                                                        Rename
                                                                    </button>
                                                                ) : null}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startEditingNote(item)}
                                                                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-[#f1ebe0] transition-colors hover:bg-white/8"
                                                                >
                                                                    <Edit2 size={15} />
                                                                    Edit Note
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        void deleteLogEntry(item);
                                                                    }}
                                                                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-[#ffb5a0] transition-colors hover:bg-[rgba(255,106,0,0.12)]"
                                                                >
                                                                    <Trash2 size={15} />
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-12 text-center">
                                                <div className="mx-auto max-w-sm rounded-[1.6rem] border border-dashed border-white/10 bg-white/5 px-6 py-8">
                                                    <p className="text-sm font-medium text-[#d0c8bc]">No activities match the selected filters.</p>
                                                    <p className="mt-1 text-xs text-[#8a8a8a]">Try clearing filters to see more logs.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 bg-[#1d1d1d] px-6 py-4">
                            <p className="text-sm text-[#a9a9a9]">{paginationRangeText}</p>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage((prevPage) => Math.max(1, prevPage - 1))}
                                    disabled={currentPage === 1}
                                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-sm text-[#d3cec4] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft size={14} />
                                    Prev
                                </button>

                                {getVisiblePageNumbers(currentPage, totalPages).map((pageNumber, index) => (
                                    typeof pageNumber === 'number' ? (
                                        <button
                                            key={pageNumber}
                                            onClick={() => setCurrentPage(pageNumber)}
                                            className={`h-8 w-8 rounded-full text-sm font-semibold transition-colors ${pageNumber === currentPage
                                                ? 'bg-[var(--ff-accent)] text-[#111111]'
                                                : 'text-[#d0cbc2] hover:bg-white/6'
                                                }`}
                                        >
                                            {pageNumber}
                                        </button>
                                    ) : (
                                        <span key={`${pageNumber}-${index}`} className="px-1 text-sm text-[#787878]">...</span>
                                    )
                                ))}

                                <button
                                    onClick={() => setCurrentPage((prevPage) => Math.min(totalPages, prevPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-sm text-[#d3cec4] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Next
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Profile Modal */}
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                user={user}
                onLogout={handleLogout}
            />
        </div>
    );
}

function NavItem({ icon, label, active, onClick, className = "" }) {
    return (
        <button
            onClick={onClick}
            className={`group flex w-full items-center rounded-sm p-3 transition-all ${active
                ? 'bg-[var(--ff-accent)] text-[#111111] shadow-[0_14px_28px_rgba(255,177,20,0.2)]'
                : 'text-[#5d5d5d] hover:bg-[rgba(255,177,20,0.08)] hover:text-[#111111]'
                } ${className}`}
        >
            <span className={`mr-3 transition-colors ${active ? 'text-[#111111]' : 'text-[#747474] group-hover:text-[#111111]'}`}>
                {icon}
            </span>
            <span className="font-medium text-sm">{label}</span>
            {active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#111111]" />}
        </button>
    );
}
