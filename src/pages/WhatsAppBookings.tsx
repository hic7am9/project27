import { useState, useMemo } from 'react';
import { MessageCircle, Building2, ArrowLeft, FileText, Calendar, DollarSign, Phone, User, Paperclip, Loader2, CheckCircle2 } from 'lucide-react';
import type { Apartment, Booking, Location } from '@/types';
import { supabase } from '@/lib/supabase';
import { formatDate, daysBetween, SOURCE_LABELS, PAYMENT_LABELS } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

interface Props {
  apartments: Apartment[];
  locations: Location[];
  bookings: Booking[];
}

export function WhatsAppBookings({ apartments, locations, bookings }: Props) {
  const { setView } = useApp();
  const [selectedAptId, setSelectedAptId] = useState<string>('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [loadingAtt, setLoadingAtt] = useState(false);

  const whatsappBookings = useMemo(() => {
    return bookings.filter((b) => b.source === 'whatsapp' && !b.archived);
  }, [bookings]);

  const aptBookings = useMemo(() => {
    if (!selectedAptId) return [];
    return whatsappBookings
      .filter((b) => b.apartment_id === selectedAptId)
      .sort((a, b) => a.check_in.localeCompare(b.check_in));
  }, [whatsappBookings, selectedAptId]);

  const aptLocation = (id: string) => locations.find((l) => l.id === apartments.find((a) => a.id === id)?.location_id)?.name ?? '';

  const openBooking = async (booking: Booking) => {
    setSelectedBooking(booking);
    setAttachmentUrl(null);
    if (booking.attachment_url) {
      setLoadingAtt(true);
      const { data } = await supabase.storage.from('user-files').createSignedUrl(booking.attachment_url, 3600);
      if (data?.signedUrl) setAttachmentUrl(data.signedUrl);
      setLoadingAtt(false);
    }
  };

  const sortedApartments = useMemo(() => {
    return [...apartments].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }, [apartments]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <button onClick={() => setView('dashboard')} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <MessageCircle size={22} className="text-emerald-600" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">حجوزات الواتساب</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Apartment selector — right sidebar */}
        <div className="card p-3 space-y-1.5 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
          <div className="flex items-center gap-2 px-2 py-2 text-xs font-bold text-slate-400 uppercase">
            <Building2 size={14} />
            الشقق
          </div>
          {sortedApartments.length === 0 ? (
            <p className="text-sm text-slate-400 px-2 py-4">لا توجد شقق</p>
          ) : (
            sortedApartments.map((apt) => {
              const count = whatsappBookings.filter((b) => b.apartment_id === apt.id).length;
              const active = selectedAptId === apt.id;
              return (
                <button
                  key={apt.id}
                  onClick={() => setSelectedAptId(apt.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-start ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{apt.apt_number ?? apt.name}</span>
                  {count > 0 && (
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Booking details */}
        <div className="space-y-3">
          {!selectedAptId ? (
            <div className="card p-12 text-center">
              <MessageCircle size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-400 font-semibold">اختر شقة من القائمة لعرض حجوزات الواتساب الخاصة بها</p>
            </div>
          ) : aptBookings.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-sm text-slate-400 font-semibold">لا توجد حجوزات واتساب لهذه الشقة</p>
            </div>
          ) : (
            aptBookings.map((booking) => {
              const apt = apartments.find((a) => a.id === booking.apartment_id);
              const nights = daysBetween(booking.check_in, booking.check_out);
              return (
                <button
                  key={booking.id}
                  onClick={() => openBooking(booking)}
                  className="card p-4 w-full text-start hover:ring-2 hover:ring-emerald-400 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{booking.guest_name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">واتساب</span>
                        {booking.attachment_url && (
                          <span className="flex items-center gap-1 text-xs text-sky-600 font-semibold">
                            <Paperclip size={12} /> مرفق
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} />
                          {formatDate(booking.check_in)} ← {formatDate(booking.check_out)} ({nights} ليلة)
                        </span>
                        {booking.total_price != null && (
                          <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                            <DollarSign size={13} />
                            {booking.total_price} ر.س
                          </span>
                        )}
                      </div>
                      {booking.guest_phone && (
                        <p className="text-xs text-slate-400" dir="ltr">{booking.guest_phone}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Booking detail modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={() => setSelectedBooking(null)}>
          <div className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">تفاصيل الحجز</h2>
              <button onClick={() => setSelectedBooking(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                <ArrowLeft size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <DetailRow icon={User} label="اسم الضيف" value={selectedBooking.guest_name} />
              <DetailRow icon={Phone} label="رقم الهاتف" value={selectedBooking.guest_phone ?? '—'} ltr />
              <DetailRow icon={Calendar} label="تاريخ الدخول" value={formatDate(selectedBooking.check_in)} />
              <DetailRow icon={Calendar} label="تاريخ الخروج" value={formatDate(selectedBooking.check_out)} />
              <DetailRow icon={Calendar} label="عدد الليالي" value={`${daysBetween(selectedBooking.check_in, selectedBooking.check_out)} ليلة`} />
              {selectedBooking.total_price != null && (
                <DetailRow icon={DollarSign} label="السعر الإجمالي" value={`${selectedBooking.total_price} ر.س`} />
              )}
              {selectedBooking.balance != null && selectedBooking.balance > 0 && (
                <DetailRow icon={DollarSign} label="الرصيد المتبقي" value={`${selectedBooking.balance} ر.س`} />
              )}
              <DetailRow icon={CheckCircle2} label="مدفوع" value={selectedBooking.paid ? 'نعم' : 'لا'} />
              {selectedBooking.payment_method && (
                <DetailRow icon={DollarSign} label="طريقة الدفع" value={PAYMENT_LABELS[selectedBooking.payment_method] ?? selectedBooking.payment_method} />
              )}
              {selectedBooking.notes && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs font-bold text-slate-400 mb-1">ملاحظات</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{selectedBooking.notes}</p>
                </div>
              )}
            </div>

            {/* Attachment */}
            {selectedBooking.attachment_url && (
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800">
                <p className="text-xs font-bold text-sky-700 dark:text-sky-400 mb-2 flex items-center gap-1.5">
                  <Paperclip size={14} /> المرفق
                </p>
                {loadingAtt ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 size={16} className="animate-spin" /> جاري التحميل...
                  </div>
                ) : attachmentUrl ? (
                  <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-600 hover:text-sky-700 font-semibold underline">
                    عرض / تنزيل الملف
                  </a>
                ) : (
                  <p className="text-sm text-slate-400">تعذر تحميل المرفق</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, ltr }: { icon: typeof User; label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800">
      <span className="flex items-center gap-2 text-sm text-slate-400 font-semibold">
        <Icon size={16} /> {label}
      </span>
      <span className={`text-sm font-bold text-slate-900 dark:text-slate-100 ${ltr ? 'dir-ltr' : ''}`} dir={ltr ? 'ltr' : undefined}>{value}</span>
    </div>
  );
}
