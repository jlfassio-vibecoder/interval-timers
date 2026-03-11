/**
 * Client-side profile updates. Replaces firebaseService.updatePurchasedPass.
 */

import { supabase } from '../supabase-instance';

export async function updatePurchasedPass(uid: string, index: number): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ purchased_index: index })
    .eq('id', uid);

  if (error) throw error;
}
