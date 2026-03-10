CREATE POLICY "Authenticated can manage exercise_images" ON public.exercise_images FOR ALL USING (auth.uid() IS NOT NULL);
