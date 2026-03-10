CREATE POLICY "Users can manage own user_challenges" ON public.user_challenges FOR ALL USING (auth.uid() = user_id);
