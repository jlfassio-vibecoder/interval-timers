import { useState, useEffect } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { buildAuthRedirectUrl } from './useAuthRedirect';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  supabase: SupabaseClient;
  redirectBaseUrl: string;
  defaultSignUp?: boolean;
  fromAppId?: string;
  returnUrl?: string;
  /** If provided and returns a string, use that instead of redirectBaseUrl + ?from=. Used for role-based redirect (e.g. trainer → /trainer). */
  getRedirectUrl?: (user: User) => string | Promise<string | null>;
}

function normalizeAuthError(msg: string): string {
  if (
    msg.includes('Invalid login') ||
    msg.includes('Invalid login credentials') ||
    msg.includes('invalid_grant')
  ) {
    return 'Wrong email or password.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'Please confirm your email using the link we sent.';
  }
  if (msg.includes('Too many requests')) {
    return 'Too many attempts. Please try again later.';
  }
  return msg;
}

export default function AuthModal({
  isOpen,
  onClose,
  supabase,
  redirectBaseUrl,
  defaultSignUp = false,
  fromAppId,
  returnUrl,
  getRedirectUrl,
}: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(defaultSignUp);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSignUp(defaultSignUp);
      setError(null);
      setSignUpSuccess(false);
    }
  }, [isOpen, defaultSignUp]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setError(null);
    setSignUpSuccess(false);
  };

  const handleRedirect = async (user: User) => {
    if (getRedirectUrl) {
      const customUrl = await getRedirectUrl(user);
      if (customUrl) {
        onClose();
        clearForm();
        window.location.href = customUrl;
        return;
      }
    }
    const url = buildAuthRedirectUrl(redirectBaseUrl, {
      fromAppId,
      returnUrl,
    });
    onClose();
    clearForm();
    window.location.href = url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role: 'client' },
          },
        });
        if (err) throw err;
        setSignUpSuccess(true);
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
        if (data.user) {
          await handleRedirect(data.user);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(normalizeAuthError(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    clearForm();
    onClose();
  };

  if (!isOpen) return null;

  if (signUpSuccess) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0500] p-6">
          <h2 id="auth-modal-title" className="mb-4 text-xl font-bold text-white">
            Check your email
          </h2>
          <p className="mb-6 text-sm text-white/70">
            We sent you a confirmation link. Click it to activate your account.
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 font-bold text-white hover:bg-orange-500"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0500] p-6">
        <h2 id="auth-modal-title" className="mb-4 text-xl font-bold text-white">
          {isSignUp ? 'Create account' : 'Log in'}
        </h2>
        <p className="mb-4 text-sm text-white/70">
          {isSignUp
            ? 'Create an account to unlock features across your apps.'
            : 'Log in to access your account and workouts.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignUp && (
            <input
              type="text"
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white placeholder:text-white/50 focus:border-orange-500 focus:outline-none"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white placeholder:text-white/50 focus:border-orange-500 focus:outline-none"
          />
          <div className="space-y-1">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 pr-24 text-white placeholder:text-white/50 focus:border-orange-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-white/60 hover:text-white"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {isSignUp && (
              <p className="text-xs text-white/50">At least 6 characters</p>
            )}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 font-bold text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Log in'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-4 w-full text-sm text-white/60 hover:text-white"
        >
          {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Create one"}
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="mt-2 w-full text-sm text-white/50 hover:text-white/80"
        >
          Close
        </button>
      </div>
    </div>
  );
}
