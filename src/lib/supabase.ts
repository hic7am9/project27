import { createClient } from '@supabase/supabase-js';
import type { Apartment, Booking, GuestArchive, Location, TeamRole } from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const CACHE_KEY = 'pms_cloud_cache_v1';

interface CacheShape {
  locations: Location[];
  apartments: Apartment[];
  bookings: Booking[];
  guests_archive: GuestArchive[];
}

function loadCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheShape;
  } catch {
    return null;
  }
}

function saveCache(data: CacheShape): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save cache', err);
  }
}

export function clearCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

export async function fetchAll(): Promise<CacheShape> {
  const [locRes, aptRes, bookRes, archRes] = await Promise.all([
    supabase.from('locations').select('id,name,display_order,created_at,user_id').order('display_order').order('name'),
    supabase.from('apartments').select('*').order('display_order'),
    supabase.from('bookings').select('*').order('check_in', { ascending: false }),
    supabase.from('guests_archive').select('*').order('archived_at', { ascending: false }),
  ]);

  const errors = [locRes.error, aptRes.error, bookRes.error, archRes.error].filter(Boolean);
  if (errors.length > 0) {
    console.error('Supabase query errors:', errors.map(e => (e as Error).message));
    throw new Error(errors[0]!.message);
  }

  const locations = locRes.data as Location[];
  const bookingsMap = new Map<string, Booking>();
  for (const bk of bookRes.data as Booking[]) bookingsMap.set(bk.id, bk);

  const apartments = (aptRes.data as Apartment[]).map((apt) => ({
    ...apt,
    location: apt.location_id ? locations.find((l) => l.id === apt.location_id) ?? null : null,
    current_booking: apt.current_booking_id ? bookingsMap.get(apt.current_booking_id) ?? null : null,
  }));

  const bookings = (bookRes.data as Booking[]).map((bk) => ({
    ...bk,
    apartment: bk.apartment_id ? (aptRes.data as Apartment[]).find((a) => a.id === bk.apartment_id) ?? null : null,
  }));

  const guests_archive = archRes.data as GuestArchive[];

  const result: CacheShape = { locations, apartments, bookings, guests_archive };
  saveCache(result);
  return result;
}

export function fetchAllSync(): CacheShape {
  const cached = loadCache();
  if (cached) return cached;
  return { locations: [], apartments: [], bookings: [], guests_archive: [] };
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: 'user' | 'admin';
  last_sign_in_at: string | null;
  created_at: string;
}

export async function fetchProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, last_sign_in_at, created_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    console.error('Failed to fetch profile:', error.message);
    return null;
  }
  return data as Profile | null;
}

export interface TeamRoleInfo {
  role: TeamRole;
  owner_id: string;
}

export async function fetchTeamRole(): Promise<TeamRoleInfo | null> {
  const { data, error } = await supabase.rpc('get_my_role');
  if (error) {
    console.error('Failed to fetch team role:', error.message);
    return null;
  }
  const role = (data as string) || 'owner';
  const { data: ownerData } = await supabase.rpc('get_my_owner_id');
  const ownerId = (ownerData as string) || null;
  return { role: role as TeamRole, owner_id: ownerId ?? '' };
}
