import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getTrainerForUser } from '@/lib/supabase/client/trainer-resolver';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile, WorkoutLog } from '@/types';

// Extend UserProfile to include Supabase specifics if needed
export type AppUser = UserProfile;

const ACTIVE_PROGRAM_STORAGE_KEY = 'ai-fit-active-program-id';

interface AppContextType {
  user: AppUser | null;
  session: Session | null;
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

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
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
    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email || undefined);
      }
    });

    // 2. Auth State Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email || undefined);
      } else {
        setUser(null);
        setTrainerProfile(null);
        setWorkoutLogs([]);
      }
    });

    return () => subscription.unsubscribe();
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
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

      if (error) {
        console.error('Error fetching profile:', error);
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
      }
    } catch (err) {
      console.error('Profile fetch failed', err);
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
  };

  const isTrainer = user?.role === 'trainer' || user?.role === 'admin';
  const isPaid = !!user?.isAdmin || purchasedIndex !== null;

  return (
    <AppContext.Provider
      value={{
        user,
        session,
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
