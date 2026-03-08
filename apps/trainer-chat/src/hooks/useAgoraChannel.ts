import { useState, useEffect, useCallback, useRef } from 'react'
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
  type IRemoteVideoTrack,
  type IRemoteAudioTrack,
} from 'agora-rtc-sdk-ng'
import { createClient, getAppId, getTokenOrFetch } from '@/lib/agora'

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
  isHost: boolean
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

  const leave = useCallback(async () => {
    const client = clientRef.current
    const tracks = tracksRef.current
    if (tracks) {
      tracks.video.close()
      tracks.audio.close()
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
    const appId = getAppId()
    if (!appId) {
      setError('VITE_AGORA_APP_ID is not set') // eslint-disable-line react-hooks/set-state-in-effect -- sync config error to UI
      return () => {}
    }

    const client = createClient()
    clientRef.current = client

    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType)
      addRemoteUser(user.uid, user.videoTrack, user.audioTrack)
    })
    client.on('user-unpublished', (user, mediaType) => {
      addRemoteUser(
        user.uid,
        mediaType === 'video' ? undefined : user.videoTrack,
        mediaType === 'audio' ? undefined : user.audioTrack
      )
    })
    client.on('user-left', (user) => {
      removeRemoteUser(user.uid)
    })

    const run = async () => {
      try {
        setError(null)
        const uid = isHost ? 0 : Math.floor(Math.random() * 0xffffff) + 1
        const result = await getTokenOrFetch(channelName, uid)
        if ('error' in result) {
          setError(result.error)
          return
        }
        await client.join(appId, channelName, result.token, uid)

        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks()
        tracksRef.current = { video: videoTrack, audio: audioTrack }
        await client.publish([audioTrack, videoTrack])
        setLocalVideoTrack(videoTrack)
        setLocalAudioTrack(audioTrack)
        setJoined(true)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to join channel'
        let hint = ''
        if (msg.includes('dynamic use static key')) {
          hint =
            ' — Enable App Certificate requires a token. Add VITE_AGORA_TOKEN or disable App Certificate for testing.'
        } else if (msg.includes('CAN_NOT_GET_GATEWAY') && msg.includes('unknown error')) {
          hint =
            ' — Often caused by: (1) token generated for different channel/uid — token must match exact channel name and uid; (2) token expired — temp tokens expire quickly; (3) network/firewall blocking Agora; (4) invalid App ID.'
        }
        setError(msg + hint)
      }
    }
    void run()

    return () => {
      const tracks = tracksRef.current
      if (tracks) {
        tracks.video.close()
        tracks.audio.close()
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
  }, [channelName, isHost, addRemoteUser, removeRemoteUser])

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
