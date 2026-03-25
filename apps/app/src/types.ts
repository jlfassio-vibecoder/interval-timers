// Placeholder for now
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string;
  role: 'trainer' | 'client' | 'admin' | 'host' | 'super_admin';
  isAdmin?: boolean;
  purchasedIndex?: number | null;
  createdAt: string;
  avatarUrl?: string; // Add this to match Supabase profile
  /** Auth provider IDs (e.g. ["google.com"], ["password"]) - from Firebase Auth, for admin display */
  providerIds?: string[];
  /** Whether email is verified - from Firebase Auth */
  emailVerified?: boolean;
  /** Custom claims (admin, isAdmin, etc.) - from Firebase Auth */
  customClaims?: Record<string, unknown>;
  /** Hub-wide trial end; set on sign-up to now + 7 days */
  trialEndsAt?: string | null;
  /** Last sign-in timestamp (ISO); from Auth or profiles.last_sign_in_at */
  lastSignInAt?: string | null;
  /** Count of explicit sign-in visits */
  signInVisitCount?: number;
  /** Count of resumed-activity visits */
  activityVisitCount?: number;
  /** Training Log: weekly target minutes (Mon–Sun). Default 150. */
  weeklyGoalMinutes?: number | null;
  /** MET/BMR baseline (from profiles) */
  dateOfBirth?: string | null;
  /** Resting HR (bpm); Karvonen / zone display when set. */
  restingHrBpm?: number | null;
  /** Manual max HR (bpm); Tanaka from DOB used when unset. */
  maxHrBpm?: number | null;
  biologicalSex?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  activityLevelBaseline?: string | null;
  /** Daily routine PAL id (bimodal model) */
  lifestyleBaseline?: string | null;
  workoutRoutine?: string | null;
  totalActiveMultiplier?: number | null;
  /** Engine-aligned physical limitation ids + optional explicit `none`. */
  physicalLimitations?: string[] | null;
  medicalConditions?: string[] | null;
  pregnancyPostpartum?: string[] | null;
  /** Ordered fitness goal ids (priority 1 first), max 3. */
  fitnessGoalRanking?: string[] | null;
}

export interface Exercise {
  name: string;
  images: string[];
  instructions: string[];
  videoUrl?: string; // Optional video URL for exercise demonstrations
}

/** Handler for when user selects an exercise (e.g. from WorkoutDetailModal). Parent resolves data and opens ExerciseDetailModal. */
export type OnSelectExercise = (exerciseName: string) => void;

export interface WorkoutComponent {
  title: string;
  duration: string;
  exercises: string[];
}

export interface WorkoutDetail {
  warmup: WorkoutComponent;
  main: WorkoutComponent;
  finisher: WorkoutComponent;
  cooldown: WorkoutComponent;
}

export interface WorkoutLog {
  id: string;
  userId: string;
  workoutId?: string;
  workoutName: string;
  date: string;
  effort: number; // 1-10
  rating: number; // 1-5
  notes: string;
  /** Handoff/timer sessions (Tabata, AMRAP, Daily Warm-Up). */
  durationSeconds?: number;
  calories?: number;
  rounds?: number;
  source?: string;
  /** For deduping AMRAP/handoff merges (amrap_with_friends:userId:sessionId). */
  handoffDedupeKey?: string;
  /** Training Log enrichment. */
  workoutType?: string;
  workoutFormat?: string;
  intensity?: string;
  focusArea?: string;
  isActiveRest?: boolean;
  /** Ranked goal ids from profile at save time (`workout_logs.goal_snapshot`). */
  goalSnapshot?: string[] | null;
}

export interface Artist {
  id: string;
  name: string;
  genre: string;
  image: string;
  day: string;
  description: string;
  intensity: number; // Scale of 1 to 5
  workoutDetail?: WorkoutDetail;
  /** Per-exercise image/instruction overrides keyed by exercise name. */
  exerciseOverrides?: Record<string, Exercise>;
  /** Per-exercise query for matching to approved exercises (exerciseName -> exerciseQuery). */
  exerciseQueryMap?: Record<string, string>;
  /** Display: target volume in hero (e.g. 45 → "45:00"). */
  targetVolumeMinutes?: number;
  /** Display: session window in Mission Parameters (e.g. 45 → "45 Minutes"). */
  windowMinutes?: number;
  /** Display: rest load in Mission Parameters (e.g. "Compressed"). */
  restLoad?: string;
}

/** WOD Engine: user level for single-workout generation (required selection, no "all"). */
export type WODLevel = 'beginner' | 'intermediate' | 'advanced';

/** WOD Engine: single generated workout matching Artist with required workoutDetail. */
export type GeneratedWOD = Omit<Artist, 'workoutDetail'> & { workoutDetail: WorkoutDetail };

export interface ProgramPhase {
  weeks: string;
  title: string;
  focus: string;
  deliverables: string[];
}

export interface ProgramDetail {
  overview: string;
  phases: ProgramPhase[];
}

export interface Program {
  id: string;
  name: string;
  weeks: number;
  description: string;
  image: string;
  intensity: number; // Scale of 1 to 5
  focus: string;
  programDetail?: ProgramDetail;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

// Enum kept for potential future use
export enum Section {
  HERO = 'hero',
  LINEUP = 'lineup',
  EXPERIENCE = 'experience',
  TICKETS = 'tickets',
}
