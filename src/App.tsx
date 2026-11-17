import { lazy, Suspense, useState, useEffect } from 'react';
import { I18nProvider } from '@/context/I18nContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AppProvider, useApp } from '@/context/AppContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TopNav } from '@/components/Navigation';
import { ActivationGate } from '@/components/ActivationGate';
import { InstallPrompt } from '@/components/InstallPrompt';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { Loader2, AlertCircle } from 'lucide-react';
import { Login } from '@/pages/auth/Login';
import { Signup } from '@/pages/auth/Signup';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { ResetPassword } from '@/pages/auth/ResetPassword';
import { VerifyEmail } from '@/pages/auth/VerifyEmail';
import { Terms } from '@/pages/auth/Terms';
import { Privacy } from '@/pages/auth/Privacy';

const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const WorkSchedule = lazy(() => import('@/pages/WorkSchedule').then(m => ({ default: m.WorkSchedule })));
const Calendar = lazy(() => import('@/pages/Calendar').then(m => ({ default: m.Calendar })));
const CheckOut = lazy(() => import('@/pages/CheckOut').then(m => ({ default: m.CheckOut })));
const GuestsArchive = lazy(() => import('@/pages/GuestsArchive').then(m => ({ default: m.GuestsArchive })));
const Admin = lazy(() => import('@/pages/Admin').then(m => ({ default: m.Admin })));
const Team = lazy(() => import('@/pages/Team').then(m => ({ default: m.Team })));
const CleaningLogPage = lazy(() => import('@/pages/CleaningLog').then(m => ({ default: m.CleaningLogPage })));
const Cleaner = lazy(() => import('@/pages/Cleaner').then(m => ({ default: m.Cleaner })));
const WhatsAppBookings = lazy(() => import('@/pages/WhatsAppBookings').then(m => ({ default: m.WhatsAppBookings })));
const ReportsHub = lazy(() => import('@/pages/ReportsHub').then(m => ({ default: m.ReportsHub })));
const ChatAssistant = lazy(() => import('@/components/ChatAssistant').then(m => ({ default: m.ChatAssistant })));

type AuthView = 'login' | 'signup' | 'forgot' | 'reset' | 'verify' | 'terms' | 'privacy';

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={28} className="animate-spin text-slate-400" />
    </div>
  );
}

function AppContent() {
  const { view, data, loading, error, triggerRefresh, setView } = useApp();
  const { teamRole } = useAuth();
  const role = teamRole?.role ?? 'owner';

  // Cleaner role: always show cleaner page, redirect any other view
  useEffect(() => {
    if (role === 'cleaner' && view !== 'cleaner') {
      setView('cleaner');
    }
  }, [role, view, setView]);

  if (role === 'cleaner') {
    return (
      <Suspense fallback={<PageFallback />}>
        <Cleaner />
      </Suspense>
    );
  }

  // Host: block team and admin views
  const effectiveView = (role === 'host' && (view === 'team' || view === 'admin')) ? 'schedule' : view;

  if (loading && data.apartments.length === 0 && data.locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 size={32} className="animate-spin text-slate-400" />
        <p className="text-sm text-slate-400 font-semibold">جاري تحميل البيانات...</p>
      </div>
    );
  }

  if (error && data.apartments.length === 0 && data.locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm text-red-500 font-semibold">{error}</p>
        <button onClick={() => triggerRefresh()} className="btn-primary">إعادة المحاولة</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1 min-w-0 pb-24 sm:pb-0">
        <div className="w-full p-3 sm:p-4">
          <Suspense fallback={<PageFallback />}>
            {effectiveView === 'dashboard' && <Dashboard apartments={data.apartments} locations={data.locations} bookings={data.bookings} />}
            {effectiveView === 'schedule' && <WorkSchedule apartments={data.apartments} locations={data.locations} bookings={data.bookings} />}
            {effectiveView === 'calendar' && <Calendar apartments={data.apartments} locations={data.locations} bookings={data.bookings} />}
            {effectiveView === 'checkout' && <CheckOut apartments={data.apartments} locations={data.locations} bookings={data.bookings} />}
            {effectiveView === 'archive' && <GuestsArchive archive={data.archive} />}
            {effectiveView === 'admin' && role === 'owner' && <Admin />}
            {effectiveView === 'team' && role === 'owner' && <Team />}
            {effectiveView === 'cleaning_log' && <CleaningLogPage />}
            {effectiveView === 'whatsapp_bookings' && <WhatsAppBookings apartments={data.apartments} locations={data.locations} bookings={data.bookings} />}
            {effectiveView === 'reports' && <ReportsHub apartments={data.apartments} locations={data.locations} bookings={data.bookings} />}
          </Suspense>
        </div>
      </main>
      <ChatAssistant apartments={data.apartments} locations={data.locations} bookings={data.bookings} archive={data.archive} />
      <InstallPrompt />
      <OfflineIndicator />
    </div>
  );
}

function AuthGate() {
  const { session, loading, isPasswordRecovery, clearPasswordRecovery, refreshProfile } = useAuth();
  const [authView, setAuthView] = useState<AuthView>('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (token) {
      setInviteToken(token);
      setAuthView('signup');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-800 to-slate-950">
        <Loader2 size={32} className="animate-spin text-slate-400" />
        <p className="text-sm text-slate-400 font-semibold">...</p>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return <ResetPassword onDone={clearPasswordRecovery} />;
  }

  if (!session) {
    if (authView === 'signup') return <Signup onSwitchLogin={() => setAuthView('login')} onShowTerms={() => setAuthView('terms')} onShowPrivacy={() => setAuthView('privacy')} onVerifyEmail={(email) => { setPendingEmail(email); setAuthView('verify'); }} inviteToken={inviteToken} onInviteConsumed={() => { setInviteToken(null); refreshProfile(); }} />;
    if (authView === 'forgot') return <ForgotPassword onBack={() => setAuthView('login')} />;
    if (authView === 'reset') return <ResetPassword />;
    if (authView === 'verify') return <VerifyEmail email={pendingEmail} onBack={() => setAuthView('login')} />;
    if (authView === 'terms') return <Terms onBack={() => setAuthView('signup')} />;
    if (authView === 'privacy') return <Privacy onBack={() => setAuthView('signup')} />;
    return <Login onSwitchSignup={() => setAuthView('signup')} onSwitchForgot={() => setAuthView('forgot')} onVerifyEmail={(email) => { setPendingEmail(email); setAuthView('verify'); }} />;
  }

  return <ActivationGate><AppContent /></ActivationGate>;
}

function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppProvider>
              <AuthGate />
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default App;
