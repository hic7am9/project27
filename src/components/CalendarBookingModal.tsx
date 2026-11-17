import { useState } from 'react';
import { DoorOpen, Edit, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { archiveBooking } from './StatusModal';
import type { Apartment, Booking } from '@/types';
import { formatDate, daysBetween, SOURCE_LABELS, PAYMENT_LABELS } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';

interface Props {
  booking: Booking;
  apartment: Apartment;
  onClose: () => void;
  onEdit: () => void;
}

const SOURCE_BADGE: Record<Booking['source'], string> = {
  airbnb: 'bg-rose-100 text-rose-700',
  gathern: 'bg-violet-100 text-violet-800',
  whatsapp: 'bg-emerald-100 text-emerald-800',
  direct: 'bg-sky-100 text-sky-800',
};

type PendingAction = 'delete' | 'checkout' | null;

export function CalendarBookingModal({ booking, apartment, onClose, onEdit }: Props) {
  const { triggerRefresh } = useApp();
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nights = daysBetween(booking.check_in, booking.check_out);

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      triggerRefresh();
      onClose();
    } catch {
      setError('تعذر تنفيذ العملية، حاول مرة أخرى');
    } finally {
      setBusy(false);
    }
  };

  const clearApartmentIfCurrent = async (status: 'not_ready') => {
    if (apartment.current_booking_id !== booking.id) return;
    const { error: aptError } = await supabase
      .from('apartments')
      .update({ current_booking_id: null, status })
      .eq('id', apartment.id);
    if (aptError) throw aptError;
  };

  const handleDelete = () =>
    runAction(async () => {
      if (!booking.external_uid) {
        await supabase.from('deleted_bookings').insert({
          apartment_id: apartment.id,
          ical_uid: `booking-${booking.id}@property-management`,
          check_in: booking.check_in,
          check_out: booking.check_out,
        });
      }
      await clearApartmentIfCurrent('not_ready');
      const { error: deleteError } = await supabase.from('bookings').delete().eq('id', booking.id);
      if (deleteError) throw deleteError;
    });

  const handleCheckout = () =>
    runAction(async () => {
      await archiveBooking(booking, apartment);
      await clearApartmentIfCurrent('not_ready');
    });

  return (
    <Modal isOpen onClose={onClose} title="تفاصيل الحجز" size="sm">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${SOURCE_BADGE[booking.source]}`}>
            {SOURCE_LABELS[booking.source]}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {nights} ليلة
          </span>
          {booking.paid && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">مدفوع</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
          <div className="col-span-2">
            <DetailItem label="اسم الضيف" value={booking.guest_name} />
          </div>
          <DetailItem label="تاريخ الدخول" value={formatDate(booking.check_in)} />
          <DetailItem label="تاريخ الخروج" value={formatDate(booking.check_out)} />
          {booking.guest_phone && (
            <div className="col-span-2">
              <DetailItem label="رقم الجوال" value={booking.guest_phone} dir="ltr" />
            </div>
          )}
          {booking.guest_email && (
            <div className="col-span-2">
              <DetailItem label="البريد الإلكتروني" value={booking.guest_email} dir="ltr" />
            </div>
          )}
          {booking.payment_method && (
            <DetailItem label="طريقة الدفع" value={PAYMENT_LABELS[booking.payment_method]} />
          )}
          {booking.total_price != null && (
            <DetailItem label="السعر الإجمالي" value={`${booking.total_price} ر.س`} />
          )}
          {booking.balance > 0 && (
            <DetailItem label="المتبقي" value={`${booking.balance} ر.س`} highlight />
          )}
          {booking.notes && (
            <div className="col-span-2">
              <DetailItem label="ملاحظات" value={booking.notes} />
            </div>
          )}
        </div>

        {error && <p className="text-sm font-semibold text-red-500 text-center">{error}</p>}

        {pending ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center">
              {pending === 'checkout'
                ? 'هل أنت متأكد من تسجيل خروج الضيف وأرشفة الحجز؟'
                : 'هل أنت متأكد من حذف هذا الحجز نهائياً؟'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPending(null)} disabled={busy} className="btn-secondary flex-1">إلغاء</button>
              <button
                onClick={pending === 'checkout' ? handleCheckout : handleDelete}
                disabled={busy}
                className="btn-danger flex-1"
              >
                {busy ? '...' : 'تأكيد'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={onEdit} className="btn-secondary flex-1">
              <Edit size={16} />
              تعديل
            </button>
            <button onClick={() => setPending('checkout')} className="btn-secondary flex-1">
              <DoorOpen size={16} />
              خروج وأرشفة
            </button>
            <button onClick={() => setPending('delete')} className="btn-danger flex-1">
              <Trash2 size={16} />
              حذف
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function DetailItem({ label, value, dir, highlight }: {
  label: string; value: string; dir?: 'ltr' | 'rtl'; highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] text-slate-400 font-semibold mb-0.5">{label}</p>
      <p className={`text-sm font-bold break-words ${highlight ? 'text-red-600' : 'text-slate-800 dark:text-slate-100'}`} dir={dir}>
        {value}
      </p>
    </div>
  );
}
