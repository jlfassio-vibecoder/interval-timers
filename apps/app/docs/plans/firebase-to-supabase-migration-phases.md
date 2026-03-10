# Firebase to Supabase Migration: Phases and Planning Prompts

This document defines the phased migration from Firebase/Firestore to Supabase and provides **ready-to-use prompts** for the Cursor AI planning tool. Use one prompt per phase to generate a detailed plan; then implement that phase before moving to the next.

**Rules for all phases:** Do not reset databases. Handle empty or missing data gracefully (return empty arrays / friendly empty states where appropriate). Keep existing code intact where possible; add or switch code surgically.

---

## Phase 1: Server equipment

**Scope:** Switch all server-side equipment (admin/API) from Firestore to Supabase. Supabase already has `equipment_inventory` and `equipment_zones` tables and some Supabase libs exist.

**Prompt for Cursor planning tool:**

```
Create a detailed migration plan to move server-side equipment from Firebase/Firestore to Supabase.

Current state: Equipment is read/written via Firestore (equipment_inventory, equipment_zones) in src/lib/firebase/admin/equipment.ts and src/lib/firebase/admin/server-equipment.ts. API routes and admin UI (e.g. ProgramGeneratorModal) use these or call APIs that use Firestore.

Target state: All server-side equipment reads and writes use Supabase tables equipment_inventory and equipment_zones. Supabase schema and some libs (e.g. src/lib/supabase/admin/server-equipment.ts, client equipment) may already exist.

Plan should: (1) Identify every API and server path that uses Firestore equipment; (2) Switch them to use Supabase admin/server equipment libs; (3) Remove or deprecate Firestore equipment usage; (4) Handle empty equipment lists gracefully. Do not reset any database. Keep client-side behavior the same where it calls APIs.
```

---

## Phase 2: Programs and program entitlements

**Scope:** Programs CRUD and entitlements (ensureProgramPublished, grantProgramAccess, getSecureFullProgram, etc.) on Supabase. Programs table and related tables already exist in Supabase.

**Prompt for Cursor planning tool:**

```
Create a detailed migration plan to move Programs (CRUD and entitlements) from Firebase/Firestore to Supabase.

Current state: Programs are stored in Firestore. Admin CRUD is in src/pages/api/admin/programs/ and src/lib/firebase/admin/programs.ts and program-persistence.ts. Public list and unlock use src/lib/firebase/public/program-service and src/lib/firebase/server/entitlements (ensureProgramPublished, grantProgramAccess, etc.). Client uses src/lib/firebase/admin/program-persistence and src/lib/firebase/client/user-programs.

Target state: Programs live in Supabase (programs, program_weeks or equivalent). Admin APIs and public APIs (programs index, unlock) use Supabase libs. Entitlements use Supabase user_programs (or equivalent). Mirror the pattern used for Challenges migration: Supabase admin lib for CRUD, public lib for published list, entitlement helpers for access control.

Plan should: (1) Map Firestore program document shape to Supabase schema; (2) Create or extend Supabase admin lib for programs; (3) Create or extend public lib and entitlement helpers; (4) Switch admin and public API routes to Supabase; (5) Handle empty program list and missing program gracefully (no 500). Do not reset any database. Client persistence can keep calling same API endpoints; only backend switches to Supabase.
```

---

## Phase 3: Client user-programs

**Scope:** Replace Firestore usage for "user's enrolled programs" with Supabase (or API backed by Supabase). Depends on Phase 2 (Programs on Supabase).

**Prompt for Cursor planning tool:**

```
Create a detailed migration plan to move client-side user-programs from Firestore to Supabase.

Current state: src/lib/firebase/client/user-programs.ts reads the user's enrolled programs from Firestore (user_programs or users/{uid}/programs style). This is used by the app to show "My Programs" or similar.

Target state: Client uses Supabase user_programs (and related program data) via an API or direct Supabase client with RLS. Assume Programs and user_programs are already in Supabase (Phase 2). Identify every component or page that uses the Firebase user-programs lib and switch them to the Supabase-backed path. Handle empty list gracefully. Do not reset any database.
```

---

## Phase 4: Generated exercises

**Scope:** Unify on Supabase for generated exercises. All reads/writes and public/admin APIs use Supabase `generated_exercises`; remove Firestore usage.

**Prompt for Cursor planning tool:**

```
Create a detailed migration plan to fully migrate Generated Exercises from Firebase/Firestore to Supabase.

Current state: Generated exercises are partially on Firestore and partially on Supabase. Firestore usage: src/lib/firebase/public/generated-exercise-service.ts, src/lib/firebase/client/generated-exercises.ts, admin exercise APIs, ExerciseImageGenerator, learn pages, sitemap. Supabase has generated_exercises table and some code (e.g. warmup enrichment, src/lib/supabase/public/generated-exercise-service) already uses it.

Target state: All generated-exercise reads and writes go through Supabase (generated_exercises table). Admin APIs (CRUD, generate-biomechanics, generate-page, update-deep-dive, generate-exercise-video), public APIs (learn by slug, sitemap), and client components (ExerciseImageGenerator, AdminExerciseDetailWrapper, ExercisePrescriptionEngine, etc.) use Supabase libs only. Remove or deprecate Firestore generated_exercises usage. Handle empty list and missing exercise gracefully. Do not reset any database.
```

