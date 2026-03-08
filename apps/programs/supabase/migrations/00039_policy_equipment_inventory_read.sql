CREATE POLICY "Authenticated can read equipment_inventory" ON public.equipment_inventory FOR SELECT USING (auth.uid() IS NOT NULL);
