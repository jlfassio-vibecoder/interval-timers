import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/supabase-instance';
import { getTrainerForUser } from '@/lib/supabase/client/trainer-resolver';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile, WorkoutLog } from '@/types';

// Extend UserProfile to include Supabase specifics if needed
export type AppUser = UserProfile;

const ACTIVE_PROGRAM_STORAGE_KEY = 'ai-fit-active-program-id';

interface AppContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  profile: AppUser | null; // Alias for user
  trainerProfile: { uid: string; displayName: string; avatarUrl?: string } | null;
  activeProgramId: string | null;
  isTrainer: boolean;
  isAdmin: boolean;
  workoutLogs: WorkoutLog[];
  completedWorkouts: Set<string>;
  purchasedIndex: number | null;
  isPaid: boolean;

  // Actions
  setProfile: (p: AppUser | null) => void;
  setWorkoutLogs: (logs: WorkoutLog[]) => void;
  setCompletedWorkouts: (workouts: Set<string>) => void;
  setPurchasedIndex: (index: number | null) => void;
  setActiveProgramId: (id: string | null) => void;
  handleLogout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/** SSR-safe stub when context is unavailable (e.g. account page during server render).
 * Returns a fresh object per call to avoid cross-request state leakage (e.g. mutable Set). */
function getSSRStub(): AppContextType {
  return {
    user: null,
    session: null,
    loading: true,
    profile: null,
    trainerProfile: null,
    activeProgramId: null,
    isTrainer: false,
    isAdmin: false,
    workoutLogs: [],
    completedWorkouts: new Set(),
    purchasedIndex: null,
    isPaid: false,
    setProfile: () => {},
    setWorkoutLogs: () => {},
    setCompletedWorkouts: () => {},
    setPurchasedIndex: () => {},
    setActiveProgramId: () => {},
    handleLogout: async () => {},
  };
}

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    if (typeof window === 'undefined') return getSSRStub();
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [trainerProfile, setTrainerProfile] = useState<{
    uid: string;
    displayName: string;
    avatarUrl?: string;
  } | null>(null);

  // Active program (persisted to localStorage)
  const [activeProgramId, setActiveProgramIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(ACTIVE_PROGRAM_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setActiveProgramId = React.useCallback((id: string | null) => {
    setActiveProgramIdState(id);
    try {
      if (id) window.localStorage.setItem(ACTIVE_PROGRAM_STORAGE_KEY, id);
      else window.localStorage.removeItem(ACTIVE_PROGRAM_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Legacy state
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [completedWorkouts, setCompletedWorkouts] = useState<Set<string>>(new Set());
  const [purchasedIndex, setPurchasedIndex] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    let didFinish = false;

    const finishInit = () => {
      if (!didFinish && mounted) {
        didFinish = true;
        setLoading(false);
      }
    };

    // Safety: never hang indefinitely if getSession or fetchProfile stalls.
    // Timer calls setLoading(false) directly so loading is cleared even if finishInit's
    // mounted check blocks (e.g. Strict Mode unmount before first run() completes).
    const safetyTimer = setTimeout(() => {
      if (!didFinish) {
        didFinish = true;
        setLoading(false);
      }
    }, 5000);

    const run = async () => {
      try {
        // 0. Restore session from URL hash (cross-origin handoff from AMRAP)
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        if (hash) {
          const params = new URLSearchParams(hash.slice(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            try {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              window.history.replaceState(
                null,
                '',
                window.location.pathname + window.location.search
              );
            } catch {
              window.history.replaceState(
                null,
                '',
                window.location.pathname + window.location.search
              );
            }
          }
        }

        // 1. Initial Session Check
        const {
          data: { session: s },
        } = await supabase.auth.getSession();
        if (mounted) {
          setSession(s);
          if (s?.user) {
            await fetchProfile(s.user.id, s.user.email || undefined);
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[AppContext] Auth init failed:', err);
      } finally {
        clearTimeout(safetyTimer);
        finishInit();
      }
    };

    run();

    // 2. Auth State Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email || undefined);
      } else {
        setUser(null);
        setTrainerProfile(null);
        setWorkoutLogs([]);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setTrainerProfile(null);
      return;
    }
    let cancelled = false;
    getTrainerForUser(user.uid, activeProgramId).then((profile) => {
      if (!cancelled) {
        setTrainerProfile(profile);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, activeProgramId]);

  const fetchProfile = async (userId: string, email?: string) => {
    const setMinimalUser = () => {
      setUser({
        uid: userId,
        email: email || null,
        displayName: undefined,
        role: 'client',
        avatarUrl: undefined,
        isAdmin: false,
        createdAt: new Date().toISOString(),
        purchasedIndex: null,
      });
    };

    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        // Fallback: session exists but profile fetch failed (406, RLS, network). Set minimal user so account page can render.
        setMinimalUser();
        return;
      }

      if (data) {
        setUser({
          uid: data.id,
          email: email || null,
          displayName: data.full_name || undefined,
          role: (data.role as 'trainer' | 'client' | 'admin') || 'client',
          avatarUrl: data.avatar_url || undefined,
          isAdmin: data.role === 'admin',
          createdAt: data.created_at || new Date().toISOString(),
          purchasedIndex: null, // Populate from subscription table later
        });
      } else {
        // Session exists but no profile row (0 rows; e.g. RLS blocks, or trigger hasn't created it yet)
        setMinimalUser();
      }
    } catch (err) {
      console.error('Profile fetch failed', err);
      setMinimalUser();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setTrainerProfile(null);
    setActiveProgramIdState(null);
    setWorkoutLogs([]);
    try {
      window.localStorage.removeItem(ACTIVE_PROGRAM_STORAGE_KEY);
    } catch {
      // ignore
    }
    // Cross-origin logout propagation: redirect to timer app logout to clear its session
    const amrapLogout =
      import.meta.env.PUBLIC_AMRAP_LOGOUT_URL || import.meta.env.VITE_AMRAP_LOGOUT_URL;
    if (amrapLogout && typeof window !== 'undefined') {
      window.location.href = amrapLogout;
    }
  };

  const isTrainer = user?.role === 'trainer' || user?.role === 'admin';
  const isPaid = !!user?.isAdmin || purchasedIndex !== null;

  return (
    <AppContext.Provider
      value={{
        user,
        session,
        loading,
        profile: user, // user IS the profile now
        trainerProfile,
        activeProgramId,
        isTrainer,
        isAdmin: !!user?.isAdmin,
        workoutLogs,
        completedWorkouts,
        purchasedIndex,
        isPaid,
        setProfile: setUser,
        setWorkoutLogs,
        setCompletedWorkouts,
        setPurchasedIndex,
        setActiveProgramId,
        handleLogout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
