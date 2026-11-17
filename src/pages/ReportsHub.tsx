import { useState } from 'react';
import { FileText, BarChart3, CalendarCheck } from 'lucide-react';
import { Reports } from '@/pages/Reports';
import { MonthlyReports } from '@/pages/MonthlyReports';
import { DailyReportModal } from '@/components/DailyReportModal';
import type { Apartment, Booking, Location } from '@/types';

interface Props {
  apartments: Apartment[];
  locations: Location[];
  bookings: Booking[];
}

type Tab = 'summary' | 'monthly' | 'daily';

export function ReportsHub({ apartments, locations, bookings }: Props) {
  const [tab, setTab] = useState<Tab>('summary');
  const [dailyOpen, setDailyOpen] = useState(false);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 w-full max-w-lg mx-auto">
        <button
          onClick={() => setTab('summary')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            tab === 'summary'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileText size={16} /> تقرير شقة
        </button>
        <button
          onClick={() => setTab('monthly')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            tab === 'monthly'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <BarChart3 size={16} /> شهري
        </button>
        <button
          onClick={() => { setTab('daily'); setDailyOpen(true); }}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            tab === 'daily'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <CalendarCheck size={16} /> يومي
        </button>
      </div>

      {/* Active tab content */}
      {tab === 'daily' ? (
        <div className="card p-12 text-center">
          <CalendarCheck size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-400 font-semibold">اضغط زر "يومي" بالأعلى لفتح التقرير اليومي</p>
          <button
            onClick={() => setDailyOpen(true)}
            className="btn-primary mt-4 mx-auto"
          >
            <CalendarCheck size={18} /> فتح التقرير اليومي
          </button>
        </div>
      ) : tab === 'monthly' ? (
        <MonthlyReports apartments={apartments} locations={locations} bookings={bookings} />
      ) : (
        <Reports apartments={apartments} locations={locations} bookings={bookings} />
      )}

      <DailyReportModal
        isOpen={dailyOpen}
        onClose={() => { setDailyOpen(false); setTab('summary'); }}
        apartments={apartments}
        locations={locations}
        bookings={bookings}
      />
    </div>
  );
}
