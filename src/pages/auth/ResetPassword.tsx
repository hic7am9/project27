import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, KeyRound } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

export function ResetPassword({ onDone }: { onDone?: () => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('auth_password_mismatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth_password_too_short'));
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
    } else {
      setDone(true);
      onDone?.();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 space-y-6 animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <img src="/icon.svg" alt="HICHAM STAY" className="w-20 h-20 rounded-2xl shadow-lg" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-wide">HICHAM STAY</h1>
            <p className="text-sm text-slate-400">{t('auth_reset_subtitle')}</p>
          </div>

          {done ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <KeyRound size={40} className="text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('auth_password_reset_done')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('auth_new_password')}</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  className="input"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('auth_confirm_password')}</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  dir="ltr"
                  className="input"
                  placeholder="••••••••"
                />
              </div>

              {error && <p className="text-sm font-semibold text-red-500 text-center">{error}</p>}

              <button type="submit" disabled={loading || !password || !confirm} className="btn-primary w-full py-3.5 text-base">
                {loading ? <Loader2 size={20} className="animate-spin" /> : t('auth_reset_password')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
