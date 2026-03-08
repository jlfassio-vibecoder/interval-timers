CREATE POLICY "Admin can manage equipment_zones" ON public.equipment_zones FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
