import React from 'react';
import { Link } from 'react-router-dom';
import { OFFICIAL_ATTRIBUTION } from '../shared/types';
import { VaelorEmblem } from './VaelorEmblem';

export const OfficialFooter: React.FC = () => {
  return (
    <footer className="border-t border-white/8 bg-[#0e0c16] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div className="space-y-1.5 text-left">
          <div className="flex items-center gap-2 text-sm font-bold tracking-[0.06em] text-[#f6f4fc]">
            <VaelorEmblem size="sm" />
            <span>{OFFICIAL_ATTRIBUTION.footerLines[0]}</span>
          </div>
          <p className="text-xs text-[#b5add0]">{OFFICIAL_ATTRIBUTION.footerLines[1]}</p>
          <p className="text-xs text-[#958ea8]">{OFFICIAL_ATTRIBUTION.footerLines[2]}</p>
        </div>

        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#9e97b0]"
        >
          <Link to="/" className="hover:text-[#f6f4fc] transition-colors whitespace-nowrap">
            Workspace
          </Link>
          <Link to="/overview" className="hover:text-[#f6f4fc] transition-colors whitespace-nowrap">
            Overview
          </Link>
          <Link to="/research" className="hover:text-[#f6f4fc] transition-colors whitespace-nowrap">
            Research Mode
          </Link>
          <Link to="/about" className="hover:text-[#f6f4fc] transition-colors whitespace-nowrap">
            About & Attribution
          </Link>
          <Link to="/settings" className="hover:text-[#f6f4fc] transition-colors whitespace-nowrap">
            Settings & Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
};
