import { useState, useRef, useMemo, useCallback } from 'react';
import { MapPin, Check, Download, Share2, Loader2, Calendar, FileText } from 'lucide-react';
import type { Apartment, Location, Booking, ApartmentStatus } from '@/types';
import { formatDate, SOURCE_LABELS, isDepartureActive } from '@/lib/utils';
import { Modal } from '@/components/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  apartments: Apartment[];
  locations: Location[];
  bookings: Booking[];
}

const STATUS_LABELS: Record<ApartmentStatus, string> = {
  occupied: 'مشغولة',
  ready: 'جاهزة',
  not_ready: 'غير جاهزة',
  maintenance: 'صيانة',
};

const STATUS_COLORS: Record<ApartmentStatus, string> = {
  occupied: '#059669',
  ready: '#0284c7',
  not_ready: '#94a3b8',
  maintenance: '#ea580c',
};

const STATUS_LABELS_EN: Record<ApartmentStatus, string> = {
  occupied: 'Occupied',
  ready: 'Ready',
  not_ready: 'Not Ready',
  maintenance: 'Maintenance',
};

interface AptRow {
  name: string;
  aptNumber: string;
  locationName: string;
  status: ApartmentStatus;
  statusLabel: string;
  statusColor: string;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  source: string | null;
  departureToday: boolean;
}

interface ReportData {
  totalDays: number;
  totalApartments: number;
  byStatus: Record<ApartmentStatus, number>;
  occupancyRate: number;
  todayBookings: Booking[];
  apartments: AptRow[];
  locationLabel: string;
  dayName: string;
  fullDate: string;
  dateStr: string;
}

