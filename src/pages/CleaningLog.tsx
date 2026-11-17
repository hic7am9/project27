import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, ArrowLeft, Loader2, Search, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { useApp } from '@/context/AppContext';
import type { CleaningLog, Apartment } from '@/types';

interface CleaningLogRow extends CleaningLog {
  apartment_name?: string | null;
  apt_number?: string | null;
  cleaner_email?: string | null;
}

export function CleaningLogPage() {
  const { t } = useI18n();
  const { data } = useApp();
  const { setView } = useApp();
  const [logs, setLogs] = useState<CleaningLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [cleanerFilter, setCleanerFilter] = useState('all');

  const apartments: Apartment[] = data.apartments;
  const aptMap = useMemo(() => new Map(apartments.map((a) => [a.id, a])), [apartments]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: raw, error: err } = await supabase
      .from('cleaning_logs')
      .select('*')
      .order('cleaned_at', { ascending: false });
    if (err) {
      setError(err.message);
      setLogs([]);
    } else {
      const rows = (raw as CleaningLog[]) ?? [];
      const cleanerIds = [...new Set(rows.map((r) => r.cleaner_user_id))];
      const { data: cleaners } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', cleanerIds);
      const cleanerMap = new Map((cleaners ?? []).map((c: { id: string; email: string }) => [c.id, c.email]));
      setLogs(rows.map((r) => ({
        ...r,
        apartment_name: aptMap.get(r.apartment_id)?.name ?? null,
        apt_number: aptMap.get(r.apartment_id)?.apt_number ?? null,
        cleaner_email: cleanerMap.get(r.cleaner_user_id) ?? null,
      })));
    }
    setLoading(false);
  }, [aptMap]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const uniqueCleaners = useMemo(() => {
    const map = new Map<string, string>();
    for (const log of logs) {
      if (log.cleaner_email) map.set(log.cleaner_user_id, log.cleaner_email);
    }
    return Array.from(map.entries()).map(([id, email]) => ({ id, email }));
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (cleanerFilter !== 'all' && log.cleaner_user_id !== cleanerFilter) return false;
      if (dateFilter) {
        const logDate = new Date(log.cleaned_at).toISOString().split('T')[0];
        if (logDate !== dateFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const aptName = (log.apt_number ?? log.apartment_name ?? '').toLowerCase();
        if (!aptName.includes(q) && !(log.cleaner_email ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, cleanerFilter, dateFilter, search]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
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
        <p className="text-sm text-red-500 font-semibold">{error}</p>
        <button onClick={() => loadLogs()} className="btn-primary">{t('cancel') === 'إلغاء' ? 'إعادة' : 'Retry'}</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView('schedule')}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ClipboardList size={24} className="text-slate-400" />
          {t('cleaning_log_title')}
        </h1>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
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
            value={cleanerFilter}
            onChange={(e) => setCleanerFilter(e.target.value)}
            className="input sm:w-48 text-sm"
          >
            <option value="all">{t('cleaning_log_filter_cleaner')}</option>
            {uniqueCleaners.map((c) => (
              <option key={c.id} value={c.id}>{c.email}</option>
            ))}
          </select>
          <div className="relative sm:w-44">
            <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input pr-9 text-sm"
            />
          </div>
          {(search || dateFilter || cleanerFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setDateFilter(''); setCleanerFilter('all'); }}
              className="btn-secondary text-sm shrink-0"
            >
              {t('all')}
            </button>
          )}
        </div>
      </div>

      {/* Log table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-400 font-semibold">{t('cleaning_log_no_records')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="text-right font-semibold px-4 py-3">{t('cleaning_log_apartment')}</th>
                  <th className="text-right font-semibold px-4 py-3">{t('cleaning_log_cleaner')}</th>
                  <th className="text-right font-semibold px-4 py-3">{t('cleaning_log_date')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {log.apt_number ?? log.apartment_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300" dir="ltr">
                      {log.cleaner_email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(log.cleaned_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
