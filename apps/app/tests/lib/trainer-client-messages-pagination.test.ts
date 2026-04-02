/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { partitionTrainerClientMessageFetch } from '@/lib/supabase/admin/trainer-client-messages';

describe('partitionTrainerClientMessageFetch', () => {
  it('drops the has-more probe row from the returned page (no boundary duplicate in payload)', () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({ id: `m-${i}` }));
    const { page, nextCursorOffset } = partitionTrainerClientMessageFetch(rows, 50, 0);
    expect(page).toHaveLength(50);
    expect(page.some((r) => r.id === 'm-50')).toBe(false);
    expect(nextCursorOffset).toBe(50);
  });

  it('next window ids do not overlap the previous page ids', () => {
    const first = partitionTrainerClientMessageFetch(
      Array.from({ length: 51 }, (_, i) => ({ id: `m-${i}` })),
      50,
      0
    );
    const secondBatch = Array.from({ length: 11 }, (_, i) => ({ id: `m-${50 + i}` }));
    const second = partitionTrainerClientMessageFetch(secondBatch, 50, 50);
    const overlap = second.page.filter((r) => first.page.some((p) => p.id === r.id));
    expect(overlap).toHaveLength(0);
    expect(second.page[0]?.id).toBe('m-50');
  });

  it('returns all rows and null cursor when not more than pageSize', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: `m-${i}` }));
    const { page, nextCursorOffset } = partitionTrainerClientMessageFetch(rows, 50, 0);
    expect(page).toHaveLength(50);
    expect(nextCursorOffset).toBeNull();
  });
});
