import { useCallback, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface TrainerLiveHostShareMenuProps {
  copyLink: () => void | Promise<void>;
  copyJoinSessionId: () => void | Promise<void>;
  copyLinkOk: boolean;
  copySessionIdOk: boolean;
  onOpenInvite: () => void;
  /** When true, hide/disable in-app roster invites (reserved 1:1 session). */
  inviteDisabled?: boolean;
  inviteDisabledReason?: string;
}

export default function TrainerLiveHostShareMenu({
  copyLink,
  copyJoinSessionId,
  copyLinkOk,
  copySessionIdOk,
  onOpenInvite,
  inviteDisabled = false,
  inviteDisabledReason,
}: TrainerLiveHostShareMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const closeMenu = useCallback(() => {
    const el = detailsRef.current;
    if (el) el.open = false;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeMenu]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const root = detailsRef.current;
      if (!root?.open) return;
      if (root.contains(e.target as Node)) return;
      closeMenu();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [closeMenu]);

  return (
    <details ref={detailsRef} className="relative z-[120]">
      <summary
        className="border-white/20 hover:bg-white/10 list-none cursor-pointer rounded-lg border px-3 py-1.5 text-xs text-white md:text-sm [&::-webkit-details-marker]:hidden"
        aria-label="Share and invite"
      >
        <span className="inline-flex items-center gap-1">
          Share
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        </span>
      </summary>
      <div className="border-white/15 absolute right-0 mt-1 min-w-[12.5rem] rounded-lg border bg-black/95 py-1 shadow-lg backdrop-blur-sm">
        <button
          type="button"
          className="hover:bg-white/10 block w-full px-3 py-2 text-left text-xs text-white md:text-sm"
          onClick={() => {
            void copyLink();
            closeMenu();
          }}
        >
          {copyLinkOk ? 'Copied join link' : 'Copy join link'}
        </button>
        <button
          type="button"
          className="hover:bg-white/10 block w-full px-3 py-2 text-left text-xs text-white md:text-sm"
          onClick={() => {
            void copyJoinSessionId();
            closeMenu();
          }}
        >
          {copySessionIdOk ? 'Copied session ID' : 'Copy join session ID'}
        </button>
        <div className="border-white/10 my-1 border-t" />
        <button
          type="button"
          disabled={inviteDisabled}
          title={inviteDisabled ? inviteDisabledReason : undefined}
          className="hover:bg-white/10 block w-full px-3 py-2 text-left text-xs text-orange-light disabled:cursor-not-allowed disabled:opacity-40 md:text-sm"
          onClick={() => {
            if (inviteDisabled) return;
            closeMenu();
            onOpenInvite();
          }}
        >
          Invite clients…
        </button>
      </div>
    </details>
  );
}
