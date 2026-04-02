/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  decodeTrainerClientMessagesCursor,
  encodeTrainerClientMessagesCursor,
} from '@/lib/supabase/admin/trainer-client-messages';

describe('trainer-client-messages cursor', () => {
  it('encode/decode round-trip', () => {
    const c = encodeTrainerClientMessagesCursor(150);
    const d = decodeTrainerClientMessagesCursor(c);
    expect(d).toEqual({ ok: true, offset: 150 });
  });

  it('rejects invalid cursor', () => {
    expect(decodeTrainerClientMessagesCursor('')).toEqual({ ok: false });
    expect(decodeTrainerClientMessagesCursor('not-base64!!!')).toEqual({ ok: false });
    expect(decodeTrainerClientMessagesCursor(encodeTrainerClientMessagesCursor(-1))).toEqual({
      ok: false,
    });
    expect(decodeTrainerClientMessagesCursor(encodeTrainerClientMessagesCursor(2e6))).toEqual({
      ok: false,
    });
  });
});
