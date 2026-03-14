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

---

## Firebase (Legacy)

## Your User Details (use placeholders)

- **UID**: `<UID>` — get this from [Firebase Console → Authentication → Users](https://console.firebase.google.com/project/_/authentication/users): open a user and copy the **User UID**.
- **Email**: `<EMAIL>` — the user’s email (for your reference when editing the document).

## Method 1: Firebase Console (Fastest - ~2 minutes)

1. **Open Firebase Console**: https://console.firebase.google.com/project/ai-fitness-guy-26523278-3e978/firestore/data

2. **Navigate to users collection**:
   - Click "Firestore Database" in left sidebar
   - Click "Data" tab
   - If "users" collection doesn't exist, click "Start collection" and name it "users"
   - Click on "users" collection

3. **Add/Edit Document**:
   - Click "Add document" (or find existing document with ID `<UID>`)
   - **Document ID**: `<UID>`
   - Add these fields:

     ```
     Field name: uid
     Type: string
     Value: <UID>

     Field name: email
     Type: string
     Value: <EMAIL>

     Field name: isAdmin
     Type: boolean
     Value: true  ← THIS IS CRITICAL!

     Field name: createdAt
     Type: string
     Value: 2026-01-25T00:00:00.000Z

     Field name: purchasedIndex
     Type: null
     Value: null
     ```

4. **Click "Save"**

5. **Test**: Go back to your admin dashboard and try creating a program - it should work now!

## Method 2: Using the Script (Requires gcloud setup)

If you prefer CLI:

```bash
# Set up credentials (one-time)
gcloud auth application-default login

# Run the script
node scripts/set-admin-user.js
```

## Verification

After setting `isAdmin: true`, the create program operation should work. The error message will change from "permission-denied" to success, and you'll be redirected to the program editor.
