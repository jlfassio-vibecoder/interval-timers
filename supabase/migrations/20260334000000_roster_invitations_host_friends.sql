-- Roster invitations (email/phone) and host↔buddy connections.
-- Access from app via service role API routes (RLS on; no broad grants to authenticated).

-- ---------------------------------------------------------------------------
-- host_friend_connections: accepted host "buddy" roster
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.host_friend_connections (
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buddy_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (host_id, buddy_user_id),
  CONSTRAINT host_friend_no_self CHECK (host_id <> buddy_user_id)
);

CREATE INDEX IF NOT EXISTS host_friend_connections_buddy_idx
  ON public.host_friend_connections (buddy_user_id);

COMMENT ON TABLE public.host_friend_connections IS 'Host-tier social roster; buddies appear in Mission Control roster for hosts.';
COMMENT ON COLUMN public.host_friend_connections.invitation_id IS 'Optional link to roster_invitations row that created this connection.';

-- ---------------------------------------------------------------------------
-- roster_invitations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roster_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inviter_role text NOT NULL CHECK (inviter_role IN ('host', 'trainer')),
  kind text NOT NULL CHECK (kind IN ('friend', 'client')),
  invitee_email text,
  invitee_phone_e164 text,
  program_ids uuid[] NOT NULL DEFAULT '{}',
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  accepted_at timestamptz,
  accepted_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roster_inv_one_contact CHECK (
    (invitee_email IS NOT NULL AND invitee_phone_e164 IS NULL)
    OR (invitee_email IS NULL AND invitee_phone_e164 IS NOT NULL)
  ),
  CONSTRAINT roster_inv_kind_role CHECK (
    (kind = 'friend' AND inviter_role = 'host' AND cardinality(program_ids) = 0)
    OR (kind = 'client' AND inviter_role = 'trainer' AND cardinality(program_ids) > 0)
  )
);

-- FK from host_friend_connections to roster_invitations (after both exist)
ALTER TABLE public.host_friend_connections
  DROP CONSTRAINT IF EXISTS host_friend_connections_invitation_id_fkey;
ALTER TABLE public.host_friend_connections
  ADD CONSTRAINT host_friend_connections_invitation_id_fkey
  FOREIGN KEY (invitation_id) REFERENCES public.roster_invitations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS roster_invitations_inviter_status_idx
  ON public.roster_invitations (inviter_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS roster_invitations_pending_email_dedupe
  ON public.roster_invitations (inviter_id, lower(trim(invitee_email)))
  WHERE status = 'pending' AND invitee_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS roster_invitations_pending_phone_dedupe
  ON public.roster_invitations (inviter_id, invitee_phone_e164)
  WHERE status = 'pending' AND invitee_phone_e164 IS NOT NULL;

COMMENT ON TABLE public.roster_invitations IS 'Pending/accepted roster invites; token_hash is SHA-256 hex of secret token.';
COMMENT ON COLUMN public.roster_invitations.program_ids IS 'Required for kind=client (trainer); empty for kind=friend (host).';

ALTER TABLE public.host_friend_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_invitations ENABLE ROW LEVEL SECURITY;

-- No policies: service_role bypasses RLS; authenticated users use API only.

-- ---------------------------------------------------------------------------
-- Helpers: resolve auth user by email/phone (service_role / RPC from server)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
STABLE
AS $$
  SELECT id
  FROM auth.users
  WHERE email IS NOT NULL AND lower(trim(email)) = lower(trim(p_email))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.find_auth_user_id_by_phone(p_phone text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
STABLE
AS $$
  SELECT id
  FROM auth.users
  WHERE phone IS NOT NULL AND trim(phone) = trim(p_phone)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_auth_user_id_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_auth_user_id_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_auth_user_id_by_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_auth_user_id_by_phone(text) TO service_role;

COMMENT ON FUNCTION public.find_auth_user_id_by_email IS 'Lookup auth.users.id by email; roster invite accept + dedupe; service_role only.';
COMMENT ON FUNCTION public.find_auth_user_id_by_phone IS 'Lookup auth.users.id by phone; roster invite accept + dedupe; service_role only.';
