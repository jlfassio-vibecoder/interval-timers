-- Create exercise-images storage bucket and policies (used by visualization lab, generated exercises, etc.)
-- Idempotent: bucket uses ON CONFLICT DO NOTHING; policies are dropped then recreated.

INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
VALUES ('exercise-images', 'exercise-images', true, now(), now())
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow authenticated uploads to exercise-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select exercise-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update exercise-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete exercise-images" ON storage.objects;

-- Restrict to owner to prevent cross-user overwrites/deletions
CREATE POLICY "Allow authenticated uploads to exercise-images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exercise-images' AND owner_id = auth.uid()::text);

-- SELECT required for upsert (client checks if object exists before overwrite); owner-only so users only manage own uploads
CREATE POLICY "Allow authenticated select exercise-images" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'exercise-images' AND owner_id = auth.uid()::text);

CREATE POLICY "Allow authenticated update exercise-images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'exercise-images' AND owner_id = auth.uid()::text)
WITH CHECK (bucket_id = 'exercise-images' AND owner_id = auth.uid()::text);

CREATE POLICY "Allow authenticated delete exercise-images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'exercise-images' AND owner_id = auth.uid()::text);
