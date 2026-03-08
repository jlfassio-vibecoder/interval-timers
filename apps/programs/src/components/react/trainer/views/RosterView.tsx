/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, ChevronRight } from 'lucide-react';

interface RosterItem {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  programIds: string[];
}

const RosterView: React.FC = () => {
  const navigate = useNavigate();
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRoster = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/trainer/roster', { credentials: 'include' });
      if (!response.ok) {
        if (response.status === 401) throw new Error('Unauthorized. Trainer access required.');
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

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Roster</h1>
        <p className="mt-2 text-white/60">Manage active cadets and assignments</p>
      </div>

      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Search clients..."
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
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Client</th>
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
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <p className="text-white/60">
                      {searchQuery
                        ? 'No clients match your search.'
                        : 'No clients in your roster yet.'}
                    </p>
                    {!searchQuery && (
                      <p className="mt-2 text-sm text-white/40">
                        Clients will appear here once they enroll in your programs.
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
                    <td className="px-6 py-4 text-white/70">{client.email || '—'}</td>
                    <td className="px-6 py-4 text-white/70">
                      {client.programIds.length} program{client.programIds.length !== 1 ? 's' : ''}
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
          Showing {filteredRoster.length} of {roster.length} client{roster.length !== 1 ? 's' : ''}
          {searchQuery ? ` (filtered)` : ''}
        </p>
      )}
    </div>
  );
};

export default RosterView;
