import { useState, useMemo, useRef, useEffect } from 'react';
import { Bell, DoorOpen, LogIn, Copy, Check, X, Sparkles } from 'lucide-react';
import type { Apartment, Booking } from '@/types';
import { todayISO, formatDate, isDepartureToday, SOURCE_LABELS } from '@/lib/utils';
import { copyToClipboard } from '@/lib/whatsapp';

interface Props {
  apartments: Apartment[];
  bookings: Booking[];
}

interface TodayItem {
  apartmentName: string;
  locationName: string;
  guestName: string;
  date: string;
  source: string;
  bookingId: string;
  apartmentId: string;
}

function buildSummary(
  checkIns: TodayItem[],
  checkOuts: TodayItem[],
  cleaning: { apartmentName: string; locationName: string }[],
): string {
  const today = new Date();
  const dateStr = new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(today);

  const lines: string[] = [];
  lines.push(`📋 ملخص اليوم — ${dateStr}`);
  lines.push('');
  lines.push(`🟢 تشيك إن (${checkIns.length}):`);
  if (checkIns.length === 0) lines.push('  لا يوجد');
  checkIns.forEach((c, i) => {
    lines.push(`  ${i + 1}. ${c.apartmentName} — ${c.locationName} | الضيف: ${c.guestName}`);
  });
  lines.push('');
  lines.push(`🔴 تشيك أوت (${checkOuts.length}):`);
  if (checkOuts.length === 0) lines.push('  لا يوجد');
  checkOuts.forEach((c, i) => {
    lines.push(`  ${i + 1}. ${c.apartmentName} — ${c.locationName} | الضيف: ${c.guestName}`);
  });
  lines.push('');
  lines.push(`🧹 تحتاج تنظيف (${cleaning.length}):`);
  if (cleaning.length === 0) lines.push('  لا يوجد');
  cleaning.forEach((c, i) => {
    lines.push(`  ${i + 1}. ${c.apartmentName} — ${c.locationName}`);
  });
  return lines.join('\n');
}

