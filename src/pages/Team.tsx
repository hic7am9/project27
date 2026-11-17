import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Trash2, Mail, Loader2, ArrowLeft, CheckCircle, Home, Link2, Copy, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { useApp } from '@/context/AppContext';
import type { TeamMember, Apartment, TeamRole, TeamInvite } from '@/types';

export function Team() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const { setView, data, triggerRefresh } = useApp();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('host');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [selectedCleaner, setSelectedCleaner] = useState<string | null>(null);
  const [cleanerApartments, setCleanerApartments] = useState<Set<string>>(new Set());
  const [savingApts, setSavingApts] = useState(false);

  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkRole, setLinkRole] = useState<TeamRole>('host');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: raw, error: err } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: true });
    if (err) {
      setError(err.message);
    } else {
      const sorted = (raw as TeamMember[] ?? []).sort((a, b) => {
        if (a.role === 'owner') return -1;
        if (b.role === 'owner') return 1;
        return 0;
      });
      setMembers(sorted);
    }
    setLoading(false);
  }, []);

  const loadInvites = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('team_invites')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setInvites((data as TeamInvite[]) ?? []);
    }
  }, []);

  useEffect(() => {
    loadMembers();
    loadInvites();
  }, [loadMembers, loadInvites]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !profile) return;
    setInviting(true);
    setInviteMsg(null);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('team_members')
        .insert({
          owner_id: profile.id,
          member_user_id: null,
          role: inviteRole,
          email: inviteEmail.trim().toLowerCase(),
        });
      if (err) {
        if (err.message.includes('duplicate') || err.message.includes('unique')) {
          setError(t('team_member_exists'));
        } else {
          setError(err.message);
        }
      } else {
        setInviteMsg(t('team_invite_sent'));
        setInviteEmail('');
        await loadMembers();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setInviting(false);
    }
  };

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkEmail.trim() || !profile) return;
    setGeneratingLink(true);
    setInviteMsg(null);
    setError(null);
    try {
      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const { error: err } = await supabase
        .from('team_invites')
        .insert({
          owner_id: profile.id,
          email: linkEmail.trim().toLowerCase(),
          role: linkRole,
          token,
        });
      if (err) {
        setError(err.message);
      } else {
        setInviteMsg(t('team_invite_link_generated'));
        setLinkEmail('');
        await loadInvites();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}?invite=${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 3000);
    });
  };

  const handleDeleteInvite = async (inviteId: string) => {
    const { error: err } = await supabase
      .from('team_invites')
      .delete()
      .eq('id', inviteId);
    if (err) {
      setError(err.message);
    } else {
      await loadInvites();
    }
  };

  const handleRoleChange = async (memberId: string, newRole: TeamRole) => {
    const { error: err } = await supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('id', memberId);
    if (err) {
      setError(err.message);
    } else {
      await loadMembers();
    }
  };

  const handleRemove = async (memberId: string) => {
    const { error: err } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId);
    if (err) {
      setError(err.message);
    } else {
      await loadMembers();
      if (selectedCleaner === memberId) {
        setSelectedCleaner(null);
        setCleanerApartments(new Set());
      }
    }
  };

  const loadCleanerApartments = async (cleanerUserId: string | null, memberId: string) => {
    if (!cleanerUserId) {
      setSelectedCleaner(memberId);
      setCleanerApartments(new Set());
      return;
    }
    const { data: apts } = await supabase
      .from('cleaner_apartments')
      .select('apartment_id')
      .eq('cleaner_user_id', cleanerUserId);
    setCleanerApartments(new Set((apts ?? []).map((a: { apartment_id: string }) => a.apartment_id)));
    setSelectedCleaner(memberId);
  };

  const toggleApartment = (aptId: string) => {
    setCleanerApartments((prev) => {
      const next = new Set(prev);
      if (next.has(aptId)) next.delete(aptId);
      else next.add(aptId);
      return next;
    });
  };

  const saveCleanerApartments = async () => {
    if (!selectedCleaner || !profile) return;
    const member = members.find((m) => m.id === selectedCleaner);
    if (!member || !member.member_user_id) return;
    setSavingApts(true);
    setError(null);
    try {
      await supabase
        .from('cleaner_apartments')
        .delete()
        .eq('cleaner_user_id', member.member_user_id)
        .eq('owner_id', profile.id);
      const toInsert = Array.from(cleanerApartments).map((aptId) => ({
        cleaner_user_id: member.member_user_id,
        apartment_id: aptId,
        owner_id: profile.id,
      }));
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('cleaner_apartments')
          .insert(toInsert);
        if (insErr) throw insErr;
      }
      setInviteMsg(t('team_apartments_saved'));
      setTimeout(() => setInviteMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSavingApts(false);
    }
  };

  const roleLabel = (role: TeamRole): string => {
    if (role === 'owner') return t('team_role_owner');
    if (role === 'host') return t('team_role_host');
    return t('team_role_cleaner');
  };

  const apartments: Apartment[] = data.apartments;
  const cleaners = members.filter((m) => m.role === 'cleaner' && m.id !== members.find((x) => x.role === 'owner')?.id);

  const inviteStatusBadge = (status: string) => {
    if (status === 'used') return <span className="badge bg-slate-100 text-slate-600 text-xs">{t('team_invite_used')}</span>;
    if (status === 'expired') return <span className="badge bg-red-100 text-red-700 text-xs">{t('team_invite_expired')}</span>;
    return <span className="badge bg-amber-100 text-amber-700 text-xs">{t('team_invite_pending_status')}</span>;
  };

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
          <Users size={24} className="text-slate-400" />
          {t('team_title')}
        </h1>
      </div>

      {error && <p className="text-sm font-semibold text-red-500 text-center">{error}</p>}
      {inviteMsg && <p className="text-sm font-semibold text-emerald-600 text-center">{inviteMsg}</p>}

      {/* Invite form */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('team_add_member')}</h2>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            dir="ltr"
            className="input flex-1"
            placeholder="email@example.com"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as TeamRole)}
            className="input sm:w-40"
          >
            <option value="host">{t('team_role_host')}</option>
            <option value="cleaner">{t('team_role_cleaner')}</option>
          </select>
          <button type="submit" disabled={inviting} className="btn-primary sm:w-auto">
            {inviting ? <Loader2 size={18} className="animate-spin" /> : <><UserPlus size={18} /> {t('team_invite')}</>}
          </button>
        </form>
        <p className="text-xs text-slate-400 leading-relaxed">{t('team_invite_desc')}</p>
      </div>

      {/* Invite link generation */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Link2 size={16} className="text-sky-500" />
          {t('team_create_invite_link')}
        </h2>
        <form onSubmit={handleGenerateLink} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={linkEmail}
            onChange={(e) => setLinkEmail(e.target.value)}
            dir="ltr"
            className="input flex-1"
            placeholder="email@example.com"
          />
          <select
            value={linkRole}
            onChange={(e) => setLinkRole(e.target.value as TeamRole)}
            className="input sm:w-40"
          >
            <option value="host">{t('team_role_host')}</option>
            <option value="cleaner">{t('team_role_cleaner')}</option>
          </select>
          <button type="submit" disabled={generatingLink} className="btn-primary sm:w-auto">
            {generatingLink ? <Loader2 size={18} className="animate-spin" /> : <><Link2 size={18} /> {t('team_create_invite_link')}</>}
          </button>
        </form>
        <p className="text-xs text-slate-400 leading-relaxed">{t('team_invite_link_desc')}</p>

        {invites.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-bold text-slate-500">{t('team_invite_links')}</p>
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-slate-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" dir="ltr">{inv.email}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {inviteStatusBadge(inv.status)}
                    <span className="text-xs text-slate-400">{t('team_invite_expires')}: <span dir="ltr">{new Date(inv.expires_at).toLocaleDateString()}</span></span>
                  </div>
                </div>
                {inv.status === 'pending' && (
                  <button
                    onClick={() => copyLink(inv.token)}
                    className="p-2 rounded-lg text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors shrink-0"
                    title={t('team_copy_link')}
                  >
                    {copiedToken === inv.token ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                )}
                <button
                  onClick={() => handleDeleteInvite(inv.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                  title={t('team_invite_delete')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Members list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-400 font-semibold">{t('team_no_members')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((m) => {
              const isOwner = m.role === 'owner';
              const isLinked = !!m.member_user_id;
              const isSelected = selectedCleaner === m.id;
              return (
                <div key={m.id} className="p-4 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-slate-400 shrink-0" />
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100" dir="ltr">{m.email}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {isLinked ? (
                          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle size={12} /> {t('team_linked')}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-500 font-semibold">{t('team_pending')}</span>
                        )}
                      </div>
                    </div>
                    {!isOwner && (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as TeamRole)}
                        className="input w-32 text-sm"
                      >
                        <option value="host">{t('team_role_host')}</option>
                        <option value="cleaner">{t('team_role_cleaner')}</option>
                      </select>
                    )}
                    {isOwner && (
                      <span className="badge bg-sky-100 text-sky-800 text-xs">{t('team_role_owner')}</span>
                    )}
                    {!isOwner && (
                      <button
                        onClick={() => handleRemove(m.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title={t('team_remove')}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* Cleaner apartment assignment */}
                  {m.role === 'cleaner' && (
                    <div className="mt-2">
                      <button
                        onClick={() => isSelected ? setSelectedCleaner(null) : loadCleanerApartments(m.member_user_id, m.id)}
                        className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                      >
                        <Home size={14} /> {isSelected ? t('team_hide_apartments') : t('team_assign_apartments')}
                      </button>
                      {isSelected && (
                        <div className="mt-2 space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                          {!m.member_user_id && (
                            <p className="text-xs text-amber-500 font-semibold">{t('team_assign_wait')}</p>
                          )}
                          {m.member_user_id && apartments.length === 0 && (
                            <p className="text-xs text-slate-400">{t('team_no_apartments')}</p>
                          )}
                          {m.member_user_id && apartments.length > 0 && (
                            <>
                              <div className="flex flex-wrap gap-2">
                                {apartments.map((apt) => (
                                  <label key={apt.id} className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={cleanerApartments.has(apt.id)}
                                      onChange={() => toggleApartment(apt.id)}
                                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                    />
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      {apt.apt_number ?? apt.name}
                                    </span>
                                  </label>
                                ))}
                              </div>
                              <button
                                onClick={saveCleanerApartments}
                                disabled={savingApts}
                                className="btn-primary text-sm py-2"
                              >
                                {savingApts ? <Loader2 size={16} className="animate-spin" /> : t('save')}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cleaning log link */}
      <div className="flex justify-center">
        <button
          onClick={() => setView('cleaning_log')}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          <ClipboardList size={16} /> {t('cleaning_log_title')}
        </button>
      </div>

      {cleaners.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          {cleaners.length} {t('team_role_cleaner')}
        </p>
      )}
    </div>
  );
}
