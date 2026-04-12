import { useState, useEffect, useCallback, useRef } from 'react';
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
  type IRemoteVideoTrack,
  type IRemoteAudioTrack,
} from 'agora-rtc-sdk-ng';
import {
  createTrainerLiveRtcClient,
  getTrainerLiveAppId,
  getTrainerLiveToken,
} from '@/lib/trainer-live/agora';

/** When set, join uses `/api/agora/token` credentials instead of the legacy trainer-live token fetch. */
export type TrainerLiveSecureAgoraToken = {
  loading: boolean;
  error: string | null;
  token: string | null;
  joinUid: string | null;
  channelName: string | null;
};

export interface TrainerLiveRemoteUser {
  uid: string | number;
  videoTrack?: IRemoteVideoTrack;
  audioTrack?: IRemoteAudioTrack;
}

export interface UseTrainerLiveAgoraChannelResult {
  joined: boolean;
  localVideoTrack: ICameraVideoTrack | null;
  localAudioTrack: IMicrophoneAudioTrack | null;
  remoteUsers: TrainerLiveRemoteUser[];
  leave: () => Promise<void>;
  /** Full Agora teardown then join again (same channel identity). Used for AV recovery. */
  rejoin: () => Promise<void>;
  muteVideo: (muted: boolean) => void;
  muteAudio: (muted: boolean) => void;
  error: string | null;
}

