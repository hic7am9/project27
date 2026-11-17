import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sparkles, CheckCircle, Loader2, LogOut, Search, Home } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import type { CleanerApartmentView } from '@/types';
import type { ApartmentStatus } from '@/types';

const STATUS_CONFIG: Record<string, { labelKey: string; dot: string; cardBorder: string; bg: string }> = {
  not_ready: { labelKey: 'cleaner_not_ready', dot: 'bg-slate-400', cardBorder: 'ring-2 ring-slate-400', bg: 'bg-slate-50 dark:bg-slate-800/50' },
  ready: { labelKey: 'cleaner_ready', dot: 'bg-sky-500', cardBorder: '', bg: 'bg-sky-50 dark:bg-sky-950/30' },
  occupied: { labelKey: 'cleaner_occupied', dot: 'bg-emerald-500', cardBorder: '', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  maintenance: { labelKey: 'cleaner_maintenance', dot: 'bg-orange-500', cardBorder: '', bg: 'bg-orange-50 dark:bg-orange-950/30' },
};

export function Cleaner() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const [apartments, setApartments] = useState<CleanerApartmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [markMsg, setMarkMsg] = useState<string | null>(null);

  const loadApartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('cleaner_apartments_view')
      .select('*')
      .order('apartment_name');
    if (err) {
      setError(err.message);
      setApartments([]);
    } else {
      setApartments((data as CleanerApartmentView[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadApartments();
    const channel = supabase
      .channel('cleaner-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'apartments' }, () => loadApartments())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaner_apartments' }, () => loadApartments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadApartments]);

  const handleMarkClean = async (aptId: string) => {
    setMarking(aptId);
    setConfirmingId(null);
    setMarkMsg(null);
    const { data, error: err } = await supabase.rpc('mark_apartment_clean', { p_apartment_id: aptId });
    if (err) {
      setMarkMsg(err.message);
    } else {
      const result = data as { success: boolean; error?: string };
      if (result?.success) {
        setMarkMsg(t('cleaner_marked_done'));
        await loadApartments();
      } else {
        setMarkMsg(result?.error || t('cleaner_mark_failed'));
      }
    }
    setTimeout(() => setMarkMsg(null), 4000);
    setMarking(null);
  };

  const filtered = useMemo(() => {
    return apartments.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (a.apartment_name ?? '').toLowerCase().includes(q) || (a.apt_number ?? '').toLowerCase().includes(q) || (a.location_name ?? '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [apartments, search, statusFilter]);

  const needsCleaningCount = apartments.filter((a) => a.status === 'not_ready').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 size={32} className="animate-spin text-slate-400" />
        <p className="text-sm text-slate-400 font-semibold">...</p>
      </div>
    );
  }

  if (error && apartments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <p className="text-sm text-red-500 font-semibold">{error}</p>
        <button onClick={() => loadApartments()} className="btn-primary">{t('cancel') === 'إلغاء' ? 'إعادة' : 'Retry'}</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src="/icon.svg" alt="HICHAM STAY" className="w-8 h-8 rounded-lg" />
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">HICHAM STAY</h1>
              <p className="text-[10px] text-slate-400 font-semibold">{t('cleaner_title')}</p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            title={t('auth_sign_out')}
          >
            <LogOut size={20} />
          </button>
        </div>

        {/* Stats + filters */}
        <div className="mt-3 space-y-2">
          {needsCleaningCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30">
              <Sparkles size={16} className="text-amber-500" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                {needsCleaningCount} {t('cleaner_needs_cleaning')}
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pr-9 text-sm"
                placeholder={t('search')}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-32 text-sm"
            >
              <option value="all">{t('all')}</option>
              <option value="not_ready">{t('cleaner_not_ready')}</option>
              <option value="ready">{t('cleaner_ready')}</option>
              <option value="occupied">{t('cleaner_occupied')}</option>
              <option value="maintenance">{t('cleaner_maintenance')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 sm:p-4">
        {markMsg && (
          <div className={`mb-3 p-3 rounded-xl text-sm font-semibold text-center ${markMsg.includes(t('cleaner_marked_done')) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-red-50 text-red-600 dark:bg-red-950/30'}`}>
            {markMsg}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Home size={40} className="text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400 font-semibold">{t('cleaner_no_apartments')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((apt) => {
              const cfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.not_ready;
              const isNeedsCleaning = apt.status === 'not_ready';
              return (
                <div key={apt.apartment_id} className={`card p-4 ${cfg.cardBorder} ${cfg.bg} transition-all`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                        {apt.apt_number ?? apt.apartment_name}
                      </h3>
                      {apt.location_name && (
                        <p className="text-xs text-slate-400 font-semibold mt-0.5 truncate">{apt.location_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t(cfg.labelKey)}</span>
                    </div>
                  </div>

                  {apt.next_check_out && (
                    <p className="text-xs text-slate-400 font-semibold mb-3">
                      {t('check_out')}: <span dir="ltr">{apt.next_check_out}</span>
                    </p>
                  )}

                  {isNeedsCleaning && (
                    <button
                      onClick={() => setConfirmingId(apt.apartment_id)}
                      disabled={marking === apt.apartment_id}
                      className="btn-success w-full py-3 text-sm font-bold"
                    >
                      {marking === apt.apartment_id ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> {t('cleaner_mark_done')}</>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmingId(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('cleaner_confirm_title')}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmingId(null)} className="btn-secondary flex-1">{t('cancel')}</button>
              <button
                onClick={() => handleMarkClean(confirmingId)}
                disabled={marking === confirmingId}
                className="btn-success flex-1"
              >
                {marking === confirmingId ? <Loader2 size={18} className="animate-spin" /> : t('cleaner_confirm_yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
