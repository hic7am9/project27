import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase, fetchProfile, fetchTeamRole, clearCache, type Profile, type TeamRoleInfo } from '@/lib/supabase';

interface AuthContextValue {
  session: import('@supabase/supabase-js').Session | null;
  profile: Profile | null;
  teamRole: TeamRoleInfo | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  emailConfirmed: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthContextValue['session']>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teamRole, setTeamRole] = useState<TeamRoleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      setSession(sess);
      if (!sess) {
        setProfile(null);
        setTeamRole(null);
        clearCache();
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    if (isPasswordRecovery) return;
    setLoading(true);
    (async () => {
      const [p, tr] = await Promise.all([fetchProfile(), fetchTeamRole()]);
      setProfile(p);
      setTeamRole(tr);
      setLoading(false);
    })();
  }, [session, isPasswordRecovery]);

  const signOut = async () => {
    setProfile(null);
    setTeamRole(null);
    clearCache();
    await supabase.auth.signOut({ scope: 'global' });
    setSession(null);
    setIsPasswordRecovery(false);
    setLoading(false);
  };

  const refreshProfile = async () => {
    const [p, tr] = await Promise.all([fetchProfile(), fetchTeamRole()]);
    setProfile(p);
    setTeamRole(tr);
  };

  const clearPasswordRecovery = () => setIsPasswordRecovery(false);

  return (
    <AuthContext.Provider value={{ session, profile, teamRole, loading, isPasswordRecovery, emailConfirmed: true, signOut, refreshProfile, clearPasswordRecovery }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
