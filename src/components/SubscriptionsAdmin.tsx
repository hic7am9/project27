import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  KeyRound, Plus, Download, Search, Loader2, RefreshCw, Ban, CheckCircle2,
  Clock, XCircle, ShieldOff, CalendarClock, FileText, Users,
} from 'lucide-react';

interface CodeRow {
  id: string;
  code_prefix: string;
  duration_days: number;
  status: 'unused' | 'used' | 'revoked' | 'expired';
  used_by_email: string | null;
  used_at: string | null;
  expires_at: string | null;
  note: string | null;
  created_at: string;
}

interface SubUser {
  user_id: string;
  email: string;
  full_name: string;
  account_status: string;
  subscription_ends_at: string | null;
  blocked_reason: string | null;
  access_state: string;
  is_team_member: boolean;
  owner_email: string | null;
}

interface SubStats {
  total_users: number;
  active_users: number;
  pending_users: number;
  blocked_users: number;
  expired_users: number;
  expiring_7d: number;
  codes_used: number;
  codes_unused: number;
  codes_revoked: number;
  codes_expired: number;
}

interface AuditRow {
  id: number;
  action: string;
  target_email: string | null;
  details: Record<string, unknown> | null;
  created_by_email: string | null;
  created_at: string;
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  try { return JSON.stringify(err); } catch { return String(err); }
}

const STATUS_LABELS: Record<string, string> = {
  unused: 'غير مستخدم',
  used: 'مستخدم',
  revoked: 'ملغى',
  expired: 'منتهٍ',
};

