import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface Props {
  apartmentId: string;
}

export function IcalExportLink({ apartmentId }: Props) {
  const [copied, setCopied] = useState(false);
  const exportUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-ical?apartment_id=${apartmentId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500">
        رابط تصدير الحجوزات إلى Airbnb (الصقه في إعدادات استيراد التقويم في Airbnb)
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={exportUrl}
          dir="ltr"
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
        />
        <button onClick={handleCopy} className="btn-secondary shrink-0">
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'تم النسخ' : 'نسخ'}
        </button>
      </div>
    </div>
  );
}
