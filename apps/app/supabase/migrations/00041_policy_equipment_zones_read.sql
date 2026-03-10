CREATE POLICY "Authenticated can read equipment_zones" ON public.equipment_zones FOR SELECT USING (auth.uid() IS NOT NULL);
