import { useState, useMemo, useCallback } from 'react';
import { BarChart3, Building2, MapPin, Copy, Check, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Apartment, Booking, Location, BookingSource } from '@/types';
import { formatDate, SOURCE_LABELS } from '@/lib/utils';

interface Props {
  apartments: Apartment[];
  locations: Location[];
  bookings: Booking[];
}

const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

type ReportMode = 'apartment' | 'location';

interface MonthlyStats {
  totalDays: number;
  bookedDays: number;
  availableDays: number;
  airbnbDays: number;
  externalDays: number;
  sourceBreakdown: Record<string, number>;
  occupancyRate: number;
  bookings: Booking[];
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function dateInRange(date: string, year: number, month: number): boolean {
  const d = new Date(date);
  return d.getFullYear() === year && d.getMonth() === month;
}

function overlapDaysInMonth(checkIn: string, checkOut: string, year: number, month: number): number {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
  const ci = new Date(checkIn);
  const co = new Date(checkOut);

  const start = ci < monthStart ? monthStart : ci;
  const end = co > monthEnd ? monthEnd : co;

  if (start >= end) return 0;
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function computeStats(bookings: Booking[], year: number, month: number): MonthlyStats {
  const totalDays = getDaysInMonth(year, month);
  const sourceBreakdown: Record<string, number> = {};
  let bookedDays = 0;
  let airbnbDays = 0;
  let externalDays = 0;

  const monthBookings = bookings
    .filter((b) => !b.archived)
    .filter((b) => {
      const ci = new Date(b.check_in);
      const co = new Date(b.check_out);
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
      return ci <= monthEnd && co >= monthStart;
    })
    .sort((a, b) => a.check_in.localeCompare(b.check_in));

  for (const b of monthBookings) {
    const days = overlapDaysInMonth(b.check_in, b.check_out, year, month);
    bookedDays += days;
    sourceBreakdown[b.source] = (sourceBreakdown[b.source] ?? 0) + days;
    if (b.source === 'airbnb') {
      airbnbDays += days;
    } else {
      externalDays += days;
    }
  }

  // Cap at totalDays to handle overlaps
  if (bookedDays > totalDays) bookedDays = totalDays;
  if (airbnbDays + externalDays > totalDays) {
    const ratio = totalDays / (airbnbDays + externalDays);
    airbnbDays = Math.round(airbnbDays * ratio);
    externalDays = totalDays - airbnbDays;
  }

  const availableDays = totalDays - bookedDays;
  const occupancyRate = totalDays > 0 ? (bookedDays / totalDays) * 100 : 0;

  return { totalDays, bookedDays, availableDays, airbnbDays, externalDays, sourceBreakdown, occupancyRate, bookings: monthBookings };
}

function formatMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

export function MonthlyReports({ apartments, locations, bookings }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [mode, setMode] = useState<ReportMode>('apartment');
  const [selectedAptId, setSelectedAptId] = useState<string>('');
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const sortedApartments = useMemo(() => {
    return [...apartments].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }, [apartments]);

  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }, [locations]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const toggleLocation = (id: string) => {
    setSelectedLocationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Compute which apartments are in scope
  const scopedApartments = useMemo(() => {
    if (mode === 'apartment') {
      return sortedApartments;
    }
    // location mode: apartments whose location_id is in selectedLocationIds
    if (selectedLocationIds.length === 0) return [];
    return sortedApartments.filter((a) => a.location_id && selectedLocationIds.includes(a.location_id));
  }, [mode, sortedApartments, selectedLocationIds]);

  // Per-apartment stats (for location mode aggregation and apartment mode single)
  const aptStats = useMemo(() => {
    const map = new Map<string, MonthlyStats>();
    for (const apt of scopedApartments) {
      const aptBookings = bookings.filter((b) => b.apartment_id === apt.id);
      map.set(apt.id, computeStats(aptBookings, year, month));
    }
    return map;
  }, [scopedApartments, bookings, year, month]);

  // Aggregated stats (for location mode)
  const aggregatedStats = useMemo((): MonthlyStats | null => {
    if (mode !== 'location' || scopedApartments.length === 0) return null;
    const totalDays = getDaysInMonth(year, month) * scopedApartments.length;
    let bookedDays = 0;
    let airbnbDays = 0;
    let externalDays = 0;
    const sourceBreakdown: Record<string, number> = {};
    const allBookings: Booking[] = [];

    for (const apt of scopedApartments) {
      const s = aptStats.get(apt.id);
      if (!s) continue;
      bookedDays += s.bookedDays;
      airbnbDays += s.airbnbDays;
      externalDays += s.externalDays;
      for (const [src, days] of Object.entries(s.sourceBreakdown)) {
        sourceBreakdown[src] = (sourceBreakdown[src] ?? 0) + days;
      }
      allBookings.push(...s.bookings);
    }

    const availableDays = totalDays - bookedDays;
    const occupancyRate = totalDays > 0 ? (bookedDays / totalDays) * 100 : 0;

    return { totalDays, bookedDays, availableDays, airbnbDays, externalDays, sourceBreakdown, occupancyRate, bookings: allBookings.sort((a, b) => a.check_in.localeCompare(b.check_in)) };
  }, [mode, scopedApartments, aptStats, year, month]);

  const selectedApt = apartments.find((a) => a.id === selectedAptId);
  const selectedAptLocation = selectedApt ? locations.find((l) => l.id === selectedApt.location_id)?.name ?? '' : '';

  const singleStats = mode === 'apartment' && selectedAptId ? aptStats.get(selectedAptId) ?? null : null;

  // Generate report text
  const reportText = useMemo(() => {
    const lines: string[] = [];
    const monthLabel = formatMonthYear(year, month);

    if (mode === 'apartment' && singleStats && selectedApt) {
      lines.push(`التقرير الشهري – الشقة ${selectedApt.apt_number ?? selectedApt.name} – شهر ${monthLabel}`);
      if (selectedAptLocation) lines.push(`الموقع: ${selectedAptLocation}`);
      lines.push('');
      lines.push('البيان                          العدد');
      lines.push('─────────────────────────────────────');
      lines.push(`إجمالي أيام الشهر              ${singleStats.totalDays} يومًا`);
      lines.push(`الأيام المحجوزة                ${singleStats.bookedDays} يومًا`);
      lines.push(`الأيام غير المحجوزة            ${singleStats.availableDays} أيام`);
      lines.push(`حجوزات Airbnb                  ${singleStats.airbnbDays} يومًا`);
      lines.push(`الحجوزات الخارجية (واتساب/مباشر) ${singleStats.externalDays} أيام`);
      lines.push(`نسبة الإشغال                   ${singleStats.occupancyRate.toFixed(1)}%`);
      lines.push('');
      lines.push('تفصيل الحجوزات حسب المصدر:');
      for (const [src, days] of Object.entries(singleStats.sourceBreakdown)) {
        lines.push(`  ${SOURCE_LABELS[src as BookingSource] ?? src}: ${days} يومًا`);
      }
      lines.push('');
      lines.push('تفاصيل الحجوزات:');
      singleStats.bookings.forEach((b, i) => {
        const nights = overlapDaysInMonth(b.check_in, b.check_out, year, month);
        lines.push(`  الحجز ${i + 1}: ${b.guest_name} | ${SOURCE_LABELS[b.source] ?? b.source} | ${formatDate(b.check_in)} ← ${formatDate(b.check_out)} | ${nights} ليلة`);
      });
    } else if (mode === 'location' && aggregatedStats) {
      const locNames = selectedLocationIds
        .map((id) => locations.find((l) => l.id === id)?.name ?? '')
        .filter(Boolean)
        .join('، ');
      lines.push(`التقرير الشهري – ${locNames} – شهر ${monthLabel}`);
      lines.push(`عدد الشقق: ${scopedApartments.length}`);
      lines.push('');
      lines.push('البيان                          العدد');
      lines.push('─────────────────────────────────────');
      lines.push(`إجمالي أيام الشهر              ${aggregatedStats.totalDays} يومًا`);
      lines.push(`الأيام المحجوزة                ${aggregatedStats.bookedDays} يومًا`);
      lines.push(`الأيام غير المحجوزة            ${aggregatedStats.availableDays} أيام`);
      lines.push(`حجوزات Airbnb                  ${aggregatedStats.airbnbDays} يومًا`);
      lines.push(`الحجوزات الخارجية (واتساب/مباشر) ${aggregatedStats.externalDays} أيام`);
      lines.push(`نسبة الإشغال                   ${aggregatedStats.occupancyRate.toFixed(1)}%`);
      lines.push('');
      lines.push('تفصيل الحجوزات حسب المصدر:');
      for (const [src, days] of Object.entries(aggregatedStats.sourceBreakdown)) {
        lines.push(`  ${SOURCE_LABELS[src as BookingSource] ?? src}: ${days} يومًا`);
      }
      lines.push('');
      lines.push('تفاصيل الحجوزات:');
      aggregatedStats.bookings.forEach((b, i) => {
        const apt = apartments.find((a) => a.id === b.apartment_id);
        const nights = overlapDaysInMonth(b.check_in, b.check_out, year, month);
        lines.push(`  الحجز ${i + 1}: ${b.guest_name} | شقة ${apt?.apt_number ?? apt?.name ?? '—'} | ${SOURCE_LABELS[b.source] ?? b.source} | ${formatDate(b.check_in)} ← ${formatDate(b.check_out)} | ${nights} ليلة`);
      });

      // Per-apartment breakdown
      lines.push('');
      lines.push('تقرير كل شقة:');
      lines.push('─────────────────────────────────────');
      for (const apt of scopedApartments) {
        const s = aptStats.get(apt.id);
        if (!s) continue;
        lines.push(`شقة ${apt.apt_number ?? apt.name}: محجوزة ${s.bookedDays}/${s.totalDays} يوم | إشغال ${s.occupancyRate.toFixed(1)}% | Airbnb ${s.airbnbDays} | خارجية ${s.externalDays}`);
      }
    }

    lines.push('');
    lines.push(`تاريخ التقرير: ${formatDate(new Date().toISOString())}`);
    return lines.join('\n');
  }, [mode, singleStats, aggregatedStats, selectedApt, selectedAptLocation, year, month, selectedLocationIds, locations, scopedApartments, aptStats, apartments]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reportText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = reportText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [reportText]);

  const canShowReport = mode === 'apartment' ? !!singleStats : !!aggregatedStats;
  const displayStats = mode === 'apartment' ? singleStats : aggregatedStats;

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="card p-3 space-y-3">
        {/* Month picker */}
        <div className="flex items-center justify-between gap-2">
          <button onClick={prevMonth} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ChevronRight size={20} />
          </button>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Calendar size={16} className="text-indigo-500" />
            {formatMonthYear(year, month)}
          </div>
          <button onClick={nextMonth} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => { setMode('apartment'); setSelectedLocationIds([]); }}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
              mode === 'apartment'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Building2 size={16} /> تقرير شقة
          </button>
          <button
            onClick={() => { setMode('location'); setSelectedAptId(''); }}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
              mode === 'location'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <MapPin size={16} /> تقرير منطقة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Left selector panel */}
        <div className="card p-3 space-y-1.5 lg:max-h-[calc(100vh-320px)] lg:overflow-y-auto">
          {mode === 'apartment' ? (
            <>
              <div className="flex items-center gap-2 px-2 py-2 text-xs font-bold text-slate-400 uppercase">
                <Building2 size={14} /> الشقق
              </div>
              {sortedApartments.length === 0 ? (
                <p className="text-sm text-slate-400 px-2 py-4">لا توجد شقق</p>
              ) : (
                sortedApartments.map((a) => {
                  const active = selectedAptId === a.id;
                  const count = bookings.filter((b) => b.apartment_id === a.id && !b.archived && dateInRange(b.check_in, year, month)).length;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAptId(a.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-start ${
                        active ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{a.apt_number ?? a.name}</span>
                      {count > 0 && (
                        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 px-2 py-2 text-xs font-bold text-slate-400 uppercase">
                <MapPin size={14} /> المناطق (اختر واحدة أو أكثر)
              </div>
              {sortedLocations.length === 0 ? (
                <p className="text-sm text-slate-400 px-2 py-4">لا توجد مناطق</p>
              ) : (
                sortedLocations.map((loc) => {
                  const active = selectedLocationIds.includes(loc.id);
                  const aptCount = sortedApartments.filter((a) => a.location_id === loc.id).length;
                  return (
                    <button
                      key={loc.id}
                      onClick={() => toggleLocation(loc.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-start ${
                        active ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${active ? 'border-white bg-white' : 'border-slate-300 dark:border-slate-600'}`}>
                          {active && <Check size={12} className="text-indigo-600" />}
                        </span>
                        {loc.name}
                      </span>
                      <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                        {aptCount} شقة
                      </span>
                    </button>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Report content */}
        <div className="space-y-3">
          {!canShowReport ? (
            <div className="card p-12 text-center">
              <BarChart3 size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-400 font-semibold">
                {mode === 'apartment' ? 'اختر شقة لعرض تقريرها الشهري' : 'اختر منطقة واحدة أو أكثر لعرض التقرير'}
              </p>
            </div>
          ) : displayStats ? (
            <>
              {/* Stats cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard label="إجمالي أيام الشهر" value={`${displayStats.totalDays}`} unit="يوم" color="slate" />
                <StatCard label="الأيام المحجوزة" value={`${displayStats.bookedDays}`} unit="يوم" color="emerald" />
                <StatCard label="الأيام غير المحجوزة" value={`${displayStats.availableDays}`} unit="يوم" color="slate" />
                <StatCard label="حجوزات Airbnb" value={`${displayStats.airbnbDays}`} unit="يوم" color="rose" />
                <StatCard label="الحجوزات الخارجية" value={`${displayStats.externalDays}`} unit="يوم" color="sky" />
                <StatCard label="نسبة الإشغال" value={displayStats.occupancyRate.toFixed(1)} unit="%" color="amber" />
              </div>

              {/* Source breakdown */}
              <div className="card p-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">تفصيل الحجوزات حسب المصدر</h3>
                <div className="space-y-2">
                  {Object.entries(displayStats.sourceBreakdown).map(([src, days]) => (
                    <div key={src} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">{SOURCE_LABELS[src as BookingSource] ?? src}</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{days} يوم</span>
                    </div>
                  ))}
                  {Object.keys(displayStats.sourceBreakdown).length === 0 && (
                    <p className="text-sm text-slate-400">لا توجد حجوزات في هذا الشهر</p>
                  )}
                </div>
              </div>

              {/* Occupancy bar */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">نسبة الإشغال</span>
                  <span className="text-sm font-bold text-indigo-600">{displayStats.occupancyRate.toFixed(1)}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-indigo-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.min(displayStats.occupancyRate, 100)}%` }}
                  />
                </div>
              </div>

              {/* Booking details */}
              {displayStats.bookings.length > 0 && (
                <div className="card p-4">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">تفاصيل الحجوزات ({displayStats.bookings.length})</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {displayStats.bookings.map((b, i) => {
                      const apt = apartments.find((a) => a.id === b.apartment_id);
                      const nights = overlapDaysInMonth(b.check_in, b.check_out, year, month);
                      return (
                        <div key={b.id} className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-slate-400 shrink-0">{i + 1}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{b.guest_name}</p>
                              <p className="text-xs text-slate-400 truncate">
                                {mode === 'location' && apt ? `شقة ${apt.apt_number ?? apt.name} • ` : ''}
                                {formatDate(b.check_in)} ← {formatDate(b.check_out)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              b.source === 'airbnb' ? 'bg-rose-100 text-rose-700' :
                              b.source === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' :
                              b.source === 'gathern' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {SOURCE_LABELS[b.source] ?? b.source}
                            </span>
                            <span className="text-xs font-bold text-slate-500">{nights} ليلة</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Per-apartment breakdown (location mode only) */}
              {mode === 'location' && scopedApartments.length > 0 && (
                <div className="card p-4">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">تقرير كل شقة</h3>
                  <div className="space-y-2">
                    {scopedApartments.map((apt) => {
                      const s = aptStats.get(apt.id);
                      if (!s) return null;
                      return (
                        <div key={apt.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{apt.apt_number ?? apt.name}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-emerald-600 font-bold">{s.bookedDays}/{s.totalDays}</span>
                            <span className="text-slate-500">{s.occupancyRate.toFixed(0)}%</span>
                            <span className="text-rose-500">A: {s.airbnbDays}</span>
                            <span className="text-sky-500">خ: {s.externalDays}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Copy button */}
              <div className="card p-3">
                <button
                  onClick={handleCopy}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    copied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? 'تم نسخ التقرير' : 'نسخ التقرير كاملاً'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: 'slate' | 'emerald' | 'sky' | 'rose' | 'amber' | 'indigo' }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    slate: { bg: 'bg-slate-50 dark:bg-slate-800/50', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
    sky: { bg: 'bg-sky-50 dark:bg-sky-950/30', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800' },
    rose: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
  };
  const c = colors[color];
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-3 text-center`}>
      <p className="text-xs font-semibold text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${c.text}`}>{value}<span className="text-sm font-normal mr-1">{unit}</span></p>
    </div>
  );
}
