CREATE POLICY "Admin can insert warmup_config" ON public.warmup_config FOR INSERT WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
