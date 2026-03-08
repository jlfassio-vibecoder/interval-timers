CREATE POLICY "Authenticated can read exercises" ON public.exercises FOR SELECT USING (auth.uid() IS NOT NULL);
