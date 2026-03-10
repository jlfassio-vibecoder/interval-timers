# Vertex AI Setup Instructions

**Note:** Deep dive page generation uses the **Gemini API** (API key), not Vertex AI. For production, set `GEMINI_API_KEY` in Firebase Console → App Hosting → Secrets so the generate-page API can call Gemini.

## Current Issue

You're getting a 403 Permission Denied error because:

1. The Vertex AI API may not be enabled for your project
2. Your account doesn't have the necessary IAM permissions

## Required Actions

### Option 1: Ask Project Owner/Editor to Grant Permissions

Ask someone with **Owner** or **Editor** role on the `ai-fitness-guy-26523278-3e978` project to run these commands:

```bash
# 1. Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com --project=ai-fitness-guy-26523278-3e978

# 2. Grant Vertex AI User role to your account
gcloud projects add-iam-policy-binding ai-fitness-guy-26523278-3e978 \
  --member="user:jlfassio@gmail.com" \
  --role="roles/aiplatform.user"
```

### Option 2: Use Service Account (Recommended for Production)

1. **Create a Service Account** (requires Owner/Editor):

   ```bash
   gcloud iam service-accounts create vertex-ai-service \
     --display-name="Vertex AI Service Account" \
     --project=ai-fitness-guy-26523278-3e978
   ```

2. **Grant Vertex AI User role to service account**:

   ```bash
   gcloud projects add-iam-policy-binding ai-fitness-guy-26523278-3e978 \
     --member="serviceAccount:vertex-ai-service@ai-fitness-guy-26523278-3e978.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   ```

3. **Create and download service account key**:

   ```bash
   gcloud iam service-accounts keys create service-account-key.json \
     --iam-account=vertex-ai-service@ai-fitness-guy-26523278-3e978.iam.gserviceaccount.com \
     --project=ai-fitness-guy-26523278-3e978
   ```

4. **Set environment variable**:

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
   ```

5. **Update API route** to use service account key if `GOOGLE_APPLICATION_CREDENTIALS` is set.

### Option 3: Check Current Permissions

If you have access, check your current roles:

```bash
gcloud projects get-iam-policy ai-fitness-guy-26523278-3e978 \
  --flatten="bindings[].members" \
  --filter="bindings.members:jlfassio@gmail.com" \
  --format="table(bindings.role)"
```

## Verification

After permissions are granted, verify:

1. **API is enabled**:

   ```bash
   gcloud services list --enabled --project=ai-fitness-guy-26523278-3e978 | grep aiplatform
   ```

2. **Test authentication**:

   ```bash
   gcloud auth application-default print-access-token
   ```

3. **Test API access** (if you have gcloud with Vertex AI):
   ```bash
   gcloud ai models list --region=us-central1 --project=ai-fitness-guy-26523278-3e978
   ```

## Current Status

- ✅ `GOOGLE_PROJECT_ID` is set in `.env.local`
- ✅ Application default credentials are configured
- ❌ Vertex AI API may not be enabled
- ❌ Account may not have `roles/aiplatform.user` permission

## Next Steps

1. Contact project owner/editor to enable API and grant permissions
2. Or set up service account authentication (Option 2)
3. Restart dev server after permissions are granted
