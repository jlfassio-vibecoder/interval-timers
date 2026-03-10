/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HUD top bar: trainer brand (left), app wordmark (center), notification bell + user menu (right).
 */

import React, { useState, useRef, useEffect } from 'react';
import { Bell, LogOut, Settings, UserCircle, X } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

export interface HUDHeaderProps {
  /** When overlay mode; renders Close button. */
  onClose?: () => void;
  /** Phase 0: pass 0. Future: unread count. */
  notificationCount?: number;
  /** Opens the notification panel when the bell is clicked. */
  onBellClick?: () => void;
}

function getInitials(displayName?: string | null, email?: string | null): string {
  if (displayName?.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

const HUDHeader: React.FC<HUDHeaderProps> = ({ onClose, notificationCount = 0, onBellClick }) => {
  const { user, trainerProfile, handleLogout } = useAppContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setDropdownOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
      {/* Left: Trainer brand */}
      <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-initial">
        {trainerProfile ? (
          <>
            {trainerProfile.avatarUrl ? (
              <img
                src={trainerProfile.avatarUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 font-mono text-xs font-bold text-orange-light"
                aria-hidden
              >
                {getInitials(trainerProfile.displayName, null)}
              </div>
            )}
            <span className="truncate font-mono text-xs uppercase tracking-wider text-white/90 md:text-sm">
              {trainerProfile.displayName}
            </span>
          </>
        ) : (
          <span className="font-mono text-xs uppercase tracking-wider text-white/40">
            No active program
          </span>
        )}
      </div>

      {/* Center: App wordmark (hidden on mobile) */}
      <div className="hidden flex-shrink-0 md:block">
        <span className="font-heading text-lg font-black uppercase tracking-tighter text-orange-light">
          AI FITCOPILOT
        </span>
      </div>

      {/* Right: Bell + Avatar dropdown + optional Close */}
      <div className="flex flex-1 items-center justify-end gap-2 md:flex-initial">
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={onBellClick}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label={
              notificationCount > 0 ? `${notificationCount} notifications` : 'Notifications'
            }
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-light px-1 font-mono text-[10px] font-bold text-black">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>

          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                aria-expanded={dropdownOpen}
                aria-haspopup="menu"
                aria-label="User menu"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="font-mono text-sm font-bold text-orange-light">
                    {getInitials(user.displayName, user.email)}
                  </span>
                )}
              </button>

              {dropdownOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 min-w-[180px] rounded-lg border border-white/10 bg-bg-dark py-1 shadow-xl"
                >
                  <a
                    href="/profile"
                    role="menuitem"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-white/90 transition hover:bg-white/10 hover:text-white"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <UserCircle className="h-4 w-4" />
                    Profile
                  </a>
                  <a
                    href="/settings"
                    role="menuitem"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-white/90 transition hover:bg-white/10 hover:text-white"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </a>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-white/90 transition hover:bg-white/10 hover:text-red-400"
                    onClick={() => {
                      setDropdownOpen(false);
                      handleLogout();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/20 hover:text-black"
            aria-label="Close HUD"
          >
            <X className="h-4 w-4" />
            Close
          </button>
        )}
      </div>
    </header>
  );
};

export default HUDHeader;
