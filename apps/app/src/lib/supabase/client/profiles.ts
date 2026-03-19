/**
 * Client-side profile updates. Replaces firebaseService.updatePurchasedPass.
 */

import { supabase } from '../supabase-instance';
import { HEALTH_GUIDELINE_WEEKLY_MINUTES } from '@/lib/training-log-constants';

const DEFAULT_WEEKLY_GOAL_MINUTES = HEALTH_GUIDELINE_WEEKLY_MINUTES;

export async function getWeeklyGoalMinutes(uid: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('weekly_goal_minutes')
    .eq('id', uid)
    .maybeSingle();

  if (error) throw error;
  const val = data?.weekly_goal_minutes;
  return typeof val === 'number' && val > 0 ? val : DEFAULT_WEEKLY_GOAL_MINUTES;
}

export async function updateWeeklyGoalMinutes(uid: string, minutes: number): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ weekly_goal_minutes: Math.max(1, Math.min(999, minutes)) })
    .eq('id', uid);

  if (error) throw error;
}

export async function updatePurchasedPass(uid: string, index: number): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ purchased_index: index })
    .eq('id', uid);

  if (error) throw error;
}
