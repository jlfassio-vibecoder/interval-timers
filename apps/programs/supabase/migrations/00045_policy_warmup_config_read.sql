CREATE POLICY "Authenticated can read warmup_config" ON public.warmup_config FOR SELECT USING (auth.uid() IS NOT NULL);
