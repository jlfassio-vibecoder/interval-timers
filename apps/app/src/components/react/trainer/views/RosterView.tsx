/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, User, ChevronRight, Mail, Phone, Copy, UserPlus } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { ROSTER_INVITE_STORAGE_KEY } from '@/lib/roster-invite-handoff';

interface RosterItem {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  programIds: string[];
  relationship?: 'client' | 'friend';
}

interface TrainerProgramOption {
  id: string;
  title: string;
  status: string;
}

interface PendingInvitation {
  id: string;
  kind: 'friend' | 'client';
  channel: 'email' | 'phone';
  inviteeEmail: string | null;
  inviteePhoneE164: string | null;
  programIds: string[];
  createdAt: string;
  expiresAt: string;
}

const RosterView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, user, isTrainer } = useAppContext();
  const role = profile?.role ?? 'client';
  const isHost = role === 'host';
  const canInviteClients = isTrainer;

  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvitation[]>([]);
  const [programs, setPrograms] = useState<TrainerProgramOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteChannel, setInviteChannel] = useState<'email' | 'phone'>('email');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [acceptFlash, setAcceptFlash] = useState<string | null>(null);
  const [invitationMutationId, setInvitationMutationId] = useState<string | null>(null);
  const [resendFeedbackById, setResendFeedbackById] = useState<Record<string, string>>({});
  const [pendingInviteRowErrors, setPendingInviteRowErrors] = useState<Record<string, string>>({});

  const fetchRoster = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/trainer/roster', { credentials: 'include' });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Mission Control access required.');
        }
        throw new Error('Failed to fetch roster');
      }
      const data = await response.json();
      setRoster(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load roster';
      setError(msg);
      if (import.meta.env.DEV) console.error('[RosterView]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const response = await fetch('/api/trainer/roster/invitations', { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      setPendingInvites(Array.isArray(data) ? data : []);
    } catch {
      setPendingInvites([]);
    }
  }, []);

  const fetchPrograms = useCallback(async () => {
    if (!canInviteClients) {
      setPrograms([]);
      return;
    }
    try {
      const response = await fetch('/api/trainer/programs', { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      setPrograms(Array.isArray(data) ? data : []);
    } catch {
      setPrograms([]);
    }
  }, [canInviteClients]);

  useEffect(() => {
    fetchRoster();
    fetchPending();
    fetchPrograms();
  }, [fetchRoster, fetchPending, fetchPrograms]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void fetchPending();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchPending]);

  const inviteParam = searchParams.get('invite');

  useEffect(() => {
    const t = inviteParam?.trim();
    if (t) {
      try {
        sessionStorage.setItem(ROSTER_INVITE_STORAGE_KEY, t);
      } catch {
        /* private mode */
      }
    }
  }, [inviteParam]);

  useEffect(() => {
    const fromUrl = inviteParam?.trim() ?? '';
    let fromStore = '';
    try {
      fromStore = sessionStorage.getItem(ROSTER_INVITE_STORAGE_KEY)?.trim() ?? '';
    } catch {
      fromStore = '';
    }
    const token = fromUrl || fromStore;
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/invitations/accept', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;

        const clearInviteUrl = () => {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete('invite');
              return next;
            },
            { replace: true }
          );
        };

        if (res.ok) {
          try {
            sessionStorage.removeItem(ROSTER_INVITE_STORAGE_KEY);
          } catch {
            /* ignore */
          }
          clearInviteUrl();
          setAcceptFlash(`Invitation accepted (${body.kind === 'friend' ? 'friend' : 'client'}).`);
          fetchRoster();
          fetchPending();
          return;
        }

        if (res.status === 401) {
          setAcceptFlash(
            'Sign in with the invited email, then we will finish accepting. If you already signed in, refresh the page.'
          );
          return;
        }

        try {
          sessionStorage.removeItem(ROSTER_INVITE_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        clearInviteUrl();
        setAcceptFlash(body.error || 'Could not accept invitation.');
      } catch {
        if (!cancelled) setAcceptFlash('Could not accept invitation.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inviteParam, user?.uid, fetchRoster, fetchPending, setSearchParams]);

  const toggleProgram = (id: string) => {
    setSelectedProgramIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const submitInvite = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setInviteMessage(null);
    setInviteSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        channel: inviteChannel,
        programIds: canInviteClients ? selectedProgramIds : [],
      };
      if (inviteChannel === 'email') body.email = inviteEmail.trim();
      else body.phoneE164 = invitePhone.trim();

      const res = await fetch('/api/trainer/roster/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteMessage(data.error || 'Invite failed');
        return;
      }
      const baseMsg = data.inviteUrl
        ? `Invite created. Copy the link below.${data.emailDeliveryAttempted ? ' We also attempted to email a signup/magic link when the service role is configured.' : ''}`
        : 'Invite created.';
      const url = typeof data.inviteUrl === 'string' ? (data.inviteUrl as string) : '';
      setInviteMessage(url ? `${baseMsg}\n\n${url}` : baseMsg);
      setInviteEmail('');
      setInvitePhone('');
      setSelectedProgramIds([]);
      fetchPending();
    } catch {
      setInviteMessage('Invite failed');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const copyInviteUrlFromMessage = () => {
    const lines = inviteMessage?.split('\n') ?? [];
    const url = lines.find((l) => l.startsWith('http'));
    if (url) void navigator.clipboard.writeText(url.trim());
  };

  const copyResendUrlForRow = (invitationId: string) => {
    const text = resendFeedbackById[invitationId];
    const lines = text?.split('\n') ?? [];
    const url = lines.find((l) => l.startsWith('http'));
    if (url) void navigator.clipboard.writeText(url.trim());
  };

  const resendPendingInvitation = async (invitationId: string) => {
    setInvitationMutationId(invitationId);
    setPendingInviteRowErrors((prev) => {
      const next = { ...prev };
      delete next[invitationId];
      return next;
    });
    try {
      const res = await fetch(
        `/api/trainer/roster/invitations/${encodeURIComponent(invitationId)}/resend`,
        { method: 'POST', credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPendingInviteRowErrors((prev) => ({
          ...prev,
          [invitationId]:
            typeof data.error === 'string' ? data.error : 'Could not resend invitation',
        }));
        return;
      }
      const url = typeof data.inviteUrl === 'string' ? data.inviteUrl : '';
      const baseMsg = url
        ? `New invite link.${data.emailDeliveryAttempted ? ' We also attempted to email a signup/magic link when the service role is configured.' : ''}`
        : 'Invitation updated.';
      setResendFeedbackById((prev) => ({
        ...prev,
        [invitationId]: url ? `${baseMsg}\n\n${url}` : baseMsg,
      }));
      await fetchPending();
    } catch {
      setPendingInviteRowErrors((prev) => ({
        ...prev,
        [invitationId]: 'Could not resend invitation',
      }));
    } finally {
      setInvitationMutationId(null);
    }
  };

  const cancelPendingInvitation = async (invitationId: string) => {
    if (!window.confirm('Cancel this invitation? They will not be able to use the invite link.')) {
      return;
    }
    setInvitationMutationId(invitationId);
    setPendingInviteRowErrors((prev) => {
      const next = { ...prev };
      delete next[invitationId];
      return next;
    });
    try {
      const res = await fetch(
        `/api/trainer/roster/invitations/${encodeURIComponent(invitationId)}/cancel`,
        { method: 'POST', credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPendingInviteRowErrors((prev) => ({
          ...prev,
          [invitationId]:
            typeof data.error === 'string' ? data.error : 'Could not cancel invitation',
        }));
        return;
      }
      setResendFeedbackById((prev) => {
        const next = { ...prev };
        delete next[invitationId];
        return next;
      });
      await fetchPending();
      await fetchRoster();
    } catch {
      setPendingInviteRowErrors((prev) => ({
        ...prev,
        [invitationId]: 'Could not cancel invitation',
      }));
    } finally {
      setInvitationMutationId(null);
    }
  };

  const filteredRoster = roster.filter((client) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      client.email?.toLowerCase().includes(q) ||
      client.full_name?.toLowerCase().includes(q) ||
      client.id.toLowerCase().includes(q)
    );
  });

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const rosterLabel = isHost ? 'friends' : 'clients';
  const rosterTitle = isHost ? 'Friends' : 'Clients';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Roster</h1>
        <p className="mt-2 text-white/60">
          {isHost
            ? 'Invite friends and see who you’ve connected with'
            : 'Manage clients, programs, and invitations'}
        </p>
      </div>

      {acceptFlash && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/90">
          {acceptFlash}
          <button
            type="button"
            className="ml-3 text-orange-light underline"
            onClick={() => setAcceptFlash(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {(isHost || canInviteClients) && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-orange-light" />
            <h2 className="font-heading text-xl font-bold">
              {isHost ? 'Invite a friend' : 'Invite a client'}
            </h2>
          </div>
          {isHost && (
            <p className="mb-4 text-sm text-white/50">
              Up to five buddies including pending invites. Phone invites use a link only (no SMS)
              unless you configure SMS separately.
            </p>
          )}
          <form onSubmit={submitInvite} className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInviteChannel('email')}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  inviteChannel === 'email'
                    ? 'bg-orange-light/10 border-orange-light text-white'
                    : 'border-white/10 text-white/70'
                }`}
              >
                <Mail className="h-4 w-4" />
                Email
              </button>
              <button
                type="button"
                onClick={() => setInviteChannel('phone')}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  inviteChannel === 'phone'
                    ? 'bg-orange-light/10 border-orange-light text-white'
                    : 'border-white/10 text-white/70'
                }`}
              >
                <Phone className="h-4 w-4" />
                Phone (E.164)
              </button>
            </div>
            {inviteChannel === 'email' ? (
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="friend@example.com"
                className="w-full max-w-md rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white placeholder:text-white/40"
              />
            ) : (
              <input
                type="tel"
                required
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                placeholder="+15551234567"
                className="w-full max-w-md rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white placeholder:text-white/40"
              />
            )}
            {canInviteClients && programs.length > 0 && (
              <div>
                <p className="mb-2 text-sm text-white/60">Programs to enroll</p>
                <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-white/10 p-3">
                  {programs.map((p) => (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                        <input
                          type="checkbox"
                          checked={selectedProgramIds.includes(p.id)}
                          onChange={() => toggleProgram(p.id)}
                          className="rounded border-white/20"
                        />
                        <span>{p.title || 'Untitled'}</span>
                        <span className="text-white/40">({p.status})</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {canInviteClients && programs.length === 0 && (
              <p className="text-sm text-amber-400/90">
                Create a program in the builder before sending client invites.
              </p>
            )}
            <button
              type="submit"
              disabled={
                inviteSubmitting ||
                (canInviteClients && programs.length > 0 && selectedProgramIds.length === 0)
              }
              className="rounded-lg bg-orange-light px-4 py-2 text-sm font-bold uppercase text-black disabled:opacity-40"
            >
              {inviteSubmitting ? 'Sending…' : 'Create invite'}
            </button>
          </form>
          {inviteMessage && (
            <div className="mt-4 rounded border border-white/10 bg-black/30 p-3 text-sm text-white/80">
              <pre className="whitespace-pre-wrap font-sans">{inviteMessage}</pre>
              {inviteMessage.includes('http') && (
                <button
                  type="button"
                  onClick={copyInviteUrlFromMessage}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-orange-light"
                >
                  <Copy className="h-3 w-3" />
                  Copy link
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <h2 className="font-heading text-lg font-bold">Pending invitations</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            {pendingInvites.map((p) => {
              const rowBusy = invitationMutationId === p.id;
              const rowErr = pendingInviteRowErrors[p.id];
              const resendText = resendFeedbackById[p.id];
              return (
                <li key={p.id} className="space-y-2 border-b border-white/5 py-3 last:border-b-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span>
                        {p.kind === 'friend' ? 'Friend' : 'Client'} ·{' '}
                        {p.inviteeEmail || p.inviteePhoneE164 || '—'}
                      </span>
                      <div className="mt-0.5 text-white/40">expires {formatDate(p.expiresAt)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() => void resendPendingInvitation(p.id)}
                        className="rounded-lg border border-white/15 px-3 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
                      >
                        {rowBusy ? '…' : 'Resend'}
                      </button>
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() => void cancelPendingInvitation(p.id)}
                        className="rounded-lg border border-red-500/40 px-3 py-1 text-xs font-medium text-red-300/90 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  {rowErr && <p className="text-xs text-red-400/90">{rowErr}</p>}
                  {resendText && (
                    <div className="rounded border border-white/10 bg-black/30 p-2 text-xs text-white/80">
                      <pre className="whitespace-pre-wrap font-sans">{resendText}</pre>
                      {resendText.includes('http') && (
                        <button
                          type="button"
                          onClick={() => copyResendUrlForRow(p.id)}
                          className="mt-2 inline-flex items-center gap-1 text-orange-light"
                        >
                          <Copy className="h-3 w-3" />
                          Copy link
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder={`Search ${rosterLabel}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full max-w-md rounded-lg border border-white/10 bg-black/20 px-10 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
        />
      </div>

      {loading && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <p className="text-white/60">Loading roster...</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 backdrop-blur-sm">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
          <table className="w-full">
            <thead className="border-b border-white/10 bg-black/30">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">
                  Programs
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Joined</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-white/80">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
                    <p className="text-white/60">
                      {searchQuery
                        ? `No ${rosterLabel} match your search.`
                        : `No ${rosterLabel} on your roster yet.`}
                    </p>
                    {!searchQuery && (
                      <p className="mt-2 text-sm text-white/40">
                        {isHost
                          ? 'Send an invite to connect with a friend.'
                          : 'Clients appear when they enroll in your programs or accept an invite.'}
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRoster.map((client) => (
                  <tr key={client.id} className="transition-colors hover:bg-white/5">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-white/10 p-2">
                          <User className="h-5 w-5 text-white/70" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {client.full_name || client.email || 'Unnamed'}
                          </div>
                          <div className="font-mono text-xs text-white/50" title="User ID">
                            {client.id.slice(0, 8)}…
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {client.relationship === 'friend'
                        ? 'Friend'
                        : client.relationship === 'client'
                          ? 'Client'
                          : canInviteClients
                            ? 'Client'
                            : '—'}
                    </td>
                    <td className="px-6 py-4 text-white/70">{client.email || '—'}</td>
                    <td className="px-6 py-4 text-white/70">
                      {client.programIds.length > 0
                        ? `${client.programIds.length} program${client.programIds.length !== 1 ? 's' : ''}`
                        : client.relationship === 'friend'
                          ? '—'
                          : '0'}
                    </td>
                    <td className="px-6 py-4 text-white/70">{formatDate(client.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/roster/${client.id}`)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        View Stats
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && roster.length > 0 && (
        <p className="text-sm text-white/60">
          Showing {filteredRoster.length} of {roster.length}{' '}
          {roster.length === 1 ? rosterTitle.slice(0, -1) : rosterTitle.toLowerCase()}
          {searchQuery ? ` (filtered)` : ''}
        </p>
      )}
    </div>
  );
};

export default RosterView;
