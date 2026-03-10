# Set Admin User - Quick Guide

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
