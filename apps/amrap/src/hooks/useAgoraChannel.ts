import { useState, useEffect, useCallback, useRef } from 'react'
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
  type IRemoteVideoTrack,
  type IRemoteAudioTrack,
} from 'agora-rtc-sdk-ng'
import { createClient, getAppId, getTokenOrFetchWithAccount } from '@/lib/agora'

export interface RemoteUserWithTracks {
  uid: string | number
  videoTrack?: IRemoteVideoTrack
  audioTrack?: IRemoteAudioTrack
}

export interface UseAgoraChannelResult {
  joined: boolean
  localVideoTrack: ICameraVideoTrack | null
  localAudioTrack: IMicrophoneAudioTrack | null
  remoteUsers: RemoteUserWithTracks[]
  leave: () => Promise<void>
  muteVideo: (muted: boolean) => void
  muteAudio: (muted: boolean) => void
  error: string | null
}

export function useAgoraChannel(
  channelName: string,
  participantId: string | null
): UseAgoraChannelResult {
  const [joined, setJoined] = useState(false)
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null)
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null)
  const [remoteUsers, setRemoteUsers] = useState<RemoteUserWithTracks[]>([])
  const [error, setError] = useState<string | null>(null)
  const clientRef = useRef<IAgoraRTCClient | null>(null)
  const tracksRef = useRef<{ video: ICameraVideoTrack; audio: IMicrophoneAudioTrack } | null>(null)

  const addRemoteUser = useCallback((uid: string | number, video?: IRemoteVideoTrack, audio?: IRemoteAudioTrack) => {
    setRemoteUsers((prev) => {
      if (prev.some((u) => String(u.uid) === String(uid))) {
        return prev.map((u) =>
          String(u.uid) === String(uid) ? { ...u, videoTrack: video ?? u.videoTrack, audioTrack: audio ?? u.audioTrack } : u
        )
      }
      return [...prev, { uid, videoTrack: video, audioTrack: audio }]
    })
  }, [])

  const removeRemoteUser = useCallback((uid: string | number) => {
    setRemoteUsers((prev) => prev.filter((u) => String(u.uid) !== String(uid)))
  }, [])

  const clearRemoteUserTrack = useCallback((uid: string | number, mediaType: 'video' | 'audio') => {
    setRemoteUsers((prev) =>
      prev.map((u) =>
        String(u.uid) === String(uid)
          ? { ...u, ...(mediaType === 'video' ? { videoTrack: undefined } : { audioTrack: undefined }) }
          : u
      )
    )
  }, [])

  const leave = useCallback(async () => {
    const client = clientRef.current
    const tracks = tracksRef.current
    if (tracks && client) {
      try {
        await client.unpublish([tracks.video, tracks.audio])
      } catch {
        /* already unpublished */
      }
      try {
        tracks.video.stop()
      } catch {
        /* already stopped */
      }
      try {
        tracks.audio.stop()
      } catch {
        /* already stopped */
      }
      try {
        tracks.video.close()
      } catch {
        /* already closed */
      }
      try {
        tracks.audio.close()
      } catch {
        /* already closed */
      }
      tracksRef.current = null
    }
    if (client) {
      await client.leave()
      client.removeAllListeners()
      clientRef.current = null
    }
    setLocalVideoTrack(null)
    setLocalAudioTrack(null)
    setRemoteUsers([])
    setJoined(false)
  }, [])

  const muteVideo = useCallback((muted: boolean) => {
    tracksRef.current?.video.setEnabled(!muted)
  }, [])

  const muteAudio = useCallback((muted: boolean) => {
    tracksRef.current?.audio.setEnabled(!muted)
  }, [])

  useEffect(() => {
    if (!channelName || !participantId) {
      return () => {}
    }

    const appId = getAppId()
    if (!appId) {
      setError('VITE_AGORA_APP_ID is not set') // eslint-disable-line react-hooks/set-state-in-effect -- sync config to UI
      return () => {}
    }

    const client = createClient()
    clientRef.current = client

    client.on('user-published', async (user, mediaType) => {
      try {
        await client.subscribe(user, mediaType)
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play()
        }
        addRemoteUser(user.uid, user.videoTrack, user.audioTrack)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to handle remote user publication'
        setError(msg)
      }
    })
    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video' || mediaType === 'audio') {
        clearRemoteUserTrack(user.uid, mediaType)
      }
    })
    client.on('user-left', (user) => {
      removeRemoteUser(user.uid)
    })

    const run = async () => {
      try {
        setError(null)
        const result = await getTokenOrFetchWithAccount(channelName, participantId)
        if ('error' in result) {
          if (typeof window !== 'undefined') console.warn('[Agora] Token fetch failed:', result.error)
          setError(result.error)
          return
        }
        await client.join(appId, channelName, result.token, participantId)

        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks()
        tracksRef.current = { video: videoTrack, audio: audioTrack }
        await client.publish([audioTrack, videoTrack])
        setLocalVideoTrack(videoTrack)
        setLocalAudioTrack(audioTrack)
        setJoined(true)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to join channel'
        if (typeof window !== 'undefined') console.warn('[Agora] Join failed:', msg, e)
        let hint = ''
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
          hint = ' — Camera or microphone access denied'
        } else if (msg.includes('dynamic use static key')) {
          hint =
            ' — Enable App Certificate requires a token. Add VITE_AGORA_TOKEN or disable App Certificate for testing.'
        } else if (msg.includes('CAN_NOT_GET_GATEWAY') && msg.includes('unknown error')) {
          hint =
            ' — Often caused by: (1) token mismatch for channel/uid; (2) token expired; (3) network/firewall; (4) invalid App ID.'
        }
        setError(msg + hint)
      }
    }
    void run()

    return () => {
      const tracks = tracksRef.current
      if (tracks) {
        try {
          void client.unpublish([tracks.video, tracks.audio])
        } catch {
          /* ignore */
        }
        try {
          tracks.video.stop()
        } catch {
          /* ignore */
        }
        try {
          tracks.audio.stop()
        } catch {
          /* ignore */
        }
        try {
          tracks.video.close()
        } catch {
          /* ignore */
        }
        try {
          tracks.audio.close()
        } catch {
          /* ignore */
        }
        tracksRef.current = null
      }
      client.removeAllListeners()
      void client.leave()
      clientRef.current = null
      setLocalVideoTrack(null)
      setLocalAudioTrack(null)
      setRemoteUsers([])
      setJoined(false)
    }
  }, [channelName, participantId, addRemoteUser, removeRemoteUser, clearRemoteUserTrack])

  return {
    joined,
    localVideoTrack,
    localAudioTrack,
    remoteUsers,
    leave,
    muteVideo,
    muteAudio,
    error,
  }
}
