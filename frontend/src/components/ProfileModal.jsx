import { Mail, Power, Plus, UserRound } from 'lucide-react';
import { getUserInitials } from '../utils/userProfile';

export default function ProfileModal({ isOpen, onClose, user, onLogout }) {
    if (!isOpen) return null;

    const profileInitials = getUserInitials(user, 'FF');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="ff-panel-dark relative w-full max-w-sm overflow-hidden rounded-[2rem] shadow-[0_34px_90px_rgba(0,0,0,0.34)] transition-all duration-200 animate-in fade-in zoom-in">
                <div className="relative h-36 bg-[linear-gradient(135deg,#171717,#2c2c2c)]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,177,20,0.18),transparent_28%)]"></div>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 rounded-sm bg-white/10 p-2 text-[#f6f2eb] transition-colors hover:bg-white/20"
                    >
                        <Plus size={20} className="rotate-45" />
                    </button>
                    <div className="absolute left-6 top-6">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#948e84]">Profile</p>
                        <p className="mt-2 text-lg font-bold text-[#f6f2eb]">Account Overview</p>
                    </div>
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                        <div className="h-24 w-24 rounded-[1.6rem] bg-[var(--ff-accent)] p-1 shadow-[0_18px_40px_rgba(255,177,20,0.28)]">
                            <div className="flex h-full w-full items-center justify-center rounded-[1.4rem] bg-[#1a1a1a] text-2xl font-bold tracking-[0.08em] text-[var(--ff-accent)]">
                                {profileInitials}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-16 pb-8 px-8 text-center">
                    <h3 className="mb-1 text-2xl font-bold text-[#f6f2eb]">{user?.fullName || 'User'}</h3>
                    <p className="mb-6 text-sm font-medium text-[var(--ff-accent)]">{user?.email || '--'}</p>

                    <div className="mb-8 space-y-3 text-left">
                        <ProfileInfoRow
                            icon={<UserRound size={16} />}
                            label="Age"
                            value={user?.age || '--'}
                        />
                        <ProfileInfoRow
                            icon={<Mail size={16} />}
                            label="Email"
                            value={user?.email || '--'}
                        />
                        <ProfileInfoRow
                            icon={<UserRound size={16} />}
                            label="Occupation"
                            value={user?.occupation || '--'}
                            truncate
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-left">
                            <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-[#8f8f8f]">Status</p>
                            <p className="text-lg font-bold text-[#f5f1e7]">Active</p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-left">
                            <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-[#8f8f8f]">Workspace</p>
                            <p className="text-lg font-bold text-[#f5f1e7]">FocusFlow</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={onLogout}
                            className="group ff-button-accent flex w-full items-center justify-center gap-2 rounded-[1rem] py-3.5 text-sm font-bold transition-all"
                        >
                            <Power size={18} className="transition-colors group-hover:text-[#3a2400]" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ProfileInfoRow({ icon, label, value, truncate = false }) {
    return (
        <div className="flex items-center gap-3 rounded-[1.2rem] border border-white/8 bg-white/5 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[0.9rem] bg-[rgba(255,177,20,0.12)] text-[var(--ff-accent)]">
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8f8f8f]">{label}</p>
                <p className={`mt-1 text-sm font-bold text-[#f5f1e7] ${truncate ? 'truncate' : ''}`} title={truncate ? value : undefined}>
                    {value}
                </p>
            </div>
        </div>
    );
}
