# Roadmap: AMRAP With Friends Video Integration

Plan for integrating Agora video streams into the AMRAP With Friends session page. Video appears in leaderboard cards (per-participant backgrounds) and as a host livestream below the timer.

---

## Goals

- **Leaderboard cards**: Show each participant's video stream as the background of their leaderboard row
- **Host livestream**: Display the host's video stream below the timer during setup and work phases
- Reuse the existing AMRAP With Friends workflow (create/join session, Supabase state)
- Integrate Agora only—no full trainer-chat UI

---

## Feasibility: Yes

| Requirement | Approach | Notes |
|-------------|----------|-------|
| Map video to participant | Use `participant_id` as Agora uid | Web SDK v2.5+ supports string UIDs in `Client.join` |
| Same channel for all | Use `session_id` as channel name | All session members join one channel |
| Token generation | `RtcTokenBuilder.buildTokenWithAccount` | String account requires this builder |
| Identify host | `participants.find(p => p.role === 'host')` | Already available from Supabase |
| Video in cards | Pass `videoTrack` to `LeaderboardRow` | Optional background layer |
| Host livestream | New section below timer | Conditional on host and phase |

---

## Current State

### AMRAP With Friends

- **Session flow**: Create/join via Supabase RPC; navigate to `/with-friends/session/:sessionId`
- **Session page**: Timer, leaderboard, Who's Here, message board, exercises
- **Participants**: `amrap_participants` has `id` (participant_id), `nickname`, `role` (host/participant)
- **Leaderboard**: `LeaderboardRow` shows nickname, totalRounds, splits; keyed by `participantId`
- **No Agora**: amrap app has no video dependencies

### trainer-chat (Agora Reference)

- **Channel**: `channelId` in URL; host gets `?host=1`
- **Uid**: Host = 1, others = random int
- **Token**: Local server on port 9517, proxies `/api/agora-token` in Vite
- **Components**: `useAgoraChannel`, `VideoCallLayout`, `VideoTile` / `RemoteVideoTile`
- **Token server**: `RtcTokenBuilder.buildTokenWithUid` (integer uid)

---

## Phase 1: Foundation

### 1.1 Add Agora to amrap

- [ ] Add `agora-rtc-sdk-ng` to `apps/amrap/package.json`
- [ ] Ensure `VITE_AGORA_APP_ID` and `VITE_AGORA_APP_CERTIFICATE` are available (root `.env` already used)

### 1.2 Token Server Support for String UIDs

- [ ] Update `apps/trainer-chat/server/token-server.js` to support string accounts:
  - Accept `account` query param (optional; fallback to `uid` for backward compatibility)
  - When `account` is present, call `RtcTokenBuilder.buildTokenWithAccount` instead of `buildTokenWithUid`
- [ ] Document token endpoint:  
  `GET /token?channel=:sessionId&account=:participantId` or  
  `GET /token?channel=:sessionId&uid=:number` (legacy)

### 1.3 Shared Token Endpoint for amrap

**Option A (recommended for dev)**: Run token server alongside amrap

- [ ] Add Vite proxy in `apps/amrap/vite.config.ts`:
  ```ts
  proxy: {
    '/api/agora-token': {
      target: 'http://localhost:9517',
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/api\/agora-token/, '/token'),
    },
  },
  ```
- [ ] Add `dev:amrap:video` script (or extend `dev:amrap`) to run token server + Vite, or document running both

**Option B (production)**: Backend token endpoint

- [x] Add serverless/API route: `api/agora-token.ts` (Vercel) — `GET /api/agora-token?channel=:sessionId&account=:participantId`
- [x] Auth/validation: verify participant exists in `amrap_participants` before issuing token (prevents arbitrary token issuance)
- [ ] Set in Vercel: `VITE_AGORA_APP_ID`, `VITE_AGORA_APP_CERTIFICATE`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AGORA_TOKEN_ALLOWED_ORIGINS` (comma-separated, e.g. `https://yoursite.com`)
- **"invalid token, authorized failed"**: App ID and Certificate must match between (1) Vercel env at build time, (2) Vercel env at runtime, (3) Agora Console. No extra spaces. Enable App Certificate in Agora Console.

### 1.4 Extract/Port Agora Logic

