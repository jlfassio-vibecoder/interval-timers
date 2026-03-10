import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSignUp?: boolean;
}

export default function AuthModal({
  isOpen,
  onClose,
  defaultSignUp = false,
}: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(defaultSignUp);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsSignUp(defaultSignUp);
      setError(null);
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

  const redirectAfterAuth = () => {
    const url =
      import.meta.env.VITE_ACCOUNT_REDIRECT_URL ??
      import.meta.env.VITE_HUD_REDIRECT_URL ??
      '/account';
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
        onClose();
        setEmail('');
        setPassword('');
        setFullName('');
        alert('Check your email for the confirmation link!');
        redirectAfterAuth();
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onClose();
        setEmail('');
        setPassword('');
        redirectAfterAuth();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.includes('Invalid login') || msg.includes('invalid_grant')
          ? 'Wrong email or password.'
          : msg.includes('Email not confirmed')
            ? 'Please confirm your email using the link we sent.'
            : msg
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
            ? 'Create an account to schedule further out and track your AMRAP sessions.'
            : 'Log in to access extended scheduling and workout tracking.'}
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
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white placeholder:text-white/50 focus:border-orange-500 focus:outline-none"
          />
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
          onClick={onClose}
          className="mt-2 w-full text-sm text-white/50 hover:text-white/80"
        >
          Close
        </button>
      </div>
    </div>
  );
}
