import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { TRUSTGRID_BRAND } from '../shared/trustgridEngine';
import { OFFICIAL_ATTRIBUTION } from '../shared/types';
import { useTrustGrid } from '../context/TrustGridContext';
import { TrustGridBrandMark } from './TrustGridBrandMark';

interface TrustGridNavItem {
  to: string;
  label: string;
  end?: boolean;
}

const PRIMARY_LINKS: TrustGridNavItem[] = [
  { to: '/trustgrid', label: 'TrustGrid Home', end: true },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/demo', label: 'Interactive Demo' },
  { to: '/assessment', label: 'Assessment' },
  { to: '/testing', label: 'Testing' },
  { to: '/safeguards', label: 'Safeguards' },
  { to: '/passport', label: 'Passport' },
  { to: '/reports', label: 'Reports' },
];

const SECONDARY_LINKS: TrustGridNavItem[] = [
  { to: '/product', label: 'Product' },
  { to: '/solutions', label: 'Solutions' },
  { to: '/risk-rules', label: 'Risk Rules' },
  { to: '/implementation', label: 'Free Plan' },
  { to: '/faq', label: 'FAQ' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
];

interface TrustGridShellProps {
  currentPageLabel: string;
  children: React.ReactNode;
}

export const TrustGridShell: React.FC<TrustGridShellProps> = ({
  currentPageLabel,
  children,
}) => {
  const { storageWarning } = useTrustGrid();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  return (
    <div className="min-h-full bg-[#06101F] text-[#F3F7FF] flex flex-col justify-between">
      <div>
        {/* Shared TrustGrid Top Navigation Header (hidden in print) */}
        <header className="print:hidden sticky top-0 z-20 border-b border-white/10 bg-[#06101F]/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <Link
              to="/trustgrid"
              className="flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#35C8FF]"
            >
              <TrustGridBrandMark size="sm" />
              <div>
                <p className="text-xs font-bold tracking-wider text-[#F3F7FF] whitespace-nowrap">
                  AURENYX <span className="text-[#35C8FF]">TRUSTGRID</span>
                </p>
                <p className="text-[11px] text-[#AEBFD4] hidden sm:block">
                  by {TRUSTGRID_BRAND.parentBrand} · {TRUSTGRID_BRAND.tagline}
                </p>
              </div>
            </Link>

            {/* Desktop Primary Links */}
            <nav
              aria-label="TrustGrid navigation"
              className="hidden xl:flex items-center gap-4 text-xs"
            >
              {PRIMARY_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `py-1.5 font-medium transition-colors whitespace-nowrap border-b-2 ${
                      isActive
                        ? 'border-[#35C8FF] text-[#F3F7FF]'
                        : 'border-transparent text-[#AEBFD4] hover:text-[#F3F7FF]'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}

              <div className="relative">
                <button
                  type="button"
                  aria-expanded={moreMenuOpen}
                  aria-label="Toggle TrustGrid documentation and legal links"
                  onClick={() => setMoreMenuOpen((v) => !v)}
                  className="inline-flex min-h-[36px] items-center gap-1 py-1.5 text-xs font-medium text-[#AEBFD4] hover:text-[#F3F7FF] whitespace-nowrap"
                >
                  <span>Docs & Legal</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {moreMenuOpen && (
                  <div
                    onMouseLeave={() => setMoreMenuOpen(false)}
                    className="absolute right-0 mt-1 w-48 rounded-xl border border-white/12 bg-[#0B1B30] py-1.5 shadow-xl z-30"
                  >
                    {SECONDARY_LINKS.map((sub) => (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        onClick={() => setMoreMenuOpen(false)}
                        className={({ isActive }) =>
                          `block px-3.5 py-2 text-xs transition-colors ${
                            isActive
                              ? 'bg-[#1685FF]/20 text-[#F3F7FF] font-semibold'
                              : 'text-[#AEBFD4] hover:bg-white/5 hover:text-[#F3F7FF]'
                          }`
                        }
                      >
                        {sub.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                to="/assessment"
                className="hidden sm:inline-flex min-h-[38px] items-center justify-center rounded-lg bg-[#1685FF] px-3.5 py-1.5 text-xs font-semibold text-[#F3F7FF] transition-colors hover:bg-[#2c92ff] whitespace-nowrap"
              >
                New Assessment
              </Link>
              <button
                type="button"
                aria-expanded={mobileNavOpen}
                aria-label={mobileNavOpen ? 'Close TrustGrid menu' : 'Open TrustGrid menu'}
                onClick={() => setMobileNavOpen((v) => !v)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/12 bg-[#0B1B30] text-[#F3F7FF] xl:hidden"
              >
                {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Mobile / Tablet Expandable TrustGrid Menu */}
          {mobileNavOpen && (
            <nav
              aria-label="Mobile TrustGrid navigation"
              className="border-t border-white/10 bg-[#0B1B30] px-4 py-4 xl:hidden"
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[...PRIMARY_LINKS, ...SECONDARY_LINKS].map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      `min-h-[42px] flex items-center rounded-lg px-3 py-2 text-xs font-medium ${
                        isActive
                          ? 'bg-[#1685FF] text-[#F3F7FF]'
                          : 'bg-[#06101F]/70 text-[#AEBFD4] hover:text-[#F3F7FF]'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </div>
            </nav>
          )}
        </header>

        {/* Breadcrumb & Storage Notice */}
        <div className="print:hidden mx-auto max-w-6xl px-4 pt-4 sm:px-6 lg:px-8 space-y-3">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[#AEBFD4]">
            <Link to="/" className="hover:text-[#F3F7FF] underline-offset-4 hover:underline">
              {TRUSTGRID_BRAND.parentBrand}
            </Link>
            <span aria-hidden="true">/</span>
            <Link to="/trustgrid" className="hover:text-[#F3F7FF] underline-offset-4 hover:underline">
              TrustGrid
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[#F3F7FF] font-medium">{currentPageLabel}</span>
          </nav>

          {storageWarning && (
            <div
              role="alert"
              className="rounded-xl border border-[#FFD37A]/35 bg-[#FFD37A]/10 px-4 py-2.5 text-xs text-[#FFD37A]"
            >
              {storageWarning}
            </div>
          )}
        </div>

        {/* Main Page Content */}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>

      {/* Shared TrustGrid Footer (hidden in print) */}
      <footer className="print:hidden mt-12 border-t border-white/10 bg-[#0B1B30]/75">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <TrustGridBrandMark size="sm" />
                <span className="text-sm font-bold tracking-wide text-[#F3F7FF]">
                  {TRUSTGRID_BRAND.productName}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[#AEBFD4] max-w-md">
                {TRUSTGRID_BRAND.supportingMessage}
              </p>
              <p className="text-xs text-[#35C8FF]">
                {TRUSTGRID_BRAND.parentBrand} · “{TRUSTGRID_BRAND.tagline}”
              </p>
              <p className="text-[11px] text-[#AEBFD4]">{OFFICIAL_ATTRIBUTION.statement}</p>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-semibold text-[#F3F7FF]">Governance Suite</p>
              <ul className="space-y-1.5 text-[#AEBFD4]">
                <li>
                  <Link to="/dashboard" className="hover:text-[#F3F7FF]">
                    Governance Dashboard
                  </Link>
                </li>
                <li>
                  <Link to="/demo" className="hover:text-[#F3F7FF]">
                    Interactive Free Demo
                  </Link>
                </li>
                <li>
                  <Link to="/assessment" className="hover:text-[#F3F7FF]">
                    Guided Risk Assessment
                  </Link>
                </li>
                <li>
                  <Link to="/risk-rules" className="hover:text-[#F3F7FF]">
                    Provisional Risk Rules
                  </Link>
                </li>
                <li>
                  <Link to="/passport" className="hover:text-[#F3F7FF]">
                    AI Workflow Passport
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-semibold text-[#F3F7FF]">Resources & Notices</p>
              <ul className="space-y-1.5 text-[#AEBFD4]">
                <li>
                  <Link to="/product" className="hover:text-[#F3F7FF]">
                    Product Modules
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="hover:text-[#F3F7FF]">
                    Solutions by Role
                  </Link>
                </li>
                <li>
                  <Link to="/implementation" className="hover:text-[#F3F7FF]">
                    Free Implementation Plan
                  </Link>
                </li>
                <li>
                  <Link to="/faq" className="hover:text-[#F3F7FF]">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-[#F3F7FF]">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-[#F3F7FF]">
                    Privacy Notice
                  </Link>{' '}
                  ·{' '}
                  <Link to="/terms" className="hover:text-[#F3F7FF]">
                    Starter Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 text-[11px] leading-relaxed text-[#AEBFD4]">
            Transparency notice: Risk scores use a provisional deterministic methodology and are not
            scientifically validated or a regulatory certification. Records persist locally in your
            browser by default; export JSON backups regularly.
          </div>
        </div>
      </footer>
    </div>
  );
};