- [ ] Add `apps/amrap/src/lib/agora.ts` (copy from trainer-chat; adjust token URL if needed)
- [ ] Add `apps/amrap/src/hooks/useAgoraChannel.ts` with changes:
  - Accept `channelName: string` (session_id), `participantId: string | null` (participant_id from session)
  - Join with string uid: `client.join(appId, channelName, token, participantId)` when `participantId` exists
  - Fetch token with `account=participantId` when using string uid
  - Return `remoteUsers: Array<{ uid: string; videoTrack?; audioTrack? }>` (uid = participant_id)
- [ ] Add `apps/amrap/src/components/VideoTile.tsx` (minimal: play video in a container, optional label overlay)

---

## Phase 2: Session Page Integration

### 2.1 Join Video on Session Load

- [ ] In `AmrapSessionPage`, call `useAgoraChannel(sessionId ?? '', participantId)` when user has `participantId` (joined) or `isHost` (host has participantId from create)
- [ ] Only join when `sessionId` and `participantId` are both present
- [ ] Graceful degradation: if Agora fails (no token, network, etc.), session still works; video sections show "Video unavailable" or are hidden

### 2.2 Host Livestream Below Timer

- [ ] Add a section between the timer card and the host controls (or between timer and right column) for the host video
- [ ] Condition: show only when `timerState` is `setup` or `work` and host is in `remoteUsers`
- [ ] Find host: `participants.find(p => p.role === 'host')` → `hostParticipantId`
- [ ] Find remote user: `remoteUsers.find(u => String(u.uid) === hostParticipantId)`
- [ ] Render `VideoTile` (or similar) with `user.videoTrack`; optional "Host" label
- [ ] Host sees their own local video; participants see host's remote video

### 2.3 Leaderboard Cards with Video Backgrounds

- [ ] Extend `LeaderboardRow`:
  - New optional prop: `videoTrack?: IRemoteVideoTrack | null`
  - When present, render video as background (absolute, object-fit cover), content overlay on top
  - Preserve existing layout for nickname, rounds, splits
- [ ] In `AmrapSessionPage` leaderboard render:
  - For each `row`, look up `remoteUsers.find(u => String(u.uid) === row.participantId)`
  - Pass `videoTrack: user?.videoTrack` to `LeaderboardRow`
- [ ] Don't show local user's video in their own card if desired (or show it—design choice)

---

## Phase 3: Polish and Edge Cases

### 3.1 Video Toggle (Optional)

- [ ] Add "Camera on/off" or "Show video" toggle per user or global
- [ ] Reduces bandwidth if users prefer audio-only or no video

### 3.2 Muted / No Video States

- [ ] Leaderboard card: when no `videoTrack` or track is muted, show placeholder (avatar, nickname initial)
- [ ] Host livestream: same fallback when host has no video

### 3.3 Performance

- [ ] Consider limiting remote subscriptions (e.g. only subscribe to host + N participants) if many users
- [ ] Lazy-load video only when leaderboard or host section is visible (e.g. Intersection Observer)

### 3.4 Permissions and Errors

- [ ] Handle camera/mic permission denial (show message, don't block session)
- [ ] Handle token expiry (refresh or re-join if session is long)
- [ ] Log/monitor Agora errors without disrupting Supabase-based flow

---

## File Changes Summary

| File | Action |
|------|--------|
| `apps/amrap/package.json` | Add `agora-rtc-sdk-ng` |
| `apps/amrap/vite.config.ts` | Add token proxy |
| `apps/trainer-chat/server/token-server.js` | Support `buildTokenWithAccount` |
| `apps/amrap/src/lib/agora.ts` | New (port from trainer-chat) |
| `apps/amrap/src/hooks/useAgoraChannel.ts` | New (adapted for participant_id uid) |
| `apps/amrap/src/components/VideoTile.tsx` | New (minimal video display) |
| `apps/amrap/src/components/LeaderboardRow.tsx` | Add optional `videoTrack` background |
| `apps/amrap/src/pages/AmrapSessionPage.tsx` | Integrate useAgoraChannel, host livestream, pass video to LeaderboardRow |

---

## Dependencies

- Agora project with App Certificate enabled (for token auth)
- Root `.env`: `VITE_AGORA_APP_ID`, `VITE_AGORA_APP_CERTIFICATE`
- Token server running (dev) or production token API (prod)

---

## Out of Scope (For This Roadmap)

- Full trainer-chat UI (grid layout, separate call page)
- Recording or cloud recording
- Chat/whiteboard in video layer
- Video quality controls (resolution, etc.)—use Agora defaults initially