export function useTrainerLiveAgoraChannel(
  channelName: string,
  participantId: string | null,
  secureToken: TrainerLiveSecureAgoraToken | null = null
): UseTrainerLiveAgoraChannelResult {
  const [joined, setJoined] = useState(false);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<TrainerLiveRemoteUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Bumping this re-runs the connection effect after an explicit `rejoin()` without depending on token string changes (avoids double-connect when the provider refetches JWT first). */
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const tracksRef = useRef<{ video: ICameraVideoTrack; audio: IMicrophoneAudioTrack } | null>(null);
  const previousLeavePromiseRef = useRef<Promise<void> | null>(null);
  /** Latest secure gate for join credentials (always current when `run()` executes after await points). */
  const secureTokenRef = useRef<TrainerLiveSecureAgoraToken | null>(null);
  secureTokenRef.current = secureToken;

  const addRemoteUser = useCallback(
    (uid: string | number, video?: IRemoteVideoTrack, audio?: IRemoteAudioTrack) => {
      setRemoteUsers((prev) => {
        if (prev.some((u) => String(u.uid) === String(uid))) {
          return prev.map((u) =>
            String(u.uid) === String(uid)
              ? { ...u, videoTrack: video ?? u.videoTrack, audioTrack: audio ?? u.audioTrack }
              : u
          );
        }
        return [...prev, { uid, videoTrack: video, audioTrack: audio }];
      });
    },
    []
  );

  const removeRemoteUser = useCallback((uid: string | number) => {
    setRemoteUsers((prev) => prev.filter((u) => String(u.uid) !== String(uid)));
  }, []);

  const clearRemoteUserTrack = useCallback((uid: string | number, mediaType: 'video' | 'audio') => {
    setRemoteUsers((prev) =>
      prev.map((u) =>
        String(u.uid) === String(uid)
          ? {
              ...u,
              ...(mediaType === 'video' ? { videoTrack: undefined } : { audioTrack: undefined }),
            }
          : u
      )
    );
  }, []);

  const leave = useCallback(async () => {
    const client = clientRef.current;
    const tracks = tracksRef.current;
    if (tracks && client) {
      try {
        await client.unpublish([tracks.video, tracks.audio]);
      } catch {
        /* already unpublished */
      }
      try {
        tracks.video.stop();
      } catch {
        /* already stopped */
      }
      try {
        tracks.audio.stop();
      } catch {
        /* already stopped */
      }
      try {
        tracks.video.close();
      } catch {
        /* already closed */
      }
      try {
        tracks.audio.close();
      } catch {
        /* already closed */
      }
      tracksRef.current = null;
    }
    if (client) {
      previousLeavePromiseRef.current = client.leave();
      await previousLeavePromiseRef.current;
      client.removeAllListeners();
      clientRef.current = null;
    }
    setLocalVideoTrack(null);
    setLocalAudioTrack(null);
    setRemoteUsers([]);
    setJoined(false);
  }, []);

  const rejoin = useCallback(async () => {
    await leave();
    if (previousLeavePromiseRef.current) {
      await previousLeavePromiseRef.current;
      previousLeavePromiseRef.current = null;
    }
    setReconnectNonce((n) => n + 1);
  }, [leave]);

  const muteVideo = useCallback((muted: boolean) => {
    tracksRef.current?.video.setEnabled(!muted);
  }, []);

  const muteAudio = useCallback((muted: boolean) => {
    tracksRef.current?.audio.setEnabled(!muted);
  }, []);

  useEffect(() => {
    if (!channelName || !participantId) {
      return () => {};
    }

    const stGate = secureTokenRef.current;
    if (stGate) {
      if (stGate.loading) {
        return () => {};
      }
      if (stGate.error) {
        setError(stGate.error);
        return () => {};
      }
      if (!stGate.token || !stGate.joinUid || !stGate.channelName) {
        return () => {};
      }
    }

    const appId = getTrainerLiveAppId();
    if (!appId) {
      setError('VITE_AGORA_APP_ID is not set');
      return () => {};
    }

    const client = createTrainerLiveRtcClient();
    clientRef.current = client;

    client.on('user-published', async (user, mediaType) => {
      try {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
        }
        addRemoteUser(user.uid, user.videoTrack, user.audioTrack);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to subscribe to remote user';
        setError(msg);
      }
    });
    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video' || mediaType === 'audio') {
        clearRemoteUserTrack(user.uid, mediaType);
      }
    });
    client.on('user-left', (user) => {
      removeRemoteUser(user.uid);
    });

    let cancelled = false;

    const run = async () => {
      try {
        setError(null);
        if (previousLeavePromiseRef.current) {
          await previousLeavePromiseRef.current;
          previousLeavePromiseRef.current = null;
        }
        if (cancelled) return;

        let joinToken: string;
        let joinChannel: string;
        let joinAccount: string;
        const st = secureTokenRef.current;
        if (st?.token && st.joinUid && st.channelName) {
          joinToken = st.token;
          joinChannel = st.channelName;
          joinAccount = st.joinUid;
        } else {
          const result = await getTrainerLiveToken(channelName, participantId);
          if (cancelled) return;
          if ('error' in result) {
            if (typeof window !== 'undefined') console.warn('[TrainerLive Agora]', result.error);
            setError(result.error);
            return;
          }
          joinToken = result.token;
          joinChannel = channelName;
          joinAccount = participantId;
        }

        await client.join(appId, joinChannel, joinToken, joinAccount);
        if (cancelled) return;

        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        if (cancelled) {
          try {
            audioTrack.close();
          } catch {
            /* ignore */
          }
          try {
            videoTrack.close();
          } catch {
            /* ignore */
          }
          return;
        }
        tracksRef.current = { video: videoTrack, audio: audioTrack };
        await client.publish([audioTrack, videoTrack]);
        if (cancelled) return;
        setLocalVideoTrack(videoTrack);
        setLocalAudioTrack(audioTrack);
        setJoined(true);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Failed to join channel';
        if (typeof window !== 'undefined') console.warn('[TrainerLive Agora] Join failed:', msg, e);
        let hint = '';
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
          hint = ' — Camera or microphone access denied';
        } else if (
          msg.toLowerCase().includes('invalid token') ||
          msg.toLowerCase().includes('authorized failed')
        ) {
          hint =
            ' — Check VITE_AGORA_APP_ID / certificate; apply trainer_live Supabase migration. Dev: npm run dev:trainer:live.';
        }
        setError(msg + hint);
      }
    };
    void run();

    return () => {
      cancelled = true;
      const tracks = tracksRef.current;
      if (tracks) {
        try {
          void client.unpublish([tracks.video, tracks.audio]);
        } catch {
          /* ignore */
        }
        try {
          tracks.video.stop();
        } catch {
          /* ignore */
        }
        try {
          tracks.audio.stop();
        } catch {
          /* ignore */
        }
        try {
          tracks.video.close();
        } catch {
          /* ignore */
        }
        try {
          tracks.audio.close();
        } catch {
          /* ignore */
        }
        tracksRef.current = null;
      }
      // If `rejoin()` already ran `leave()`, clientRef is null — avoid a second `client.leave()` on the same SDK client.
      if (clientRef.current === client) {
        client.removeAllListeners();
        previousLeavePromiseRef.current = client.leave();
        clientRef.current = null;
      }
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      setRemoteUsers([]);
      setJoined(false);
    };
  }, [
    channelName,
    participantId,
    reconnectNonce,
    secureToken?.loading,
    secureToken?.error,
    addRemoteUser,
    removeRemoteUser,
    clearRemoteUserTrack,
  ]);

  return {
    joined,
    localVideoTrack,
    localAudioTrack,
    remoteUsers,
    leave,
    rejoin,
    muteVideo,
    muteAudio,
    error,
  };
}
