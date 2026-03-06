import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    'AMRAP With Friends: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '');

export type AmrapSessionRow = {
  id: string;
  host_token: string;
  duration_minutes: number;
  workout_list: string[];
  state: 'waiting' | 'setup' | 'work' | 'finished';
  time_left_sec: number;
  is_paused: boolean;
  started_at: string | null;
  created_at: string;
};

export type AmrapParticipantRow = {
  id: string;
  session_id: string;
  nickname: string;
  role: 'host' | 'joiner';
  joined_at: string;
};

export type AmrapRoundRow = {
  id: string;
  session_id: string;
  participant_id: string;
  round_index: number;
  elapsed_sec_at_round: number;
};
