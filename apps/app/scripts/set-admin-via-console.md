# Set Admin User - Quick Guide

Admin routes use **Supabase** `profiles.role`. Both `admin` and `trainer` roles can access admin pages.

## Supabase (Recommended for this project)

**If your user has no profile row** (e.g. signed up before the trigger existed), run this first in SQL Editor:

```sql
-- Backfill: create profiles for auth.users who don't have one
INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), u.raw_user_meta_data->>'avatar_url', 'client'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

**Then set role:**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Table Editor**.
2. Open the **profiles** table.
3. Find your row (by email or id from Auth → Users) and set **role** to `admin` or `trainer`.
4. Save.

Or run in **SQL Editor**:

```sql
UPDATE public.profiles SET role = 'admin' WHERE id = '<YOUR_USER_UUID>';
-- Get your UUID from Supabase Auth → Users
```

**Note:** If using local Supabase (`supabase start`), run the SQL in the local project. The app uses the Supabase URL from your `.env`.
