/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, LogOut } from 'lucide-react';
import type { UserProfile } from '@/types';

const PROVIDER_LABELS: Record<string, string> = {
  'google.com': 'Google',
  google: 'Google',
  password: 'Email',
  email: 'Email',
  'facebook.com': 'Facebook',
  facebook: 'Facebook',
  'apple.com': 'Apple',
  apple: 'Apple',
  'github.com': 'GitHub',
  github: 'GitHub',
};

function formatProviderIds(providerIds?: string[]): string {
  if (!providerIds || providerIds.length === 0) return '—';
  return providerIds.map((id) => PROVIDER_LABELS[id] ?? id).join(', ');
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  trainer: 'Trainer',
  client: 'User',
};

function getRoleDisplay(role: UserProfile['role'] | undefined): {
  label: string;
  className: string;
} {
  const r = role ?? 'client';
  const label = ROLE_LABELS[r] ?? (r === 'admin' ? 'Admin' : r === 'trainer' ? 'Trainer' : 'User');
  switch (r) {
    case 'admin':
      return {
        label,
        className: 'rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-300',
      };
    case 'trainer':
      return {
        label,
        className: 'rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300',
      };
    default:
      return {
        label,
        className: 'rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-300',
      };
  }
}

const ManageUsers: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [revokingUid, setRevokingUid] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setHint(null);

      const response = await fetch('/api/admin/users', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Please ensure you have admin access.');
        }
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? 'Failed to fetch users');
      }

      const data = await response.json();
      const list = Array.isArray(data) ? data : data && Array.isArray(data.users) ? data.users : [];
      setUsers(list);
      if (data && typeof data._hint === 'string') {
        setHint(data._hint);
      } else {
        setHint(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load users';
      setError(errorMessage);
      if (import.meta.env.DEV) {
        console.error('[ManageUsers] Error fetching users:', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRevokeSessions = async (uid: string) => {
    if (
      !window.confirm('Revoke all sessions for this user? They will be signed out on all devices.')
    ) {
      return;
    }
    setRevokingUid(uid);
    try {
      const response = await fetch(`/api/admin/users/${uid}/revoke`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to revoke sessions');
      }
      await fetchUsers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke sessions';
      setError(msg);
    } finally {
      setRevokingUid(null);
    }
  };

  // Filter users based on search query
  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.displayName?.toLowerCase().includes(query) ||
      user.uid.toLowerCase().includes(query)
    );
  });

  // Format date for display
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Manage Users</h1>
          <p className="mt-2 text-white/60">View and manage user accounts</p>
        </div>
        <button className="hover:bg-orange-light/90 rounded-lg bg-orange-light px-4 py-2 font-medium text-black transition-colors">
          Add User
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 px-10 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
          />
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white transition-colors hover:bg-white/5">
          <Filter className="h-5 w-5" />
          <span>Filter</span>
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <p className="text-white/60">Loading users...</p>
        </div>
      )}

      {/* Hint (e.g. service role key missing in production) */}
      {hint && (
        <div className="rounded-lg border border-[#ffbf00]/50 bg-[#ffbf00]/10 p-4 backdrop-blur-sm">
          <p className="text-sm text-[#ffbf00]">{hint}</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 backdrop-blur-sm">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Users Table */}
      {!loading && !error && (
        <>
          <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
            <table className="w-full min-w-max">
              <thead className="border-b border-white/10 bg-black/30">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Auth</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">
                    Purchased
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">
                    Last sign-in
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">
                    Sign-in visits
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">
                    Activity visits
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-white/80">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-center text-white/60">
                      {searchQuery ? 'No users found matching your search.' : 'No users found.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.uid} className="transition-colors hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div className="font-medium">{user.displayName || user.email || 'N/A'}</div>
                        <div className="mt-0.5 font-mono text-xs text-white/50" title="UID">
                          {user.uid}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-white/70">{user.email || 'N/A'}</td>
                      <td className="px-6 py-4 text-white/70">
                        {formatProviderIds(user.providerIds)}
                        {user.emailVerified && (
                          <span className="ml-1 text-xs text-green-400" title="Email verified">
                            ✓
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const { label, className } = getRoleDisplay(user.role);
                          return <span className={className}>{label}</span>;
                        })()}
                      </td>
                      <td className="px-6 py-4 text-white/70">
                        {user.purchasedIndex !== null && user.purchasedIndex !== undefined
                          ? `Program ${user.purchasedIndex}`
                          : 'None'}
                      </td>
                      <td className="px-6 py-4 text-white/70">
                        {user.createdAt ? formatDate(user.createdAt) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-white/70">
                        {user.lastSignInAt ? formatDate(user.lastSignInAt) : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-white/70">{user.signInVisitCount ?? 0}</td>
                      <td className="px-6 py-4 text-white/70">{user.activityVisitCount ?? 0}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRevokeSessions(user.uid)}
                          disabled={revokingUid === user.uid}
                          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                          title="Revoke sessions (sign out on all devices)"
                        >
                          <LogOut className="h-4 w-4" />
                          {revokingUid === user.uid ? 'Revoking…' : 'Revoke sessions'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Info */}
          <div className="flex items-center justify-between text-sm text-white/60">
            <div>
              Showing {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
              {searchQuery && ` (filtered from ${users.length} total)`}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ManageUsers;
