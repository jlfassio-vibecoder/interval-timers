/**
 * Simple script to set admin using Firebase Web SDK
 * This uses your existing Firebase config and requires you to be logged in
 * 
 * Run this in browser console at http://localhost:3002/admin/programs
 * OR use: node -e "..." (but requires browser context)
 * 
 * Actually, the simplest is to use Firebase Console directly:
 * 1. Go to Firebase Console → Firestore Database → Data
 * 2. Navigate to users collection
 * 3. Create/edit document with ID: RaJARHpHfpgzYW3Wr6EjfLj9pJc2
 * 4. Set fields:
 *    - uid: "RaJARHpHfpgzYW3Wr6EjfLj9pJc2"
 *    - email: "jlfassio@gmail.com"
 *    - isAdmin: true (boolean)
 *    - createdAt: "2026-01-25T00:00:00.000Z"
 *    - purchasedIndex: null
 */

console.log(`
To set yourself as admin, use one of these methods:

METHOD 1: Firebase Console (Easiest)
1. Go to: https://console.firebase.google.com/project/ai-fitness-guy-26523278-3e978/firestore
2. Click "Firestore Database" → "Data"
3. Navigate to "users" collection
4. Click "Add document" or find existing document
5. Document ID: RaJARHpHfpgzYW3Wr6EjfLj9pJc2
6. Add fields:
   - uid (string): RaJARHpHfpgzYW3Wr6EjfLj9pJc2
   - email (string): jlfassio@gmail.com
   - isAdmin (boolean): true
   - createdAt (string): 2026-01-25T00:00:00.000Z
   - purchasedIndex (null): null
7. Click "Save"

METHOD 2: Browser Console (If logged in)
1. Open browser console at http://localhost:3002/admin/programs
2. Run this code:
   import { db, auth } from '/src/services/firebaseService.js';
   import { doc, setDoc } from 'firebase/firestore';
   const userRef = doc(db, 'users', 'RaJARHpHfpgzYW3Wr6EjfLj9pJc2');
   await setDoc(userRef, {
     uid: 'RaJARHpHfpgzYW3Wr6EjfLj9pJc2',
     email: 'jlfassio@gmail.com',
     isAdmin: true,
     createdAt: new Date().toISOString(),
     purchasedIndex: null
   }, { merge: true });
   console.log('Admin set!');

METHOD 3: CLI with Service Account
1. Download service account key from Firebase Console
2. Save as: service-account-key.json in project root
3. Run: node scripts/set-admin-user.js
`);
