/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Fingerprint } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase/supabase-instance';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When true, show sign-up tab first (e.g. when opened from WorkoutPlanBuilder "Create account"). */
  defaultSignUp?: boolean;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultSignUp = false }) => {
  const reduceMotion = useReducedMotion();
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [fullName, setFullName] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setIsRegistering(defaultSignUp);
    } else {
      setIsRegistering(false);
    }
  }, [isOpen, defaultSignUp]);

  const handleAuth = async () => {
    setAuthLoading(true);
    try {
      if (isRegistering) {
        // Register: Sign up + create profile via trigger
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              full_name: fullName,
              role: 'client', // Default role
            },
          },
        });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      } else {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;

        // Check role and redirect
        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

          if (profile?.role === 'trainer' || profile?.role === 'admin') {
            window.location.href = '/trainer';
            return;
          }
          // Regular users: redirect to account so they land where they expect
          window.location.href = '/account';
          return;
        }
      }
      onClose();
      setAuthEmail('');
      setAuthPassword('');
      setFullName('');
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const message =
        raw.includes('Invalid login credentials') || raw.includes('invalid_grant')
          ? 'Wrong email or password.'
          : raw.includes('Email not confirmed')
            ? 'Please confirm your email using the link we sent you.'
            : raw.includes('Too many requests')
              ? 'Too many attempts. Please try again later.'
              : raw;
      toast.error(message);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl"
          onClick={() => !authLoading && onClose()}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={reduceMotion ? { duration: 0 } : undefined}
            className="border-orange-light/30 relative w-full max-w-md overflow-hidden rounded-[2.5rem] border bg-bg-dark p-8 shadow-[0_0_50px_rgba(255,191,0,0.1)] md:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-orange-light to-transparent" />
            <div className="mb-8 text-center">
              <Fingerprint className="mx-auto mb-4 h-12 w-12 animate-pulse text-orange-light" />
              <h3 className="mb-2 font-heading text-2xl font-black uppercase text-white">
                Command Access
              </h3>
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">
                Secure link via Supabase
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAuth();
              }}
              className="space-y-6"
            >
              {isRegistering && (
                <div>
                  <label
                    htmlFor="full-name"
                    className="mb-2 block font-mono text-[10px] uppercase text-white/40"
                  >
                    Codename
                  </label>
                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="focus:border-orange-light/50 w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none transition-all"
                    placeholder="Sgt. Rock"
                    required
                  />
                </div>
              )}
              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-2 block font-mono text-[10px] uppercase text-white/40"
                >
                  Email ID
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="focus:border-orange-light/50 w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none transition-all"
                  placeholder="cadet@pt.army"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="auth-password"
                  className="mb-2 block font-mono text-[10px] uppercase text-white/40"
                >
                  Access Code
                </label>
                <input
                  id="auth-password"
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="focus:border-orange-light/50 w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-xl bg-orange-light py-4 font-black uppercase tracking-widest text-black transition-all hover:bg-white disabled:opacity-50"
              >
                {authLoading ? 'Verifying...' : isRegistering ? 'Register' : 'Log In'}
              </button>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="font-mono text-[10px] uppercase text-white/30 transition-colors hover:text-orange-light"
                >
                  {isRegistering ? 'Have an account? Log In' : 'New recruit? Register'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;
