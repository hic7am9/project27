import { ArrowLeft } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export function Terms({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-950">
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 animate-fade-in" dir="rtl">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">شروط الاستخدام</h1>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <p>آخر تحديث: نوفمبر 2026</p>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">1. قبول الشروط</h2>
              <p>باستخدامك لتطبيق HICHAM STAY فإنك توافق على هذه الشروط. إذا لم توافق على أي بند منها، فيرجى عدم استخدام التطبيق.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">2. وصف الخدمة</h2>
              <p>التطبيق أداة لإدارة العقارات والوحدات السكنية والحجوزات. يتيح للمستخدمين تنظيم بيانات شققهم، تتبع الحجوزات، إدارة المدفوعات، وعرض جداول العمل. كل مستخدم يملك بياناته المعزولة بالكامل عن بيانات المستخدمين الآخرين.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">3. حساب المستخدم</h2>
              <p>يتوجب عليك تقديم معلومات صحيحة عند إنشاء حسابك، والمحافظة على سرية كلمة المرور. أنت مسؤول عن جميع الأنشطة التي تتم عبر حسابك. يجب إبلاغنا فورًا عن أي استخدام غير مصرح به لحسابك.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">4. استخدام التطبيق</h2>
              <p>يوافق المستخدم على عدم استخدام التطبيق لأي غرض غير قانوني أو مخالف لهذه الشروط. يُمنع إساءة استخدام الخدمة أو محاولة الوصول غير المصرح به لبيانات الآخرين.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">5. البيانات والمحتوى</h2>
              <p>أنت مسؤول عن صحة البيانات التي تدخلها في التطبيق. التطبيق يوفر أدوات نسخ احتياطي واستعادة، لكن مسؤولية الحفاظ على نسخ احتياطية من بياناتك تقع عليك.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">6. حدود المسؤولية</h2>
              <p>يُقدم التطبيق "كما هو" دون أي ضمانات صريحة أو ضمنية. لا يتحمل مطورو التطبيق مسؤولية أي خسارة مباشرة أو غير مباشرة ناتجة عن استخدام التطبيق أو عدم القدرة على استخدامه.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">7. التعديلات</h2>
              <p>قد يتم تحديث هذه الشروط من وقت لآخر. استمرارك في استخدام التطبيق بعد التحديث يعني موافقتك على الشروط المعدلة.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">8. إنهاء الخدمة</h2>
              <p>يحق لك حذف حسابك في أي وقت. كما يحق لإدارة التطبيق تعليق أو إنهاء حساب أي مستخدم يخالف هذه الشروط.</p>
            </section>
          </div>

          <button onClick={onBack} className="btn-secondary w-full py-3">
            <ArrowLeft size={18} /> العودة
          </button>
        </div>
      </div>
    </div>
  );
}
