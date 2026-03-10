/**
 * Script to set a user as admin in Firestore
 * Usage: node scripts/set-admin-user.js <uid> <email>
 * 
 * Requires Firebase Admin SDK credentials:
 * Option 1: Run: gcloud auth application-default login
 * Option 2: Place service-account-key.json in project root
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Get UID and email from command line args (required for security)
const uid = process.argv[2];
const email = process.argv[3];

if (!uid || !email) {
  console.error('❌ Missing required arguments.');
  console.error('Usage: node scripts/set-admin-user.js <uid> <email>');
  process.exit(1);
}

console.log('Setting admin user...');
console.log(`UID: ${uid}`);
console.log(`Email: ${email}\n`);

// Try to initialize Firebase Admin
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

const db = getFirestore(app);

async function setAdminUser() {
  try {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    // Admin SDK v9+ uses .exists property, not .exists() method
    const existingData = userDoc.exists ? userDoc.data() : {};
    const userData = {
      uid,
      email,
      isAdmin: true,
      createdAt: existingData.createdAt || new Date().toISOString(),
      purchasedIndex: existingData.purchasedIndex ?? null,
    };

    await userRef.set(userData, { merge: true });

    console.log('\n✅ Successfully set user as admin!');
    console.log(`   UID: ${uid}`);
    console.log(`   Email: ${email}`);
    console.log(`   isAdmin: true`);
    console.log('\n✓ User document updated in Firestore.');
    console.log('  You can now create programs in the admin dashboard.\n');
  } catch (error) {
    console.error('❌ Error setting admin user:', error.message);
    if (error.code === 'permission-denied') {
      console.error('\nPermission denied. Please ensure:');
      console.error('1. You are authenticated with Firebase');
      console.error('2. Your account has admin access to the Firebase project');
    }
    process.exit(1);
  }
}

setAdminUser().then(() => process.exit(0));
