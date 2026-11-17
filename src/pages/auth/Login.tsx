import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, LogIn, RefreshCw } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

interface Props {
  onSwitchSignup: () => void;
  onSwitchForgot: () => void;
  onVerifyEmail: (email: string) => void;
}

function mapAuthError(message: string, t: (k: string) => string): string {
  if (message.includes('Invalid login credentials')) return t('auth_invalid_credentials');
  if (message.includes('Email not confirmed')) return t('auth_email_not_confirmed');
  if (message.includes('rate limit')) return t('auth_rate_limit');
  return message;
}

export function Login({ onSwitchSignup, onSwitchForgot, onVerifyEmail }: Props) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setShowResend(false);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(mapAuthError(err.message, t));
      if (err.message.includes('Email not confirmed')) {
        setShowResend(true);
      }
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (err) {
      setError(err.message);
    } else {
      onVerifyEmail(email);
    }
    setResending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 space-y-6 animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <img src="/icon.svg" alt="HICHAM STAY" className="w-20 h-20 rounded-2xl shadow-lg" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-wide">HICHAM STAY</h1>
            <p className="text-sm text-slate-400">{t('auth_login_subtitle')}</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('auth_email')}</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('auth_password')}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                className="input"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <p className="text-sm font-semibold text-red-500 text-center">{error}</p>}

          {showResend && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="btn-secondary w-full py-3"
            >
              {resending ? <Loader2 size={18} className="animate-spin" /> : <><RefreshCw size={18} /> {t('auth_verify_resend')}</>}
            </button>
          )}

          <button type="submit" disabled={loading || !email || !password} className="btn-primary w-full py-3.5 text-base">
            {loading ? <Loader2 size={20} className="animate-spin" /> : <><LogIn size={18} /> {t('auth_sign_in')}</>}
          </button>

          <div className="flex flex-col items-center gap-2 text-sm">
            <button type="button" onClick={onSwitchForgot} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold">
              {t('auth_forgot_password')}
            </button>
            <div className="text-slate-400">
              {t('auth_no_account')}{' '}
              <button type="button" onClick={onSwitchSignup} className="text-slate-700 dark:text-slate-200 font-bold hover:underline">
                {t('auth_create_account')}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
