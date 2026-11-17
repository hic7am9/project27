import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MailCheck, RefreshCw, LogIn } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

interface Props {
  email: string;
  onBack: () => void;
}

export function VerifyEmail({ email, onBack }: Props) {
  const { t } = useI18n();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setResent(false);
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (err) {
      setError(err.message);
    } else {
      setResent(true);
    }
    setResending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 space-y-6 text-center animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
              <MailCheck size={40} className="text-emerald-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('auth_verify_email_title')}</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              {t('auth_verify_email_desc')}
            </p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200" dir="ltr">{email}</p>
          </div>

          {resent && (
            <p className="text-sm font-semibold text-emerald-600">{t('auth_verify_resent')}</p>
          )}
          {error && (
            <p className="text-sm font-semibold text-red-500">{error}</p>
          )}

          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={resending}
              className="btn-secondary w-full py-3"
            >
              {resending ? <RefreshCw size={18} className="animate-spin" /> : <><RefreshCw size={18} /> {t('auth_verify_resend')}</>}
            </button>

            <button
              onClick={onBack}
              className="btn-primary w-full py-3"
            >
              <LogIn size={18} /> {t('auth_verify_back_to_login')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
