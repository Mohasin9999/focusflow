import { BarChart2, Bell, BookOpen, Clock, Moon, Sparkles, Target } from 'lucide-react';
import BrandLogo from './BrandLogo';

function MetricPill({ value, label, accent = false }) {
    return (
        <div className={`rounded-[1.35rem] border px-4 py-3 ${accent
            ? 'border-[rgba(255,177,20,0.24)] bg-[rgba(255,177,20,0.1)] text-[#181818]'
            : 'border-black/6 bg-white/75 text-[#1a1a1a]'
            }`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b8378]">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${accent ? 'text-[#111111]' : 'text-[#202020]'}`}>{value}</p>
        </div>
    );
}

function InsightRow({ icon, label, value, accent = false }) {
    return (
        <div className={`flex items-center justify-between rounded-[1.2rem] border px-4 py-3 ${accent
            ? 'border-[rgba(255,177,20,0.22)] bg-[rgba(255,177,20,0.08)]'
            : 'border-black/6 bg-white/70'
            }`}>
            <span className="inline-flex items-center gap-3 text-sm font-medium text-[#4f4a43]">
                <span className={`${accent ? 'text-[var(--ff-accent-deep)]' : 'text-[#7f7668]'}`}>
                    {icon}
                </span>
                {label}
            </span>
            <span className="text-sm font-bold text-[#181818]">{value}</span>
        </div>
    );
}

