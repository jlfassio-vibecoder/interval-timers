/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Script to set admin custom claim on a Firebase Auth user
 * This replaces the Firestore-based admin check with Firebase Auth custom claims
 *
 * Usage:
 *   node scripts/set-admin-custom-claim.js <uid>
 *
 * Example:
 *   node scripts/set-admin-custom-claim.js RaJARHpHfpgzYW3Wr6EjfLj9pJc2
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Get UID from command line argument
const uid = process.argv[2];

if (!uid) {
  console.error('❌ Error: UID is required');
  console.error('\nUsage: node scripts/set-admin-custom-claim.js <uid>');
  console.error('\nExample:');
  console.error('  node scripts/set-admin-custom-claim.js RaJARHpHfpgzYW3Wr6EjfLj9pJc2');
  process.exit(1);
}

// Initialize Firebase Admin
let app;
try {
  if (getApps().length === 0) {
    // Try service account first
    const serviceAccountPath = join(projectRoot, 'service-account-key.json');
    if (existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: 'ai-fitness-guy-26523278-3e978',
      });
      console.log('✓ Using service account credentials');
    } else {
      // Use application default credentials
      app = initializeApp({
        projectId: 'ai-fitness-guy-26523278-3e978',
      });
      console.log('✓ Using application default credentials');
      console.log('  (Run "gcloud auth application-default login" if needed)');
    }
  } else {
    app = getApps()[0];
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  console.error('\nPlease set up credentials:');
  console.error('1. Run: gcloud auth application-default login');
  console.error('   OR');
  console.error('2. Download service account key from Firebase Console');
  console.error('   and save as: service-account-key.json in project root');
  process.exit(1);
}

const auth = getAuth(app);

async function setAdminClaim() {
  try {
    console.log(`\n🔧 Setting admin custom claim for UID: ${uid}...`);

    // Set custom claim
    await auth.setCustomUserClaims(uid, { admin: true });

    console.log('✅ Admin custom claim set successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. The user needs to sign out and sign back in for the claim to take effect');
    console.log('2. Or the user can refresh their ID token:');
    console.log('   - In browser console: await firebase.auth().currentUser?.getIdToken(true)');
    console.log('\n🔍 Verify the claim:');
    console.log(`   - Check Firebase Console → Authentication → Users → ${uid}`);
    console.log('   - Look for "Custom claims" section');
  } catch (error) {
    console.error('❌ Failed to set admin custom claim:', error.message);
    if (error.code === 'auth/user-not-found') {
      console.error('\n💡 User not found. Make sure the UID is correct.');
    }
    process.exit(1);
  }
}

setAdminClaim();
