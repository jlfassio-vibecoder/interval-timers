CREATE POLICY "Users can manage own workout_logs" ON public.workout_logs FOR ALL USING (auth.uid() = user_id);
