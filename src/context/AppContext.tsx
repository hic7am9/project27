import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { supabase, fetchAll, clearCache } from '@/lib/supabase';
import { fetchAllSync } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Apartment, Location, Booking, GuestArchive } from '@/types';

export type ViewName = 'dashboard' | 'schedule' | 'calendar' | 'checkout' | 'archive' | 'admin' | 'team' | 'cleaner' | 'cleaning_log' | 'whatsapp_bookings' | 'reports';

interface DataCache {
  locations: Location[];
  apartments: Apartment[];
  bookings: Booking[];
  archive: GuestArchive[];
}

interface AppContextValue {
  view: ViewName;
  setView: (v: ViewName) => void;
  refreshKey: number;
  triggerRefresh: () => void;
  data: DataCache;
  loading: boolean;
  error: string | null;
  isOnline: boolean;
  calendarApartmentId: string | null;
  setCalendarApartmentId: (id: string | null) => void;
}

const EMPTY_CACHE: DataCache = { locations: [], apartments: [], bookings: [], archive: [] };

function loadCacheSync(): DataCache {
  const cached = fetchAllSync();
  return { locations: cached.locations, apartments: cached.apartments, bookings: cached.bookings, archive: cached.guests_archive };
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [view, setView] = useState<ViewName>('schedule');
  const [calendarApartmentId, setCalendarApartmentId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [data, setData] = useState<DataCache>(() => loadCacheSync());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeReady = useRef(false);

  const triggerRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      setError(null);
      try {
        const fresh = await fetchAll();
        setData({
          locations: fresh.locations,
          apartments: fresh.apartments,
          bookings: fresh.bookings,
          archive: fresh.guests_archive,
        });
        setIsOnline(true);
        realtimeReady.current = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'فشل تحميل البيانات';
        console.error('Refresh failed:', msg);
        setError(msg);
        setIsOnline(false);
      } finally {
        setLoading(false);
        setRefreshKey((k) => k + 1);
      }
    }, 300);
  }, []);

  // Only fetch data when a session is available
  useEffect(() => {
    if (!session) {
      setData(EMPTY_CACHE);
      clearCache();
      return;
    }
    setLoading(true);
    triggerRefresh();
  }, [session, triggerRefresh]);

  // Subscribe to Realtime directly (no polling interval)
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('pms-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => triggerRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'apartments' }, () => triggerRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => triggerRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests_archive' }, () => triggerRefresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, triggerRefresh]);

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); if (session) triggerRefresh(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [session, triggerRefresh]);

  return (
    <AppContext.Provider value={{ view, setView, refreshKey, triggerRefresh, data, loading, error, isOnline, calendarApartmentId, setCalendarApartmentId }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
