import { useMemo, useState, useEffect } from 'react';
import type { Apartment, Booking, Location } from '@/types';
import { ApartmentCalendar } from '@/components/ApartmentCalendar';
import { useApp } from '@/context/AppContext';

interface CalendarProps {
  apartments: Apartment[];
  locations: Location[];
  bookings: Booking[];
}

export function Calendar({ apartments, locations, bookings }: CalendarProps) {
  const { calendarApartmentId, setCalendarApartmentId } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(calendarApartmentId);
  const [locationFilter, setLocationFilter] = useState<string>('all');

  useEffect(() => {
    if (calendarApartmentId) {
      setSelectedId(calendarApartmentId);
      setCalendarApartmentId(null);
    }
  }, [calendarApartmentId, setCalendarApartmentId]);

  const visibleApartments = useMemo(
    () => apartments.filter((apt) => locationFilter === 'all' || apt.location_id === locationFilter),
    [apartments, locationFilter]
  );

  const selected = visibleApartments.find((apt) => apt.id === selectedId) ?? visibleApartments[0] ?? null;

  return (
    <div dir="rtl" className="flex h-[calc(100dvh-7.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 sm:h-[calc(100dvh-6rem)]">
      <aside className="flex w-36 shrink-0 flex-col border-l border-slate-200 dark:border-slate-800 sm:w-56">
        <div className="border-b border-slate-200 dark:border-slate-800 p-3">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">الشقق</h2>
        </div>
        <div className="border-b border-slate-200 dark:border-slate-800 p-2">
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="input w-full py-1.5 text-xs"
            aria-label="تصفية حسب المنطقة"
          >
            <option value="all">كل المناطق</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {visibleApartments.map((apt) => {
            const active = selected?.id === apt.id;
            return (
              <li key={apt.id}>
                <button
                  onClick={() => setSelectedId(apt.id)}
                  className={`w-full rounded-xl px-3 py-2 text-start transition-colors ${
                    active
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="block truncate text-sm font-bold">{apt.name}</span>
                  {apt.apt_number && <span className="block truncate text-xs opacity-80">رقم {apt.apt_number}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selected ? (
          <ApartmentCalendar
            key={selected.id}
            apartment={selected}
            apartments={apartments}
            locations={locations}
            bookings={bookings}
          />
        ) : (
          <p className="m-auto text-sm text-slate-400">لا توجد شقق</p>
        )}
      </main>
    </div>
  );
}
