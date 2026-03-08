CREATE POLICY "Users can manage own user_programs" ON public.user_programs FOR ALL USING (auth.uid() = user_id);
