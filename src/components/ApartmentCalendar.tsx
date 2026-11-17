import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import type { Apartment, Booking, Location } from '@/types';
import { STATUS_LABELS, SOURCE_LABELS, todayISO } from '@/lib/utils';
import { shiftMonth } from '@/lib/calendar';
import { syncAirbnbCalendar } from '@/lib/sync';
import { useApp } from '@/context/AppContext';
import { BookingModal } from './BookingModal';
import { CalendarMonth } from './CalendarMonth';
import { CalendarBookingModal } from './CalendarBookingModal';

interface Props {
  apartment: Apartment;
  apartments: Apartment[];
  locations: Location[];
  bookings: Booking[];
}

const MONTHS_BEFORE = 12;
const MONTHS_AFTER = 24;
const SOURCES: Booking['source'][] = ['airbnb', 'gathern', 'whatsapp'];
const MANUAL_SOURCES: Booking['source'][] = ['whatsapp'];

const SOURCE_DOT: Record<Booking['source'], string> = {
  airbnb: 'bg-rose-500',
  gathern: 'bg-violet-600',
  whatsapp: 'bg-emerald-600',
  direct: 'bg-sky-600',
};

export function ApartmentCalendar({ apartment, apartments, locations, bookings }: Props) {
  const { triggerRefresh } = useApp();
  const today = todayISO();
  const currentMonth = today.slice(0, 7);
  const [viewing, setViewing] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const aptBookings = useMemo(
    () => bookings.filter((b) => b.apartment_id === apartment.id),
    [bookings, apartment.id]
  );

  const months = useMemo(
    () => Array.from({ length: MONTHS_BEFORE + MONTHS_AFTER + 1 }, (_, i) => shiftMonth(currentMonth, i - MONTHS_BEFORE)),
    [currentMonth]
  );

  useEffect(() => {
    document.getElementById(`month-${currentMonth}`)?.scrollIntoView({ block: 'start' });
  }, [currentMonth]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const data = await syncAirbnbCalendar(apartment.id);
      setSyncMsg(data.message);
      triggerRefresh();
    } catch (err) {
      setSyncMsg('فشلت المزامنة: ' + (err instanceof Error ? err.message : 'خطأ غير معروف'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 p-4">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 truncate">{apartment.name}</h2>
          <p className="text-xs text-slate-500">
            {apartment.location?.name ? `${apartment.location.name} · ` : ''}
            {STATUS_LABELS[apartment.status]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {syncMsg && <span className="text-xs font-semibold text-emerald-600">{syncMsg}</span>}
          <button onClick={handleSync} disabled={syncing || !apartment.ical_url} className="btn-secondary">
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'جاري المزامنة...' : 'مزامنة هذه الشقة'}</span>
          </button>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus size={16} />
            <span>حجز يدوي</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 dark:border-slate-800 px-4 py-2 text-xs text-slate-500">
        {SOURCES.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${SOURCE_DOT[s]}`} />
            {SOURCE_LABELS[s]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-700" />
          مؤرشف
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-8">
        {months.map((month) => (
          <CalendarMonth
            key={month}
            month={month}
            bookings={aptBookings}
            today={today}
            onSelect={setViewing}
          />
        ))}
      </div>

      {viewing && (
        <CalendarBookingModal
          booking={viewing}
          apartment={apartment}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
        />
      )}

      <BookingModal
        isOpen={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
          triggerRefresh();
        }}
        apartment={apartment}
        apartments={apartments}
        locations={locations}
        bookings={bookings}
        editingBooking={editing}
        sourceOptions={editing ? undefined : MANUAL_SOURCES}
      />
    </div>
  );
}
