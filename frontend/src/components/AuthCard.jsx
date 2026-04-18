import React, { useEffect, useRef, useState } from 'react';
import { AtSign, Briefcase, Calendar, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { signInWithSupabase, signUpWithSupabase } from '../utils/supabaseAuth';

function AuthMessage({ message }) {
    if (!message.text) return null;

    const toneClass = message.type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-[#ffd1ba] bg-[#fff1e8] text-[#a34b1d]';

    return (
        <div className={`rounded-[1.15rem] border px-4 py-3 text-sm font-medium ${toneClass}`}>
            {message.text}
        </div>
    );
}

function AuthField({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    icon,
    rightSlot = null,
    autoComplete,
    name,
    id,
    min,
    max,
}) {
    return (
        <label className="block">
            <span className="mb-2 block text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[#736a60]">
                {label}
            </span>
            <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#8d8478] transition-colors group-focus-within:text-[var(--ff-accent)]">
                    {icon}
                </div>
                <input
                    type={type}
                    id={id}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    autoCorrect="off"
                    autoCapitalize={type === 'email' || type === 'password' ? 'none' : 'words'}
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    min={min}
                    max={max}
                    required
                    className="ff-input-light block w-full rounded-[1.15rem] py-3 pl-12 pr-12 text-[0.97rem] transition-all"
                />
                {rightSlot ? (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                        {rightSlot}
                    </div>
                ) : null}
            </div>
        </label>
    );
}

function SocialButton({ children }) {
    return (
        <button
            type="button"
            className="ff-chip-light flex items-center justify-center rounded-[1rem] px-4 py-3 text-sm font-medium transition-all hover:-translate-y-0.5 hover:bg-white"
        >
            {children}
        </button>
    );
}

export default function AuthCard({
    mode = 'signin',
    onSwitchMode,
    onSuccess,
    variant = 'page',
}) {
    const isSignIn = mode === 'signin';
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [formData, setFormData] = useState({
        fullName: '',
        age: '',
        occupation: '',
        email: '',
        password: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const successTimeoutRef = useRef(null);

    useEffect(() => {
        setMessage({ type: '', text: '' });
    }, [mode]);

    useEffect(() => {
        return () => {
            if (successTimeoutRef.current) {
                window.clearTimeout(successTimeoutRef.current);
            }
        };
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const finishSuccess = (safeUser, nextMode) => {
        if (!onSuccess) return;
        successTimeoutRef.current = window.setTimeout(() => {
            onSuccess(safeUser, nextMode);
        }, nextMode === 'signin' ? 1000 : 1200);
    };

    const handleSignIn = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const { user: safeUser } = await signInWithSupabase({ email, password });
            setMessage({ type: 'success', text: 'Login successful! Redirecting...' });
            finishSuccess(safeUser, 'signin');
        } catch (error) {
            console.error('Login error:', error);
            setMessage({ type: 'error', text: error.message || 'Could not connect to Supabase.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ type: '', text: '' });
        const ageNumber = Number(formData.age);

        if (Number.isNaN(ageNumber) || ageNumber < 10 || ageNumber > 100) {
            setMessage({ type: 'error', text: 'Age must be between 10 and 100.' });
            setIsLoading(false);
            return;
        }

        if (!agreedToTerms) {
            setMessage({ type: 'error', text: 'You must agree to the Terms & Conditions.' });
            setIsLoading(false);
            return;
        }

        try {
            const { user: safeUser, requiresEmailConfirmation } = await signUpWithSupabase(formData);

            if (requiresEmailConfirmation) {
                setMessage({ type: 'success', text: 'Account created. Please confirm your email, then sign in.' });
                successTimeoutRef.current = window.setTimeout(() => {
                    onSwitchMode?.('signin');
                }, 1400);
            } else {
                setMessage({ type: 'success', text: 'Account created successfully!' });
                finishSuccess(safeUser, 'signup');
            }
        } catch (error) {
            console.error('Registration error:', error);
            setMessage({ type: 'error', text: error.message || 'Could not connect to Supabase.' });
        } finally {
            setIsLoading(false);
        }
    };

    const content = isSignIn
        ? {
            eyebrow: 'FocusFlow Access',
            heading: 'Welcome back',
            description: 'Sign in to continue your sessions, habits, and progress inside a cleaner premium workspace.',
            submitLabel: isLoading ? 'Signing In...' : 'Sign In',
            switchPrompt: "Don't have an account?",
            switchLabel: 'Create one',
        }
        : {
            eyebrow: 'FocusFlow Access',
            heading: 'Create account',
            description: 'Build your profile and start tracking focus, study, sleep, and weekly progress in one premium workspace.',
            submitLabel: isLoading ? 'Creating Account...' : 'Create Account',
            switchPrompt: 'Already have an account?',
            switchLabel: 'Sign in',
        };

    const cardClassName = variant === 'modal'
        ? 'ff-panel-light max-h-[85vh] overflow-y-auto rounded-[2.1rem] p-6 shadow-none sm:p-8'
        : 'ff-panel-light rounded-[2.6rem] p-8 shadow-[0_32px_70px_rgba(47,39,27,0.15)]';

    return (
        <div className={cardClassName}>
            <div className="mb-8 text-center">
                <BrandLogo wrapperClassName="mx-auto mb-4 h-16 w-16 overflow-hidden rounded-sm border border-black/5 bg-[var(--ff-accent)] shadow-[0_14px_30px_rgba(255,177,20,0.22)]" />
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.26em] text-[#857b70]">{content.eyebrow}</p>
                <h2 className="mt-3 text-4xl font-bold tracking-[-0.05em] text-[#161616]">{content.heading}</h2>
                <p className="mt-2 text-sm leading-6 text-[#6b645a]">
                    {content.description}
                </p>
            </div>

            {isSignIn ? (
                <form
                    onSubmit={handleSignIn}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    className="space-y-5"
                >
                    <AuthMessage message={message} />

                    <AuthField
                        label="Email"
                        type="email"
                        id="signin-email"
                        name="signin_email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        autoComplete="off"
                        icon={<AtSign size={18} />}
                    />

                    <AuthField
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        id="signin-password"
                        name="signin_password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        autoComplete="off"
                        icon={<Lock size={18} />}
                        rightSlot={(
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="text-[#8a8176] transition-colors hover:text-[#181818]"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        )}
                    />

                    <div className="flex items-center justify-between gap-3 pt-1">
                        <label className="flex items-center gap-3 text-sm text-[#625b51]">
                            <input
                                id="remember-me"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 cursor-pointer rounded border-gray-300 text-[var(--ff-accent)] focus:ring-[var(--ff-accent)]"
                            />
                            <span>Remember me</span>
                        </label>
                        <a href="#" className="text-sm font-semibold text-[#8d6420] transition-colors hover:text-[#171717]">
                            Forgot password?
                        </a>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`ff-button-dark flex w-full items-center justify-center rounded-[1.15rem] px-4 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[rgba(255,177,20,0.2)] ${isLoading ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                        {content.submitLabel}
                    </button>
                </form>
            ) : (
                <form
                    onSubmit={handleSignUp}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    className="space-y-5"
                >
                    <AuthMessage message={message} />

                    <AuthField
                        label="Full Name"
                        id="signup-full-name"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        placeholder="John Doe"
                        autoComplete="off"
                        icon={<User size={18} />}
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <AuthField
                            label="Age"
                            type="number"
                            id="signup-age"
                            name="age"
                            value={formData.age}
                            onChange={handleChange}
                            placeholder="25"
                            autoComplete="off"
                            min="10"
                            max="100"
                            icon={<Calendar size={18} />}
                        />

                        <AuthField
                            label="Occupation"
                            id="signup-occupation"
                            name="occupation"
                            value={formData.occupation}
                            onChange={handleChange}
                            placeholder="Developer"
                            autoComplete="off"
                            icon={<Briefcase size={18} />}
                        />
                    </div>

                    <AuthField
                        label="Email"
                        type="email"
                        id="signup-email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="john.doe@example.com"
                        autoComplete="off"
                        icon={<Mail size={18} />}
                    />

                    <AuthField
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        id="signup-password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Create a strong password"
                        autoComplete="off"
                        icon={<Lock size={18} />}
                        rightSlot={(
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="text-[#8a8176] transition-colors hover:text-[#181818]"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        )}
                    />

                    <label className="flex items-start gap-3 rounded-[1.15rem] border border-black/8 bg-white/48 px-4 py-3 text-sm text-[#625b51]">
                        <input
                            id="terms"
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-[var(--ff-accent)] focus:ring-[var(--ff-accent)]"
                            required
                        />
                        <span>
                            I agree to the{' '}
                            <a href="#" className="font-bold text-[#8d6420] transition-colors hover:text-[#181818]">
                                Terms & Conditions
                            </a>
                        </span>
                    </label>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`ff-button-dark flex w-full items-center justify-center rounded-[1.15rem] px-4 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[rgba(255,177,20,0.2)] ${isLoading ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                        {content.submitLabel}
                    </button>
                </form>
            )}

            <div className="relative my-7">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-black/8"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="bg-[var(--ff-paper)] px-3 text-[#867c71]">or continue with</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <SocialButton>
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="mr-2 h-5 w-5" alt="Google" />
                    Google
                </SocialButton>
                <SocialButton>
                    <svg className="mr-2 h-5 w-5 text-black" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.07-.52-2.06-.52-3.23 0-1.12.5-2.03.62-3.15-.34C6 19.06 4.3 16.5 4.3 12.87c0-3.3 2.1-5.18 4.34-5.18 1.13 0 2 .5 2.65.5.64 0 1.63-.52 2.92-.52 1.94 0 3.38 1.05 4.18 2.27-3.4 1.77-2.67 6.42.75 7.9-1.32 2.66-2.5 4.86-2.09 2.44zm-4.74-12.7c-1.33 1.6-3.5 1.4-4.57 1.4.33-2.6 2.5-4.4 4.54-4.4.17 1.57.17 2.2 0 3z" />
                    </svg>
                    Apple
                </SocialButton>
            </div>

            <div className="mt-8 text-center text-sm text-[#6f675d]">
                {content.switchPrompt}{' '}
                <button
                    type="button"
                    onClick={() => onSwitchMode?.(isSignIn ? 'signup' : 'signin')}
                    className="font-bold text-[#8d6420] transition-colors hover:text-[#181818]"
                >
                    {content.switchLabel}
                </button>
            </div>
        </div>
    );
}
