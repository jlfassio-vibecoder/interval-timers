# Vertex AI Permissions Fix - Production

## Issue

Production error: `403 Forbidden - Permission 'aiplatform.endpoints.predict' denied`

## Root Cause

Firebase App Hosting service accounts did not have the `roles/aiplatform.user` IAM role required to call Vertex AI API endpoints.

## Solution Applied

### Service Accounts Granted Permissions

1. **Firebase App Hosting Compute Service Account**
   - Service Account: `firebase-app-hosting-compute@ai-fitness-guy-26523278-3e978.iam.gserviceaccount.com`
   - Role Granted: `roles/aiplatform.user`
   - Command:
     ```bash
     gcloud projects add-iam-policy-binding ai-fitness-guy-26523278-3e978 \
       --member="serviceAccount:firebase-app-hosting-compute@ai-fitness-guy-26523278-3e978.iam.gserviceaccount.com" \
       --role="roles/aiplatform.user" \
       --condition=None
     ```

2. **Default Compute Service Account**
   - Service Account: `294607443271-compute@developer.gserviceaccount.com`
   - Role Granted: `roles/aiplatform.user`
   - Command:
     ```bash
     gcloud projects add-iam-policy-binding ai-fitness-guy-26523278-3e978 \
       --member="serviceAccount:294607443271-compute@developer.gserviceaccount.com" \
       --role="roles/aiplatform.user" \
       --condition=None
     ```

## Verification

### API Status

- ✅ Vertex AI API is enabled: `aiplatform.googleapis.com`
- ✅ Firebase Vertex AI API is enabled: `firebasevertexai.googleapis.com`

### Permissions Status

- ✅ `firebase-app-hosting-compute@ai-fitness-guy-26523278-3e978.iam.gserviceaccount.com` has `roles/aiplatform.user`
- ✅ `294607443271-compute@developer.gserviceaccount.com` has `roles/aiplatform.user`

## What This Fixes

The `roles/aiplatform.user` role grants the following permissions needed for Vertex AI API calls:

- `aiplatform.endpoints.predict` - Required for making predictions/chat completions
- `aiplatform.models.get` - Required for accessing model information
- Other Vertex AI read/use permissions

## Next Steps

1. **No code changes needed** - Permissions are now correctly configured
2. **No redeployment required** - IAM changes take effect immediately
3. **Test the API** - The `/api/ai/generate-program` endpoint should now work in production

## Additional Notes

- The Vertex AI API was already enabled (no action needed)
- Both service accounts were granted permissions to ensure coverage
- IAM changes propagate immediately (no waiting period)

## Date Fixed

2026-01-27
