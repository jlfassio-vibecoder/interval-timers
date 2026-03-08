CREATE POLICY "Admin can manage exercises" ON public.exercises FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
