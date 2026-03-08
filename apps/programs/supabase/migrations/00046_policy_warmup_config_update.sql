CREATE POLICY "Admin can update warmup_config" ON public.warmup_config FOR UPDATE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
