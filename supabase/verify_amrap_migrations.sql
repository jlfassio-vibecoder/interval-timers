-- Run this in Supabase Dashboard → SQL Editor against the project where you applied AMRAP migrations.
-- Verifies: create_session single signature, join_session lock, log_round RPC, unique constraint, RLS/grants.
--
-- Correct migration order (oldest first): 20250305000000 → 20250305100000 → 20250305200000 → 20250305300000 → 20250305400000

-- 1. create_session: exactly one overload (int, text, jsonb, timestamptz) for scheduled_start_at
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'create_session';
-- Expected: 1 row with args including p_scheduled_start_at timestamp with time zone

-- 2. join_session: body should contain FOR UPDATE
SELECT proname, pg_get_functiondef(oid) LIKE '%FOR UPDATE%' AS has_for_update
FROM pg_proc
WHERE proname = 'join_session';
-- Expected: has_for_update = true

-- 3. log_round exists
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'log_round';
-- Expected: 1 row with p_session_id uuid, p_participant_id uuid, p_elapsed_sec_at_round integer

-- 4. amrap_rounds unique constraint
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.amrap_rounds'::regclass
  AND contype = 'u';
-- Expected: amrap_rounds_session_participant_round_unique, UNIQUE (session_id, participant_id, round_index)

-- 5. amrap_rounds: no INSERT policy for anon (policy dropped)
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'amrap_rounds';
-- Expected: no row with cmd = 'INSERT' (amrap_rounds_insert was dropped)

-- 6. amrap_sessions: anon cannot select host_token; can select scheduled_start_at
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'amrap_sessions' AND grantee = 'anon'
ORDER BY column_name;
-- Expected: id, duration_minutes, workout_list, state, time_left_sec, is_paused, started_at, created_at, scheduled_start_at (no host_token)
