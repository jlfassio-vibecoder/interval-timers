# Firebase project and account (archived)

**Firebase is no longer used.** This document is kept for reference only. The app uses Supabase for auth, data, and storage.

---

This repo previously used a single Firebase project for Firestore, Auth, and Storage.

| Setting        | Value                           |
| -------------- | ------------------------------- |
| **Project ID** | `ai-fitness-guy-26523278-3e978` |
| **Account**    | `jlfassio@gmail.com`            |

## Repo configuration

- **`.firebaserc`** – Sets the default project to `ai-fitness-guy-26523278-3e978`. The Firebase CLI and tools that read this file (including the Firebase MCP server when using this directory) will use this project.

## Ensuring correct account and project

1. **Firebase CLI**  
   Log in and select the project:

   ```bash
   firebase login
   firebase use default
   ```

   If you have multiple accounts, sign in as `jlfassio@gmail.com` when prompted.

2. **Firebase MCP server**  
   When using the Firebase MCP server from this repo, it should use the project in `.firebaserc` (same directory as `firebase.json`). Ensure:
   - Your Cursor/MCP Firebase integration is pointed at this project root, and
   - The account that has access to `ai-fitness-guy-26523278-3e978` is the one used by the MCP server (e.g. the same account as `firebase login` on this machine: `jlfassio@gmail.com`).

3. **Application Default Credentials (server/Admin)**  
   For `firebase-admin` and Google Cloud APIs (e.g. in API routes), use:
   ```bash
   gcloud auth application-default login
   ```
   with the same Google account (`jlfassio@gmail.com`) that owns the Firebase project.
