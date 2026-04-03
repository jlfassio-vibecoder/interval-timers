import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('../hooks/useSocialAmrap', () => ({
  useSocialAmrap: vi.fn(() => ({
    timerPhase: 'waiting',
    pageState: {},
  })),
}))

import { useSocialAmrapEmbedded } from './index'
import { useSocialAmrap } from '../hooks/useSocialAmrap'

const useSocialAmrapMock = vi.mocked(useSocialAmrap)

describe('useSocialAmrapEmbedded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls useSocialAmrap with skipAgora true and forwards options', () => {
    const onDismiss = () => {}
    renderHook(() =>
      useSocialAmrapEmbedded({
        amrapSessionId: 'sess-1',
        embedVideo: 'trainer_live',
        recapDismissed: true,
        onDismissFinishedRecap: onDismiss,
      })
    )

    expect(useSocialAmrapMock).toHaveBeenCalledWith('sess-1', {
      recapDismissed: true,
      onDismissFinishedRecap: onDismiss,
      skipAgora: true,
      hideMessageBoard: true,
    })
  })

  it('allows hideMessageBoard false to show embedded AMRAP message board', () => {
    renderHook(() =>
      useSocialAmrapEmbedded({
        amrapSessionId: 'sess-2',
        embedVideo: 'trainer_live',
        hideMessageBoard: false,
      })
    )

    expect(useSocialAmrapMock).toHaveBeenCalledWith('sess-2', {
      skipAgora: true,
      hideMessageBoard: false,
    })
  })

  it('throws when embedVideo is not trainer_live', () => {
    expect(() =>
      renderHook(() =>
        useSocialAmrapEmbedded({
          amrapSessionId: 'x',
          embedVideo: 'other' as 'trainer_live',
        })
      )
    ).toThrow(/unsupported embedVideo/)
  })
})
