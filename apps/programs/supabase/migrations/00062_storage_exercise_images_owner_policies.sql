-- Tighten exercise-images RLS: restrict SELECT/UPDATE/DELETE (and INSERT check) to object owner
-- so authenticated users cannot overwrite or delete each other's uploads.
-- For DBs that already applied 00061 with the previous bucket-only policies.

DROP POLICY IF EXISTS "Allow authenticated uploads to exercise-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select exercise-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update exercise-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete exercise-images" ON storage.objects;

CREATE POLICY "Allow authenticated uploads to exercise-images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exercise-images' AND owner_id = auth.uid()::text);

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
