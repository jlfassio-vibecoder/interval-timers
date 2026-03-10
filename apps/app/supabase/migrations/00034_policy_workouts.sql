CREATE POLICY "Trainers can manage own workouts" ON public.workouts FOR ALL USING (auth.uid() = trainer_id);
