import { useMemo, useState } from 'react';
import { Copy, Share2, UserCheck, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import type { Apartment, Location } from '@/types';
import { isDepartureActive, isDepartureToday, formatDate, SOURCE_LABELS } from '@/lib/utils';
import { copyToClipboard, sendWhatsAppText } from '@/lib/whatsapp';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  apartments: Apartment[];
  locations: Location[];
}

export function CleaningReportModal({ isOpen, onClose, apartments, locations }: Props) {
  const [copied, setCopied] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const allSelected = locations.length > 0 && selectedIds.length === locations.length;

  const departing = useMemo(() => {
    const inRegion = (a: Apartment) =>
      selectedIds.length === 0 || (a.location_id != null && selectedIds.includes(a.location_id));
    return apartments
      .filter((a) => a.current_booking && isDepartureActive(a.current_booking.check_out) && inRegion(a))
      .sort((a, b) => a.current_booking!.check_out.localeCompare(b.current_booking!.check_out));
  }, [apartments, selectedIds]);

  const tomorrowCount = departing.filter((a) => !isDepartureToday(a.current_booking!.check_out)).length;
  const todayCount = departing.length - tomorrowCount;

  const toggleRegion = (id: string) => {
    setTouched(true);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleAll = () => {
    setTouched(true);
    setSelectedIds(allSelected ? [] : locations.map((l) => l.id));
  };

  const report = useMemo(() => {
    if (departing.length === 0) return '';
    const todayList = departing.filter((a) => isDepartureToday(a.current_booking!.check_out));
    const tomorrowList = departing.filter((a) => !isDepartureToday(a.current_booking!.check_out));

    const sections: string[] = [`*تقرير النظافة - ${formatDate(new Date())}*`];

    const buildLines = (list: Apartment[]) =>
      list.map((apt, i) => {
        const b = apt.current_booking!;
        const loc = apt.location?.name ?? '—';
        return `${i + 1}. شقة ${apt.apt_number ?? apt.name} - ${apt.name} (${loc})\n   الضيف: ${b.guest_name}\n   الخروج: ${formatDate(b.check_out)}\n   المصدر: ${SOURCE_LABELS[b.source]}`;
      });

    if (tomorrowList.length > 0) {
      sections.push(`*شقق خروج غدًا (${tomorrowList.length})*`);
      sections.push(buildLines(tomorrowList).join('\n'));
    }

    if (todayList.length > 0) {
      sections.push(`\n*شقق خروج اليوم (${todayList.length})*`);
      sections.push(buildLines(todayList).join('\n'));
    }

    return sections.join('\n\n');
  }, [departing]);

  const handleCopy = () => {
    copyToClipboard(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showEmpty = touched && selectedIds.length > 0 && departing.length === 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تقرير النظافة" size="lg">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">اختر المناطق</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-red-600" />
              كل المناطق
            </label>
            {locations.map((loc) => (
              <label
                key={loc.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(loc.id)}
                  onChange={() => toggleRegion(loc.id)}
                  className="h-4 w-4 accent-red-600"
                />
                {loc.name}
              </label>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {selectedIds.length === 0 ? 'تعرض كل المناطق افتراضيًا' : `${selectedIds.length} منطقة مختارة`}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {tomorrowCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/30">
              <Sparkles size={16} className="text-red-500" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300">
                {tomorrowCount} شقة خروج غدًا
              </span>
            </div>
          )}
          {todayCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30">
              <Sparkles size={16} className="text-amber-500" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                {todayCount} شقة خروج اليوم
              </span>
            </div>
          )}
          {departing.length === 0 && !showEmpty && (
            <p className="text-sm text-slate-400 py-2">لا توجد شقق تحتاج نظافة</p>
          )}
          {showEmpty && (
            <p className="text-sm text-slate-400 py-2">لا توجد شقق خروج في المناطق المختارة</p>
          )}
        </div>

        {departing.length > 0 && (
          <div className="space-y-2 max-h-[35vh] overflow-y-auto">
            {departing.map((apt) => {
              const b = apt.current_booking!;
              const isToday = isDepartureToday(b.check_out);
              return (
                <div
                  key={apt.id}
                  className={`rounded-xl p-3 border-2 ${
                    isToday
                      ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20'
                      : 'border-red-400 bg-red-50 dark:bg-red-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {apt.apt_number ?? apt.name} — {apt.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {apt.location?.name ?? '—'}
                      </p>
                    </div>
                    <span
                      className={`badge text-[10px] font-bold px-2 py-0.5 shrink-0 ${
                        isToday ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                      }`}
                    >
                      {isToday ? 'خروج اليوم' : 'خروج غدًا'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {b.guest_name}
                    </span>
                    <span className="text-[10px] font-semibold text-rose-700" dir="ltr">
                      {formatDate(b.check_out)}
                    </span>
                    {b.guest_phone && (
                      <span className="text-[10px] font-semibold text-blue-700" dir="ltr">
                        {b.guest_phone}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {report && (
          <>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 max-h-[25vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 font-sans leading-relaxed">
                {report}
              </pre>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCopy} className="btn-secondary flex-1">
                {copied ? <UserCheck size={18} /> : <Copy size={18} />}
                {copied ? 'تم النسخ' : 'نسخ'}
              </button>
              <button onClick={() => sendWhatsAppText(report)} className="btn-success flex-1">
                <Share2 size={18} />
                مشاركة
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
