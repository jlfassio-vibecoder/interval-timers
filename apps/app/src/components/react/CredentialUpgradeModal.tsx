/**
 * Blocking modal after magic-link (OTP) sign-in: require password or Google before using the app.
 */

import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { buildOAuthRedirectUrl } from '@interval-timers/auth-ui';
import {
  CREDENTIAL_GATE_META_KEY,
  shouldShowCredentialGate,
} from '@/lib/auth/credential-gate';

const MIN_PASSWORD_LEN = 6;

function normalizeAuthError(msg: string): string {
  if (msg.includes('Too many requests')) {
    return 'Too many attempts. Please try again later.';
  }
  if (msg.includes('Password')) return msg;
  return msg;
}

export interface CredentialUpgradeModalProps {
  supabase: SupabaseClient;
  session: Session | null;
  user: User;
}

export default function CredentialUpgradeModal({
  supabase,
  session,
  user,
}: CredentialUpgradeModalProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = shouldShowCredentialGate(session, user);

  useEffect(() => {
    if (!visible) return;
    // Blocking modal: prevent background scroll (especially on mobile/trackpads).
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  if (!visible) return null;

  const handleGoogleLink = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: linkErr } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: buildOAuthRedirectUrl('/account', { fromAppId: 'credential-gate' }),
        },
      });
      if (linkErr) throw linkErr;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(normalizeAuthError(msg));
    } finally {
      // In most cases, linkIdentity triggers a redirect; this is for completeness and for cases where
      // the redirect is suppressed or blocked.
      setLoading(false);
    }
  }, [supabase]);

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LEN) {
      setError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error: pwdErr } = await supabase.auth.updateUser({
        password,
        data: { [CREDENTIAL_GATE_META_KEY]: true },
      });
      if (pwdErr) throw pwdErr;
      await supabase.auth.refreshSession();
      setPassword('');
      setConfirm('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(normalizeAuthError(msg));
    } finally {
      setLoading(false);
    }
  };

  const emailHint = user.email?.trim() || 'your account';

  const node = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credential-gate-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0500] p-6 shadow-xl">
        <h2 id="credential-gate-title" className="mb-2 text-xl font-bold text-white">
          Secure your account
        </h2>
        <p className="mb-4 text-sm text-white/70">
          You signed in with a one-time link ({emailHint}). Set a password or connect Google so you
          can sign back in after you log out.
        </p>
        <div className="mb-4 space-y-2">
          <button
            type="button"
            onClick={() => void handleGoogleLink()}
            disabled={loading}
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 font-medium text-white hover:bg-white/10 focus:border-orange-500 focus:outline-none disabled:opacity-50"
          >
            Continue with Google
          </button>
        </div>
        <div className="mb-4 flex items-center gap-2 text-sm text-white/50">
          <span className="flex-1 border-t border-white/20" />
          <span>or set a password</span>
          <span className="flex-1 border-t border-white/20" />
        </div>
        <form onSubmit={(e) => void handlePasswordSubmit(e)} className="space-y-3">
          {/* A11y: provide a (hidden) username/email field for password managers and screen readers. */}
          <input
            type="email"
            autoComplete="username"
            value={user.email ?? ''}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LEN}
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
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LEN}
            className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white placeholder:text-white/50 focus:border-orange-500 focus:outline-none"
          />
          <p className="text-xs text-white/50">At least {MIN_PASSWORD_LEN} characters</p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 font-bold text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {loading ? 'Please wait…' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}
