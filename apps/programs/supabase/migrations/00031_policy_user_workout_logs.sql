CREATE POLICY "Users can manage own user_workout_logs" ON public.user_workout_logs FOR ALL USING (auth.uid() = user_id);
