import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, UserPlus } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

interface Props {
  onSwitchLogin: () => void;
  onShowTerms: () => void;
  onShowPrivacy: () => void;
  onVerifyEmail: (email: string) => void;
  inviteToken?: string | null;
  onInviteConsumed?: () => void;
}

function mapAuthError(message: string, t: (k: string) => string): string {
  if (message.includes('already registered') || message.includes('User already registered')) return t('auth_email_taken');
  if (message.includes('password') && message.includes('weak')) return t('auth_password_too_weak');
  if (message.includes('Password should be at least')) return t('auth_password_too_short');
  if (message.includes('rate limit')) return t('auth_rate_limit');
  return message;
}

export function Signup({ onSwitchLogin, onShowTerms, onShowPrivacy, onVerifyEmail, inviteToken, onInviteConsumed }: Props) {
  const { t } = useI18n();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
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
    if (!agreed) {
      setError(t('auth_must_agree'));
      return;
    }
    if (!phone.trim()) {
      setError(t('auth_phone_required'));
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone: phone.trim() }, emailRedirectTo: window.location.origin },
    });
    if (err) {
      setError(mapAuthError(err.message, t));
      setLoading(false);
    } else if (data.user) {
      if (inviteToken && data.user) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('consume_invite', {
          p_token: inviteToken,
          p_user_id: data.user.id,
          p_email: email,
        });
        if (rpcErr) {
          console.error('consume_invite error:', rpcErr.message);
        }
        onInviteConsumed?.();
      }
      if (data.session && data.user.email_confirmed_at) {
        // Email confirmation is off — user is immediately logged in
      } else {
        // Email confirmation required — show verify screen
        onVerifyEmail(email);
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 space-y-6 animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <img src="/icon.svg" alt="HICHAM STAY" className="w-20 h-20 rounded-2xl shadow-lg" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-wide">HICHAM STAY</h1>
            <p className="text-sm text-slate-400">{t('auth_signup_subtitle')}</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('auth_full_name')}</label>
              <input
                type="text"
                required
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('auth_email')}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('auth_phone')}</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
                className="input"
                placeholder="+966 5x xxx xxxx"
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
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
            />
            <span className="text-xs text-slate-500 leading-relaxed">
              {t('auth_agree_prefix')}{' '}
              <button type="button" onClick={onShowTerms} className="text-slate-700 dark:text-slate-200 font-bold hover:underline">
                {t('auth_terms')}
              </button>{' '}
              {t('auth_and')}{' '}
              <button type="button" onClick={onShowPrivacy} className="text-slate-700 dark:text-slate-200 font-bold hover:underline">
                {t('auth_privacy')}
              </button>
            </span>
          </label>

          {error && <p className="text-sm font-semibold text-red-500 text-center">{error}</p>}

          <button type="submit" disabled={loading || !email || !password || !fullName || !phone.trim() || !confirm || !agreed} className="btn-primary w-full py-3.5 text-base">
            {loading ? <Loader2 size={20} className="animate-spin" /> : <><UserPlus size={18} /> {t('auth_create_account')}</>}
          </button>

          <div className="text-center text-sm text-slate-400">
            {t('auth_have_account')}{' '}
            <button type="button" onClick={onSwitchLogin} className="text-slate-700 dark:text-slate-200 font-bold hover:underline">
              {t('auth_sign_in')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
