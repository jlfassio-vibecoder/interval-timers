/**
 * T4: Same parsing chain as TrainerLiveHostView / TrainerLiveClientJoinPage when applying
 * trainer_live_session_join_hints or Realtime UPDATE payloads.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { parseTrainerLiveShell } from '@/lib/trainer-live/shells';
import { parseIntervalWrapperKind } from '@/lib/trainer-live/wrappers/kind';
import { parseTabataSessionIdFromWrapperConfig } from '@/lib/trainer-live/wrappers/parseWrapperConfig';

describe('trainer_live_session_join_hints → room state (tabata)', () => {
  it('maps tabata kind, shell, and tabata_session_id from join_hints-shaped payload', () => {
    const row = {
      active: true,
      requires_invited_account: false,
      shell: 'countdown_timer',
      interval_wrapper_kind: 'tabata',
      interval_wrapper_config: {
        tabata_session_id: '550e8400-e29b-41d4-a716-446655440000',
      },
    };
    expect(parseTrainerLiveShell(row.shell)).toBe('countdown_timer');
    expect(parseIntervalWrapperKind(row.interval_wrapper_kind)).toBe('tabata');
    expect(parseTabataSessionIdFromWrapperConfig(row.interval_wrapper_config)).toBe(
      '550e8400-e29b-41d4-a716-446655440000'
    );
  });
});
