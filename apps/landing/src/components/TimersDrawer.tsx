/**
 * Reusable drawer that slides in from the right and displays grouped links.
 * Used for "All Timers" on the landing header; parent supplies sections data.
 */
import React, { useEffect } from 'react';

export interface TimersDrawerSection {
  category: string;
  items: { label: string; href: string }[];
}

interface TimersDrawerProps {
  open: boolean;
  onClose: () => void;
  sections: TimersDrawerSection[];
}

const TimersDrawer: React.FC<TimersDrawerProps> = ({ open, onClose, sections }) => {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        className={`fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-label="Close drawer"
        aria-hidden={!open}
      />
      <div
        className={`fixed inset-y-0 right-0 z-[110] w-[min(320px,100vw)] overflow-y-auto border-l border-white/10 bg-[#0d0500] shadow-xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-label="All timers"
        aria-hidden={!open}
      >
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0d0500] px-4 py-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-tight text-[#ffbf00]">
            All Timers
          </h2>
        </div>
        <nav className="p-4" aria-label="Timer protocols">
          {sections.map((section) => (
            <div key={section.category} className="mb-6">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/60">
                {section.category}
              </h3>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="block rounded-lg px-3 py-2 text-white transition-colors hover:bg-white/10 hover:text-[#ffbf00]"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
};

export default TimersDrawer;
