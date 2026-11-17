export interface SyncConflictInfo {
  apartment_name: string;
  airbnb_check_in: string;
  airbnb_check_out: string;
  manual_guest_name: string;
  manual_check_in: string;
  manual_check_out: string;
}

export interface SyncResponse {
  message: string;
  conflicts: SyncConflictInfo[];
}

export async function syncAirbnbCalendar(apartmentId?: string): Promise<SyncResponse> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-ical`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(apartmentId ? { apartment_id: apartmentId } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return {
    message: typeof data.message === 'string' ? data.message : 'تمت المزامنة',
    conflicts: Array.isArray(data.conflicts) ? data.conflicts : [],
  };
}
