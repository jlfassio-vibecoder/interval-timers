# Admin Route 500 Error - Fix Applied

## Issue

Admin route (`/admin`) returning HTTP 500 Internal Server Error in production.

## Root Cause Analysis

The 500 error indicates an unhandled exception during server-side execution. Possible causes:

1. **Firebase Admin SDK Initialization Failure**
   - Admin SDK may fail to initialize in Firebase App Hosting
   - Missing or incorrect service account credentials
   - Environment variable issues

2. **Token Verification Failure**
   - Token extraction from cookie/header failing
   - Token verification with Firebase Admin SDK throwing unexpected errors

3. **Firestore Query Failure**
   - Admin status check query failing
   - Network or permission issues

## Fixes Applied

### 1. Enhanced Error Handling in Admin Route (`src/pages/admin/[...slug].astro`)

- Added error logging (gated by `PUBLIC_ENABLE_ERROR_LOGGING` env var)
- Improved error details in catch block
- Maintains redirect behavior for security

### 2. Robust Admin SDK Initialization (`src/lib/firebase/admin/auth.ts`)

- Wrapped `getAdminAuth()` initialization in try-catch
- Wrapped `getAdminFirestore()` initialization in try-catch
- Added error logging for debugging
- Throws descriptive errors instead of crashing

### 3. Enhanced Token Verification

- Added try-catch around `verifyIdToken()` call
- Converts all verification errors to `UNAUTHENTICATED` for consistent handling
- Added error logging

### 4. Enhanced Admin Status Check

- Added try-catch around Firestore query
- Returns `false` on error (fail-secure: deny access)
- Added error logging

## Debugging

To enable error logging in production, set:

```yaml
env:
  - variable: PUBLIC_ENABLE_ERROR_LOGGING
    value: 'true'
    availability:
      - RUNTIME
```

Then check Firebase App Hosting logs to see detailed error messages.

## Next Steps

1. **Deploy these changes** to production
2. **Test the admin route** again
3. **If still failing:**
   - Enable `PUBLIC_ENABLE_ERROR_LOGGING` temporarily
   - Check Firebase App Hosting logs for specific error
   - Verify Firebase Admin SDK service account is properly configured in App Hosting

## Verification

After deployment, the admin route should:

- ✅ Redirect to `/` if not authenticated (instead of 500)
- ✅ Redirect to `/` if not an admin (instead of 500)
- ✅ Show admin dashboard if authenticated and admin
- ✅ Log errors to console (if `PUBLIC_ENABLE_ERROR_LOGGING=true`)

## Files Changed

- `src/pages/admin/[...slug].astro` - Added error logging
- `src/lib/firebase/admin/auth.ts` - Added comprehensive error handling
