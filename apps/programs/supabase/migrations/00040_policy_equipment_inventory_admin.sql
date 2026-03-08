CREATE POLICY "Admin can manage equipment_inventory" ON public.equipment_inventory FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
