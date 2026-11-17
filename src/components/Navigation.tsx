import { ClipboardList, CalendarDays, DoorOpen, Wallet, Settings, X, LogOut, Shield, Users, Sparkles, Menu, MessageCircle, FileText } from 'lucide-react';
import { useApp, type ViewName } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { useState } from 'react';
import { SupportAbout } from '@/components/SupportAbout';
import { TodayAlerts } from '@/components/TodayAlerts';

const NAV_ITEMS: { id: ViewName; labelKey: string; icon: typeof ClipboardList }[] = [
  { id: 'schedule', labelKey: 'work_schedule', icon: ClipboardList },
  { id: 'calendar', labelKey: 'calendar', icon: CalendarDays },
  { id: 'checkout', labelKey: 'checkout', icon: DoorOpen },
  { id: 'archive', labelKey: 'archive', icon: Wallet },
];

export function SettingsModal({ isOpen, onClose, onNavigateAdmin, onNavigateTeam }: { isOpen: boolean; onClose: () => void; onNavigateAdmin?: () => void; onNavigateTeam?: () => void }) {
  const { t } = useI18n();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('settings')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <SupportAbout onNavigateAdmin={onNavigateAdmin} onNavigateTeam={onNavigateTeam} />
      </div>
    </div>
  );
}

export function TopNav() {
  const { view, setView, data } = useApp();
  const { teamRole, signOut } = useAuth();
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const role = teamRole?.role ?? 'owner';
  const isOwner = role === 'owner';
  const isAdmin = isOwner;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  };

  const menuItems: { id: string; labelKey: string; icon: typeof Users; show: boolean; onClick?: () => void; danger?: boolean }[] = [
    { id: 'whatsapp_bookings', labelKey: 'whatsapp_bookings_title', icon: MessageCircle, show: role !== 'cleaner' },
    { id: 'reports', labelKey: 'reports_hub_title', icon: FileText, show: role !== 'cleaner' },
    { id: 'cleaning_log', labelKey: 'cleaning_log_title', icon: Sparkles, show: role !== 'cleaner' },
    { id: 'team', labelKey: 'team_title', icon: Users, show: isOwner },
    { id: 'admin', labelKey: 'admin', icon: Shield, show: isAdmin },
    { id: 'settings', labelKey: 'settings', icon: Settings, show: true, onClick: () => { setMenuOpen(false); setSettingsOpen(true); } },
    { id: 'logout', labelKey: 'auth_sign_out', icon: LogOut, show: true, onClick: handleSignOut, danger: true },
  ];

  const closeMenu = () => setMenuOpen(false);

  const menuButton = (
    <button
      onClick={() => setMenuOpen(true)}
      className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 sm:px-3"
      title={t('settings')}
      aria-label={t('settings')}
    >
      <Menu size={22} />
      <span className="text-[9px] sm:text-[10px] font-semibold leading-tight text-center">{t('settings')}</span>
    </button>
  );

  // Brand (logo + name) acts as the Home button
  const brand = (
    <button
      onClick={() => setView('dashboard')}
      className={`hidden sm:flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800 sm:justify-self-start ${
        view === 'dashboard' ? 'ring-1 ring-slate-200 dark:ring-slate-700' : ''
      }`}
      title={t('dashboard')}
    >
      <img src="/icon.svg" alt="HICHAM STAY" className="w-7 h-7 rounded-lg" />
      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-wide">HICHAM STAY</span>
    </button>
  );

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t sm:sticky sm:top-0 sm:h-16 sm:border-t-0 sm:border-b border-slate-200 dark:border-slate-800 px-2 py-2 pb-[env(safe-area-inset-bottom)] sm:pt-[env(safe-area-inset-top)] sm:flex sm:items-center">
        <div className="flex items-center gap-1 w-full sm:grid sm:grid-cols-[1fr_auto_1fr]">
          {/* Brand — hidden on mobile, pinned to the right edge on desktop (RTL start), opens Home */}
          {brand}

          {/* Mobile: remaining top icons in one row */}
          <div className="flex flex-1 items-center justify-around sm:hidden">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl transition-all ${
                    active ? 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-[9px] font-semibold leading-tight text-center">{t(item.labelKey)}</span>
                </button>
              );
            })}
            <TodayAlerts apartments={data.apartments} bookings={data.bookings} />
            {menuButton}
          </div>

          {/* Desktop: top nav items centered */}
          <div className="hidden sm:flex sm:flex-none sm:justify-self-center sm:gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                    active ? 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  <Icon size={22} />
                  <span className="text-[10px] font-semibold leading-tight text-center">{t(item.labelKey)}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop: menu button on the left (RTL end) */}
          <div className="hidden sm:flex items-center gap-1 sm:justify-self-end">
            <TodayAlerts apartments={data.apartments} bookings={data.bookings} />
            {menuButton}
          </div>
        </div>
      </nav>

      {/* Side drawer — anchored to the left */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={closeMenu} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-slate-900 shadow-xl border-r border-slate-200 dark:border-slate-800 flex flex-col animate-slide-right">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <img src="/icon.svg" alt="HICHAM STAY" className="w-7 h-7 rounded-lg" />
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-wide">HICHAM STAY</span>
              </div>
              <button
                onClick={closeMenu}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={t('cancel')}
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {menuItems.filter((item) => item.show).map((item) => {
                const Icon = item.icon;
                const active = !item.onClick && view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { if (item.onClick) { item.onClick(); } else { closeMenu(); setView(item.id as ViewName); } }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-start text-sm font-semibold transition-all ${
                      item.danger
                        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                        : active
                          ? 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{t(item.labelKey)}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onNavigateAdmin={isAdmin ? () => { setSettingsOpen(false); setView('admin'); } : undefined}
        onNavigateTeam={isOwner ? () => { setSettingsOpen(false); setView('team'); } : undefined}
      />
    </>
  );
}
