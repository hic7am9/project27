import { ArrowLeft } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export function Privacy({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-950">
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 animate-fade-in" dir="rtl">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">سياسة الخصوصية</h1>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <p>آخر تحديث: نوفمبر 2026</p>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">1. جمع البيانات</h2>
              <p>يجمع التطبيق البيانات التالية عند إنشاء حساب: الاسم، البريد الإلكتروني، وكلمة المرور (مشفّرة). كما يخزّن البيانات التي تدخلها في التطبيق مثل بيانات العقارات والحجوزات والضيوف والمدفوعات.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">2. عزل بيانات المستخدمين</h2>
              <p>كل مستخدم لديه بيانات معزولة بالكامل عن المستخدمين الآخرين. لا يستطيع أي مستخدم رؤية أو الوصول إلى بيانات مستخدم آخر، بما في ذلك المشرف. المشرف يرى فقط معلومات الحساب العامة (الاسم، البريد، تاريخ الاشتراك) وعدد العقارات لكل مشترك، دون أي تفاصيل عن العقارات أو الضيوف أو المدفوعات.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">3. استخدام البيانات</h2>
              <p>تُستخدم بياناتك حصريًا لتشغيل التطبيق وعرض بياناتك لك. لا يتم بيع بياناتك أو مشاركتها مع أطراف ثالثة لأغراض تسويقية.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">4. تخزين البيانات وأمانها</h2>
              <p>تُخزَّن بياناتك في قاعدة بيانات مؤمَّنة مع تفعيل حماية صفوف مستوى الأمان (Row Level Security). كلمات المرور مشفّرة ولا يمكن لأحد رؤيتها. تُحفظ الملفات والصور في مجلدات معزولة لكل مستخدم مع سياسات تمنع الوصول لملفات الآخرين.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">5. مزامنة Airbnb (iCal)</h2>
              <p>عند ربط شقة برابط iCal من Airbnb، يقوم التطبيق بمزامنة الحجوزات من Airbnb بشكل دوري. تُستخدم رابط iCal فقط لجلب بيانات الحجز (التاريخ وحالة الحجز) ولا تُشارك بياناتك مع Airbnb عبر التطبيق.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">6. الواتساب</h2>
              <p>يوفّر التطبيق قوالب رسائل واتساب لتسهيل التواصل مع الضيوف وفريق التنظيف. هذه القوالب تُرسل عبر تطبيق الواتساب على جهازك مباشرة، ولا يخزّن التطبيق محتوى المحادثات.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">7. النسخ الاحتياطي</h2>
              <p>يوفّر التطبيق ميزة تصدير واستيراد البيانات. النسخة الاحتياطية تُحفظ على جهازك أنت، وتتحمّل مسؤولية الحفاظ عليها.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">8. حقوق المستخدم</h2>
              <p>لك الحق في الوصول إلى بياناتك وتعديلها وحذفها. يمكنك حذف حسابك في أي وقت، مما سيؤدي إلى حذف جميع بياناتك المرتبطة به.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">9. ملفات الارتباط (Cookies)</h2>
              <p>يستخدم التطبيق التخزين المحلي (localStorage) لحفظ تفضيلاتك مثل اللغة والوضع الداكن. لا يستخدم ملفات ارتباط تتبعية.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">10. التواصل</h2>
              <p>لأي استفسار يتعلق بالخصوصية، يمكنك التواصل مع الدعم الفني من خلال القائمة داخل التطبيق.</p>
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
