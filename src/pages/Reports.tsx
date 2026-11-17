import { useState, useMemo, useCallback } from 'react';
import { FileText, Building2, Copy, Check } from 'lucide-react';
import type { Apartment, Booking, Location } from '@/types';
import { formatDate, daysBetween, SOURCE_LABELS, PAYMENT_LABELS } from '@/lib/utils';

interface Props {
  apartments: Apartment[];
  locations: Location[];
  bookings: Booking[];
}

export function Reports({ apartments, locations, bookings }: Props) {
  const [selectedAptId, setSelectedAptId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const aptBookings = useMemo(() => {
    if (!selectedAptId) return [];
    return bookings
      .filter((b) => b.apartment_id === selectedAptId && !b.archived)
      .sort((a, b) => a.check_in.localeCompare(b.check_in));
  }, [bookings, selectedAptId]);

  const apt = apartments.find((a) => a.id === selectedAptId);
  const aptLocation = apt ? locations.find((l) => l.id === apt.location_id)?.name ?? '' : '';

  const generateReport = useCallback(() => {
    if (!apt) return '';
    const lines: string[] = [];
    lines.push(`تقرير الشقة: ${apt.apt_number ?? apt.name}`);
    if (aptLocation) lines.push(`الموقع: ${aptLocation}`);
    if (apt.unit_type) lines.push(`نوع الوحدة: ${apt.unit_type}`);
    if (apt.building_number) lines.push(`رقم العمارة: ${apt.building_number}`);
    if (apt.floor_number) lines.push(`الدور: ${apt.floor_number}`);
    lines.push('');
    lines.push(`عدد الحجوزات: ${aptBookings.length}`);
    lines.push('─────────────────────');

    let totalRevenue = 0;
    let totalNights = 0;

    aptBookings.forEach((b, i) => {
      const nights = daysBetween(b.check_in, b.check_out);
      totalNights += nights;
      const revenue = b.total_price ?? 0;
      totalRevenue += revenue;
      lines.push('');
      lines.push(`الحجز ${i + 1}:`);
      lines.push(`  الضيف: ${b.guest_name}`);
      if (b.guest_phone) lines.push(`  الهاتف: ${b.guest_phone}`);
      lines.push(`  المصدر: ${SOURCE_LABELS[b.source] ?? b.source}`);
      lines.push(`  الدخول: ${formatDate(b.check_in)}`);
      lines.push(`  الخروج: ${formatDate(b.check_out)}`);
      lines.push(`  الليالي: ${nights}`);
      if (b.total_price != null) lines.push(`  السعر: ${b.total_price} ر.س`);
      if (b.balance > 0) lines.push(`  المتبقي: ${b.balance} ر.س`);
      lines.push(`  مدفوع: ${b.paid ? 'نعم' : 'لا'}`);
      if (b.payment_method) lines.push(`  الدفع: ${PAYMENT_LABELS[b.payment_method] ?? b.payment_method}`);
      if (b.notes) lines.push(`  ملاحظات: ${b.notes}`);
    });

    lines.push('');
    lines.push('─────────────────────');
    lines.push(`إجمالي الليالي: ${totalNights}`);
    lines.push(`إجمالي الإيرادات: ${totalRevenue} ر.س`);
    lines.push(`تاريخ التقرير: ${formatDate(new Date().toISOString())}`);

    return lines.join('\n');
  }, [apt, aptBookings, aptLocation]);

  const reportText = useMemo(() => generateReport(), [generateReport]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = reportText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sortedApartments = useMemo(() => {
    return [...apartments].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }, [apartments]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Apartment selector */}
        <div className="card p-3 space-y-1.5 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
          <div className="flex items-center gap-2 px-2 py-2 text-xs font-bold text-slate-400 uppercase">
            <Building2 size={14} />
            الشقق
          </div>
          {sortedApartments.length === 0 ? (
            <p className="text-sm text-slate-400 px-2 py-4">لا توجد شقق</p>
          ) : (
            sortedApartments.map((a) => {
              const count = bookings.filter((b) => b.apartment_id === a.id && !b.archived).length;
              const active = selectedAptId === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAptId(a.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-start ${
                    active
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{a.apt_number ?? a.name}</span>
                  {count > 0 && (
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-700'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Report content */}
        <div className="space-y-3">
          {!selectedAptId ? (
            <div className="card p-12 text-center">
              <FileText size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-400 font-semibold">اختر شقة لعرض تقريرها</p>
            </div>
          ) : (
            <>
              <div className="card p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    تقرير {apt?.apt_number ?? apt?.name}
                  </h2>
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-sky-600 text-white hover:bg-sky-700'
                    }`}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'تم النسخ' : 'نسخ التقرير'}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 max-h-[calc(100vh-280px)] overflow-y-auto" dir="rtl">
                  {reportText}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
