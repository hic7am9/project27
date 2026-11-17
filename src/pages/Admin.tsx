import { useState, useEffect, useCallback } from 'react';
import { supabase, type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/context/I18nContext';
import { Users, TrendingUp, Calendar, ArrowLeft, Search, Download, Loader2, Shield, KeyRound, UserCog } from 'lucide-react';
import { SubscriptionsAdmin } from '@/components/SubscriptionsAdmin';

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  apartment_count: number;
}

interface DashboardStats {
  total_users: number;
  new_today: number;
  new_7d: number;
  new_30d: number;
}

const PAGE_SIZE = 10;

export function Admin() {
  const { profile, teamRole } = useAuth();
  const { setView } = useApp();
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<'stats' | 'subscriptions'>('stats');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes] = await Promise.all([
        supabase.rpc('get_admin_dashboard_stats'),
        supabase.rpc('get_admin_user_stats'),
      ]);
      if (statsRes.error) throw statsRes.error;
      if (usersRes.error) throw usersRes.error;
      setStats(statsRes.data as DashboardStats);
      setUsers((usersRes.data as AdminUser[]) ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message
        : (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string')
          ? (err as { message: string }).message
          : 'Failed to load admin data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (profile && teamRole && teamRole.role !== 'owner') {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Shield size={32} className="text-slate-400" />
        <p className="text-sm text-slate-400 font-semibold">{t('admin') }</p>
        <button onClick={() => setView('dashboard')} className="btn-primary">{t('admin_back')}</button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone ?? '').includes(q);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const formatDate = (iso: string | null) => {
    if (!iso) return t('admin_never');
    const d = new Date(iso);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Joined', 'Last Login', 'Apartments'];
    const rows = filtered.map((u) => [
      `"${u.full_name}"`,
      `"${u.email}"`,
      `"${u.phone ?? ''}"`,
      `"${new Date(u.created_at).toISOString()}"`,
      `"${u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : ''}"`,
      u.apartment_count.toString(),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Shield size={32} className="text-red-400" />
        <p className="text-sm text-red-500 font-semibold">{error}</p>
        <button onClick={() => loadData()} className="btn-primary">إعادة المحاولة</button>
      </div>
    );
  }

  const statCards = [
    { label: t('admin_total_users'), value: stats?.total_users ?? 0, icon: Users, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/30' },
    { label: t('admin_new_today'), value: stats?.new_today ?? 0, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
    { label: t('admin_new_7d'), value: stats?.new_7d ?? 0, icon: Calendar, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
    { label: t('admin_new_30d'), value: stats?.new_30d ?? 0, icon: Calendar, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('schedule')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('admin_title')}</h1>
          </div>
        </div>
      </div>

      {/* Tabs: stats / subscriptions */}
      <div className="flex gap-2">
        {([
          ['stats', 'الإحصائيات', UserCog],
          ['subscriptions', 'الاشتراكات والأكواد', KeyRound],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === key
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'subscriptions' && <SubscriptionsAdmin />}

      {tab === 'stats' && (
      <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-4 space-y-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{card.value}</p>
                <p className="text-xs font-semibold text-slate-400 leading-tight">{card.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* User table */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('admin_total_users')}</h2>
          <div className="flex gap-2 flex-1 sm:flex-none sm:max-w-xs">
            <div className="relative flex-1">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="input pr-9 text-sm"
                placeholder={t('search')}
              />
            </div>
            <button onClick={handleExportCSV} className="btn-secondary shrink-0" title={t('export_csv')}>
              <Download size={16} />
              <span className="hidden sm:inline">{t('export_csv')}</span>
            </button>
          </div>
        </div>

        {pageData.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-400 font-semibold">{t('admin_no_users')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="text-right font-semibold px-4 py-3">{t('admin_name')}</th>
                    <th className="text-right font-semibold px-4 py-3">{t('admin_email')}</th>
                    <th className="text-right font-semibold px-4 py-3 hidden sm:table-cell">{t('guest_phone')}</th>
                    <th className="text-right font-semibold px-4 py-3 hidden sm:table-cell">{t('admin_joined')}</th>
                    <th className="text-right font-semibold px-4 py-3 hidden sm:table-cell">{t('admin_last_login')}</th>
                    <th className="text-center font-semibold px-4 py-3">{t('admin_apartments')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{u.full_name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300" dir="ltr">{u.email}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 hidden sm:table-cell" dir="ltr">{u.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{formatDate(u.last_sign_in_at)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
                          {u.apartment_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="btn-secondary text-sm disabled:opacity-40"
                >
                  {t('cancel') === 'إلغاء' ? 'السابق' : 'Prev'}
                </button>
                <span className="text-xs font-semibold text-slate-400">
                  {currentPage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="btn-secondary text-sm disabled:opacity-40"
                >
                  {t('cancel') === 'إلغاء' ? 'التالي' : 'Next'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      </>
      )}
    </div>
  );
}