export function DailyReportModal({ isOpen, onClose, apartments, locations, bookings }: Props) {
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }, [locations]);

  const toggleLocation = (id: string) => {
    setSelectedLocationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const scopedApartments = useMemo(() => {
    const sorted = [...apartments].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    if (selectedLocationIds.length === 0) return sorted;
    return sorted.filter((a) => a.location_id && selectedLocationIds.includes(a.location_id));
  }, [apartments, selectedLocationIds]);

  const stats = useMemo(() => {
    const total = scopedApartments.length;
    const byStatus: Record<ApartmentStatus, number> = { occupied: 0, ready: 0, not_ready: 0, maintenance: 0 };
    const todayBookings: Booking[] = [];

    for (const apt of scopedApartments) {
      byStatus[apt.status]++;

      const aptBookings = bookings.filter((b) => b.apartment_id === apt.id && !b.archived);
      for (const b of aptBookings) {
        if (b.check_in === todayStr) {
          todayBookings.push({ ...b, apartment: apt });
        }
      }
    }

    const occupancyRate = total > 0 ? (byStatus.occupied / total) * 100 : 0;
    return { total, byStatus, todayBookings, occupancyRate };
  }, [scopedApartments, bookings, todayStr]);

  const locationLabel = useMemo(() => {
    if (selectedLocationIds.length === 0) return 'كل المناطق';
    return selectedLocationIds
      .map((id) => locations.find((l) => l.id === id)?.name ?? '')
      .filter(Boolean)
      .join('، ');
  }, [selectedLocationIds, locations]);

  const today = new Date();
  const dayName = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { weekday: 'long' }).format(today);
  const fullDate = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(today);

  const reportData: ReportData = useMemo(() => {
    const aptRows: AptRow[] = scopedApartments.map((apt) => {
      const booking = apt.current_booking;
      const depActive = booking ? isDepartureActive(booking.check_out) : false;
      return {
        name: apt.name,
        aptNumber: apt.apt_number ?? apt.name,
        locationName: apt.location?.name ?? '—',
        status: apt.status,
        statusLabel: depActive ? 'خروج اليوم' : STATUS_LABELS[apt.status],
        statusColor: depActive ? '#dc2626' : STATUS_COLORS[apt.status],
        guestName: booking?.guest_name ?? null,
        checkIn: booking?.check_in ?? null,
        checkOut: booking?.check_out ?? null,
        source: booking?.source ? (SOURCE_LABELS[booking.source] ?? booking.source) : null,
        departureToday: depActive,
      };
    });

    return {
      totalDays: 30,
      totalApartments: stats.total,
      byStatus: stats.byStatus,
      occupancyRate: stats.occupancyRate,
      todayBookings: stats.todayBookings,
      apartments: aptRows,
      locationLabel,
      dayName,
      fullDate,
      dateStr: todayStr,
    };
  }, [scopedApartments, stats, locationLabel, dayName, fullDate, todayStr]);

  const generateImage = useCallback(async (): Promise<{ dataUrl: string; width: number; height: number } | null> => {
    if (!reportRef.current) return null;
    setGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const element = reportRef.current;
      const fixedWidth = 800;
      element.style.width = `${fixedWidth}px`;
      const canvas = await html2canvas(element, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        width: fixedWidth,
        windowWidth: fixedWidth,
      });
      element.style.width = '';
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      return { dataUrl, width: canvas.width, height: canvas.height };
    } catch (err) {
      console.error('Image generation failed:', err);
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  const generatePDF = useCallback(async (): Promise<Blob | null> => {
    setGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');
      const result = await generateImage();
      if (!result) return null;
      const { dataUrl: imgData, width: imgWidth, height: imgHeight } = result;

      const pdfWidth = 210; // A4 mm
      const pdfHeight = 297;
      const margin = 8;
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = (imgHeight * contentWidth) / imgWidth;

      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageContentHeight = pdfHeight - margin * 2;

      if (contentHeight <= pageContentHeight) {
        pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight, undefined, 'FAST');
      } else {
        // Multi-page: slice the image precisely
        const img = new Image();
        img.src = imgData;
        await new Promise((resolve) => { img.onload = resolve; if (img.complete) resolve(null); });

        let remainingHeight = contentHeight;
        let position = 0;

        while (remainingHeight > 0) {
          const sliceHeight = Math.min(remainingHeight, pageContentHeight);
          const ratio = sliceHeight / contentHeight;
          const sourceSliceHeight = Math.ceil(imgHeight * ratio);
          const sourceY = Math.round((position / contentHeight) * imgHeight);

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = imgWidth;
          tempCanvas.height = sourceSliceHeight;
          const tempCtx = tempCanvas.getContext('2d');
          if (!tempCtx) break;
          tempCtx.fillStyle = '#ffffff';
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          tempCtx.drawImage(img, 0, sourceY, imgWidth, sourceSliceHeight, 0, 0, imgWidth, sourceSliceHeight);

          const sliceData = tempCanvas.toDataURL('image/jpeg', 0.92);
          if (position > 0) pdf.addPage();
          pdf.addImage(sliceData, 'JPEG', margin, margin, contentWidth, sliceHeight, undefined, 'FAST');

          remainingHeight -= sliceHeight;
          position += sliceHeight;
        }
      }

      return pdf.output('blob');
    } catch (err) {
      console.error('PDF generation failed:', err);
      return null;
    } finally {
      setGenerating(false);
    }
  }, [generateImage]);

  const handleDownloadPDF = useCallback(async () => {
    const blob = await generatePDF();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير-يومي-${todayStr}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [generatePDF, todayStr]);

  const handleShareWhatsApp = useCallback(async () => {
    const blob = await generatePDF();
    if (!blob) return;

    const file = new File([blob], `daily-report-${todayStr}.pdf`, { type: 'application/pdf' });

    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: `التقرير اليومي - ${fullDate}\n${locationLabel}\nنسبة الإشغال: ${stats.occupancyRate.toFixed(1)}%`,
        });
        return;
      }
    } catch (err) {
      console.error('Web Share failed:', err);
    }

    // Fallback: download PDF + open WhatsApp with summary text
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير-يومي-${todayStr}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    const text = encodeURIComponent(`التقرير اليومي - ${fullDate}\n${locationLabel}\nإجمالي الشقق: ${stats.total}\nمشغولة: ${stats.byStatus.occupied} | جاهزة: ${stats.byStatus.ready} | غير جاهزة: ${stats.byStatus.not_ready} | صيانة: ${stats.byStatus.maintenance}\nنسبة الإشغال: ${stats.occupancyRate.toFixed(1)}%`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }, [generatePDF, todayStr, fullDate, locationLabel, stats]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="التقرير اليومي" size="md">
      <div className="space-y-4">
        {/* Location selector */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <MapPin size={16} /> تحديد المنطقة
          </label>
          <div className="flex flex-wrap gap-2">
            {sortedLocations.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد مناطق</p>
            ) : (
              sortedLocations.map((loc) => {
                const active = selectedLocationIds.includes(loc.id);
                return (
                  <button
                    key={loc.id}
                    onClick={() => toggleLocation(loc.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center ${active ? 'border-white bg-white' : 'border-slate-300 dark:border-slate-600'}`}>
                      {active && <Check size={10} className="text-indigo-600" />}
                    </span>
                    {loc.name}
                  </button>
                );
              })
            )}
          </div>
          {selectedLocationIds.length > 0 && (
            <button
              onClick={() => setSelectedLocationIds([])}
              className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
            >
              إلغاء التحديد (عرض الكل)
            </button>
          )}
        </div>

        {/* Report card container — scrollable preview */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 max-h-[60vh] overflow-y-auto">
        {/* Report card (captured for PDF) */}
        <div
          ref={reportRef}
          className="bg-white p-8 space-y-5"
          style={{ width: '800px', fontFamily: "'Cairo', 'Tahoma', sans-serif", fontSize: '15px' }}
        >
          {/* Header */}
          <div className="text-center border-b-2 border-slate-200 pb-4">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-wide">HICHAM STAY</h2>
            <p className="text-base font-bold text-indigo-600 mt-1">التقرير اليومي للإدارة</p>
            <div className="flex items-center justify-center gap-2 mt-2 text-sm text-slate-500">
              <Calendar size={14} />
              <span>{dayName}</span>
              <span>•</span>
              <span>{fullDate}</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
              <MapPin size={12} />
              {locationLabel}
            </div>
          </div>

          {/* Four status boxes — all equal, all colored */}
          <div className="grid grid-cols-5 gap-2">
            <StatusBox label="إجمالي الشقق" value={stats.total} color="#1e293b" />
            <StatusBox label="مشغولة" value={stats.byStatus.occupied} color={STATUS_COLORS.occupied} />
            <StatusBox label="جاهزة" value={stats.byStatus.ready} color={STATUS_COLORS.ready} />
            <StatusBox label="غير جاهزة" value={stats.byStatus.not_ready} color={STATUS_COLORS.not_ready} />
            <StatusBox label="صيانة" value={stats.byStatus.maintenance} color={STATUS_COLORS.maintenance} />
          </div>

          {/* Occupancy rate — prominent */}
          <div className="rounded-xl p-4" style={{ backgroundColor: '#f0fdf4', border: '2px solid #059669' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-700">نسبة الإشغال الشهري</span>
              <span className="text-2xl font-extrabold text-emerald-600">{stats.occupancyRate.toFixed(1)}%</span>
            </div>
            <div className="h-4 rounded-full bg-white overflow-hidden border border-emerald-200">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(stats.occupancyRate, 100)}%`,
                  background: 'linear-gradient(to left, #059669, #10b981)',
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-500 font-semibold">
              <span>0%</span>
              <span>{stats.byStatus.occupied} من {stats.total} شقة</span>
              <span>100%</span>
            </div>
          </div>

          {/* Apartment list with color-coded status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-slate-700">تفاصيل الشقق:</p>
              <p className="text-xs text-slate-400 font-semibold">{scopedApartments.length} شقة</p>
            </div>
            {scopedApartments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">لا توجد شقق</p>
            ) : (
              scopedApartments.map((apt) => {
                const booking = apt.current_booking;
                const depActive = booking && isDepartureActive(booking.check_out);
                const color = depActive ? '#dc2626' : STATUS_COLORS[apt.status];
                return (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5"
                    style={{ backgroundColor: '#f8fafc', borderRight: `4px solid ${color}` }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-extrabold shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {(apt.apt_number ?? apt.name).slice(0, 3)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {apt.apt_number ?? apt.name}
                        </p>
                        {booking ? (
                          <p className="text-[11px] text-slate-500 truncate">
                            {booking.guest_name} • {formatDate(booking.check_in)} ← {formatDate(booking.check_out)}
                            {booking.source && ` • ${SOURCE_LABELS[booking.source] ?? booking.source}`}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400">{apt.maintenance_note ?? STATUS_LABELS[apt.status]}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 text-white"
                      style={{ backgroundColor: color }}
                    >
                      {depActive ? 'خروج اليوم' : STATUS_LABELS[apt.status]}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Today's check-ins */}
          {stats.todayBookings.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-emerald-600 mb-2">وصولات اليوم ({stats.todayBookings.length}):</p>
              {stats.todayBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: '#ecfdf5', borderRight: '4px solid #059669' }}
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">{b.guest_name}</p>
                    <p className="text-[11px] text-slate-500">
                      {b.apartment?.apt_number ?? b.apartment?.name}
                      {b.source && ` • ${SOURCE_LABELS[b.source] ?? b.source}`}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600">{formatDate(b.check_out)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200">
            <p className="text-[11px] font-bold text-slate-500">دليل الألوان:</p>
            <LegendItem color={STATUS_COLORS.occupied} label="مشغولة" />
            <LegendItem color={STATUS_COLORS.ready} label="جاهزة" />
            <LegendItem color={STATUS_COLORS.not_ready} label="غير جاهزة" />
            <LegendItem color={STATUS_COLORS.maintenance} label="صيانة" />
            <LegendItem color="#dc2626" label="خروج اليوم" />
          </div>

          {/* Footer */}
          <div className="text-center border-t border-slate-200 pt-3">
            <p className="text-[11px] text-slate-400 font-semibold">HICHAM STAY — نظام إدارة العقارات</p>
            <p className="text-[10px] text-slate-300 mt-0.5">تم إنشاء التقرير: {fullDate}</p>
          </div>
        </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleDownloadPDF}
            disabled={generating}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            {generating ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
            تنزيل PDF
          </button>
          <button
            onClick={handleShareWhatsApp}
            disabled={generating}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            {generating ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
            مشاركة واتساب
          </button>
        </div>
      </div>
    </Modal>
  );
}

function StatusBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="text-center rounded-xl p-3 text-white"
      style={{ backgroundColor: color }}
    >
      <p className="text-2xl font-extrabold leading-none">{value}</p>
      <p className="text-[9px] font-bold mt-1 leading-tight">{label}</p>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-[11px] font-semibold text-slate-600">{label}</span>
    </div>
  );
}
