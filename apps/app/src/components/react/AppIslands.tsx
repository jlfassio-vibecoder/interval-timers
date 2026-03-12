/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { saveWorkoutLog } from '@/lib/supabase/client/workout-logs';
import { fetchUserPrograms } from '@/lib/supabase/client/user-programs';
import type { Artist, Program, WorkoutLog } from '@/types';
import type { WorkoutInSet } from '@/types/ai-workout';
import Navigation from './Navigation';
import { AuthModal } from '@interval-timers/auth-ui';
import { trackEvent } from '@interval-timers/analytics';
import { supabase } from '@/lib/supabase/supabase-instance';
import { adminPaths } from '@/lib/admin/config';
import type { ProgramMetadata } from '@/types/ai-program';
import { getExerciseDetails } from '../../data/exercises';
import type { Exercise } from '@/types';
import { getGeneratedExercises } from '@/lib/supabase/client/generated-exercises';
import type { GeneratedExercise } from '@/types/generated-exercise';
import type { ExtendedBiomechanics } from './ExerciseDetailModal';
import { buildApprovedExerciseMaps, normalizeExerciseName } from '@/lib/approved-exercise-maps';
import { parseBiomechanicalPoints, FULL_BIOMECHANICS_CARD_LENGTH } from '@/lib/parse-biomechanics';
import HUDContent from './hud/HUDContent';
import ProgramSidebar from './hud/ProgramSidebar';
import ProgressiveUpgradeBanner from './hud/ProgressiveUpgradeBanner';

const WorkoutDetailModal = lazy(() => import('./WorkoutDetailModal'));
const LogWorkoutModal = lazy(() => import('./LogWorkoutModal'));
const ProgramsGrid = lazy(() => import('./ProgramsGrid'));
const ProgramDetail = lazy(() => import('./ProgramDetail'));
const BiometricScanOverlay = lazy(() => import('./BiometricScanOverlay'));
const ExerciseDetailModal = lazy(() => import('./ExerciseDetailModal'));
const HUDShell = lazy(() => import('./hud/HUDShell'));
const ConversionModal = lazy(() => import('./hud/ConversionModal'));

interface AppIslandsProps {
  /** Pass from Astro so Navigation SSR matches client and avoids hydration mismatch */
  pathname?: string;
}

