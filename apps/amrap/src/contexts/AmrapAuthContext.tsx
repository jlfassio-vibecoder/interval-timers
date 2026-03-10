import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AmrapProfile {
  amrap_trial_ends_at: string | null;
  purchased_index: number | null;
}

interface AmrapAuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AmrapProfile | null;
  hasFullAccess: boolean;
  loading: boolean;
}

const AmrapAuthContext = createContext<AmrapAuthContextValue | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components -- context + hooks in one file
export function useAmrapAuth() {
  const ctx = useContext(AmrapAuthContext);
  if (ctx === undefined) {
    throw new Error('useAmrapAuth must be used within AmrapAuthProvider');
  }
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hooks in one file
export function useAmrapPermissions() {
  const { hasFullAccess, loading } = useAmrapAuth();
  return { hasFullAccess, loading };
}

export function AmrapAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AmrapProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('amrap_trial_ends_at, purchased_index')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setProfile({
          amrap_trial_ends_at: data.amrap_trial_ends_at ?? null,
          purchased_index: data.purchased_index ?? null,
        });
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await fetchProfile(s.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await fetchProfile(s.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasFullAccess = useMemo(() => {
    if (!profile) return false;
    if (profile.purchased_index != null) return true;
    if (profile.amrap_trial_ends_at) {
      return new Date(profile.amrap_trial_ends_at) > new Date();
    }
    return false;
  }, [profile]);

  const value: AmrapAuthContextValue = useMemo(
    () => ({ user, session, profile, hasFullAccess, loading }),
    [user, session, profile, hasFullAccess, loading]
  );

  return (
    <AmrapAuthContext.Provider value={value}>
      {children}
    </AmrapAuthContext.Provider>
  );
}
