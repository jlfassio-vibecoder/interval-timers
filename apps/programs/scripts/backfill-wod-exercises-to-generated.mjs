/**
 * Backfill generated_exercises from WOD exerciseOverrides.
 * Exercises saved from the WOD Engine before we created GeneratedExercise documents
 * only exist in generated_wods.exerciseOverrides. This script creates matching
 * documents in generated_exercises so they appear in Admin > Generated Exercises.
 *
 * Usage: node scripts/backfill-wod-exercises-to-generated.mjs
 *
 * Requires Firebase Admin SDK credentials (same as set-admin-user.js).
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function generateSlug(name) {
  return (name || 'exercise')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'exercise';
}

async function ensureUniqueSlug(db, baseSlug) {
  let slug = baseSlug;
  let n = 0;
  while (true) {
    const snap = await db.collection('generated_exercises').where('slug', '==', slug).limit(1).get();
    if (snap.empty) return slug;
    n += 1;
    slug = `${baseSlug}-${n}`;
  }
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
      console.log('✓ Using service account credentials');
    } else {
      app = initializeApp({ projectId });
      console.log('✓ Using application default credentials');
    }
  } else {
    app = getApps()[0];
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  process.exit(1);
}

const db = getFirestore(app);

async function main() {
  console.log('\nFetching generated_wods with exerciseOverrides...\n');

  const wodsSnap = await db.collection('generated_wods').get();
  let created = 0;
  let skipped = 0;

  for (const wodDoc of wodsSnap.docs) {
    const wod = wodDoc.data();
    const overrides = wod.exerciseOverrides || {};
    const keys = Object.keys(overrides);
    if (keys.length === 0) continue;

    const generatedBy = wod.generatedBy || null;
    if (!generatedBy) {
      console.warn(`  WOD ${wodDoc.id}: missing generatedBy, skipping overrides`);
      continue;
    }

    for (const exerciseName of keys) {
      const exercise = overrides[exerciseName];
      if (!exercise || typeof exercise !== 'object') continue;
      const imageUrl = Array.isArray(exercise.images) && exercise.images[0] ? exercise.images[0] : '';
      const instructions = Array.isArray(exercise.instructions) ? exercise.instructions : [];

      const existing = await db
        .collection('generated_exercises')
        .where('exerciseName', '==', exerciseName)
        .limit(1)
        .get();

      if (!existing.empty) {
        console.log(`  Skip (exists): "${exerciseName}"`);
        skipped += 1;
        continue;
      }

      const baseSlug = generateSlug(exerciseName);
      const slug = await ensureUniqueSlug(db, baseSlug);
      const now = Timestamp.now();

      const doc = {
        slug,
        exerciseName: exerciseName.trim(),
        imageUrl: imageUrl || '',
        storagePath: `wod-override/${wodDoc.id}/${slug}`,
        kineticChainType: 'MOVEMENT PATTERN',
        biomechanics: {
          biomechanicalChain: '',
          pivotPoints: '',
          stabilizationNeeds: '',
          commonMistakes: [],
          performanceCues: instructions,
        },
        imagePrompt: '',
        complexityLevel: 'intermediate',
        visualStyle: 'photorealistic',
        sources: [],
        status: 'pending',
        generatedBy,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      await db.collection('generated_exercises').add(doc);
      console.log(`  Created: "${exerciseName}" → slug: ${slug}`);
      created += 1;
    }
  }

  console.log(`\n✅ Done. Created ${created}, skipped ${skipped} (already exist).\n`);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
