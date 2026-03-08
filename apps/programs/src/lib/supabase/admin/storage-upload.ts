/**
 * Server-side Supabase Storage upload. Replaces firebase/admin/storage-upload.
 */

import { getSupabaseServer } from '../server';

const BUCKET = 'exercise-images';

/**
 * Upload a buffer to Supabase Storage and return the public URL and path.
 */
export async function uploadBufferToStorage(
  buffer: Buffer,
  storagePath: string,
  contentType: string
): Promise<{ downloadUrl: string; storagePath: string }> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return {
    downloadUrl: urlData.publicUrl,
    storagePath: data.path,
  };
}
