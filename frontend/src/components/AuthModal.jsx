import React from 'react';
import { ArrowRight, ShieldCheck, X } from 'lucide-react';
import AuthCard from './AuthCard';

export default function AuthModal({
    isOpen,
    mode = 'signin',
    intent = 'general',
    onModeChange,
    onClose,
    onSuccess,
}) {
    React.useEffect(() => {
        if (!isOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const heading = intent === 'focus'
        ? 'Sign in to start your focus session'
        : intent === 'materials'
            ? 'Sign in to upload study materials'
            : 'Sign in to unlock your workspace';

    const description = intent === 'focus'
        ? 'Your focus timer, session history, and weekly momentum are tied to your account, so we will take you there right after you log in.'
        : intent === 'materials'
            ? 'Your study files are stored with your workspace, so we will open the materials manager as soon as you log in.'
            : 'Open your dashboard, track your sessions, and keep everything synced in one place.';

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(12,12,12,0.62)] p-4 backdrop-blur-md"
            onClick={onClose}
        >
            <div
                className="grid w-full max-w-6xl overflow-hidden rounded-[2.6rem] border border-white/10 bg-[var(--ff-paper)] shadow-[0_40px_100px_rgba(0,0,0,0.36)] lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]"
                onClick={(event) => event.stopPropagation()}
            >
                <section className="ff-panel-dark relative hidden p-8 text-[#f7f3ea] lg:flex lg:flex-col">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,177,20,0.18),transparent_30%),linear-gradient(180deg,transparent,rgba(255,255,255,0.02))]"></div>
                    <div className="relative z-10 flex h-full flex-col">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(255,177,20,0.24)] bg-[rgba(255,177,20,0.08)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#f3d39c]">
                            <ShieldCheck size={14} />
                            Secure Access
                        </div>
                        <h2 className="mt-8 max-w-sm text-4xl font-bold leading-tight">{heading}</h2>
                        <p className="mt-5 max-w-md text-base leading-7 text-[#b7b0a5]">
                            {description}
                        </p>

                        <div className="mt-10 space-y-4">
                            <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-5">
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8f887d]">What unlocks</p>
                                <ul className="mt-4 space-y-3 text-sm text-[#ece6db]">
                                    <li className="flex items-center justify-between">
                                        <span>Focus timer</span>
                                        <ArrowRight size={15} className="text-[var(--ff-accent)]" />
                                    </li>
                                    <li className="flex items-center justify-between">
                                        <span>Activity history</span>
                                        <ArrowRight size={15} className="text-[var(--ff-accent)]" />
                                    </li>
                                    <li className="flex items-center justify-between">
                                        <span>Weekly progress</span>
                                        <ArrowRight size={15} className="text-[var(--ff-accent)]" />
                                    </li>
                                </ul>
                            </div>

                            <div className="rounded-[1.6rem] border border-[rgba(255,177,20,0.18)] bg-[linear-gradient(135deg,rgba(255,177,20,0.16),rgba(255,198,65,0.1))] p-5 text-sm text-[#221c16]">
                                <p className="font-semibold uppercase tracking-[0.18em] text-[#8d6420]">Flow</p>
                                <p className="mt-3 leading-6 text-[#f3e9d8]">
                                    {mode === 'signin'
                                        ? 'New here? Create your account from this same popup without leaving the home page.'
                                        : 'Already have an account? Switch back to sign in without losing the popup flow.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="relative p-3 sm:p-4">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close authentication popup"
                        className="absolute right-4 top-4 z-10 rounded-full border border-black/8 bg-white/82 p-2 text-[#171717] shadow-[0_10px_24px_rgba(42,32,20,0.08)] transition-colors hover:bg-white"
                    >
                        <X size={18} />
                    </button>

                    <AuthCard
                        mode={mode}
                        variant="modal"
                        onSwitchMode={onModeChange}
                        onSuccess={onSuccess}
                    />
                </section>
            </div>
        </div>
    );
}
