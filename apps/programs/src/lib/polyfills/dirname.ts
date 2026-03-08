/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Polyfill for __dirname in ES modules
 * Required by Firebase Admin SDK which expects __dirname to be available
 * This must be imported before any Firebase Admin SDK code runs
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Create __dirname from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Make __dirname available globally for Firebase Admin SDK
// This must be set before any Firebase Admin SDK code is loaded
if (typeof (globalThis as { __dirname?: string }).__dirname === 'undefined') {
  (globalThis as { __dirname: string }).__dirname = __dirname;
}

// Side-effect only - no exports needed
