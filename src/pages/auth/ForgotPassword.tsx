import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

interface Props {
  onBack: () => void;
}

export function ForgotPassword({ onBack }: Props) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
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
            <p className="text-sm text-slate-400">{t('auth_forgot_subtitle')}</p>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Mail size={40} className="text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('auth_reset_email_sent')}</p>
              <button onClick={onBack} className="btn-secondary w-full py-3">
                <ArrowLeft size={18} /> {t('auth_back_to_login')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {error && <p className="text-sm font-semibold text-red-500 text-center">{error}</p>}

              <button type="submit" disabled={loading || !email} className="btn-primary w-full py-3.5 text-base">
                {loading ? <Loader2 size={20} className="animate-spin" /> : t('auth_send_reset_link')}
              </button>

              <button type="button" onClick={onBack} className="w-full text-center text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold">
                <ArrowLeft size={14} className="inline ml-1" /> {t('auth_back_to_login')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
