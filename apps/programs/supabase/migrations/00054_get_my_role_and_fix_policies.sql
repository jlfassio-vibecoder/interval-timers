-- Avoid RLS recursion: policies that read from profiles to check admin role
-- cause 500s. Use a SECURITY DEFINER function so the check bypasses RLS.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Fix "Admins can read all profiles" (was subquery on profiles -> recursion)
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (public.get_my_role() = 'admin');

-- Fix admin policies on other tables (they also subquery profiles)
DROP POLICY IF EXISTS "Admin can manage equipment_inventory" ON public.equipment_inventory;
CREATE POLICY "Admin can manage equipment_inventory" ON public.equipment_inventory
  FOR ALL USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admin can manage equipment_zones" ON public.equipment_zones;
CREATE POLICY "Admin can manage equipment_zones" ON public.equipment_zones
  FOR ALL USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admin can manage exercises" ON public.exercises;
CREATE POLICY "Admin can manage exercises" ON public.exercises
  FOR ALL USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admin can update warmup_config" ON public.warmup_config;
CREATE POLICY "Admin can update warmup_config" ON public.warmup_config
  FOR UPDATE USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admin can insert warmup_config" ON public.warmup_config;
CREATE POLICY "Admin can insert warmup_config" ON public.warmup_config
  FOR INSERT WITH CHECK (public.get_my_role() = 'admin');
