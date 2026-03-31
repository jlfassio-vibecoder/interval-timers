import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { HEALTH_GUIDELINE_WEEKLY_MINUTES } from '@/lib/training-log-constants';
import { supabase } from '@/lib/supabase/supabase-instance';
import { getTrainerForUser } from '@/lib/supabase/client/trainer-resolver';
import { updateWeeklyGoalMinutes } from '@/lib/supabase/client/profiles';
import { setAuthCookie, clearAuthCookie } from '@/lib/auth-cookie';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile, WorkoutLog } from '@/types';

// Extend UserProfile to include Supabase specifics if needed
export type AppUser = UserProfile;

const ACTIVE_PROGRAM_STORAGE_KEY = 'ai-fit-active-program-id';

/** Complete roster invites when auth redirects dropped ?invite= (server matches session email). */
function requestAcceptPendingRosterInvites(accessToken?: string | null) {
  if (typeof window === 'undefined') return;
  queueMicrotask(() => {
    const headers: Record<string, string> = {};
    if (accessToken?.trim()) {
      headers.Authorization = `Bearer ${accessToken.trim()}`;
    }
    void fetch('/api/invitations/accept-pending', {
      method: 'POST',
      credentials: 'include',
      headers: Object.keys(headers).length ? headers : undefined,
    }).catch(() => {});
  });
}

