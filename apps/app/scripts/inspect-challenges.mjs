/**
 * Inspect challenges in Firestore.
 * Usage: node scripts/inspect-challenges.mjs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

let app;
try {
  if (getApps().length === 0) {
    const projectId =
      process.env.PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_PROJECT_ID ||
      'ai-fitness-guy-26523278-3e978';
    const serviceAccountPath = join(projectRoot, 'service-account-key.json');
    if (existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
      console.log('✓ Using service account credentials');
    } else {
      app = initializeApp({ projectId });
      console.log('✓ Using default credentials (ADC)');
    }
  }
} catch (e) {
  console.error('Firebase init failed:', e.message);
  process.exit(1);
}

const db = getFirestore(app);

async function inspect() {
  console.log('\n--- Inspecting challenges collection ---\n');

  const snap = await db.collection('challenges').get();

  if (snap.empty) {
    console.log('No challenges found.');
    return;
  }

  console.log(`Total challenges: ${snap.size}\n`);

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const status = data.status ?? '(missing)';
    const title = data.title ?? '(no title)';
    const createdAt = data.createdAt;
    const createdAtStr = createdAt
      ? typeof createdAt.toMillis === 'function'
        ? new Date(createdAt.toMillis()).toISOString()
        : JSON.stringify(createdAt)
      : '(missing)';

    console.log(`  ID: ${docSnap.id}`);
    console.log(`    title: ${title}`);
    console.log(`    status: ${status}`);
    console.log(`    createdAt: ${createdAtStr}`);
    console.log(`    keys: ${Object.keys(data).join(', ')}`);
    console.log('');
  });
}

inspect()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
