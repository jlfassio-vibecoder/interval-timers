/**
 * Inspect whether generated_exercises documents have a 'sources' field and how it's populated.
 * Use this to verify if citation links can appear on exercise/depth dive pages.
 *
 * Usage: node scripts/inspect-exercise-sources.mjs
 *
 * Requires Firebase Admin SDK (service-account-key.json or ADC).
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
      process.env.GOOGLE_CLOUD_PROJECT ||
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
  console.log('\n--- Inspecting generated_exercises for sources field ---\n');

  const snap = await db
    .collection('generated_exercises')
    .where('status', '==', 'approved')
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  if (snap.empty) {
    console.log('No approved exercises found.');
    return;
  }

  let withSources = 0;
  let withoutSources = 0;
  const samples = [];

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const sources = data.sources;
    const hasSources = Array.isArray(sources) && sources.length > 0;

    if (hasSources) {
      withSources++;
      if (samples.length < 3) {
        samples.push({
          id: docSnap.id,
          slug: data.slug,
          exerciseName: data.exerciseName,
          sourcesCount: sources.length,
          sample: sources.slice(0, 2),
        });
      }
    } else {
      withoutSources++;
    }
  });

  console.log(`Total inspected: ${snap.size}`);
  console.log(`With sources:   ${withSources}`);
  console.log(`Without sources: ${withoutSources}`);
  console.log('');

  if (samples.length > 0) {
    console.log('Sample documents WITH sources:');
    samples.forEach((s) => {
      console.log(`  - ${s.exerciseName} (slug: ${s.slug})`);
      console.log(`    sources: ${s.sourcesCount} items`);
      console.log(`    sample: ${JSON.stringify(s.sample, null, 4).split('\n').join('\n    ')}`);
    });
  }

  if (withoutSources > 0) {
    console.log('\nDocuments without sources will show the fallback link on the deep dive page.');
    console.log('Sources are only set when exercises are created via the research flow (ExerciseImageGenerator,');
    console.log('RegenerateImageModal, or ExerciseVisualizationLabModal) which uses Gemini grounding.');
  }
}

inspect()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