const AppIslands: React.FC<AppIslandsProps> = ({ pathname: initialPathname }) => {
  const {
    user,
    profile: _profile,
    workoutLogs,
    setWorkoutLogs,
    completedWorkouts: _completedWorkouts,
    setCompletedWorkouts,
    handleLogout,
    isPaid,
  } = useAppContext();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalSignupFirst, setAuthModalSignupFirst] = useState(false);
  const [authModalFromAppId, setAuthModalFromAppId] = useState<string>('app');
  const [showHUD, setShowHUD] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedRawWorkout, setSelectedRawWorkout] = useState<WorkoutInSet | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showProgramsGrid, setShowProgramsGrid] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [selectedExerciseExtendedBiomechanics, setSelectedExerciseExtendedBiomechanics] =
    useState<ExtendedBiomechanics | null>(null);
  const [selectedExerciseSlug, setSelectedExerciseSlug] = useState<string | null>(null);
  const [userPrograms, setUserPrograms] = useState<Awaited<ReturnType<typeof fetchUserPrograms>>>(
    []
  );

  /** Approved exercises by normalized name; populated when a WOD is selected so detail modal shows published exercise data. */
  const approvedExercisesMapRef = useRef<Map<string, Exercise>>(new Map());
  /** Extended biomechanics (chain, pivot, stabilization, commonMistakes) by normalized name for "Additional Tactical Data" modal. */
  const approvedExtendedBiomechanicsMapRef = useRef<Map<string, ExtendedBiomechanics>>(new Map());
  /** Approved exercise slug by normalized name; used for "View full page" link to canonical indexable page. */
  const approvedExerciseSlugByNameRef = useRef<Map<string, string>>(new Map());

  const stateRef = useRef({
    selectedExercise: null as Exercise | null,
    showAuthModal: false,
    showLogModal: false,
    selectedArtist: null as Artist | null,
    showHUD: false,
    showConversionModal: false,
    selectedProgram: null as Program | null,
    showProgramsGrid: false,
  });
  stateRef.current = {
    selectedExercise,
    showAuthModal,
    showLogModal,
    selectedArtist,
    showHUD,
    showConversionModal,
    selectedProgram,
    showProgramsGrid,
  };

  const DEFAULT_PROGRAM_IMAGE = '/images/gym-barbell-squat-001.jpg';

  function mapMetadataToProgram(m: ProgramMetadata & { id: string }): Program {
    const intensity = m.difficulty === 'advanced' ? 5 : m.difficulty === 'intermediate' ? 3 : 2;
    const focus = m.equipmentProfile?.zoneId ?? 'General Fitness';
    return {
      id: m.id,
      name: m.title,
      weeks: m.durationWeeks ?? 12,
      description: m.description ?? '',
      image: DEFAULT_PROGRAM_IMAGE,
      intensity,
      focus,
    };
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setProgramsLoading(true);
      try {
        const res = await fetch('/api/programs');
        if (!res.ok || cancelled) return;
        const data: (ProgramMetadata & { id: string })[] = await res.json();
        if (cancelled) return;
        setPrograms(data.map(mapMetadataToProgram));
      } catch {
        if (!cancelled) setPrograms([]);
      } finally {
        if (!cancelled) setProgramsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setUserPrograms([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchUserPrograms(user.uid);
        if (!cancelled) setUserPrograms(list);
      } catch {
        if (!cancelled) setUserPrograms([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const showUpgradePrompts =
    !isPaid &&
    (userPrograms.length === 0 ||
      userPrograms.some((p) => p.source !== 'trainer_assigned' && p.source !== 'cohort'));

  // Open auth modal or HUD when arriving from standalone nav (e.g. ?signin=1 or ?hud=1)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const signin = params.get('signin') === '1';
    const hud = params.get('hud') === '1';
    if (signin) setShowAuthModal(true);
    if (hud) setShowHUD(true);
    if (signin || hud) {
      const url = new URL(window.location.href);
      url.searchParams.delete('signin');
      url.searchParams.delete('hud');
      const clean = url.pathname + (url.search || '') + url.hash;
      window.history.replaceState(null, '', clean || '/');
    }
  }, []);

  // Listen for events from other islands
  useEffect(() => {
    const handleSelectWorkout = (e: Event) => {
      try {
        const customEvent = e as CustomEvent<
          Artist | { artist: Artist; rawWorkout?: WorkoutInSet }
        >;
        const detail = customEvent.detail;
        if (!detail) return;
        if (typeof detail === 'object' && 'artist' in detail) {
          setSelectedArtist(detail.artist);
          setSelectedRawWorkout(detail.rawWorkout ?? null);
        } else {
          setSelectedArtist(detail as Artist);
          setSelectedRawWorkout(null);
        }
      } catch (error) {
        console.error('[AppIslands] Error handling selectWorkout:', error);
      }
    };
    const handleShowAuth = (e?: Event) => {
      try {
        const fromAppId =
          (e instanceof CustomEvent ? (e as CustomEvent<{ fromAppId?: string }>).detail?.fromAppId : undefined) ??
          'app';
        setAuthModalFromAppId(fromAppId);
        setAuthModalSignupFirst(false);
        setShowAuthModal(true);
      } catch (error) {
        console.error('[AppIslands] Error showing auth modal:', error);
      }
    };
    const handleShowAuthWithSignup = (e?: Event) => {
      try {
        const fromAppId =
          (e instanceof CustomEvent ? (e as CustomEvent<{ fromAppId?: string }>).detail?.fromAppId : undefined) ??
          'app';
        setAuthModalFromAppId(fromAppId);
        setAuthModalSignupFirst(true);
        setShowAuthModal(true);
      } catch (error) {
        console.error('[AppIslands] Error showing auth modal (signup):', error);
      }
    };
    const handleShowPrograms = () => {
      try {
        setShowProgramsGrid(true);
      } catch (error) {
        console.error('[AppIslands] Error showing programs:', error);
      }
    };
    const handleShowHUD = () => {
      try {
        setShowHUD(true);
      } catch (error) {
        console.error('[AppIslands] Error showing HUD:', error);
      }
    };

    if (typeof window !== 'undefined') {
      try {
        window.addEventListener('selectWorkout', handleSelectWorkout);
        window.addEventListener('showAuthModal', handleShowAuth);
        window.addEventListener('showAuthModalWithSignup', handleShowAuthWithSignup);
        window.addEventListener('showPrograms', handleShowPrograms);
        window.addEventListener('showHUD', handleShowHUD);
      } catch (error) {
        console.error('[AppIslands] Error registering event listeners:', error);
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        try {
          window.removeEventListener('selectWorkout', handleSelectWorkout);
          window.removeEventListener('showAuthModal', handleShowAuth);
          window.removeEventListener('showAuthModalWithSignup', handleShowAuthWithSignup);
          window.removeEventListener('showPrograms', handleShowPrograms);
          window.removeEventListener('showHUD', handleShowHUD);
        } catch (error) {
          console.error('[AppIslands] Error removing event listeners:', error);
        }
      }
    };
  }, []);

  // When a WOD is selected, fetch approved exercises and build name→Exercise, name→extended, and name→slug maps for the detail modal.
  useEffect(() => {
    if (!selectedArtist?.workoutDetail) {
      approvedExercisesMapRef.current = new Map();
      approvedExtendedBiomechanicsMapRef.current = new Map();
      approvedExerciseSlugByNameRef.current = new Map();
      return;
    }
    let cancelled = false;
    getGeneratedExercises('approved')
      .then((list) => {
        if (cancelled) return;
        const { exerciseMap, extendedMap, slugMap } = buildApprovedExerciseMaps(
          list as GeneratedExercise[]
        );
        approvedExercisesMapRef.current = exerciseMap;
        approvedExtendedBiomechanicsMapRef.current = extendedMap;
        approvedExerciseSlugByNameRef.current = slugMap;
      })
      .catch(() => {
        if (!cancelled) {
          approvedExercisesMapRef.current = new Map();
          approvedExtendedBiomechanicsMapRef.current = new Map();
          approvedExerciseSlugByNameRef.current = new Map();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedArtist?.id, selectedArtist?.workoutDetail]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = stateRef.current;
      const defer = (fn: () => void) => requestAnimationFrame(() => fn());
      // Close all open modals/overlays on Escape (independent checks, not else-if)
      if (s.selectedExercise)
        defer(() => {
          setSelectedExercise(null);
          setSelectedExerciseExtendedBiomechanics(null);
          setSelectedExerciseSlug(null);
        });
      if (s.showAuthModal) defer(() => setShowAuthModal(false));
      if (s.showLogModal) defer(() => setShowLogModal(false));
      if (s.selectedArtist)
        defer(() => {
          setSelectedArtist(null);
          setSelectedRawWorkout(null);
        });
      if (s.showConversionModal) defer(() => setShowConversionModal(false));
      if (s.showHUD) defer(() => setShowHUD(false));
      if (s.selectedProgram) defer(() => setSelectedProgram(null));
      if (s.showProgramsGrid) defer(() => setShowProgramsGrid(false));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleActivateProtocol = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setIsActivating(true);
    setTimeout(() => {
      setIsActivating(false);
      setShowHUD(true);
      setSelectedProgram(null);
      setShowProgramsGrid(false);
    }, 4000);
  };

  const handleSaveLog = async (log: Omit<WorkoutLog, 'id'>) => {
    if (!user) return;

    const newLog: Omit<WorkoutLog, 'id'> = {
      ...log,
      userId: user.uid,
    };

    const docId = await saveWorkoutLog(newLog);
    const logWithId: WorkoutLog = { id: docId, ...newLog };

    setWorkoutLogs([logWithId, ...workoutLogs]);
    setCompletedWorkouts(
      new Set([...Array.from(workoutLogs.map((l) => l.workoutId || '')), log.workoutId || ''])
    );
    setShowLogModal(false);
    setSelectedArtist(null);
  };

  // Exercise detail foundation for workout/wod/tabata: resolve exercise and open ExerciseDetailModal.
  const handleSelectExercise = (exerciseName: string) => {
    // 1. WOD-specific override (admin custom or swapped exercise)
    const override = selectedArtist?.exerciseOverrides?.[exerciseName];
    if (override) {
      setSelectedExerciseSlug(null);
      // Legacy overrides may contain full 5-point biomechanicalPoints; show only performance cues and pass rest to Additional Tactical Data
      if (override.instructions.length >= FULL_BIOMECHANICS_CARD_LENGTH) {
        try {
          const { biomechanics } = parseBiomechanicalPoints(override.instructions);
          setSelectedExercise({
            ...override,
            instructions:
              biomechanics.performanceCues.length > 0
                ? biomechanics.performanceCues
                : override.instructions.slice(FULL_BIOMECHANICS_CARD_LENGTH - 1),
          });
          setSelectedExerciseExtendedBiomechanics({
            biomechanicalChain: biomechanics.biomechanicalChain || undefined,
            pivotPoints: biomechanics.pivotPoints || undefined,
            stabilizationNeeds: biomechanics.stabilizationNeeds || undefined,
            commonMistakes:
              biomechanics.commonMistakes && biomechanics.commonMistakes.length > 0
                ? biomechanics.commonMistakes
                : undefined,
          });
        } catch {
          setSelectedExercise(override);
          setSelectedExerciseExtendedBiomechanics(null);
        }
      } else {
        setSelectedExercise(override);
        setSelectedExerciseExtendedBiomechanics(null);
      }
      return;
    }
    // 2. Published approved exercise (primary image + instructions from generated_exercises)
    const normalized = normalizeExerciseName(exerciseName);
    const fromApproved = approvedExercisesMapRef.current.get(normalized);
    if (fromApproved) {
      setSelectedExercise(fromApproved);
      setSelectedExerciseExtendedBiomechanics(
        approvedExtendedBiomechanicsMapRef.current.get(normalized) ?? null
      );
      setSelectedExerciseSlug(approvedExerciseSlugByNameRef.current.get(normalized) ?? null);
      return;
    }
    // 3. Static database or generic placeholder
    setSelectedExerciseSlug(null);
    const exercise = getExerciseDetails(exerciseName);
    if (exercise) {
      setSelectedExercise(exercise);
      setSelectedExerciseExtendedBiomechanics(null);
    }
  };

  return (
    <>
      <Navigation
        onShowHUD={() => setShowHUD(true)}
        onShowAuthModal={() => {
          setAuthModalFromAppId('app');
          setAuthModalSignupFirst(false);
          setShowAuthModal(true);
        }}
        onLogout={handleLogout}
        initialPathname={initialPathname}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setAuthModalSignupFirst(false);
        }}
        supabase={supabase}
        redirectBaseUrl="/account"
        fromAppId={authModalFromAppId}
        defaultSignUp={authModalSignupFirst}
        onSignupStart={() =>
          trackEvent(supabase, 'account_signup_start', { from_app_id: authModalFromAppId }, { appId: 'app' })
        }
        onSignupComplete={() =>
          trackEvent(supabase, 'account_signup_complete', { from_app_id: authModalFromAppId, method: 'email' }, { appId: 'app' })
        }
        onLoginComplete={() =>
          trackEvent(supabase, 'account_login_complete', { from_app_id: authModalFromAppId, method: 'email' }, { appId: 'app' })
        }
        getRedirectUrl={async (authUser) => {
          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authUser.id)
            .maybeSingle();
          const isAdmin = data?.role === 'admin';
          const isTrainer = data?.role === 'trainer';
          if (
            isAdmin &&
            typeof window !== 'undefined' &&
            window.location.pathname.includes(adminPaths.root)
          ) {
            return adminPaths.root;
          }
          if (isTrainer || isAdmin) return '/trainer';
          return null;
        }}
      />

      <Suspense fallback={null}>
        <HUDShell
          isOpen={showHUD}
          onClose={() => setShowHUD(false)}
          isPaid={isPaid}
          banner={
            showUpgradePrompts ? (
              <ProgressiveUpgradeBanner onUpgrade={() => setShowConversionModal(true)} />
            ) : undefined
          }
          sidebar={
            <ProgramSidebar
              isPaid={isPaid}
              onOpenConversionModal={() => setShowConversionModal(true)}
              onProgramsChange={() => setCalendarRefreshKey((k) => k + 1)}
            />
          }
        >
          <HUDContent
            isPaid={isPaid}
            showUpgradePrompts={showUpgradePrompts}
            onOpenConversionModal={() => setShowConversionModal(true)}
            calendarRefreshKey={calendarRefreshKey}
            workoutsThisWeek={
              workoutLogs.filter((l) => {
                const d = l.date ? new Date(l.date) : null;
                if (!d) return false;
                const now = new Date();
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                return d >= startOfWeek;
              }).length
            }
            workoutLogs={workoutLogs}
          />
        </HUDShell>
      </Suspense>

      <Suspense fallback={null}>
        <ConversionModal
          isOpen={showConversionModal}
          onClose={() => setShowConversionModal(false)}
          onUpgrade={() => {
            if (!user) {
              setShowConversionModal(false);
              setShowAuthModal(true);
            }
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <WorkoutDetailModal
          workout={selectedArtist}
          rawWorkout={selectedRawWorkout}
          onClose={() => {
            setSelectedArtist(null);
            setSelectedRawWorkout(null);
          }}
          onLogWorkout={() => setShowLogModal(true)}
          onSelectExercise={handleSelectExercise}
        />
      </Suspense>

      <Suspense fallback={null}>
        <LogWorkoutModal
          isOpen={showLogModal}
          onClose={() => setShowLogModal(false)}
          onSave={handleSaveLog}
          selectedArtist={selectedArtist}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ProgramsGrid
          isOpen={showProgramsGrid && !selectedProgram}
          onClose={() => setShowProgramsGrid(false)}
          onSelectProgram={(program) => {
            window.location.href = `/programs/${program.id}`;
          }}
          programs={programs}
          loading={programsLoading}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ProgramDetail
          program={selectedProgram}
          onClose={() => setSelectedProgram(null)}
          onActivate={handleActivateProtocol}
        />
      </Suspense>

      <Suspense fallback={null}>
        <BiometricScanOverlay
          isOpen={isActivating}
          onComplete={() => {
            setIsActivating(false);
            setShowHUD(true);
            setSelectedProgram(null);
            setShowProgramsGrid(false);
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ExerciseDetailModal
          exercise={selectedExercise}
          onClose={() => {
            setSelectedExercise(null);
            setSelectedExerciseExtendedBiomechanics(null);
            setSelectedExerciseSlug(null);
          }}
          extendedBiomechanics={selectedExerciseExtendedBiomechanics}
          exerciseSlug={selectedExerciseSlug}
        />
      </Suspense>
    </>
  );
};

export default AppIslands;