---

## Phase 5: WODs (Workouts of the Day)

**Scope:** Move WOD CRUD and public list/detail from Firestore to Supabase (e.g. generated_wods or equivalent table).

**Prompt for Cursor planning tool:**

```
Create a detailed migration plan to move WODs (Workouts of the Day) from Firebase/Firestore to Supabase.

Current state: WODs are in Firestore. Server: src/lib/firebase/public/wod-service.ts, src/lib/firebase/admin/server-generated-wods.ts. Client: src/lib/firebase/client/generated-wods.ts. Pages: src/pages/wod/index.astro, src/pages/api/wod/index.ts. WODEngine saves/publishes via Firestore. API generate-wod uses getGeneratedWODByIdServer from Firebase.

Target state: WODs live in Supabase (e.g. generated_wods table if it exists, or define schema). All server and client WOD reads/writes use Supabase libs. Public WOD list and detail use Supabase. WODEngine and generate-wod API use Supabase. Handle empty WOD list gracefully (no 500). Do not reset any database.
```

---

## Phase 6: Client tracking (workout logs)

**Scope:** Write workout logs only to Supabase (via API or Supabase client); stop writing to Firestore `users/{uid}/workout_logs`.

**Prompt for Cursor planning tool:**

```
Create a detailed migration plan to move client-side workout log writes from Firestore to Supabase.

Current state: src/lib/firebase/client/tracking.ts writes to Firestore users/{userId}/workout_logs (set-level logs). Supabase already has workout_logs and user_workout_logs; other parts of the app may already write or read from Supabase for logs.

Target state: All workout log writes from the client go to Supabase (via API or Supabase client with RLS). Identify every call site of the Firebase tracking lib and switch to Supabase-backed logging. Remove or deprecate Firestore workout_logs writes. Do not reset any database. Preserve existing Supabase workout log schema and policies.
```

---

## Phase 7: Admin users and stats

**Scope:** Admin user list and dashboard stats from Supabase (and/or Firebase Auth if still in use). Minimize Firestore; prefer Supabase profiles and aggregates.

**Prompt for Cursor planning tool:**

```
Create a detailed migration plan to move Admin Users list and Dashboard Stats off Firebase/Firestore where possible.

Current state: src/pages/api/admin/users.ts uses getAllUsersWithAuthServer from Firebase (Firebase Auth list). src/pages/api/admin/stats.ts uses getDashboardStats from src/lib/firebase/admin/statistics.ts (likely Firestore and/or Auth). Admin UI shows user list and dashboard stats.

Target state: Prefer Supabase as source of truth: profiles for user list (with role), and Supabase tables for stats (counts of programs, challenges, workouts, etc.). If Firebase Auth is still used for login (Phase 8 not done), the plan may keep "list users via Firebase Auth" temporarily but should document it. Where possible, stats should aggregate from Supabase tables only. Handle empty user list and zero stats gracefully. Do not reset any database.
```

---

## Phase 8: Firebase Auth and Storage

**Scope:** Supabase Auth for login/session; Supabase Storage for uploads; remove Firebase Auth and Storage from app code.

**Prompt for Cursor planning tool:**

```
Create a detailed migration plan to replace Firebase Auth and Firebase Storage with Supabase Auth and Supabase Storage across the application.

Current state: Login and session use Firebase Auth (auth, getIdToken, onAuthStateChanged) from @/services/firebaseService. Many components and API flows use Firebase Auth for tokens and Firebase Storage for image/video uploads (AddImageModal, AddVideoModal, ExerciseVisualizationLabModal, challenge/workout persistence fallback, etc.). Admin API verification may already use Supabase (verifyAdminRequest); client still often uses Firebase for login and tokens.

Target state: (1) Supabase Auth is the only auth provider for the app: login, session, and API token verification use Supabase. (2) All file uploads (exercise images/videos, challenge images, etc.) use Supabase Storage; remove Firebase Storage usage. Plan should: identify every use of Firebase auth and Firebase storage; switch to Supabase Auth and Supabase Storage; update API routes to accept Supabase session only (or document dual support during transition); migrate or document profile/role storage in Supabase profiles. Do not reset any database. Preserve RLS and storage policies in Supabase.
```

---

## Execution order

| Order | Phase                           | Prompt section |
| ----- | ------------------------------- | -------------- |
| 1     | Server equipment                | Phase 1        |
| 2     | Programs + program entitlements | Phase 2        |
| 3     | Client user-programs            | Phase 3        |
| 4     | Generated exercises             | Phase 4        |
| 5     | WODs                            | Phase 5        |
| 6     | Client tracking                 | Phase 6        |
| 7     | Admin users + stats             | Phase 7        |
| 8     | Firebase Auth + Storage         | Phase 8        |

Use the prompt for the phase you are on in the Cursor planning tool to generate a detailed plan, then implement that phase before moving to the next.

---

## Firebase Cleanup (Phase 5 complete)

Phase 5 of the [Phase 5 Firebase Cleanup plan](../../.cursor/plans/phase_5_firebase_cleanup_bdce8c12.plan.md) is complete: Firebase packages and code have been removed; Timestamp types replaced with a local type; geminiService migrated off firebase/ai; env, check-env, deployment configs, and docs updated. **Phase 5 completed on 2025-02-27.**
