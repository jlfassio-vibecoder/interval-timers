#!/bin/bash
# Set environment variables for Firebase Hosting build.
#
# NOTE:
#   This script does not hard-code any live configuration values.
#   Define the variables below in your environment or in an untracked
#   .env.local file (in the app root, apps/programs) before running this script.
#
# Optionally load environment variables from a local file (not committed to VCS)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ -f "$APP_ROOT/.env.local" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$APP_ROOT/.env.local"
  set +a
fi
# Export variables (values come from environment or .env.local above)
export PUBLIC_FIREBASE_API_KEY="${PUBLIC_FIREBASE_API_KEY:-}"
export PUBLIC_FIREBASE_AUTH_DOMAIN="${PUBLIC_FIREBASE_AUTH_DOMAIN:-}"
export PUBLIC_FIREBASE_PROJECT_ID="${PUBLIC_FIREBASE_PROJECT_ID:-}"
export PUBLIC_FIREBASE_STORAGE_BUCKET="${PUBLIC_FIREBASE_STORAGE_BUCKET:-}"
export PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${PUBLIC_FIREBASE_MESSAGING_SENDER_ID:-}"
export PUBLIC_FIREBASE_APP_ID="${PUBLIC_FIREBASE_APP_ID:-}"
export PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY="${PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY:-}"
export PUBLIC_GEMINI_API_KEY="${PUBLIC_GEMINI_API_KEY:-}"