export function TodayAlerts({ apartments, bookings }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const today = todayISO();

  const activeBookings = useMemo(() => bookings.filter((b) => !b.archived), [bookings]);

  const checkIns = useMemo<TodayItem[]>(() => {
    return activeBookings
      .filter((b) => b.check_in === today)
      .map((b) => {
        const apt = apartments.find((a) => a.id === b.apartment_id);
        return {
          apartmentName: apt?.apt_number ?? apt?.name ?? '—',
          locationName: apt?.location?.name ?? 'بدون موقع',
          guestName: b.guest_name,
          date: b.check_in,
          source: SOURCE_LABELS[b.source] ?? b.source,
          bookingId: b.id,
          apartmentId: b.apartment_id,
        };
      });
  }, [activeBookings, apartments, today]);

  const checkOuts = useMemo<TodayItem[]>(() => {
    return activeBookings
      .filter((b) => {
        const apt = apartments.find((a) => a.id === b.apartment_id);
        if (!apt) return false;
        const isToday = b.check_out === today || isDepartureToday(b.check_out);
        if (!isToday) return false;
        return apt.current_booking_id === b.id;
      })
      .map((b) => {
        const apt = apartments.find((a) => a.id === b.apartment_id);
        return {
          apartmentName: apt?.apt_number ?? apt?.name ?? '—',
          locationName: apt?.location?.name ?? 'بدون موقع',
          guestName: b.guest_name,
          date: b.check_out,
          source: SOURCE_LABELS[b.source] ?? b.source,
          bookingId: b.id,
          apartmentId: b.apartment_id,
        };
      });
  }, [activeBookings, apartments, today]);

  const cleaning = useMemo(() => {
    return apartments
      .filter((a) => a.status === 'not_ready')
      .map((a) => ({
        apartmentName: a.apt_number ?? a.name,
        locationName: a.location?.name ?? 'بدون موقع',
        apartmentId: a.id,
      }));
  }, [apartments]);

  const totalCount = checkIns.length + checkOuts.length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleCopy = () => {
    const text = buildSummary(checkIns, checkOuts, cleaning);
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bellButton = (
    <button
      onClick={() => setOpen((v) => !v)}
      className="relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      title="تنبيهات اليوم"
      aria-label="تنبيهات اليوم"
    >
      <div className="relative">
        <Bell size={22} />
        {totalCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {totalCount}
          </span>
        )}
      </div>
      <span className="text-[9px] sm:text-[10px] font-semibold leading-tight text-center">اليوم</span>
    </button>
  );

  return (
    <div className="relative" ref={panelRef}>
      {bellButton}

      {open && (
        <div className="fixed inset-0 z-50 animate-fade-in" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-16 sm:bottom-auto sm:top-16 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 w-full max-w-sm sm:w-96 max-h-[75vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-sky-600 to-emerald-600 text-white shrink-0 sm:rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Bell size={18} />
                <h3 className="text-sm font-bold">تنبيهات اليوم</h3>
                <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5 font-bold">{formatDate(today)}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            {/* Summary bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <span className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                تشيك إن: {checkIns.length}
              </span>
              <span className="text-xs font-bold px-2 py-1 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                تشيك أوت: {checkOuts.length}
              </span>
              <span className="text-xs font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                تنظيف: {cleaning.length}
              </span>
              <button
                onClick={handleCopy}
                className="mr-auto flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-colors"
                title="نسخ ملخص اليوم"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'تم النسخ' : 'نسخ'}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Check-ins */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <LogIn size={15} className="text-emerald-600" />
                  <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">تشيك إن اليوم</h4>
                </div>
                {checkIns.length === 0 ? (
                  <p className="text-xs text-slate-400 px-2 py-1.5">لا يوجد وصولات اليوم</p>
                ) : (
                  <div className="space-y-1.5">
                    {checkIns.map((c) => (
                      <div key={c.bookingId} className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 px-2.5 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{c.apartmentName}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{c.locationName} — {c.guestName}</p>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white shrink-0" dir="ltr">{formatDate(c.date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Check-outs */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <DoorOpen size={15} className="text-rose-600" />
                  <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400">تشيك أوت اليوم</h4>
                </div>
                {checkOuts.length === 0 ? (
                  <p className="text-xs text-slate-400 px-2 py-1.5">لا يوجد مغادرات اليوم</p>
                ) : (
                  <div className="space-y-1.5">
                    {checkOuts.map((c) => (
                      <div key={c.bookingId} className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 px-2.5 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{c.apartmentName}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{c.locationName} — {c.guestName}</p>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white shrink-0" dir="ltr">{formatDate(c.date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cleaning */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles size={15} className="text-amber-600" />
                  <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400">تحتاج تنظيف</h4>
                </div>
                {cleaning.length === 0 ? (
                  <p className="text-xs text-slate-400 px-2 py-1.5">لا توجد شقق تحتاج تنظيف</p>
                ) : (
                  <div className="space-y-1.5">
                    {cleaning.map((c) => (
                      <div key={c.apartmentId} className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 px-2.5 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{c.apartmentName}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{c.locationName}</p>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white shrink-0">تنظيف</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact summary bar for the top of WorkSchedule */
export function TodaySummaryBar({ apartments, bookings, onClick }: { apartments: Apartment[]; bookings: Booking[]; onClick: () => void }) {
  const today = todayISO();
  const activeBookings = bookings.filter((b) => !b.archived);

  const checkInCount = activeBookings.filter((b) => b.check_in === today).length;
  const checkOutCount = activeBookings.filter((b) => {
    const apt = apartments.find((a) => a.id === b.apartment_id);
    if (!apt || apt.current_booking_id !== b.id) return false;
    return b.check_out === today || isDepartureToday(b.check_out);
  }).length;
  const cleaningCount = apartments.filter((a) => a.status === 'not_ready').length;

  const total = checkInCount + checkOutCount;
  if (total === 0 && cleaningCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-600 transition-colors text-start"
    >
      <Bell size={16} className="text-sky-600 shrink-0" />
      <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
        <span className="text-emerald-700 dark:text-emerald-400">تشيك إن اليوم: {checkInCount}</span>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span className="text-rose-700 dark:text-rose-400">تشيك أوت اليوم: {checkOutCount}</span>
        {cleaningCount > 0 && (
          <>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="text-amber-700 dark:text-amber-400">تنظيف: {cleaningCount}</span>
          </>
        )}
      </div>
      <span className="mr-auto text-[10px] text-slate-400 font-semibold">عرض التفاصيل ←</span>
    </button>
  );
}

/** Inline panel (used inside a modal from WorkSchedule) */
export function TodayAlertsInline({ apartments, bookings }: Props) {
  const [copied, setCopied] = useState(false);
  const today = todayISO();

  const activeBookings = useMemo(() => bookings.filter((b) => !b.archived), [bookings]);

  const checkIns = useMemo<TodayItem[]>(() => {
    return activeBookings
      .filter((b) => b.check_in === today)
      .map((b) => {
        const apt = apartments.find((a) => a.id === b.apartment_id);
        return {
          apartmentName: apt?.apt_number ?? apt?.name ?? '—',
          locationName: apt?.location?.name ?? 'بدون موقع',
          guestName: b.guest_name,
          date: b.check_in,
          source: SOURCE_LABELS[b.source] ?? b.source,
          bookingId: b.id,
          apartmentId: b.apartment_id,
        };
      });
  }, [activeBookings, apartments, today]);

  const checkOuts = useMemo<TodayItem[]>(() => {
    return activeBookings
      .filter((b) => {
        const apt = apartments.find((a) => a.id === b.apartment_id);
        if (!apt) return false;
        const isToday = b.check_out === today || isDepartureToday(b.check_out);
        if (!isToday) return false;
        return apt.current_booking_id === b.id;
      })
      .map((b) => {
        const apt = apartments.find((a) => a.id === b.apartment_id);
        return {
          apartmentName: apt?.apt_number ?? apt?.name ?? '—',
          locationName: apt?.location?.name ?? 'بدون موقع',
          guestName: b.guest_name,
          date: b.check_out,
          source: SOURCE_LABELS[b.source] ?? b.source,
          bookingId: b.id,
          apartmentId: b.apartment_id,
        };
      });
  }, [activeBookings, apartments, today]);

  const cleaning = useMemo(() => {
    return apartments
      .filter((a) => a.status === 'not_ready')
      .map((a) => ({
        apartmentName: a.apt_number ?? a.name,
        locationName: a.location?.name ?? 'بدون موقع',
        apartmentId: a.id,
      }));
  }, [apartments]);

  const handleCopy = () => {
    const text = buildSummary(checkIns, checkOuts, cleaning);
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-sky-600 to-emerald-600 text-white shrink-0 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Bell size={18} />
          <h3 className="text-sm font-bold">تنبيهات اليوم</h3>
          <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5 font-bold">{formatDate(today)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <span className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">تشيك إن: {checkIns.length}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">تشيك أوت: {checkOuts.length}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">تنظيف: {cleaning.length}</span>
        <button
          onClick={handleCopy}
          className="mr-auto flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-colors"
          title="نسخ ملخص اليوم"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'تم النسخ' : 'نسخ الملخص'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <LogIn size={15} className="text-emerald-600" />
            <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">تشيك إن اليوم</h4>
          </div>
          {checkIns.length === 0 ? (
            <p className="text-xs text-slate-400 px-2 py-1.5">لا يوجد وصولات اليوم</p>
          ) : (
            <div className="space-y-1.5">
              {checkIns.map((c) => (
                <div key={c.bookingId} className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 px-2.5 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{c.apartmentName}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{c.locationName} — {c.guestName}</p>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white shrink-0" dir="ltr">{formatDate(c.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <DoorOpen size={15} className="text-rose-600" />
            <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400">تشيك أوت اليوم</h4>
          </div>
          {checkOuts.length === 0 ? (
            <p className="text-xs text-slate-400 px-2 py-1.5">لا يوجد مغادرات اليوم</p>
          ) : (
            <div className="space-y-1.5">
              {checkOuts.map((c) => (
                <div key={c.bookingId} className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 px-2.5 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{c.apartmentName}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{c.locationName} — {c.guestName}</p>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white shrink-0" dir="ltr">{formatDate(c.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles size={15} className="text-amber-600" />
            <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400">تحتاج تنظيف</h4>
          </div>
          {cleaning.length === 0 ? (
            <p className="text-xs text-slate-400 px-2 py-1.5">لا توجد شقق تحتاج تنظيف</p>
          ) : (
            <div className="space-y-1.5">
              {cleaning.map((c) => (
                <div key={c.apartmentId} className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 px-2.5 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{c.apartmentName}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{c.locationName}</p>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white shrink-0">تنظيف</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
