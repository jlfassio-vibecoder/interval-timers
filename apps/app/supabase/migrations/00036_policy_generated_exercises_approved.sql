CREATE POLICY "Anyone can read approved exercises" ON public.generated_exercises FOR SELECT USING (status = 'approved');
