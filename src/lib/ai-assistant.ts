import type { Apartment, Booking, Location, GuestArchive } from '@/types';
import { formatDate, daysBetween, SOURCE_LABELS, STATUS_LABELS, isDepartureActive, todayISO } from '@/lib/utils';

export interface AIContext {
  apartments: Apartment[];
  locations: Location[];
  bookings: Booking[];
  archive?: GuestArchive[];
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}

export function generateAIResponse(query: string, ctx: AIContext): string {
  const q = normalize(query);
  const today = todayISO();

  if (!q) return 'اكتب سؤالك وسأساعدك فوراً. مثلاً: كم نسبة الإشغال؟ أو كم شقة متاحة؟';

  // --- Greetings ---
  if (/^(السلام|سلام|هاي|هلا|مرحبا|اهلا|صباح|مساء)/.test(q)) {
    return 'وعليكم السلام! أنا مساعدك الذكي في HICHAM STAY.\nاسألني عن أي شيء في التطبيق:\n• الإشغال والشقق والحجوزات\n• الوصولات والمغادرات\n• المزامنة و iCal\n• الإيرادات والأرشيف\n• الفريق والمناطق\n• كيفية استخدام أي قسم في التطبيق';
  }

  // --- Help / what can you do ---
  if (/^(مساعده|ساعدني|شلون|ايش|شنو|ماذا|كيف|وش|تقدر|تعرف|ممكن)/.test(q) && q.length < 25) {
    return 'أقدر أساعدك في كل شيء يخص التطبيق:\n\n🏠 الشقق: الحالة، الإشغال، المتاحة، الصيانة\n📅 الحجوزات: وصولات اليوم، المغادرات، تفاصيل حجز\n🔄 المزامنة: iCal، Airbnb، التقويم\n💰 الإيرادات: المحصّل، المتبقي، حسب المصدر\n👥 الفريق: الأدوار، الصلاحيات\n📦 الأرشيف: النزلاء السابقين\n🗺️ المناطق: توزيع الشقق\n📊 التقارير: يومي، شهري، شقة واحدة\n\nاكتب سؤالك مباشرةً!';
  }

  // --- App guide / how to use ---
  if (/(كيف|كيفيه|طريقة|طريقه|استخدام|استخدم|شرح|دليل|guide|وين|وين اجد|اين|فين)/.test(q)) {
    if (/(مزامنه|مزامنة|ical|اي كال|تقويم|airbnb|ايرب|sync)/.test(q)) {
      return 'كيفية المزامنة من التقويم (iCal):\n\n1️⃣ زر "تحديث من التقويم" في الأعلى: يزامن كل الشقق دفعة واحدة\n2️⃣ زر التحديث الصغير (↻) على كل شقة: يزامن شقة واحدة فقط\n3️⃣ داخل تقويم الشقة: زر "مزامنة هذه الشقة" يزامن من iCal\n\nملاحظات:\n• المزامنة تجلب الحجوزات من Airbnb عبر رابط iCal\n• إذا صار تعارض بين حجز Airbnb وحجز يدوي، يظهر تنبيه أصفر\n• يمكنك تصدير حجوزاتك إلى Airbnb عبر رابط iCal Export في إعدادات الشقة';
    }
    if (/(تقرير|report|تقارير)/.test(q)) {
      return 'أقسام التقارير في التطبيق:\n\n1️⃣ تقرير شقة — تفاصيل حجوزات شقة معينة\n2️⃣ التقرير الشهري — إحصائيات شهرية لكل الشقق\n3️⃣ التقرير اليومي — تقرير شامل (PDF) بحالات الشقق ونسبة الإشغال، قابل للمشاركة عبر واتساب\n\nتجدها كلها في قسم "التقارير" من القائمة.';
    }
    if (/( checkout|خروج|تسكين|checkout|check.?out|مغادرة)/.test(q)) {
      return 'قسم "تسكين الخروج":\n\n• يعرض الشقق التي لديها مغادرات قريبة\n• يمكنك تسكين الخروج (إنهاء الحجز) بضغطة زر\n• يحول الشقة إلى "غير جاهزة" بعد الخروج بانتظار التنظيف\n\nتجده في القائمة الرئيسية.';
    }
    if (/(ارشيف|أرشيف|archive|نزلاء|ضيوف سابق|سابقين)/.test(q)) {
      return 'قسم "أرشيف النزلاء":\n\n• يعرض كل النزلاء السابقين بعد انتهاء حجوزاتهم\n• يحتوي على بيانات الضيف، الشقة، تواريخ الحجز، والمصدر\n\nتجده في القائمة الرئيسية.';
    }
    if (/(فريق|team|اعضاء|أعضاء|موظف|موظفين|صلاحيات|ادوار|أدوار)/.test(q)) {
      return 'قسم "الفريق":\n\nالأدوار المتاحة:\n• مالك (Owner): صلاحيات كاملة بما فيها الإدارة والفريق\n• مضيف (Host): يدير الشقق والحجوزات بدون وصول للإدارة\n• عامل نظافة (Cleaner): يرى صفحة التنظيف فقط\n\nيمكن للمالك دعوة أعضاء جدد وإدارة أدوارهم.';
    }
    if (/(نظافه|نظافة|cleaning|cleaner|تنظيف)/.test(q)) {
      return 'قسم التنظيف:\n\n• عامل النظافة يرى الشقق التي تحتاج تنظيف بعد الخروج\n• يمكن تحديث حالة الشقة إلى "جاهزة" بعد الانتهاء\n• يوجد سجل نظافة (Cleaning Log) لتتبع عمليات التنظيف\n\nكل عامل نظافة يرى فقط ما يخصه.';
    }
    if (/(واتساب|whatsapp|حجز واتساب)/.test(q)) {
      return 'قسم "حجوزات واتساب":\n\n• يعرض الحجوزات القادمة من الواتساب\n• يمكنك إضافة حجوزات يدوية بمصدر "واتساب"\n• يوجد زر مراسلة الضيف مباشرة عبر واتساب';
    }
    if (/(اداره|إدارة|admin|لوحه|لوحة تحكم|اشتراك|activation)/.test(q)) {
      return 'قسم "الإدارة" (للمالك فقط):\n\n• إدارة الأكواد والاشتراكات\n• لوحة تحكم بإحصائيات النظام\n• إدارة المستخدمين\n\nيظهر فقط لحساب المالك.';
    }
    if (/(dashboard|الرئيسيه|الرئيسية|الاحصائ|إحصائ|الملخص)/.test(q)) {
      return 'الصفحة الرئيسية (Dashboard):\n\n• ملخص شامل: عدد الشقق، الإشغال، الإيرادات\n• مخططات بصرية للحجوزات\n• إحصائيات سريعة حسب المصدر\n\nتظهر تلقائياً عند فتح التطبيق.';
    }
    if (/(تقويم|calendar|calender|عرض شهري|شهر)/.test(q)) {
      return 'قسم "التقويم":\n\n• عرض شهري لكل الشقق مع الحجوزات\n• كل مصدر له لون مختلف (Airbnb أحمر، جذرن بنفسجي، واتساب أخضر)\n• اضغط على أي حجز لعرض تفاصيله أو تعديله';
    }
    if (/(جدول|work schedule|الشقق|شاشه الشقق|الشاشه الرئيس)/.test(q)) {
      return 'قسم "جدول العمل":\n\n• يعرض كل الشقق بشكل بطاقات صغيرة\n• كل بطاقة تظهر: الحالة، الضيف الحالي، تواريخ الحجز\n• أزرار سريعة: تحديث من التقويم، تسكين خروج، مراسلة واتساب\n• يمكن إعادة ترتيب الشقق بالسحب\n• أزرار التقارير: تقرير نظافة، التقارير العامة';
    }
    return 'استطيع شرح أي قسم في التطبيق:\n\n• كيف أزامن من التقويم؟\n• كيف أستخدم التقارير؟\n• كيف أستخدم تسكين الخروج؟\n• كيف أدير الفريق؟\n• كيف أستخدم الأرشيف؟\n• كيف أستخدم قسم التنظيف؟\n\nاكتب ما تريد معرفته!';
  }

  const activeBookings = ctx.bookings.filter((b) => !b.archived);
  const occupiedApts = ctx.apartments.filter((a) => a.status === 'occupied');
  const readyApts = ctx.apartments.filter((a) => a.status === 'ready');
  const notReadyApts = ctx.apartments.filter((a) => a.status === 'not_ready');
  const maintenanceApts = ctx.apartments.filter((a) => a.status === 'maintenance');
  const totalApts = ctx.apartments.length;
  const occupancyRate = totalApts > 0 ? (occupiedApts.length / totalApts) * 100 : 0;

  // --- Sync / iCal info ---
  if (/(مزامنه|مزامنة|ical|اي كال|تقويم|sync|airbnb|ايرب|تحديث|محدث)/.test(q) && !/(وصول|خروج|مغادره)/.test(q)) {
    const withIcal = ctx.apartments.filter((a) => a.ical_url);
    const withoutIcal = ctx.apartments.filter((a) => !a.ical_url);
    const airbnbBookings = activeBookings.filter((b) => b.source === 'airbnb');
    const syncedBookings = activeBookings.filter((b) => b.external_uid);
    const lines: string[] = [];
    lines.push('🔄 حالة المزامنة:');
    lines.push(`شقق مرتبطة بـ iCal: ${withIcal.length} من ${totalApts}`);
    if (withoutIcal.length > 0) {
      lines.push(`غير مرتبطة: ${withoutIcal.map((a) => a.apt_number ?? a.name).join('، ')}`);
    }
    lines.push(`حجوزات Airbnb نشطة: ${airbnbBookings.length}`);
    lines.push(`حجوزات تمت مزامنتها: ${syncedBookings.length}`);
    lines.push('');
    lines.push('للمزامنة:');
    lines.push('• زر "تحديث من التقويم" بالأعلى = كل الشقق');
    lines.push('• زر ↻ على كل شقة = شقة واحدة فقط');
    lines.push('• داخل تقويم الشقة = زر "مزامنة هذه الشقة"');
    return lines.join('\n');
  }

  // --- Occupancy rate ---
  if (/(نسبه|اشغال|مشغول)/.test(q)) {
    const lines: string[] = [];
    lines.push(`نسبة الإشغال الحالية: ${occupancyRate.toFixed(1)}%`);
    lines.push(`مشغولة: ${occupiedApts.length} من ${totalApts} شقة`);
    lines.push(`جاهزة: ${readyApts.length} | غير جاهزة: ${notReadyApts.length} | صيانة: ${maintenanceApts.length}`);
    return lines.join('\n');
  }

  // --- Available / ready apartments ---
  if (/(متاح|متاحه|شاغر|شاغره|فاضي|فاضيه|جاهز|جاهزه|فراغ|فراغه|available)/.test(q)) {
    if (readyApts.length === 0) {
      return 'لا توجد شقق جاهزة حالياً. جميع الشقق إما مشغولة أو غير جاهزة أو في الصيانة.';
    }
    const lines: string[] = [`الشقق الجاهزة (${readyApts.length}):`];
    readyApts.forEach((a) => {
      const loc = a.location?.name ?? 'بدون موقع';
      lines.push(`• ${a.apt_number ?? a.name} — ${loc}`);
    });
    return lines.join('\n');
  }

  // --- Today arrivals / check-ins ---
  if (/(وصول|وصولات|دخول|نزلاء|ضيوف|check.?in|قادم|قادمه|الي)/.test(q)) {
    const todayArrivals = activeBookings.filter((b) => b.check_in === today);
    if (todayArrivals.length === 0) {
      return 'لا توجد وصولات (check-in) اليوم.';
    }
    const lines: string[] = [`وصولات اليوم (${todayArrivals.length}):`];
    todayArrivals.forEach((b) => {
      const apt = ctx.apartments.find((a) => a.id === b.apartment_id);
      lines.push(`• ${b.guest_name} — شقة ${apt?.apt_number ?? apt?.name ?? '—'} | خروج: ${formatDate(b.check_out)} | ${SOURCE_LABELS[b.source] ?? b.source}`);
    });
    return lines.join('\n');
  }

  // --- Today departures / check-outs ---
  if (/(خروج|مغادره|مغادرة|check.?out|طلاع|يطلع)/.test(q)) {
    const departures = activeBookings.filter((b) => {
      const apt = ctx.apartments.find((a) => a.id === b.apartment_id);
      return apt?.current_booking && isDepartureActive(apt.current_booking.check_out);
    });
    if (departures.length === 0) {
      return 'لا توجد مغادرات قريبة حالياً.';
    }
    const lines: string[] = [`المغادرات القريبة (${departures.length}):`];
    departures.forEach((b) => {
      const apt = ctx.apartments.find((a) => a.id === b.apartment_id);
      lines.push(`• ${b.guest_name} — شقة ${apt?.apt_number ?? apt?.name ?? '—'} | خروج: ${formatDate(b.check_out)}`);
    });
    return lines.join('\n');
  }

  // --- Stats / summary ---
  if (/(احصائ|احصاء|ملخص|تقرير|كم|عدد|كام|وضع|حاله|حالة|summary|stats)/.test(q)) {
    const airbnbCount = activeBookings.filter((b) => b.source === 'airbnb').length;
    const whatsappCount = activeBookings.filter((b) => b.source === 'whatsapp').length;
    const gathernCount = activeBookings.filter((b) => b.source === 'gathern').length;
    const directCount = activeBookings.filter((b) => b.source === 'direct').length;
    const lines: string[] = [];
    lines.push('📊 ملخص الحالة:');
    lines.push(`إجمالي الشقق: ${totalApts}`);
    lines.push(`مشغولة: ${occupiedApts.length} (${occupancyRate.toFixed(1)}%)`);
    lines.push(`جاهزة: ${readyApts.length}`);
    lines.push(`غير جاهزة: ${notReadyApts.length}`);
    lines.push(`صيانة: ${maintenanceApts.length}`);
    lines.push(`الحجوزات النشطة: ${activeBookings.length}`);
    lines.push(`Airbnb: ${airbnbCount} | واتساب: ${whatsappCount} | جذرن: ${gathernCount} | مباشر: ${directCount}`);
    if (ctx.archive && ctx.archive.length > 0) {
      lines.push(`النزلاء المؤرشفون: ${ctx.archive.length}`);
    }
    return lines.join('\n');
  }

  // --- Locations ---
  if (/(منطقه|منطقة|موقع|مواقع|اماكن|أماكن|location)/.test(q)) {
    if (ctx.locations.length === 0) return 'لا توجد مناطق مسجلة.';
    const lines: string[] = [`المناطق (${ctx.locations.length}):`];
    ctx.locations.forEach((loc) => {
      const aptCount = ctx.apartments.filter((a) => a.location_id === loc.id).length;
      const occupiedCount = ctx.apartments.filter((a) => a.location_id === loc.id && a.status === 'occupied').length;
      lines.push(`• ${loc.name}: ${aptCount} شقة (${occupiedCount} مشغولة)`);
    });
    return lines.join('\n');
  }

  // --- Maintenance ---
  if (/(صيانه|صيانة|عطل|مكسور|مشكله|مشكلة|maintenance)/.test(q)) {
    if (maintenanceApts.length === 0) return 'لا توجد شقق في الصيانة حالياً.';
    const lines: string[] = [`شقق في الصيانة (${maintenanceApts.length}):`];
    maintenanceApts.forEach((a) => {
      lines.push(`• ${a.apt_number ?? a.name} — ${a.maintenance_note ?? 'بدون ملاحظات'}`);
    });
    return lines.join('\n');
  }

  // --- Not ready ---
  if (/(غير جاهز|غير جاهزه|مش جاهز|مش جاهزه|not.?ready)/.test(q)) {
    if (notReadyApts.length === 0) return 'لا توجد شقق "غير جاهزة" حالياً.';
    const lines: string[] = [`شقق غير جاهزة (${notReadyApts.length}):`];
    notReadyApts.forEach((a) => {
      const loc = a.location?.name ?? '—';
      lines.push(`• ${a.apt_number ?? a.name} — ${loc}`);
    });
    lines.push('\nيحتاج تنظيف أو تجهيز قبل أن تصبح جاهزة.');
    return lines.join('\n');
  }

  // --- Archive / past guests ---
  if (/(ارشيف|أرشيف|archive|نزلاء|ضيوف سابق|سابقين|قديم|قدامى)/.test(q) && ctx.archive) {
    if (ctx.archive.length === 0) return 'لا يوجد نزلاء في الأرشيف حالياً.';
    const recent = ctx.archive.slice(-10).reverse();
    const lines: string[] = [`آخر النزلاء المؤرشفين (${ctx.archive.length} إجمالي):`];
    recent.forEach((g) => {
      lines.push(`• ${g.guest_name} — شقة ${g.apartment?.name ?? '—'} | ${g.check_in ? formatDate(g.check_in) : '—'} ← ${g.check_out ? formatDate(g.check_out) : '—'}`);
    });
    return lines.join('\n');
  }

  // --- Revenue ---
  if (/(ايراد|إيراد|دخل|مبلغ|ريال|ر\.س|فلوس|price|revenue|متبقي|محصل|دفع)/.test(q)) {
    let totalRevenue = 0;
    let totalBalance = 0;
    activeBookings.forEach((b) => {
      totalRevenue += b.total_price ?? 0;
      totalBalance += b.balance;
    });
    const collected = totalRevenue - totalBalance;
    const lines: string[] = [];
    lines.push(`💰 الإيرادات (الحجوزات النشطة):`);
    lines.push(`إجمالي: ${totalRevenue.toLocaleString()} ر.س`);
    lines.push(`المحصّل: ${collected.toLocaleString()} ر.س`);
    lines.push(`المتبقي: ${totalBalance.toLocaleString()} ر.س`);
    if (totalBalance > 0) {
      const unpaidApts = activeBookings.filter((b) => b.balance > 0);
      lines.push(`\nشقق عليها مبالغ متبقية (${unpaidApts.length}):`);
      unpaidApts.slice(0, 10).forEach((b) => {
        const apt = ctx.apartments.find((a) => a.id === b.apartment_id);
        lines.push(`• ${apt?.apt_number ?? apt?.name ?? '—'} — ${b.guest_name}: متبقي ${b.balance.toLocaleString()} ر.س`);
      });
    }
    return lines.join('\n');
  }

  // --- Search for specific apartment by number/name ---
  const aptMatch = ctx.apartments.find((a) => {
    const name = normalize(a.apt_number ?? a.name);
    const fullName = normalize(a.name);
    return q.includes(name) || q.includes(fullName) || name.includes(q) || fullName.includes(q);
  });

  if (aptMatch) {
    const lines: string[] = [];
    lines.push(`🏠 شقة ${aptMatch.apt_number ?? aptMatch.name}:`);
    lines.push(`الحالة: ${STATUS_LABELS[aptMatch.status]}`);
    if (aptMatch.location) lines.push(`الموقع: ${aptMatch.location.name}`);
    lines.push(`مربوطة بـ iCal: ${aptMatch.ical_url ? 'نعم' : 'لا'}`);
    if (aptMatch.airbnb_listing_id) lines.push(`Airbnb Listing: ${aptMatch.airbnb_listing_id}`);
    if (aptMatch.maintenance_note) lines.push(`ملاحظة: ${aptMatch.maintenance_note}`);
    if (aptMatch.current_booking) {
      const b = aptMatch.current_booking;
      const nights = daysBetween(b.check_in, b.check_out);
      lines.push('');
      lines.push(`👤 الحجز الحالي:`);
      lines.push(`الضيف: ${b.guest_name}`);
      lines.push(`الدخول: ${formatDate(b.check_in)} | الخروج: ${formatDate(b.check_out)}`);
      lines.push(`المدة: ${nights} ليلة`);
      lines.push(`المصدر: ${SOURCE_LABELS[b.source] ?? b.source}`);
      if (b.external_uid) lines.push(`مزامنة: نعم (من التقويم)`);
      if (b.total_price != null) lines.push(`السعر: ${b.total_price.toLocaleString()} ر.س`);
      if (b.balance > 0) lines.push(`المتبقي: ${b.balance.toLocaleString()} ر.س`);
      if (b.guest_phone) lines.push(`الهاتف: ${b.guest_phone}`);
    } else {
      lines.push('لا يوجد حجز حالي.');
    }
    return lines.join('\n');
  }

  // --- Search for guest by name ---
  const guestMatch = activeBookings.find((b) => {
    const name = normalize(b.guest_name);
    return q.includes(name) || name.includes(q);
  });

  if (guestMatch) {
    const apt = ctx.apartments.find((a) => a.id === guestMatch.apartment_id);
    const nights = daysBetween(guestMatch.check_in, guestMatch.check_out);
    const lines: string[] = [];
    lines.push(`👤 الضيف: ${guestMatch.guest_name}`);
    lines.push(`شقة: ${apt?.apt_number ?? apt?.name ?? '—'}`);
    lines.push(`الدخول: ${formatDate(guestMatch.check_in)} | الخروج: ${formatDate(guestMatch.check_out)}`);
    lines.push(`المدة: ${nights} ليلة | المصدر: ${SOURCE_LABELS[guestMatch.source] ?? guestMatch.source}`);
    if (guestMatch.external_uid) lines.push(`مزامنة: نعم (من التقويم)`);
    if (guestMatch.guest_phone) lines.push(`الهاتف: ${guestMatch.guest_phone}`);
    if (guestMatch.total_price != null) lines.push(`السعر: ${guestMatch.total_price.toLocaleString()} ر.س | متبقي: ${guestMatch.balance.toLocaleString()} ر.س`);
    return lines.join('\n');
  }

  // --- Source-based queries ---
  if (/(airbnb|ايرب)/.test(q)) {
    const airbnbBookings = activeBookings.filter((b) => b.source === 'airbnb');
    const synced = airbnbBookings.filter((b) => b.external_uid);
    const lines: string[] = [];
    lines.push(`حجوزات Airbnb النشطة: ${airbnbBookings.length} حجز`);
    lines.push(`مزامنة من التقويم: ${synced.length} | يدوية: ${airbnbBookings.length - synced.length}`);
    const airbnbApts = ctx.apartments.filter((a) => a.ical_url);
    lines.push(`شقق مربوطة بـ iCal: ${airbnbApts.length}`);
    return lines.join('\n');
  }
  if (/(واتساب|whatsapp)/.test(q)) {
    const waBookings = activeBookings.filter((b) => b.source === 'whatsapp');
    return `حجوزات الواتساب النشطة: ${waBookings.length} حجز`;
  }
  if (/(جذرن|gathern)/.test(q)) {
    const gBookings = activeBookings.filter((b) => b.source === 'gathern');
    return `حجوزات جذرن النشطة: ${gBookings.length} حجز`;
  }

  // --- Tomorrow ---
  if (/(بكره|بكرة|غدا|غدًا|tomorrow)/.test(q)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const arrivals = activeBookings.filter((b) => b.check_in === tomorrowStr);
    const departures = activeBookings.filter((b) => b.check_out === tomorrowStr);
    const lines: string[] = [];
    lines.push(`📅 غداً ${formatDate(tomorrowStr)}:`);
    lines.push(`وصولات: ${arrivals.length}`);
    arrivals.forEach((b) => {
      const apt = ctx.apartments.find((a) => a.id === b.apartment_id);
      lines.push(`  • ${b.guest_name} — شقة ${apt?.apt_number ?? apt?.name ?? '—'}`);
    });
    lines.push(`مغادرات: ${departures.length}`);
    departures.forEach((b) => {
      const apt = ctx.apartments.find((a) => a.id === b.apartment_id);
      lines.push(`  • ${b.guest_name} — شقة ${apt?.apt_number ?? apt?.name ?? '—'}`);
    });
    if (arrivals.length === 0 && departures.length === 0) lines.push('لا يوجد وصولات أو مغادرات غداً.');
    return lines.join('\n');
  }

  // --- This week ---
  if (/(هذا الاسبوع|الاسبوع|هذا الأسبوع|الأسبوع|this week)/.test(q)) {
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const arrivals = activeBookings.filter((b) => b.check_in >= today && b.check_in <= weekEndStr);
    const departures = activeBookings.filter((b) => b.check_out >= today && b.check_out <= weekEndStr);
    const lines: string[] = [];
    lines.push(`📅 هذا الأسبوع (${formatDate(today)} → ${formatDate(weekEndStr)}):`);
    lines.push(`وصولات: ${arrivals.length}`);
    arrivals.forEach((b) => {
      const apt = ctx.apartments.find((a) => a.id === b.apartment_id);
      lines.push(`  • ${formatDate(b.check_in)} — ${b.guest_name} (شقة ${apt?.apt_number ?? apt?.name ?? '—'})`);
    });
    lines.push(`مغادرات: ${departures.length}`);
    departures.forEach((b) => {
      const apt = ctx.apartments.find((a) => a.id === b.apartment_id);
      lines.push(`  • ${formatDate(b.check_out)} — ${b.guest_name} (شقة ${apt?.apt_number ?? apt?.name ?? '—'})`);
    });
    return lines.join('\n');
  }

  // --- Team / roles ---
  if (/(فريق|team|اعضاء|أعضاء|موظف|موظفين|صلاحيات|ادوار|أدوار|owner|host|cleaner|مالك|مضيف|عامل)/.test(q)) {
    return '👥 أدوار الفريق في التطبيق:\n\n• مالك (Owner): صلاحيات كاملة — الإدارة، الفريق، التقارير، كل شيء\n• مضيف (Host): إدارة الشقق والحجوزات بدون وصول للإدارة أو الفريق\n• عامل نظافة (Cleaner): يرى صفحة التنظيف فقط ويحدّث حالة الشقق بعد التنظيف\n\nلإدارة الفريق: اذهب لقسم "الفريق" (للمالك فقط).';
  }

  // --- Reports ---
  if (/(تقرير يومي|daily report|تقرير pdf|بي دي اف|pdf)/.test(q)) {
    return '📄 التقرير اليومي:\n\n• يعرض كل الشقق بألوان حالاتها (مشغولة/جاهزة/غير جاهزة/صيانة)\n• نسبة الإشغال بشكل بارز\n• وصولات اليوم\n• يُصدّر كملف PDF احترافي\n• يمكن مشاركته عبر واتساب مباشرة\n\nتجده في قسم "التقارير" ← تبويب "يومي"';
  }

  // --- Default fallback ---
  const suggestions = [
    'كم نسبة الإشغال؟',
    'كم شقة جاهزة؟',
    'وصولات اليوم',
    'المغادرات القريبة',
    'ملخص الحالة',
    'حالة المزامنة',
    'الشقق في الصيانة',
    'إيرادات الحجوزات',
    'ماذا يحدث غداً؟',
    'كيف أزامن من التقويم؟',
  ];
  return `لم أفهم سؤالك تماماً. جرب أحد هذه:\n\n${suggestions.map((s) => '• ' + s).join('\n')}\n\nأو اكتب اسم شقة أو ضيف للبحث عنه.`;
}