interface AppContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  profile: AppUser | null; // Alias for user
  trainerProfile: { uid: string; displayName: string; avatarUrl?: string } | null;
  activeProgramId: string | null;
  isTrainer: boolean;
  /** True if user can access Mission Control (host, trainer, admin, super_admin). */
  isMissionControlStaff: boolean;
  isAdmin: boolean;
  workoutLogs: WorkoutLog[];
  completedWorkouts: Set<string>;
  purchasedIndex: number | null;
  isPaid: boolean;
  /** True when trial_ends_at is in future and user is not paid */
  isInTrial: boolean;
  /** Remaining trial time in ms, or null if not in trial */
  trialRemainingMs: number | null;

  // Actions
  setProfile: (p: AppUser | null) => void;
  setWorkoutLogs: (logs: WorkoutLog[]) => void;
  setCompletedWorkouts: (workouts: Set<string>) => void;
  setPurchasedIndex: (index: number | null) => void;
  setActiveProgramId: (id: string | null) => void;
  setWeeklyGoalMinutes: (minutes: number) => Promise<void>;
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
    isMissionControlStaff: false,
    isAdmin: false,
    workoutLogs: [],
    completedWorkouts: new Set(),
    purchasedIndex: null,
    isPaid: false,
    isInTrial: false,
    trialRemainingMs: null,
    setProfile: () => {},
    setWorkoutLogs: () => {},
    setCompletedWorkouts: () => {},
    setPurchasedIndex: () => {},
    setActiveProgramId: () => {},
    setWeeklyGoalMinutes: async () => {},
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
  const [hasTrainerRecord, setHasTrainerRecord] = useState(false);

  useEffect(() => {
    let mounted = true;
    let didFinish = false;

    const finishInit = () => {
      if (!didFinish && mounted) {
        didFinish = true;
        setLoading(false);
      }
    };

    // Safety: never hang indefinitely if getSession or fetchProfile stalls (e.g. prod proxy/Supabase).
    const safetyTimer = setTimeout(() => {
      if (!didFinish) {
        didFinish = true;
        setLoading(false);
      }
    }, 3000);

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
          setAuthCookie(s);
          if (s?.user) {
            await fetchProfile(s.user.id, s.user.email || undefined);
            requestAcceptPendingRosterInvites(s.access_token);
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setSession(session);
      setAuthCookie(session);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email || undefined);
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          requestAcceptPendingRosterInvites(session?.access_token);
        }
      } else {
        setUser(null);
        setTrainerProfile(null);
        setHasTrainerRecord(false);
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
      setHasTrainerRecord(false);
      setUser({
        uid: userId,
        email: email || null,
        displayName: undefined,
        role: 'client',
        avatarUrl: undefined,
        isAdmin: false,
        createdAt: new Date().toISOString(),
        purchasedIndex: null,
        trialEndsAt: null,
        weeklyGoalMinutes: HEALTH_GUIDELINE_WEEKLY_MINUTES,
        lifestyleBaseline: null,
        workoutRoutine: null,
        totalActiveMultiplier: null,
        physicalLimitations: null,
        medicalConditions: null,
        pregnancyPostpartum: null,
        fitnessGoalRanking: null,
        restingHrBpm: null,
        maxHrBpm: null,
      });
    };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
          console.error('Error fetching profile:', error);
        }
        // Fallback: session exists but profile fetch failed (406, RLS, network). Set minimal user so account page can render.
        setMinimalUser();
        return;
      }

      if (data) {
        const { data: trRow } = await supabase
          .from('trainers')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();
        setHasTrainerRecord(!!trRow);

        const goal = data.weekly_goal_minutes;
        setUser({
          uid: data.id,
          email: email || null,
          displayName: data.full_name || undefined,
          role: (data.role as 'client' | 'admin' | 'host' | 'super_admin') || 'client',
          avatarUrl: data.avatar_url || undefined,
          isAdmin: data.role === 'admin' || data.role === 'super_admin',
          createdAt: data.created_at || new Date().toISOString(),
          purchasedIndex: null, // Populate from subscription table later
          trialEndsAt: data.trial_ends_at ?? null,
          weeklyGoalMinutes:
            typeof goal === 'number' && goal > 0 ? goal : HEALTH_GUIDELINE_WEEKLY_MINUTES,
          dateOfBirth: data.date_of_birth ?? null,
          restingHrBpm: data.resting_hr_bpm != null ? Number(data.resting_hr_bpm) : null,
          maxHrBpm: data.max_hr_bpm != null ? Number(data.max_hr_bpm) : null,
          biologicalSex: data.biological_sex ?? null,
          weightKg: data.weight_kg != null ? Number(data.weight_kg) : null,
          heightCm: data.height_cm != null ? Number(data.height_cm) : null,
          activityLevelBaseline: data.activity_level_baseline ?? null,
          lifestyleBaseline: data.lifestyle_baseline ?? null,
          workoutRoutine: data.workout_routine ?? null,
          totalActiveMultiplier:
            data.total_active_multiplier != null ? Number(data.total_active_multiplier) : null,
          physicalLimitations: Array.isArray(data.physical_limitations)
            ? data.physical_limitations
            : null,
          medicalConditions: Array.isArray(data.medical_conditions)
            ? data.medical_conditions
            : null,
          pregnancyPostpartum: Array.isArray(data.pregnancy_postpartum)
            ? data.pregnancy_postpartum
            : null,
          fitnessGoalRanking: Array.isArray(data.fitness_goal_ranking)
            ? data.fitness_goal_ranking
            : null,
        });
      } else {
        // Session exists but no profile row (0 rows; e.g. RLS blocks, or trigger hasn't created it yet)
        setMinimalUser();
      }
    } catch (err) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.error('Profile fetch failed', err);
      }
      setMinimalUser();
    }
  };

  const setWeeklyGoalMinutes = React.useCallback(
    async (minutes: number) => {
      if (!user?.uid) return;
      const clamped = Math.max(1, Math.min(999, minutes));
      await updateWeeklyGoalMinutes(user.uid, clamped);
      setUser((prev) => (prev ? { ...prev, weeklyGoalMinutes: clamped } : null));
    },
    [user?.uid]
  );

  const handleLogout = async () => {
    clearAuthCookie();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setHasTrainerRecord(false);
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

  const isTrainer = hasTrainerRecord || user?.role === 'admin' || user?.role === 'super_admin';
  const isMissionControlStaff = isTrainer || user?.role === 'host';
  const isPaid = !!user?.isAdmin || purchasedIndex !== null;

  const trialEndsAt = user?.trialEndsAt ?? null;
  const trialEndDate = trialEndsAt ? new Date(trialEndsAt) : null;
  const now = Date.now();
  const isInTrial = !isPaid && trialEndDate != null && trialEndDate.getTime() > now;
  const trialRemainingMs = isInTrial && trialEndDate ? trialEndDate.getTime() - now : null;

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
        isMissionControlStaff,
        isAdmin: !!user?.isAdmin,
        workoutLogs,
        completedWorkouts,
        purchasedIndex,
        isPaid,
        isInTrial,
        trialRemainingMs,
        setProfile: setUser,
        setWorkoutLogs,
        setCompletedWorkouts,
        setPurchasedIndex,
        setActiveProgramId,
        setWeeklyGoalMinutes,
        handleLogout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
