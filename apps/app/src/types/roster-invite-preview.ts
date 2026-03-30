/** Public-safe studio fields for invite landing (shared client/server). */
export interface RosterInviteStudioPreview {
  slug: string;
  displayName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  tagline: string | null;
}

/** Public-safe inviter fields for invite landing (shared client/server). */
export interface RosterInvitePreview {
  inviterDisplayName: string | null;
  inviterAvatarUrl: string | null;
  kind: 'friend' | 'client';
  /** Present when inviter profile has studio_id and studio row exists. */
  studio: RosterInviteStudioPreview | null;
  /**
   * Invitee contact for signup prefill. Always present on the JSON object; null when not
   * applicable (e.g. friend invites, or the invite used the other channel — email vs phone).
   */
  inviteeEmail: string | null;
  inviteePhoneE164: string | null;
}
