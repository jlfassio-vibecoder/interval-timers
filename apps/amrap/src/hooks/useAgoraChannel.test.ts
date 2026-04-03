import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAgoraChannel } from './useAgoraChannel'

vi.mock('@/lib/agora', () => ({
  createClient: vi.fn(() => ({
    on: vi.fn(),
    leave: vi.fn(() => Promise.resolve()),
    removeAllListeners: vi.fn(),
    unpublish: vi.fn(),
    join: vi.fn(() => Promise.resolve()),
    publish: vi.fn(() => Promise.resolve()),
  })),
  getAppId: vi.fn(() => 'test-app-id'),
  getTokenOrFetchWithAccount: vi.fn(async () => ({ token: 'tok' })),
}))

vi.mock('agora-rtc-sdk-ng', () => ({
  default: {
    createMicrophoneAndCameraTracks: vi.fn(async () => {
      const a = { close: vi.fn(), stop: vi.fn(), setEnabled: vi.fn() }
      const v = { close: vi.fn(), stop: vi.fn(), setEnabled: vi.fn() }
      return [a, v]
    }),
  },
}))

import { createClient } from '@/lib/agora'
import AgoraRTC from 'agora-rtc-sdk-ng'

describe('useAgoraChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not call createClient or createMicrophoneAndCameraTracks when disabled', async () => {
    renderHook(() =>
      useAgoraChannel('channel-id', 'participant-id', { disabled: true })
    )

    await waitFor(() => {
      expect(createClient).not.toHaveBeenCalled()
      expect(AgoraRTC.createMicrophoneAndCameraTracks).not.toHaveBeenCalled()
    })
  })
})