const STATUS_STYLES: Record<string, string> = {
  unused: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  used: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  revoked: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const USER_STATE_LABELS: Record<string, string> = {
  active: 'فعّال',
  pending: 'غير مفعّل',
  blocked: 'محظور',
  suspended: 'موقوف',
  expired: 'منتهي الاشتراك',
};

const USER_STATE_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  blocked: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  suspended: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  expired: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const ACTION_LABELS: Record<string, string> = {
  codes_generated: 'إنشاء أكواد',
  code_revoked: 'إلغاء كود',
  account_activated: 'تفعيل حساب بكود',
  status_changed_active: 'إعادة تنشيط حساب',
  status_changed_suspended: 'إيقاف حساب',
  status_changed_blocked: 'حظر حساب',
  subscription_extended: 'تمديد اشتراك',
  user_reactivated: 'إعادة تفعيل مستخدم',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function SubscriptionsAdmin() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'codes' | 'users' | 'audit'>('codes');
  const [stats, setStats] = useState<SubStats | null>(null);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [users, setUsers] = useState<SubUser[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // generate form
  const [genCount, setGenCount] = useState(1);
  const [genDays, setGenDays] = useState(30);
  const [genValid, setGenValid] = useState(7);
  const [genNote, setGenNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>([]);

  // filters
  const [codeSearch, setCodeSearch] = useState('');
  const [codeFilter, setCodeFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [extendUser, setExtendUser] = useState<SubUser | null>(null);
  const [extendDays, setExtendDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, codesRes, usersRes, auditRes] = await Promise.all([
        supabase.rpc('admin_subscription_stats'),
        supabase.rpc('admin_list_activation_codes'),
        supabase.rpc('admin_list_users_subscription'),
        supabase.rpc('admin_subscription_audit'),
      ]);
      if (statsRes.error) throw statsRes.error;
      if (codesRes.error) throw codesRes.error;
      if (usersRes.error) throw usersRes.error;
      if (auditRes.error) throw auditRes.error;
      setStats(statsRes.data as SubStats);
      setCodes((codesRes.data as CodeRow[]) ?? []);
      setUsers((usersRes.data as SubUser[]) ?? []);
      setAudit((auditRes.data as AuditRow[]) ?? []);
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const generateCodes = async () => {
    setGenerating(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('generate_activation_codes', {
        p_count: genCount,
        p_duration_days: genDays,
        p_valid_days: genValid,
        p_note: genNote.trim() || null,
      });
      if (rpcError) throw rpcError;
      setNewCodes(((data as { code: string }[]) ?? []).map((r) => r.code));
      setGenNote('');
      setToast('تم إنشاء الأكواد بنجاح');
      await load();
    } catch (err) {
      setToast(errText(err));
    } finally {
      setGenerating(false);
    }
  };

  const revokeCode = async (row: CodeRow) => {
    setBusy(row.id);
    const { data } = await supabase.rpc('admin_revoke_code', { p_code_id: row.id });
    setToast(data?.message ?? 'تم');
    setBusy(null);
    await load();
  };

  const setUserStatus = async (u: SubUser, status: 'active' | 'suspended' | 'blocked', reason?: string) => {
    setBusy(u.user_id);
    const { data } = await supabase.rpc('admin_set_user_status', {
      p_user_id: u.user_id,
      p_status: status,
      p_reason: reason ?? null,
    });
    setToast(data?.message ?? 'تم');
    setBusy(null);
    await load();
  };

  const extendSubscription = async () => {
    if (!extendUser) return;
    setBusy(extendUser.user_id);
    const { data } = await supabase.rpc('admin_extend_subscription', {
      p_user_id: extendUser.user_id,
      p_days: extendDays,
    });
    setToast(data?.message ?? 'تم');
    setBusy(null);
    setExtendUser(null);
    await load();
  };

  const reactivateUser = async (u: SubUser) => {
    setBusy(u.user_id);
    const { data } = await supabase.rpc('admin_reactivate_user', { p_user_id: u.user_id });
    setToast(data?.message ?? 'تم');
    setBusy(null);
    await load();
  };

  const exportCodesCSV = () => {
    const headers = ['Prefix', 'Status', 'Duration Days', 'Used By', 'Used At', 'Code Expires At', 'Note', 'Created At'];
    const rows = filteredCodes.map((c) => [
      `"${c.code_prefix}..."`,
      c.status,
      c.duration_days,
      `"${c.used_by_email ?? ''}"`,
      `"${c.used_at ?? ''}"`,
      `"${c.expires_at ?? ''}"`,
      `"${c.note ?? ''}"`,
      `"${c.created_at}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activation-codes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredCodes = codes.filter((c) => {
    if (codeFilter !== 'all' && c.status !== codeFilter) return false;
    if (!codeSearch) return true;
    const q = codeSearch.toLowerCase();
    return (
      c.code_prefix.toLowerCase().includes(q) ||
      (c.used_by_email ?? '').toLowerCase().includes(q) ||
      (c.note ?? '').toLowerCase().includes(q)
    );
  });

  const filteredUsers = users.filter((u) => {
    if (u.email === profile?.email) return false;
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q);
  });

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
        <ShieldOff size={32} className="text-red-400" />
        <p className="text-sm text-red-500 font-semibold">{error}</p>
        <button onClick={() => load()} className="btn-primary">إعادة المحاولة</button>
      </div>
    );
  }

  const statCards = [
    { label: 'المسجلون', value: stats?.total_users ?? 0, icon: Users, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/30' },
    { label: 'المفعّلون', value: stats?.active_users ?? 0, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'غير المفعّلين', value: stats?.pending_users ?? 0, icon: KeyRound, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800' },
    { label: 'المحظورون/الموقوفون', value: stats?.blocked_users ?? 0, icon: Ban, color: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
    { label: 'منتهي الاشتراك', value: stats?.expired_users ?? 0, icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
    { label: 'تنتهي خلال 7 أيام', value: stats?.expiring_7d ?? 0, icon: CalendarClock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
    { label: 'أكواد غير مستخدمة', value: stats?.codes_unused ?? 0, icon: KeyRound, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'أكواد مستخدمة', value: stats?.codes_used ?? 0, icon: CheckCircle2, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800' },
    { label: 'أكواد ملغاة', value: stats?.codes_revoked ?? 0, icon: XCircle, color: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
  ];

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-3 space-y-1.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
                <Icon size={16} />
              </div>
              <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">{card.value}</p>
              <p className="text-[10px] font-semibold text-slate-400 leading-tight">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {([
          ['codes', 'الأكواد', KeyRound],
          ['users', 'المستخدمون', Users],
          ['audit', 'سجل العمليات', FileText],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
              tab === key
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Codes tab */}
      {tab === 'codes' && (
        <div className="space-y-4">
          {/* Generate */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Plus size={16} className="text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">إنشاء أكواد تفعيل</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">العدد</label>
                <input type="number" min={1} max={100} value={genCount}
                  onChange={(e) => setGenCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  className="input text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">مدة الاشتراك (يوم)</label>
                <input type="number" min={1} max={3650} value={genDays}
                  onChange={(e) => setGenDays(Math.max(1, Math.min(3650, Number(e.target.value) || 1)))}
                  className="input text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">صلاحية الكود (يوم)</label>
                <input type="number" min={0} max={365} value={genValid}
                  onChange={(e) => setGenValid(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
                  className="input text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">ملاحظة</label>
                <input value={genNote} onChange={(e) => setGenNote(e.target.value)}
                  placeholder="مثال: عميل دبي" className="input text-sm" />
              </div>
            </div>
            <button onClick={generateCodes} disabled={generating}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
              {generating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              إنشاء الأكواد
            </button>

            {newCodes.length > 0 && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    هذه الأكواد تظهر مرة واحدة فقط — انسخها أو صدّرها الآن:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(newCodes.join('\n')).then(() => setToast('تم نسخ الأكواد'))}
                      className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                    >نسخ الكل</button>
                    <button onClick={exportCodesCSV} className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline">تصدير CSV</button>
                  </div>
                </div>
                <div dir="ltr" className="font-mono text-sm space-y-1">
                  {newCodes.map((c) => (
                    <div key={c} className="text-slate-800 dark:text-slate-100 select-all">{c}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Codes table */}
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">جدول الأكواد ({filteredCodes.length})</h3>
              <div className="flex gap-2 flex-1 sm:flex-none">
                <div className="relative flex-1 sm:w-48">
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={codeSearch} onChange={(e) => setCodeSearch(e.target.value)}
                    placeholder="بحث بالبادئة أو البريد" className="input pr-9 text-sm" />
                </div>
                <select value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)} className="input text-sm w-auto">
                  <option value="all">الكل</option>
                  <option value="unused">غير مستخدم</option>
                  <option value="used">مستخدم</option>
                  <option value="revoked">ملغى</option>
                  <option value="expired">منتهٍ</option>
                </select>
                <button onClick={exportCodesCSV} className="btn-secondary shrink-0" title="تصدير CSV">
                  <Download size={15} />
                </button>
                <button onClick={() => load()} className="btn-secondary shrink-0" title="تحديث">
                  <RefreshCw size={15} />
                </button>
              </div>
            </div>
            {filteredCodes.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400 font-semibold">لا توجد أكواد</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="text-right font-semibold px-4 py-3">الكود</th>
                      <th className="text-right font-semibold px-4 py-3">الحالة</th>
                      <th className="text-right font-semibold px-4 py-3">المدة</th>
                      <th className="text-right font-semibold px-4 py-3 hidden sm:table-cell">استخدمه</th>
                      <th className="text-right font-semibold px-4 py-3 hidden sm:table-cell">صلاحية الكود</th>
                      <th className="text-right font-semibold px-4 py-3 hidden lg:table-cell">ملاحظة</th>
                      <th className="text-center font-semibold px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCodes.map((c) => (
                      <tr key={c.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100" dir="ltr">{c.code_prefix}...</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLES[c.status]}`}>
                            {STATUS_LABELS[c.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.duration_days} يوم</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 hidden sm:table-cell" dir="ltr">
                          {c.used_by_email ? `${c.used_by_email} (${formatDate(c.used_at)})` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{formatDate(c.expires_at)}</td>
                        <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{c.note ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {c.status === 'unused' && (
                            <button onClick={() => revokeCode(c)} disabled={busy === c.id}
                              className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline disabled:opacity-50">
                              إلغاء
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">إدارة المستخدمين ({filteredUsers.length})</h3>
            <div className="flex gap-2 flex-1 sm:flex-none">
              <div className="relative flex-1 sm:w-56">
                <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="بحث بالاسم أو البريد" className="input pr-9 text-sm" />
              </div>
              <button onClick={() => load()} className="btn-secondary shrink-0" title="تحديث">
                <RefreshCw size={15} />
              </button>
            </div>
          </div>
          {filteredUsers.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400 font-semibold">لا يوجد مستخدمون</div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {filteredUsers.map((u) => {
                const left = daysLeft(u.subscription_ends_at);
                return (
                  <div key={u.user_id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{u.full_name}</span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${USER_STATE_STYLES[u.access_state] ?? ''}`}>
                          {USER_STATE_LABELS[u.access_state] ?? u.access_state}
                        </span>
                        {u.is_team_member && u.owner_email && (
                          <span className="text-xs text-slate-400">(عضو فريق — اشتراك {u.owner_email})</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500" dir="ltr">{u.email}</p>
                      <p className="text-xs text-slate-400">
                        {u.subscription_ends_at
                          ? `ينتهي الاشتراك: ${formatDate(u.subscription_ends_at)}${left !== null && left >= 0 ? ` (باقي ${left} يوم)` : ''}`
                          : 'بلا اشتراك'}
                        {u.blocked_reason ? ` — السبب: ${u.blocked_reason}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {u.access_state !== 'active' && u.access_state !== 'expired' && (
                        <button onClick={() => reactivateUser(u)} disabled={busy === u.user_id}
                          className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-50">
                          <CheckCircle2 size={13} /> إعادة تفعيل
                        </button>
                      )}
                      <button onClick={() => { setExtendUser(u); setExtendDays(30); }} disabled={busy === u.user_id}
                        className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-50">
                        <CalendarClock size={13} /> تمديد
                      </button>
                      {u.access_state !== 'suspended' && u.access_state !== 'blocked' && (
                        <>
                          <button onClick={() => setUserStatus(u, 'suspended')} disabled={busy === u.user_id}
                            className="btn-secondary text-xs flex items-center gap-1 text-amber-600 disabled:opacity-50">
                            <Clock size={13} /> إيقاف
                          </button>
                          <button
                            onClick={() => {
                              const reason = window.prompt('سبب الحظر (اختياري):');
                              if (reason === null) return;
                              setUserStatus(u, 'blocked', reason);
                            }}
                            disabled={busy === u.user_id}
                            className="btn-secondary text-xs flex items-center gap-1 text-red-600 disabled:opacity-50">
                            <Ban size={13} /> حظر
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Audit tab */}
      {tab === 'audit' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">سجل العمليات (آخر {audit.length})</h3>
            <button onClick={() => load()} className="btn-secondary" title="تحديث">
              <RefreshCw size={15} />
            </button>
          </div>
          {audit.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400 font-semibold">لا توجد عمليات مسجلة</div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {audit.map((a) => (
                <div key={a.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm">
                  <span className="font-bold text-slate-900 dark:text-slate-100 shrink-0">{ACTION_LABELS[a.action] ?? a.action}</span>
                  {a.target_email && <span className="text-slate-500 text-xs" dir="ltr">{a.target_email}</span>}
                  <span className="text-slate-400 text-xs sm:ms-auto">{formatDate(a.created_at)} — بواسطة {a.created_by_email ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Extend modal */}
      {extendUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setExtendUser(null)}>
          <div className="card p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              تمديد اشتراك {extendUser.full_name}
            </h3>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">عدد الأيام</label>
              <input type="number" min={1} max={3650} value={extendDays}
                onChange={(e) => setExtendDays(Math.max(1, Math.min(3650, Number(e.target.value) || 1)))}
                className="input text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setExtendUser(null)} className="btn-secondary text-sm">إلغاء</button>
              <button onClick={extendSubscription} disabled={busy === extendUser.user_id}
                className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50">
                {busy === extendUser.user_id && <Loader2 size={14} className="animate-spin" />}
                تمديد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