function MiniNav() {
    const items = [
        { icon: <Target size={18} />, active: true },
        { icon: <Clock size={18} />, badge: '1' },
        { icon: <BarChart2 size={18} /> },
        { icon: <Moon size={18} /> },
        { icon: <Bell size={18} /> },
    ];

    return (
        <div className="flex gap-3">
            {items.map((item, index) => (
                <div
                    key={index}
                    className={`relative flex h-16 w-16 items-center justify-center rounded-sm border transition-colors ${item.active
                        ? 'border-[rgba(255,177,20,0.22)] bg-[var(--ff-accent)] text-[#121212] shadow-[0_12px_24px_rgba(255,177,20,0.2)]'
                        : 'border-black/6 bg-white/70 text-[#1c1c1c]'
                        }`}
                >
                    {item.icon}
                    {item.badge ? (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#171717] text-[10px] font-bold text-[#f8f3ea]">
                            {item.badge}
                        </span>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

export default function AuthShell({
    eyebrow,
    title,
    description,
    panelTitle,
    panelDescription,
    footer,
    children,
}) {
    return (
        <div className="min-h-screen bg-[var(--ff-sand)] p-4 font-sans text-[#191919]">
            <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl items-center gap-8 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="relative hidden min-h-[780px] overflow-hidden rounded-[3rem] border border-black/8 bg-[linear-gradient(135deg,#f7f3ec_0%,#f3ece2_48%,#eadfcd_100%)] p-8 shadow-[0_40px_70px_rgba(52,42,29,0.12)] xl:block">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,177,20,0.18),transparent_24%),linear-gradient(180deg,transparent,rgba(255,255,255,0.24))]"></div>

                    <div className="relative z-10 flex items-start justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <BrandLogo wrapperClassName="h-16 w-16 overflow-hidden rounded-sm border border-black/5 bg-[var(--ff-accent)] shadow-[0_14px_30px_rgba(255,177,20,0.24)]" />
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8e8579]">Workspace</p>
                                <p className="text-2xl font-bold tracking-tight text-[#151515]">FocusFlow Personal Rhythm</p>
                            </div>
                        </div>
                        <MiniNav />
                    </div>

                    <div className="relative z-10 mt-16 max-w-[520px]">
                        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#8c8379]">{eyebrow}</p>
                        <h1 className="mt-6 text-[5rem] font-bold leading-[0.9] tracking-[-0.06em] text-[#151515]">
                            {title}
                        </h1>
                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,177,20,0.24)] bg-[rgba(255,177,20,0.14)] px-4 py-2 text-lg font-semibold text-[#171717] shadow-[0_10px_24px_rgba(255,177,20,0.12)]">
                                <span className="h-7 w-7 rounded-full border border-[var(--ff-line)] bg-[rgba(255,177,20,0.12)]"></span>
                                74% Focus
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/78 px-4 py-2 text-base font-semibold text-[#2a241f] shadow-[0_10px_20px_rgba(40,33,23,0.06)]">
                                <Clock size={17} className="text-[#8d6420]" />
                                8 Sessions
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/78 px-4 py-2 text-base font-semibold text-[#2a241f] shadow-[0_10px_20px_rgba(40,33,23,0.06)]">
                                <Bell size={17} className="text-[#8d6420]" />
                                2 Alerts
                            </span>
                        </div>
                        <p className="mt-8 max-w-md rounded-[1.6rem] border border-black/6 bg-white/72 px-5 py-4 text-lg leading-8 text-[#332f2a] shadow-[0_18px_32px_rgba(40,33,23,0.06)]">
                            {description}
                        </p>
                    </div>

                    <div className="relative z-10 mt-12 grid grid-cols-[minmax(0,1.05fr)_minmax(320px,0.78fr)] gap-6 items-end">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-[2rem] border border-black/6 bg-white/80 p-5">
                                <div className="flex items-center justify-between">
                                    <p className="text-2xl font-bold text-[#171717]">Today</p>
                                    <span className="text-[#8c8378]">⌃</span>
                                </div>
                                <div className="mt-8 space-y-3">
                                    <InsightRow
                                        icon={<Clock size={18} />}
                                        label="Deep focus"
                                        value="3h 20m"
                                        accent
                                    />
                                    <InsightRow
                                        icon={<Moon size={18} />}
                                        label="Sleep tracked"
                                        value="7h 42m"
                                    />
                                </div>
                            </div>

                            <div className="rounded-[2rem] border border-black/6 bg-white/80 p-5">
                                <div className="flex items-center justify-between">
                                    <p className="text-2xl font-bold text-[#171717]">Insights</p>
                                    <span className="text-[#8c8378]">⌃</span>
                                </div>
                                <div className="mt-8 space-y-3">
                                    <InsightRow
                                        icon={<BookOpen size={18} />}
                                        label="Study blocks"
                                        value="6 logged"
                                    />
                                    <InsightRow
                                        icon={<Sparkles size={18} />}
                                        label="Coach signal"
                                        value="Momentum up"
                                        accent
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="ff-panel-dark relative self-stretch overflow-hidden rounded-[2.2rem] p-7 text-[#f7f3ea]">
                            <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent,rgba(255,255,255,0.03))]"></div>
                            <div className="relative z-10">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-2xl font-bold">{panelTitle}</p>
                                        <p className="mt-2 text-sm leading-6 text-[#9f9a90]">{panelDescription}</p>
                                    </div>
                                    <span className="rounded-full border border-[var(--ff-line)] bg-[rgba(255,177,20,0.08)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ff-accent)]">
                                        Live
                                    </span>
                                </div>

                                <div className="mt-8 grid grid-cols-2 gap-3">
                                    <MetricPill value="12.4h" label="Focus Time" accent />
                                    <MetricPill value="5 Days" label="Streak" />
                                </div>

                                <div className="mt-8 space-y-4">
                                    <div>
                                        <div className="mb-2 flex items-center justify-between text-sm text-[#9f998f]">
                                            <span>Weekly target</span>
                                            <span className="text-[var(--ff-accent)]">74%</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-white/8">
                                            <div className="h-full w-[74%] rounded-full bg-gradient-to-r from-[var(--ff-accent)] to-[var(--ff-accent-deep)]"></div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="mb-2 flex items-center justify-between text-sm text-[#9f998f]">
                                            <span>Sleep balance</span>
                                            <span className="text-[#f7d178]">82%</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-white/8">
                                            <div className="h-full w-[82%] rounded-full bg-[linear-gradient(90deg,rgba(255,210,102,0.88),rgba(255,177,20,0.78))]"></div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-7 items-end gap-2 pt-2">
                                        {[28, 34, 26, 48, 38, 44, 62].map((height, index) => (
                                            <div
                                                key={index}
                                                className="rounded-full"
                                                style={{
                                                    height: `${height}px`,
                                                    background: index >= 4
                                                        ? 'linear-gradient(180deg, #ffb114, #ff6a00)'
                                                        : 'rgba(255,177,20,0.42)',
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7d776e]">
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                                            <span key={day}>{day}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="w-full max-w-lg xl:ml-auto">
                    {children}
                    {footer ? (
                        <p className="mt-4 text-center text-xs uppercase tracking-[0.22em] text-[#756d62]">
                            {footer}
                        </p>
                    ) : null}
                </section>
            </div>
        </div>
    );
}
