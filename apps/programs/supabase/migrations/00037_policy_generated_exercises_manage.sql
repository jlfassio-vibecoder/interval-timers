CREATE POLICY "Authenticated can manage exercises" ON public.generated_exercises FOR ALL USING (auth.uid() IS NOT NULL);
