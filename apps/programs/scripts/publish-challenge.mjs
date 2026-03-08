/**
 * Publish a challenge by ID (set status to 'published').
 * Usage: node scripts/publish-challenge.mjs <challengeId>
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const challengeId = process.argv[2];
if (!challengeId) {
  console.error('Usage: node scripts/publish-challenge.mjs <challengeId>');
  process.exit(1);
}

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
    } else {
      app = initializeApp({ projectId });
    }
  }
} catch (e) {
  console.error('Firebase init failed:', e.message);
  process.exit(1);
}

const db = getFirestore(app);

async function publish() {
  const ref = db.collection('challenges').doc(challengeId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`Challenge ${challengeId} not found.`);
    process.exit(1);
  }
  await ref.update({ status: 'published', updatedAt: FieldValue.serverTimestamp() });
  console.log(`Published challenge: ${challengeId} (${snap.data().title || 'Untitled'})`);
}

publish()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
