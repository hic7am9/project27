import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loader2, KeyRound, ShieldAlert, Clock, Ban, LogOut, CheckCircle2 } from 'lucide-react';

type AccessState = {
  state: 'active' | 'pending' | 'expired' | 'blocked' | 'suspended';
  subscription_ends_at: string | null;
  blocked_reason: string | null;
};

function formatEnds(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-800 to-slate-950" dir="rtl">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 sm:p-8">{children}</div>
    </div>
  );
}

function LogoutButton() {
  const { signOut } = useAuth();
  return (
    <button
      onClick={() => signOut()}
      className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
    >
      <LogOut size={16} />
      تسجيل الخروج
    </button>
  );
}

function ActivationCodeScreen() {
  const { refreshProfile } = useAuth();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const activate = async () => {
    const trimmed = code.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setMessage(null);
    const { data, error } = await supabase.rpc('activate_account', { p_code: trimmed });
    if (error) {
      setMessage({ ok: false, text: 'حدث خطأ، حاول مرة أخرى' });
    } else if (data?.success) {
      setMessage({ ok: true, text: data.message || 'تم تفعيل الحساب بنجاح' });
      await refreshProfile();
      window.location.reload();
      return;
    } else {
      setMessage({ ok: false, text: data?.message || 'كود غير صالح' });
    }
    setSaving(false);
  };

  return (
    <Shell>
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
          <KeyRound size={26} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">تفعيل الحساب</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          أدخل كود التفعيل الذي حصلت عليه لإكمال تفعيل حسابك والبدء في استخدام التطبيق.
        </p>
      </div>
      <div className="mt-6 space-y-3">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && activate()}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          dir="ltr"
          className="w-full text-center tracking-widest font-mono text-lg px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          maxLength={24}
        />
        {message && !message.ok && (
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-xl px-3 py-2.5">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            <span>{message.text}</span>
          </div>
        )}
        {message?.ok && (
          <div className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl px-3 py-2.5">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>{message.text}</span>
          </div>
        )}
        <button
          onClick={activate}
          disabled={saving || !code.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
          تفعيل
        </button>
      </div>
      <LogoutButton />
    </Shell>
  );
}

function BlockedScreen({ state, reason, ends }: { state: string; reason: string | null; ends: string | null }) {
  const cfg = {
    blocked: {
      icon: <Ban size={26} className="text-red-600 dark:text-red-400" />,
      bg: 'bg-red-100 dark:bg-red-900/40',
      title: 'الحساب محظور',
      text: reason ? `تم حظر هذا الحساب. السبب: ${reason}` : 'تم حظر هذا الحساب. يرجى التواصل مع المسؤول.',
    },
    suspended: {
      icon: <ShieldAlert size={26} className="text-amber-600 dark:text-amber-400" />,
      bg: 'bg-amber-100 dark:bg-amber-900/40',
      title: 'الحساب موقوف',
      text: reason ? `تم إيقاف هذا الحساب مؤقتاً. السبب: ${reason}` : 'تم إيقاف هذا الحساب مؤقتاً. يرجى التواصل مع المسؤول.',
    },
    expired: {
      icon: <Clock size={26} className="text-amber-600 dark:text-amber-400" />,
      bg: 'bg-amber-100 dark:bg-amber-900/40',
      title: 'انتهى الاشتراك',
      text: ends
        ? `انتهى اشتراك حسابك بتاريخ ${formatEnds(ends)}. للحصول على كود تفعيل جديد يرجى التواصل مع المسؤول.`
        : 'انتهى اشتراك حسابك. للحصول على كود تفعيل جديد يرجى التواصل مع المسؤول.',
    },
  }[state] ?? {
    icon: <ShieldAlert size={26} className="text-red-600 dark:text-red-400" />,
    bg: 'bg-red-100 dark:bg-red-900/40',
    title: 'لا يمكن الوصول',
    text: 'لا يمكنك استخدام التطبيق حالياً. يرجى التواصل مع المسؤول.',
  };

  return (
    <Shell>
      <div className="flex flex-col items-center text-center gap-3">
        <div className={`w-14 h-14 rounded-2xl ${cfg.bg} flex items-center justify-center`}>{cfg.icon}</div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{cfg.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{cfg.text}</p>
      </div>
      <LogoutButton />
    </Shell>
  );
}

export function ActivationGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState | null>(null);
  const [error, setError] = useState(false);

  const load = async () => {
    setError(false);
    const { data, error: rpcError } = await supabase.rpc('my_access_state');
    if (rpcError || !data) {
      setError(true);
      setState(null);
      return;
    }
    setState(data as AccessState);
  };

  useEffect(() => {
    load();
  }, []);

  if (!state) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-800 to-slate-950">
        <Loader2 size={32} className="animate-spin text-slate-400" />
        {error && (
          <button onClick={load} className="text-sm text-slate-300 underline">
            إعادة المحاولة
          </button>
        )}
      </div>
    );
  }

  if (state.state === 'active') return <>{children}</>;
  if (state.state === 'pending') return <ActivationCodeScreen />;
  return <BlockedScreen state={state.state} reason={state.blocked_reason} ends={state.subscription_ends_at} />;
}
