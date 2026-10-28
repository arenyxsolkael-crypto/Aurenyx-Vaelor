import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  BookOpen,
  Check,
  CheckCircle2,
  Code2,
  Compass,
  Cpu,
  FolderKanban,
  Globe,
  Info,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  PanelRight,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UserCheck,
  Users,
  WifiOff,
  Workflow,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { VaelorEmblem } from './VaelorEmblem';
import { OfflineBanner, PWAInstallButton } from './PWAInstallButton';
import { AgentActivityPanel } from './AgentActivityPanel';
import { OFFICIAL_ATTRIBUTION } from '../shared/types';

const TRUSTGRID_ROUTE_PREFIXES = [
  '/trustgrid',
  '/dashboard',
  '/demo',
  '/product',
  '/solutions',
  '/passport',
  '/assessment',
  '/risk-rules',
  '/testing',
  '/safeguards',
  '/reports',
  '/implementation',
  '/contact',
  '/privacy',
  '/terms',
  '/faq',
];

const NAV_ITEMS = [
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/missions', label: 'Mission Control', icon: Workflow },
  { to: '/research', label: 'Deep Research', icon: Compass },
  { to: '/council', label: 'Council', icon: Users },
  { to: '/coding-lab', label: 'Coding Lab', icon: Code2 },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/knowledge', label: 'Project Memory', icon: BookOpen },
  { to: '/agents', label: 'Agents', icon: Cpu },
  { to: '/tasks', label: 'Tasks', icon: Activity },
  { to: '/trustgrid', label: 'TrustGrid', icon: ShieldCheck },
  { to: '/overview', label: 'Overview', icon: Globe },
  { to: '/android', label: 'Android App', icon: Smartphone },
  { to: '/about', label: 'About', icon: Info },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const {
    theme,
    toggleTheme,
    gatewayState,
    health,
    conversations,
    activeConversation,
    selectConversation,
    startNewConversation,
    renameConversation,
    archiveConversation,
    deleteConversation,
  } = useWorkspace();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopAgentPanelOpen, setDesktopAgentPanelOpen] = useState(true);
  const [mobileAgentDrawerOpen, setMobileAgentDrawerOpen] = useState(false);

  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'active' | 'archived'>('active');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileAgentDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setMobileAgentDrawerOpen(false);
        setRenamingId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const isTrustGridSection = TRUSTGRID_ROUTE_PREFIXES.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
  );

  const isAuthenticatedChatSurface =
    Boolean(user) && (location.pathname === '/' || location.pathname === '/chat');

  const currentRouteName = isTrustGridSection
    ? 'TrustGrid'
    : location.pathname === '/auth'
      ? 'Sign In'
      : location.pathname === '/account'
        ? 'Account'
        : location.pathname === '/'
          ? user
            ? 'Chat'
            : 'Overview'
          : NAV_ITEMS.find((item) => location.pathname.startsWith(item.to))?.label || 'Workspace';

  const activeCount = useMemo(
    () => conversations.filter((c) => !c.archived).length,
    [conversations]
  );
  const archivedCount = useMemo(
    () => conversations.filter((c) => Boolean(c.archived)).length,
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return conversations.filter((conv) => {
      const matchesTab =
        historyFilter === 'archived' ? Boolean(conv.archived) : !conv.archived;
      if (!matchesTab) return false;
      if (!q) return true;
      return (
        conv.title.toLowerCase().includes(q) ||
        conv.messages.some((m) => m.content.toLowerCase().includes(q))
      );
    });
  }, [conversations, historyFilter, historySearch]);

  const handleNewChat = () => {
    setHistoryFilter('active');
    startNewConversation();
    if (location.pathname !== '/chat') {
      void navigate('/chat');
    }
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    void navigate('/overview');
  };

  const commitRename = (id: string) => {
    if (renameDraft.trim()) {
      renameConversation(id, renameDraft);
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  const renderGatewayStatus = () => {
    if (gatewayState === 'ready') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-[#d6d0e8] whitespace-nowrap shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="hidden sm:inline">{health?.primaryModel || 'Gemini ready'}</span>
          <span className="sm:hidden">Ready</span>
        </span>
      );
    }
    if (gatewayState === 'setup') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-amber-300 whitespace-nowrap shrink-0">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Setup required</span>
        </span>
      );
    }
    if (gatewayState === 'offline') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-rose-300 whitespace-nowrap shrink-0">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Backend offline</span>
        </span>
      );
    }
    return (
      <span className="text-xs text-[#9e97b0] whitespace-nowrap shrink-0">Checking gateway…</span>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0e0c16] text-left">
      {/* Brand Lockup */}
      <div className="flex h-14 items-center justify-between border-b border-white/8 px-4">
        <NavLink
          to="/"
          className="flex items-center gap-2.5 text-sm font-bold tracking-[0.06em] text-[#f6f4fc] whitespace-nowrap shrink-0"
        >
          <VaelorEmblem size="sm" />
          <span>
            AURENYX <span className="text-[#c5b3fc]">VAELOR</span>
          </span>
        </NavLink>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#9e97b0] hover:bg-white/6 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary Action */}
      <div className="p-3">
        {user ? (
          <button
            type="button"
            onClick={handleNewChat}
            className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#8b6ff7] px-4 py-2 text-xs font-semibold text-[#0b0a10] transition-colors hover:bg-[#9f86fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6ff7] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>New conversation</span>
          </button>
        ) : (
          <Link
            to="/auth"
            onClick={() => setMobileMenuOpen(false)}
            className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#8b6ff7] px-4 py-2 text-xs font-semibold text-[#0b0a10] transition-colors hover:bg-[#9f86fa] whitespace-nowrap"
          >
            <LogIn className="h-4 w-4" />
            <span>Sign in to workspace</span>
          </Link>
        )}
      </div>

      {/* Route Navigation */}
      <nav aria-label="Primary workspace navigation" className="px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const forceActive =
            (item.to === '/trustgrid' && isTrustGridSection) ||
            (item.to === '/chat' && isAuthenticatedChatSurface) ||
            (item.to === '/overview' && !user && location.pathname === '/');
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-[38px] items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive || forceActive
                    ? 'bg-[#1c172d] text-[#f6f4fc]'
                    : 'text-[#a39cb8] hover:bg-white/[0.04] hover:text-[#ece8f6]'
                }`
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-[#a58ff8]" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Private Conversation History (Authenticated) vs Public Visitor Notice (Signed Out) */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-white/8 px-3 pt-3">
        {user ? (
          <>
            <div className="mb-2 flex items-center justify-between px-1 text-xs text-[#87809b]">
              <span>Session History</span>
              <div className="inline-flex items-center gap-1 rounded-md bg-[#13111d] p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setHistoryFilter('active')}
                  aria-pressed={historyFilter === 'active'}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${
                    historyFilter === 'active'
                      ? 'bg-[#231d38] text-[#f5f3fc]'
                      : 'text-[#87809b] hover:text-[#d8d2e8]'
                  }`}
                >
                  Active ({activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('archived')}
                  aria-pressed={historyFilter === 'archived'}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${
                    historyFilter === 'archived'
                      ? 'bg-[#231d38] text-[#f5f3fc]'
                      : 'text-[#87809b] hover:text-[#d8d2e8]'
                  }`}
                >
                  Archived ({archivedCount})
                </button>
              </div>
            </div>

            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#7f7894]" />
              <input
                type="search"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                aria-label="Search conversation history"
                placeholder="Search sessions…"
                className="w-full rounded-lg border border-white/10 bg-[#13111d] py-1.5 pl-8 pr-2.5 text-xs text-[#f1eef9] placeholder-[#7f7894] focus:border-[#8b6ff7] focus:outline-none"
              />
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto pr-0.5">
              {filteredConversations.length === 0 ? (
                <p className="px-2 py-3 text-xs text-[#87809b]">No matching conversations.</p>
              ) : (
                filteredConversations.map((conv) => {
                  const isCurrent =
                    conv.id === activeConversation.id && isAuthenticatedChatSurface;
                  const isRenaming = renamingId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      className={`group flex items-center rounded-lg transition-colors ${
                        isCurrent ? 'bg-[#181427]' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      {isRenaming ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            commitRename(conv.id);
                          }}
                          className="flex flex-1 items-center gap-1 p-1"
                        >
                          <input
                            type="text"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            aria-label={`New title for ${conv.title}`}
                            autoFocus
                            maxLength={72}
                            className="min-w-0 flex-1 rounded border border-[#8b6ff7]/50 bg-[#0b0a10] px-2 py-1 text-xs text-[#f1eef9] focus:outline-none"
                          />
                          <button
                            type="submit"
                            aria-label="Save conversation title"
                            className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded text-emerald-300 hover:bg-white/8"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-label={`Open session: ${conv.title}`}
                            onClick={() => {
                              selectConversation(conv.id);
                              if (!isAuthenticatedChatSurface) {
                                void navigate('/chat');
                              }
                              setMobileMenuOpen(false);
                            }}
                            className="min-h-[40px] flex-1 truncate px-2.5 py-2 text-left text-xs text-[#cfc8e2] group-hover:text-white"
                          >
                            {conv.title}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingId(conv.id);
                              setRenameDraft(conv.title);
                            }}
                            aria-label={`Rename conversation ${conv.title}`}
                            className="inline-flex min-h-[36px] min-w-[28px] items-center justify-center rounded-md text-[#857e99] hover:text-[#e4dff2]"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => archiveConversation(conv.id, !conv.archived)}
                            aria-label={
                              conv.archived
                                ? `Unarchive conversation ${conv.title}`
                                : `Archive conversation ${conv.title}`
                            }
                            className="inline-flex min-h-[36px] min-w-[28px] items-center justify-center rounded-md text-[#857e99] hover:text-[#c5b3fc]"
                          >
                            {conv.archived ? (
                              <ArchiveRestore className="h-3.5 w-3.5" />
                            ) : (
                              <Archive className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteConversation(conv.id)}
                            aria-label={`Delete conversation ${conv.title}`}
                            className="inline-flex min-h-[36px] min-w-[28px] items-center justify-center rounded-md text-[#857e99] hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-white/8 bg-[#13111d] p-3.5 space-y-2 text-xs">
            <p className="font-semibold text-[#f1eef9]">Private Account Isolation</p>
            <p className="leading-relaxed text-[#958ea8]">
              Public landing pages and the tool sandbox are open without login. Sign in with Google
              or Email to access your private chats, projects, and saved memories.
            </p>
          </div>
        )}
      </div>

      {/* Sidebar Footer: Account Strip + PWA Install + Official Attribution */}
      <div className="border-t border-white/8 p-3 space-y-2.5">
        {user && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-[#13111d] px-2.5 py-2 text-xs">
            <Link
              to="/account"
              onClick={() => setMobileMenuOpen(false)}
              className="min-w-0 flex-1 truncate text-[#ece8f6] hover:text-white"
              title={user.email || user.displayName || 'Account settings'}
            >
              <span className="block truncate font-medium">
                {user.displayName || user.email || 'Signed-in Account'}
              </span>
              <span className="block truncate text-[11px] text-[#8f88a3]">
                {user.emailVerified ? 'Verified account' : 'Unverified email'}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Sign out of account"
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#cfc8e2] hover:bg-white/6 hover:text-rose-300 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        )}
        <PWAInstallButton />
        <p className="text-[11px] leading-relaxed text-[#87809b]">
          Founded by {OFFICIAL_ATTRIBUTION.founderOrganization} · {OFFICIAL_ATTRIBUTION.founderName}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh print:h-auto w-full overflow-hidden print:overflow-visible bg-[#0b0a10] text-[#f1eef9]">
      {/* Desktop Left Sidebar */}
      <aside className="print:hidden hidden w-[264px] shrink-0 border-r border-white/8 lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="print:hidden fixed inset-0 z-40 flex lg:hidden">
          <button
            type="button"
            aria-label="Close navigation backdrop"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
          />
          <div className="relative z-10 h-full w-[min(288px,84vw)] border-r border-white/10 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
        <OfflineBanner />

        {/* Compact 56px Sticky Top Header */}
        <header className="print:hidden flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/8 bg-[#0b0a10]/95 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="inline-flex min-h-[44px] min-w-[44px] -ml-2 items-center justify-center rounded-lg text-[#cfc8e2] hover:bg-white/6 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm whitespace-nowrap truncate">
              <span className="hidden text-[#8f88a3] sm:inline">Vaelor</span>
              <span className="hidden text-[#5f5873] sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-[#f5f3fc]">{currentRouteName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {renderGatewayStatus()}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-[#14121f] px-2.5 py-1.5 text-xs font-medium text-[#d8d2e8] hover:border-white/20 whitespace-nowrap shrink-0"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-[#a58ff8]" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-[#a58ff8]" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {user ? (
              <Link
                to="/account"
                aria-label="Account and privacy settings"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-[#14121f] px-2.5 py-1.5 text-xs font-medium text-[#ece8f6] hover:border-white/25 whitespace-nowrap shrink-0"
              >
                <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden md:inline max-w-[120px] truncate">
                  {user.displayName || user.email || 'Account'}
                </span>
              </Link>
            ) : (
              <Link
                to="/auth"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#8b6ff7] px-3 py-1.5 text-xs font-semibold text-[#0b0a10] hover:bg-[#9f86fa] whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign in</span>
              </Link>
            )}

            {isAuthenticatedChatSurface && (
              <>
                <button
                  type="button"
                  onClick={() => setDesktopAgentPanelOpen((v) => !v)}
                  aria-label="Toggle desktop agent activity panel"
                  className="hidden min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-[#14121f] px-3 py-1.5 text-xs font-medium text-[#d8d2e8] hover:border-white/20 hover:text-white xl:inline-flex whitespace-nowrap"
                >
                  <PanelRight className="h-3.5 w-3.5 text-[#a58ff8]" />
                  <span>Agents</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileAgentDrawerOpen(true)}
                  aria-label="Open agent activity panel"
                  className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-white/10 bg-[#14121f] text-[#d8d2e8] hover:border-white/20 xl:hidden"
                >
                  <PanelRight className="h-4 w-4 text-[#a58ff8]" />
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main Viewport + Optional Right Agent Panel on Authenticated Chat Route */}
        <div className="flex min-h-0 flex-1 overflow-hidden print:overflow-visible">
          <main className="min-w-0 flex-1 overflow-y-auto print:overflow-visible">
            <Outlet />
          </main>

          {isAuthenticatedChatSurface && desktopAgentPanelOpen && (
            <div className="print:hidden hidden w-[288px] shrink-0 border-l border-white/8 xl:block">
              <AgentActivityPanel />
            </div>
          )}
        </div>
      </div>

      {/* Mobile / Tablet Slide-over Agent Activity Panel */}
      {isAuthenticatedChatSurface && mobileAgentDrawerOpen && (
        <div className="fixed inset-0 z-40 flex justify-end xl:hidden">
          <button
            type="button"
            aria-label="Close agent panel backdrop"
            onClick={() => setMobileAgentDrawerOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
          />
          <div className="relative z-10 h-full w-[min(320px,88vw)] border-l border-white/10 shadow-2xl">
            <AgentActivityPanel onCloseMobile={() => setMobileAgentDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
