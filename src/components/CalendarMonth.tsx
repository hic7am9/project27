import { useMemo } from 'react';
import type { Booking } from '@/types';
import { addDays, dayOffset, shiftMonth, toUtc } from '@/lib/calendar';

interface Props {
  month: string;
  bookings: Booking[];
  today: string;
  onSelect: (booking: Booking) => void;
}

interface Segment {
  booking: Booking;
  start: number;
  end: number;
  lane: number;
}

const WEEKDAYS_FULL = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const WEEKDAYS_SHORT = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];
const CHECK_IN_FRACTION = 12 / 24;
const CHECK_OUT_FRACTION = 12 / 24;
const HEADER_HEIGHT = 32;
const LANE_HEIGHT = 28;

const SOURCE_BAR: Record<Booking['source'], string> = {
  airbnb: 'bg-rose-500 text-white',
  gathern: 'bg-violet-600 text-white',
  whatsapp: 'bg-emerald-600 text-white',
  direct: 'bg-sky-600 text-white',
};

const ARCHIVED_BAR = 'bg-slate-300 text-slate-500 dark:bg-slate-700 dark:text-slate-400';

function layoutWeek(
  bookings: Booking[],
  weekStart: string,
  monthFirst: string,
  nextMonthFirst: string
): { segments: Segment[]; laneCount: number } {
  const lower = dayOffset(monthFirst, weekStart);
  const upper = dayOffset(nextMonthFirst, weekStart);
  const items = bookings
    .map((booking) => ({
      booking,
      start: Math.max(0, lower, dayOffset(booking.check_in, weekStart) + CHECK_IN_FRACTION),
      end: Math.min(7, upper, dayOffset(booking.check_out, weekStart) + CHECK_OUT_FRACTION),
    }))
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start);

  const laneEnds: number[] = [];
  const segments = items.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    return { ...item, lane };
  });
  return { segments, laneCount: laneEnds.length };
}

export function CalendarMonth({ month, bookings, today, onSelect }: Props) {
  const monthLabel = new Date(toUtc(`${month}-01`)).toLocaleDateString('ar-SA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const weeks = useMemo(() => {
    const monthFirst = `${month}-01`;
    const nextMonthFirst = `${shiftMonth(month, 1)}-01`;
    const [y, m] = month.split('-').map(Number);
    const firstDow = new Date(toUtc(monthFirst)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const gridStart = addDays(monthFirst, -firstDow);
    const weekCount = Math.ceil((firstDow + daysInMonth) / 7);
    return Array.from({ length: weekCount }, (_, w) => {
      const weekStart = addDays(gridStart, w * 7);
      const cells = Array.from({ length: 7 }, (_, d) => addDays(weekStart, d));
      return { weekStart, cells, ...layoutWeek(bookings, weekStart, monthFirst, nextMonthFirst) };
    });
  }, [month, bookings]);

  return (
    <section id={`month-${month}`} className="space-y-2">
      <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">{monthLabel}</h3>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
          {WEEKDAYS_FULL.map((d, i) => (
            <div key={d} className="py-2 text-center text-xs font-bold text-slate-500">
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{WEEKDAYS_SHORT[i]}</span>
            </div>
          ))}
        </div>

        {weeks.map((week) => (
          <div
            key={week.weekStart}
            className="relative grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
            style={{ minHeight: Math.max(64, HEADER_HEIGHT + week.laneCount * LANE_HEIGHT + 4) }}
          >
            {week.cells.map((iso) => {
              const inMonth = iso.slice(0, 7) === month;
              const isToday = iso === today;
              return (
                <div key={iso} className={inMonth ? 'border-l border-slate-100 dark:border-slate-800 p-1.5' : 'p-1.5'}>
                  {inMonth && (
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                      isToday ? 'bg-sky-600 text-white' : 'text-slate-700 dark:text-slate-200'
                    }`}>
                      {Number(iso.slice(8))}
                    </span>
                  )}
                </div>
              );
            })}

            {week.segments.map((seg) => (
              <button
                key={seg.booking.id}
                type="button"
                onClick={() => onSelect(seg.booking)}
                title={`${seg.booking.guest_name} · ${seg.booking.check_in} → ${seg.booking.check_out}`}
                className={`absolute flex items-center overflow-hidden rounded-md px-2 text-start text-[11px] font-semibold shadow-sm transition-all hover:brightness-110 hover:shadow-md ${seg.booking.archived ? ARCHIVED_BAR : SOURCE_BAR[seg.booking.source]}`}
                style={{
                  right: `calc(${(seg.start / 7) * 100}% + 2px)`,
                  width: `calc(${((seg.end - seg.start) / 7) * 100}% - 4px)`,
                  top: HEADER_HEIGHT + seg.lane * LANE_HEIGHT,
                  height: LANE_HEIGHT - 4,
                }}
              >
                <span className="truncate">{seg.booking.guest_name}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
