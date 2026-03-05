import React, { useState, useEffect } from 'react';
import { BASE } from '../constants';

const HANDBOOK_PATHS = ['/handbook', '/biology', '/neuro', '/chrono', '/functional-force'];

const Navigation: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pathname, setPathname] = useState('/');

  useEffect(() => {
    setPathname(window.location.pathname);
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const localPath = pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : pathname;
  const isHandbookActive =
    HANDBOOK_PATHS.includes(localPath) || localPath.startsWith('/pillar-');

  const linkClass = (active: boolean) =>
    `text-sm font-medium transition-colors ${active ? 'text-sync-orange font-bold' : 'text-gray-600 hover:text-sync-blue'}`;

  return (
    <nav className="sticky top-0 z-50 bg-sync-base/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <a
            href={BASE + '/'}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-3 h-3 rounded-full bg-sync-orange"></div>
            <span className="text-xl font-display font-bold text-sync-blue tracking-tight">
              Sync<span className="text-sync-orange">60</span>
            </span>
          </a>
          <div className="hidden md:flex space-x-8">
            <a
              href={BASE + '/japanese-walking'}
              className={linkClass(localPath === '/japanese-walking')}
            >
              Japanese Walking
            </a>
            <a
              href={BASE + '/cookbook'}
              className={linkClass(localPath === '/cookbook')}
            >
              Bio-Sync60 Cookbook
            </a>
            <a
              href={BASE + '/pillars'}
              className={linkClass(localPath === '/pillars')}
            >
              The 5 Pillars
            </a>
            <a
              href={BASE + '/mindful-walking'}
              className={linkClass(localPath === '/mindful-walking')}
            >
              Mindful Walking
            </a>
            <a
              href={BASE + '/handbook'}
              className={linkClass(isHandbookActive)}
            >
              Handbook
            </a>
          </div>
          <div className="md:hidden">
            <button
              className="text-gray-600 font-bold p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              ☰
            </button>
          </div>
        </div>
      </div>
      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div id="mobile-menu" className="md:hidden bg-white border-t p-4 space-y-3 shadow-lg">
          <a href={BASE + '/japanese-walking'} onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-left font-medium text-gray-700">Japanese Walking</a>
          <a href={BASE + '/cookbook'} onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-left font-medium text-gray-700">Bio-Sync60 Cookbook</a>
          <a href={BASE + '/pillars'} onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-left font-medium text-gray-700">The 5 Pillars</a>
          <a href={BASE + '/mindful-walking'} onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-left font-medium text-gray-700">Mindful Walking</a>
          <a href={BASE + '/handbook'} onClick={() => setIsMobileMenuOpen(false)} className={`block w-full text-left font-medium ${isHandbookActive ? 'text-sync-orange font-bold' : 'text-gray-700'}`}>Handbook</a>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
