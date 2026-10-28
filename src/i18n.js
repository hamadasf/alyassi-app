// Interface language: Arabic (default) or English. The screens are written in Arabic; in English mode every piece of
// interface text is swapped for its English wording as it appears on screen (users' own content — titles, names,
// messages — is left as written: anything inside .notr is skipped).
const KEY = 'oay:lang';
let lang = 'ar';
try { lang = localStorage.getItem(KEY) === 'en' ? 'en' : 'ar'; } catch { /* ignore */ }
export const isEn = () => lang === 'en';
export const getLang = () => lang;
export function setLang(l) { try { localStorage.setItem(KEY, l); } catch { /* ignore */ } location.reload(); }
document.documentElement.lang = lang;
document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';

/* Arabic → English. Longer phrases are matched before shorter ones, whole words only. */
const EN = {
  // navigation & headers
  'الرئيسية': 'Home', 'الأراضي': 'Lands', 'المشاريع': 'Projects', 'المفضلة': 'Favourites', 'المحادثات': 'Chats', 'المزيد': 'More',
  'تواصل معنا': 'Contact us', 'آخر التحديثات': 'Latest updates', 'التحديثات': 'Updates', 'تفاصيل الأرض': 'Land details', 'المشروع': 'Project',
  'حسابي': 'My account', 'أضف أرضك': 'Add your land', 'لوحة الإدارة': 'Admin panel', 'إعلان': 'Listing', 'ملف المستخدم': 'User profile',
  'الملف': 'Profile', 'تعديل الملف': 'Edit profile', 'الإعدادات': 'Settings', 'إعدادات': 'Settings', 'خيارات الإشعارات': 'Notification options',
  'الاتصال بنا': 'Contact us', 'بحث محفوظ': 'Saved searches', 'توثيق حسابك': 'Verify your account', 'محادثة': 'Chat', 'رجوع': 'Back',
  'أراضٍ معروضة للبيع': 'Lands for sale', 'سياسة الخصوصية': 'Privacy policy', 'شروط الاستخدام': 'Terms of use',
  // home
  'أراضٍ ومشاريع في الشارقة بخطط سداد مرنة ومواقع استراتيجية': 'Lands and projects in Sharjah with flexible payment plans and strategic locations',
  'ابحث برقم القطعة أو اسم المشروع…': 'Search by plot number or project name…', 'أرض متاحة': 'Available lands', 'مشروع': 'Project', 'تم بيعها': 'Sold',
  'مشاريعنا': 'Our projects', 'عرض الكل': 'View all', 'أراضٍ مميزة': 'Featured lands', 'أفضل الأسعار': 'Best prices',
  'عروض لفترة محدودة': 'Limited-time offers', 'عرض لفترة محدودة': 'Limited-time offer', 'لا توجد أسعار معروضة حالياً': 'No prices listed right now',
  'عندك أرض للبيع؟': 'Have land for sale?', 'سجّل وأضف أرضك من التطبيق — تُعرض بعد موافقة الإدارة': 'Sign up and add your land in the app — shown after approval',
  'تعذّر الاتصال بالإنترنت': 'No internet connection', 'إعادة المحاولة': 'Try again', 'تعذّر التحديث — تُعرض آخر بيانات محفوظة': "Couldn't update — showing the last saved data",
  'ثبّت التطبيق على جوالك': 'Install the app on your phone', 'اضغط زر المشاركة': 'Tap the Share button', 'في الأسفل ثم «إضافة إلى الشاشة الرئيسية»': 'below, then «Add to Home Screen»',
  // lands & filters
  'رقم القطعة، المشروع، النوع…': 'Plot no., project, type…', 'الكل': 'All', 'الفلاتر': 'Filters', 'تصفية النتائج': 'Filter results', 'الحالة': 'Status',
  'كل الحالات': 'All statuses', 'كل المشاريع': 'All projects', 'الترتيب': 'Sort', 'المميزة أولاً': 'Featured first', 'السعر: الأقل أولاً': 'Price: low to high',
  'السعر: الأعلى أولاً': 'Price: high to low', 'المساحة: الأكبر أولاً': 'Area: largest first', 'المساحة: الأصغر أولاً': 'Area: smallest first',
  'المساحة من (قدم²)': 'Area from (ft²)', 'السعر من (د.إ)': 'Price from (AED)', 'إلى': 'to', 'أي مساحة': 'Any area', 'أي سعر': 'Any price',
  'مسح': 'Clear', 'عرض النتائج': 'Show results', 'حفظ هذا البحث': 'Save this search', 'مسح الفلاتر': 'Clear filters',
  'لا توجد أراضٍ تطابق البحث': 'No lands match your search', 'لم تضف أي أرض للمفضلة بعد': "You haven't added any land to favourites yet", 'تصفح الأراضي': 'Browse lands',
  'أرض': 'lands', 'متاحة': 'Available', 'محجوزة': 'Reserved', 'مباعة': 'Sold', 'متاح': 'Available', 'محجوز': 'Reserved', 'مباع': 'Sold',
  'مميزة': 'Featured', 'مميز': 'Featured', 'جديدة': 'New', 'سعر جديد': 'New price', 'سعر أقل': 'Lower price', 'تحديث': 'Update', 'عرض': 'Offer',
  'قطعة رقم': 'Plot No.', 'قطعة': 'Plot', 'تم البيع': 'Sold', 'السعر عند الاستفسار': 'Price on request', 'للاستفسار': 'On request', 'عند الاستفسار': 'on request',
  'د.إ': 'AED', 'درهم': 'AED', 'قدم²': 'ft²', 'م²': 'm²', 'دفعة أولى': 'Down payment', 'أقساط': 'instalments', 'اتصال': 'Call', 'واتساب': 'WhatsApp',
  'فلل': 'Villas', 'تجاري': 'Commercial', 'سكني': 'Residential', 'صناعي': 'Industrial', 'محلات': 'Shops', 'أخرى': 'Other', 'مكاتب': 'Offices',
  'تجاري سكني': 'Commercial residential', 'تجاري مكاتب سكني': 'Commercial, offices & residential', 'فلل سكنية استثمارية': 'Investment residential villas',
  'محلات تجارية': 'Commercial shops', 'سكني (فلل)': 'Residential (villas)', 'أرضي + اثنين': 'Ground + 2', 'أرضي + أول + نصف طابق': 'Ground + 1 + half floor',
  'أرضي فقط': 'Ground only', 'أرضي + ميزانين': 'Ground + mezzanine', 'زاوية': 'Corner', 'عادية': 'Regular', 'على الطريق الرئيسي': 'On the main road',
  'ينتهي خلال': 'Ends in', 'يوم': 'day', 'يومين': '2 days', 'أيام': 'days', 'يوماً': 'days', 'ساعة': 'hours', 'ساعات': 'hours', 'دقيقة': 'minutes', 'دقائق': 'minutes', 'و': 'and', 'انتهى العرض': 'Offer ended',
  'حتى': 'until', 'ينتهي العرض في': 'Offer ends on',
  // land page
  'الاستخدام': 'Use', 'المساحة': 'Area', 'الارتفاع': 'Height', 'الموقع': 'Location', 'الأبعاد': 'Dimensions', 'سعر القدم': 'Price per ft',
  'خطة السداد': 'Payment plan', 'الدفعة الأولى': 'Down payment', 'القسط': 'Instalment', 'الإجمالي': 'Total', 'كروكي القطعة': 'Plot sketch',
  'عرض القطعة على المخطط': 'Show plot on the plan', 'مخطط القطعة (PDF)': 'Plot plan (PDF)', 'مشاركة التفاصيل + مخطط الأرض PDF': 'Share details + land plan PDF',
  'موقع القطعة في مخطط المشروع · اضغط للتكبير': 'Plot location on the project plan · tap to enlarge', 'موقع القطعة في مخطط المشروع': 'Plot location on the project plan',
  'مفضلة': 'Favourite', 'مشاركة': 'Share', 'أضيفت إلى المفضلة': 'Added to favourites', 'أزيلت من المفضلة': 'Removed from favourites',
  // project page
  'افتح المخطط التفاعلي': 'Open the interactive plan', 'المخطط التفاعلي': 'Interactive plan', 'ملف المشروع PDF': 'Project file PDF', 'استفسر': 'Enquire',
  'الأنواع المتاحة': 'Available types', 'آخر تحديث للبيانات': 'Data last updated', 'الأراضي المتاحة (': 'Available lands (', 'لا توجد أراضٍ متاحة حالياً في هذا المشروع': 'No available lands in this project right now',
  'مشاركة المشروع PDF': 'Share project PDF',
  // sharing
  'مشاركة تفاصيل القطعة': 'Share plot details', 'بطاقة كاملة: التفاصيل، شروط التخطيط، السعر والدفعات مع تواريخها': 'A complete card: details, planning terms, price and payments with dates',
  '، ومخطط الأرض PDF': ', and the land plan PDF', 'في ملف واحد': 'in one file', 'جارِ تجهيز الملف…': 'Preparing the file…', 'إرسال البطاقة + المخطط PDF': 'Send card + plan PDF',
  'إرسال النص فقط': 'Send text only', 'البطاقة ومخطط الأرض جاهزان في ملف PDF واحد': 'The card and land plan are ready in one PDF',
  'البطاقة جاهزة (تعذّر إرفاق المخطط — سيُرسل رابطه)': "The card is ready (the plan couldn't be attached — its link will be sent)",
  'البطاقة جاهزة (لا يوجد مخطط PDF لهذه القطعة)': 'The card is ready (no PDF plan for this plot)', 'تعذّر تجهيز الملف — يمكنك إرسال النص': "Couldn't prepare the file — you can send the text",
  'تعذّر فتح المشاركة': "Couldn't open sharing", 'تم نسخ التفاصيل — الصقها في أي محادثة': 'Details copied — paste them into any chat',
  'تم نسخ التفاصيل كنص — الصقها في نفس المحادثة': 'Details copied as text — paste them into the same chat', 'مشاركة مشروع': 'Share project',
  'ملف المخطط الكامل PDF — نفس ملف «تحميل ملف المشروع» في الموقع، بالحالات والأرقام المحدّثة': 'The full plan PDF — the same file as the website’s «Download project file», with up-to-date statuses',
  'جارِ تجهيز ملف المشروع…': 'Preparing the project file…', 'إرسال ملف المشروع PDF': 'Send project PDF', 'ملف المشروع جاهز (': 'Project file ready (',
  'ملف المشروع غير متوفر الآن — يمكنك إرسال النص مع رابط المخطط': 'The project file is not available right now — you can send the text with the plan link',
  // updates & notifications
  'لا توجد تحديثات حالياً': 'No updates right now', 'ستظهر هنا أي تغييرات في الأسعار أو حالة الأراضي': 'Price and status changes will appear here',
  'أرض جديدة متاحة': 'New land available', 'فعّل إشعارات الأسعار': 'Turn on price alerts', 'تفعيل': 'Turn on',
  'يوصلك إشعار فوراً عند تغيّر سعر أو حالة أي أرض، أو نزول أرض جديدة': "You'll be notified instantly when a land's price or status changes, or a new land is listed",
  'على الآيفون: أضف التطبيق للشاشة الرئيسية من زر المشاركة، ثم افتحه من الأيقونة وفعّل الإشعارات': 'On iPhone: add the app to your Home Screen from the Share button, open it from the icon and turn on notifications',
  'الإشعارات مرفوضة — فعّلها من إعدادات المتصفح لهذا الموقع': 'Notifications are blocked — allow them in the browser settings for this site',
  'تم تفعيل الإشعارات ✓': 'Notifications turned on ✓', 'الإشعارات مرفوضة من إعدادات المتصفح': 'Notifications are blocked in the browser settings',
  'أضف التطبيق إلى الشاشة الرئيسية أولاً ثم فعّل الإشعارات': 'Add the app to your Home Screen first, then turn on notifications', 'لحظة… جارِ التحضير': 'One moment… getting ready',
  'إشعارات الأسعار والعروض': 'Price and offer alerts', 'تصلك إشعارات عند:': 'You get notified when:', 'تغيّر سعر أو حالة أي أرض': "A land's price or status changes",
  'نزول أرض جديدة على المخططات': 'A new land is listed on the plans', 'العروض لفترة محدودة': 'Limited-time offers',
  'الإشعارات مفعّلة على هذا الجهاز': 'Notifications are on for this device', 'الإشعارات مرفوضة من إعدادات الجهاز — فعّلها من الإعدادات': 'Notifications are blocked in the device settings — allow them there',
  'هذا الجهاز لا يدعم الإشعارات': "This device doesn't support notifications",
  // more tab
  'تسجيل الدخول / حساب جديد': 'Sign in / Create account', 'بالبريد الإلكتروني أو حساب جوجل': 'With email or a Google account', 'نشاطي': 'My activity',
  'عقاراتي': 'My properties', 'أضف أرضك للبيع': 'Add your land for sale', 'الحساب والإعدادات': 'Account & settings', 'الدعم': 'Support', 'من نحن': 'About us',
  'تسجيل الخروج': 'Sign out', 'باستخدامك تطبيق عمر الياسي للعقارات فأنت توافق على': 'By using the Omar Al Yassi Real Estate app you agree to the',
  'الإصدار': 'Version', 'سجّل الدخول': 'Sign in', 'موثّق': 'Verified', 'قيد المراجعة': 'Under review', 'English': 'العربية',
  'مدير': 'Admin', 'عضو': 'Member', 'مكتب عقاري موثّق': 'Verified real-estate office', 'نقطة': 'points', 'الجوال': 'Mobile', 'دخول بحساب جوجل': 'Google sign-in',
  'تغيير الصورة': 'Change photo', 'الاسم': 'Name', 'رقم الجوال': 'Mobile number', 'البريد الإلكتروني': 'Email', 'حفظ': 'Save', 'تم الحفظ ✓': 'Saved ✓',
  'تم تحديث الصورة ✓': 'Photo updated ✓', 'إعدادات الحساب': 'Account settings', 'المعلومات الأساسية': 'Basic information', 'حذف الحساب': 'Delete account',
  'الخصوصية': 'Privacy', 'حذف حسابك نهائياً؟ ستُحذف معه كل إعلاناتك ولا يمكن التراجع.': 'Delete your account permanently? All your listings will be deleted and this cannot be undone.',
  'تأكيد أخير: حذف الحساب الآن؟': 'Final confirmation: delete the account now?', 'تم حذف الحساب': 'Account deleted', 'تم تسجيل الخروج': 'Signed out',
  'هاتف المكتب': 'Office phone', 'العنوان': 'Address', 'الموقع الإلكتروني': 'Website', 'إنستغرام': 'Instagram', 'فيسبوك': 'Facebook', 'اتصل بنا': 'Call us',
  'عمر الياسي للعقارات': 'Omar Al Yassi Real Estate', 'الشارقة، شارع مليحة، مكتب رقم 2': 'Sharjah, Mleiha Street, Office No. 2',
  'نساعدك في اختيار الأرض المناسبة للتطوير أو الاستثمار في الشارقة، بخيارات تنافسية وخطط سداد مرنة.': 'We help you choose the right land to develop or invest in Sharjah, with competitive options and flexible payment plans.',
  'لا توجد عمليات بحث محفوظة': 'No saved searches', 'من «الأراضي» افتح الفلاتر واضغط «حفظ هذا البحث»': 'In «Lands», open the filters and tap «Save this search»',
  'تم حفظ البحث 🔖 — تجده في «المزيد ← بحث محفوظ»': 'Search saved 🔖 — find it in «More → Saved searches»', 'كل الأراضي المتاحة': 'All available lands',
  // accounts
  'حسابك في عمر الياسي للعقارات': 'Your Omar Al Yassi Real Estate account', 'سجّل لتضيف أرضك للبيع — تظهر في التطبيق بعد مراجعة وموافقة الإدارة': 'Sign up to add your land for sale — it appears in the app after review and approval',
  'أو بالبريد الإلكتروني': 'or with email', 'تسجيل الدخول': 'Sign in', 'حساب جديد': 'New account', 'كلمة المرور': 'Password', 'دخول': 'Sign in', 'إنشاء الحساب': 'Create account',
  'نسيت كلمة المرور؟': 'Forgot password?', 'المتابعة بحساب جوجل': 'Continue with Google', 'أهلاً': 'Welcome', 'اكتب بريدك الإلكتروني المسجّل:': 'Enter your registered email:',
  'أضف أرضاً للبيع': 'Add land for sale', 'طلباتي': 'My requests', 'جارِ التحميل…': 'Loading…', 'لم تضف أي أرض بعد.': "You haven't added any land yet.",
  'بانتظار الموافقة': 'Pending approval', 'معروضة': 'Listed', 'مرفوضة': 'Rejected', 'على المخطط': 'On the plan', 'السبب': 'Reason',
  'تمييز الإعلان': 'Feature listing', '(70 نقطة)': '(70 points)', 'تمييز الإعلانات متاح للمكاتب الموثّقة': 'Featuring is available to verified offices',
  'تمييز هذا الإعلان؟': 'Feature this listing?', 'تمييز هذا الإعلان مقابل 70 نقطة؟': 'Feature this listing for 70 points?', 'تم تمييز الإعلان ⭐': 'Listing featured ⭐',
  'توثيق حساب المكتب العقاري': 'Verify real-estate office account', 'نقاط غير محدودة للإدارة · تمييز الإعلان يجعله يظهر أولاً في الصفحة الرئيسية': 'Unlimited points for admins · featured listings show first on the home screen',
  'نقطة في رصيدك · تمييز الإعلان بـ 70 نقطة يجعله يظهر أولاً في الصفحة الرئيسية': 'points in your balance · featuring a listing for 70 points shows it first on the home screen',
  'تمييز الإعلانات متاح للمكاتب الموثّقة — وثّق حسابك واحصل على 500 نقطة': 'Featuring is for verified offices — verify your account and get 500 points',
  'نقطة في رصيدك · تمييز الإعلان بـ 70 نقطة': 'points in your balance · featuring a listing costs 70 points', 'سجّل الدخول أولاً لإضافة أرضك': 'Sign in first to add your land',
  // add land form
  'تُراجع الإدارة طلبك، وتظهر الأرض في التطبيق بعد الموافقة. إذا اخترت المشروع ورقم القطعة تظهر أيضاً على المخطط التفاعلي.': 'The office reviews your request and the land appears in the app after approval. If you choose the project and plot number it also appears on the interactive plan.',
  'عنوان الإعلان *': 'Listing title *', 'مثال: أرض سكنية زاوية في الرحمانية': 'e.g. Residential corner plot in Al Rahmaniya', '— خارج مخططات المشاريع —': '— Not in our project plans —',
  'المنطقة / المشروع (تصنيف)': 'Area / project (category)', '— اختر —': '— Choose —', 'رقم الأرض': 'Land number', 'نوع الأرض': 'Land type', 'المساحة (قدم²) *': 'Area (ft²) *',
  'السعر (درهم) *': 'Price (AED) *', 'الدفعة المقدمة': 'Down payment', 'عدد الأقساط': 'Number of instalments', 'نوع التصريح': 'Permit type', 'مثال: أرضي + اثنين': 'e.g. Ground + 2',
  'الموقع / الوصف المختصر للمكان': 'Location / short description', 'مثال: الشارقة، شارع مليحة': 'e.g. Sharjah, Mleiha Street', 'رابط الموقع على خرائط جوجل': 'Google Maps link',
  'تفاصيل إضافية': 'More details', 'رقم جوالك للتواصل': 'Your contact mobile', 'جوال صاحب الأرض': "Owner's mobile", 'صور الأرض (حتى 10) — الأولى صورة الغلاف': 'Land photos (up to 10) — the first is the cover',
  'إضافة صور': 'Add photos', 'الغلاف': 'Cover', 'إرسال للمراجعة': 'Send for review', 'حفظ التعديلات': 'Save changes', 'جارِ الإرسال…': 'Sending…', 'جارِ الحفظ…': 'Saving…',
  'رفع الصور': 'Uploading photos', 'تم إرسال الطلب ✓ سيظهر بعد موافقة الإدارة': 'Request sent ✓ it will appear after approval', 'تعذّر قراءة إحدى الصور': "Couldn't read one of the photos",
  'اكتب عنواناً للإعلان': 'Write a title for the listing', 'اكتب مساحة الأرض': 'Enter the land area', 'اكتب السعر': 'Enter the price',
  'هذا الرقم غير موجود في مخطط المشروع — تأكد من رقم القطعة': "This number isn't on the project plan — check the plot number", 'هذه القطعة معروضة على المخطط مسبقاً': 'This plot is already listed on the plan',
  'القطعة موجودة في المخطط': 'The plot is on the plan', 'تظهر عليه بعد الموافقة': 'it will show there after approval',
  // admin
  'الطلبات': 'Requests', 'المعروضة': 'Listed', 'المرفوضة': 'Rejected', 'التوثيق': 'Verification', 'المستخدمون': 'Users', 'ابحث بالاسم أو البريد…': 'Search by name or email…',
  'لا توجد إعلانات هنا.': 'No listings here.', 'لا يوجد مستخدمون.': 'No users.', 'موقوف': 'Suspended', 'نشط': 'Active', 'إعلان ·': 'listings ·', 'جوجل': 'Google',
  'صاحب الإعلان': 'Advertiser', 'جواله': 'Their mobile', 'رقم الأرض ': 'Land number', 'التاريخ': 'Date', 'سيُضاف عند الموافقة': 'Will be added on approval',
  'موافقة وعرض': 'Approve & list', 'رفض': 'Reject', 'إخفاء': 'Hide', 'إلغاء التمييز': 'Remove feature', 'تمييز': 'Feature', 'حذف': 'Delete', 'ملف صاحب الإعلان': "Advertiser's profile",
  'تعديل الإعلان': 'Edit listing', 'تمت الموافقة ✓': 'Approved ✓', 'تم': 'Done', 'تم إلغاء التمييز': 'Feature removed', 'تم حذف الإعلان': 'Listing deleted', 'تم حفظ التعديلات ✓': 'Changes saved ✓',
  'سبب الرفض (اختياري):': 'Reason for rejection (optional):', 'السبب (اختياري):': 'Reason (optional):', 'حذف هذا الإعلان نهائياً من التطبيق؟': 'Delete this listing from the app permanently?',
  'عضو منذ': 'Member since', 'دخول بجوجل': 'Google sign-in', 'نقطة · تمييز إعلان = 70 نقطة': 'points · featuring a listing = 70 points', 'نقطة (تمييز إعلان)': 'points (one feature)',
  'نقاط بعدد آخر': 'Other amount', 'إيقاف الحساب': 'Suspend account', 'رفع الإيقاف': 'Lift suspension', 'إعلاناته (': 'Their listings (', 'لا توجد إعلانات.': 'No listings.',
  'عدد النقاط (اكتب رقماً سالباً للخصم):': 'Number of points (negative to deduct):', 'تمت إضافة': 'Added', 'تم خصم': 'Deducted', 'تم إيقاف الحساب': 'Account suspended', 'تم رفع الإيقاف': 'Suspension lifted',
  'إيقاف هذا الحساب؟ يُسجَّل خروجه وتُخفى إعلاناته المعروضة.': 'Suspend this account? They will be signed out and their listings hidden.',
  'طلب التوثيق:': 'Verification request:', 'موثّق ✓': 'Verified ✓', 'مرفوض': 'Rejected', 'توثيق (+500 نقطة)': 'Verify (+500 points)', 'إلغاء التوثيق': 'Remove verification',
  'لا توجد طلبات توثيق.': 'No verification requests.', 'تم توثيق الحساب وإضافة 500 نقطة ✓': 'Account verified and 500 points added ✓', 'تم رفض الطلب': 'Request rejected',
  // verification
  'وثّق حسابك': 'Verify your account', 'خدمة مخصصة للمكاتب والشركات العقارية': 'A service for real-estate offices and companies', 'يرجى إدخال بياناتك أدناه': 'Please enter your details below',
  'اسم المكتب / الشركة العقارية': 'Office / real-estate company name', 'المدينة': 'City', 'اختر المدينة': 'Choose city', 'رقم الهاتف': 'Phone number', 'إرسال الطلب': 'Send request',
  'هذه الخدمة مجانية للمكاتب العقارية المرخّصة. بعد النقر على «إرسال الطلب» سيتصل بك أحد موظفينا لطلب نسخة من الرخصة التجارية. عند الموافقة تظهر علامة التوثيق على حسابك وتحصل على 500 نقطة لتمييز إعلاناتك.': 'This service is free for licensed real-estate offices. After you tap «Send request», a member of our staff will call you to ask for a copy of the trade licence. Once approved, your account shows the verification badge and you get 500 points to feature your listings.',
  'طلبك قيد المراجعة': 'Your request is under review', 'شكراً لكم، سيتواصل معكم أحد موظفينا في أقرب وقت.': 'Thank you, a member of our staff will contact you shortly.',
  'شكراً لكم، سيتواصل معكم أحد موظفينا في أقرب وقت': 'Thank you, a member of our staff will contact you shortly', 'المكتب / الشركة': 'Office / company', 'الهاتف': 'Phone',
  'حسابك موثّق': 'Your account is verified', 'تظهر علامة التوثيق على حسابك وإعلاناتك، ويمكنك تمييز إعلاناتك بالنقاط من «عقاراتي».': 'The verification badge shows on your account and listings, and you can feature your listings with points from «My properties».',
  'لم تتم الموافقة على الطلب السابق': 'The previous request was not approved',
  'الشارقة': 'Sharjah', 'دبي': 'Dubai', 'أبوظبي': 'Abu Dhabi', 'عجمان': 'Ajman', 'رأس الخيمة': 'Ras Al Khaimah', 'أم القيوين': 'Umm Al Quwain', 'الفجيرة': 'Fujairah', 'العين': 'Al Ain',
  // owner lands
  'للبيع': 'For sale', 'المشروع / المنطقة': 'Project / area', 'لا توجد أراضٍ معروضة حالياً': 'No lands listed right now', 'الموقع على الخريطة': 'Location on the map',
  'تواصل مع الإدارة بخصوص الإعلان': 'Contact the office about this listing', 'سجّل الدخول لمراسلة الإدارة بخصوص الإعلان': 'Sign in to message the office about this listing',
  // chats
  'نرد عليك في أقرب وقت': 'We reply as soon as possible', 'اكتب رسالة…': 'Write a message…', 'اكتب رسالتك وسيرد عليك فريق عمر الياسي للعقارات': 'Write your message and the Omar Al Yassi Real Estate team will reply',
  'لا توجد رسائل بعد': 'No messages yet', 'لا توجد محادثات بعد': 'No chats yet', 'سجّل الدخول لمراسلة فريق عمر الياسي للعقارات والاستفسار عن أي إعلان': 'Sign in to message the Omar Al Yassi Real Estate team about any listing',
  'بخصوص:': 'About:', 'أنت:': 'You:', 'إرسال رقم المعلن للعميل': "Send the advertiser's number to the client", 'المعلن:': 'Advertiser:', 'إرسال': 'Send',
  // notification settings & group
  'تفعيل الإشعارات': 'Turn on notifications', 'تلقي التنبيهات على جهازك': 'Receive alerts on your device', 'الإشعارات متوقفة على هذا الجهاز': 'Notifications are off on this device',
  'مرفوضة من إعدادات الجهاز — فعّلها من الإعدادات': 'Blocked in the device settings — allow them there', 'على الآيفون: أضف التطبيق للشاشة الرئيسية أولاً': 'On iPhone: add the app to your Home Screen first',
  'أعلمني عند تغيّر سعر أو حالة أي أرض، أو نزول أرض جديدة': "Notify me when a land's price or status changes, or a new land is listed", 'أعلمني بالعروض لفترة محدودة': 'Notify me about limited-time offers',
  'الرسائل الخاصة': 'Private messages', 'أعلمني عند استلام رسالة خاصة جديدة': 'Notify me when I get a new private message', 'أخبرني عندما أتلقى كل رسالة خاصة': 'Tell me about every private message',
  'المجموعة العامة': 'Public group', 'أعلمني بكل رسالة جديدة في المجموعة العامة': 'Notify me about every new message in the public group',
  'أعلمني عند وصول طلب عرض أرض أو طلب توثيق جديد': 'Notify me about new land or verification requests', 'أعلمني عند الموافقة على إعلاناتي أو رفضها، وعند توثيق حسابي': 'Notify me when my listings are approved or rejected, and when my account is verified',
  'سجّل الدخول لاختيار إشعارات الرسائل والطلبات': 'Sign in to choose message and request notifications', 'تم حفظ إعدادات الإشعارات ✓': 'Notification settings saved ✓',
  'سجّل الدخول لدخول المجموعة العامة ومراسلة فريق عمر الياسي للعقارات': 'Sign in to join the public group and message the Omar Al Yassi Real Estate team',
  'رسائل الأعضاء — لكل المسجّلين': "Members' messages — for everyone signed in", 'راسل الإدارة واستفسر عن أي إعلان': 'Message the office about any listing', 'رسائل خاصة': 'Private messages',
  'ابدأ محادثة …': 'Start a conversation …', 'أرقام الهواتف والروابط تُخفى تلقائياً — التواصل بين الأعضاء يتم عن طريق الإدارة': 'Phone numbers and links are hidden automatically — members get in touch through the office',
  'كن أول من يكتب في المجموعة': 'Be the first to write in the group', 'الإدارة': 'Office', 'رد على الخاص': 'Reply privately', 'نسخ': 'Copy', 'قراءة المزيد': 'Read more',
  'تم النسخ': 'Copied', 'تعذّر النسخ': "Couldn't copy", 'حذف هذه الرسالة من المجموعة؟': 'Delete this message from the group?',
  // server messages
  'محاولات كثيرة — حاول بعد قليل': 'Too many attempts — try again shortly', 'انتهت الجلسة — سجّل الدخول مرة أخرى': 'Session ended — please sign in again',
  'اكتب الاسم': 'Enter your name', 'البريد الإلكتروني غير صحيح': 'Invalid email address', 'كلمة المرور 8 أحرف على الأقل': 'Password must be at least 8 characters',
  'هذا البريد مسجّل من قبل — سجّل الدخول': 'This email is already registered — sign in', 'تعذّر إنشاء الحساب': "Couldn't create the account",
  'البريد أو كلمة المرور غير صحيحة': 'Incorrect email or password', 'هذا الحساب موقوف — تواصل مع الإدارة': 'This account is suspended — contact the office',
  'تسجيل الدخول بجوجل غير مفعّل بعد': 'Google sign-in is not enabled yet', 'تعذّر التحقق من حساب جوجل': "Couldn't verify the Google account",
  'إذا كان البريد مسجّلاً ستصلك رسالة لتعيين كلمة مرور جديدة': "If the email is registered you'll receive a message to set a new password",
  'لا يمكن حذف حساب إداري من التطبيق': "Admin accounts can't be deleted from the app", 'صورة غير صالحة': 'Invalid image', 'حجم الصورة كبير': 'Image is too large', 'تعذّر رفع الصورة': "Couldn't upload the image",
  'تعذّر حفظ الإعلان': "Couldn't save the listing", 'غير موجود': 'Not found', 'غير مسموح': 'Not allowed', 'الإعلان مميز بالفعل': 'The listing is already featured',
  'تمييز الإعلانات متاح للحسابات الموثّقة — وثّق حسابك من «المزيد ← توثيق حسابك»': 'Featuring is for verified accounts — verify yours from «More → Verify your account»',
  'حسابك موثّق بالفعل': 'Your account is already verified', 'اكتب اسم المكتب أو الشركة العقارية': 'Enter the office or company name', 'رقم الهاتف 9 أرقام ويبدأ بـ 5': 'The phone number is 9 digits starting with 5',
  'لا يمكن إيقاف حساب إداري': "Admin accounts can't be suspended", 'لا يوجد طلب توثيق لهذا الحساب': 'This account has no verification request', 'اكتب رسالة': 'Write a message', 'تعذّر الإرسال': "Couldn't send",
  'تعذّر الاتصال — تحقق من الإنترنت': "Couldn't connect — check your internet", 'حدث خطأ': 'Something went wrong', 'رقم القطعة غير موجود في مخطط المشروع': "The plot number isn't on the project plan",
  'أُضيفت على المخطط التفاعلي كمتاحة': 'Added to the interactive plan as available', 'القطعة معروضة مسبقاً على المخطط — لم تُغيَّر': 'The plot is already listed on the plan — not changed',
  'أُزيلت من المخطط التفاعلي': 'Removed from the interactive plan', 'تمييز الإعلان يحتاج': 'featuring needs', 'رصيدك': 'Your balance',
};

let re = null;
function build() {
  const keys = Object.keys(EN).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  try { re = new RegExp(`(?<![\\u0600-\\u06FF])(?:${keys.join('|')})(?![\\u0600-\\u06FF])`, 'g'); }
  catch { re = new RegExp(`(?:${keys.join('|')})`, 'g'); }   // older iPhones without look-behind
}
/** Translates one piece of interface text (no-op in Arabic). */
export function tr(s) {
  if (lang !== 'en' || !s || !/[؀-ۿ]/.test(s)) return s;
  const k = s.trim(); if (EN[k]) return s.replace(k, EN[k]);
  if (!re) build();
  return s.replace(re, (m) => EN[m] || m).replace(/ {2,}/g, ' ');
}

const SKIP = 'script,style,textarea,.notr,[contenteditable]';
function walk(root) {
  if (root.nodeType === 3) { if (!root.parentElement || !root.parentElement.closest(SKIP)) { const v = tr(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; } return; }
  if (root.nodeType !== 1 || root.closest('.notr')) return;
  for (const a of ['placeholder', 'aria-label', 'title']) { const v = root.getAttribute && root.getAttribute(a); if (v && /[؀-ۿ]/.test(v)) root.setAttribute(a, tr(v)); }
  if (root.matches(SKIP)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = tw.nextNode();
  while (n) {
    if (n.nodeType === 1) {
      if (!n.closest('.notr')) for (const a of ['placeholder', 'aria-label', 'title']) { const v = n.getAttribute(a); if (v && /[؀-ۿ]/.test(v)) n.setAttribute(a, tr(v)); }
      if (n.matches(SKIP)) { n = tw.nextSibling() || nextOut(tw); continue; }
      if (n.tagName === 'OPTION' && /[؀-ۿ]/.test(n.textContent)) { /* text node handled below */ }
    } else { const v = tr(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
    n = tw.nextNode();
  }
}
function nextOut(tw) { let p = tw.currentNode; while (p && !tw.nextSibling()) { p = tw.parentNode(); if (!p) return null; } return tw.currentNode; }

/** English mode: translate now and whenever the screens change; also dialogs. */
export function startI18n() {
  if (lang !== 'en') return;
  walk(document.body);
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') walk(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  const c = window.confirm.bind(window), p = window.prompt.bind(window);
  window.confirm = (s) => c(tr(s));
  window.prompt = (s, d) => p(tr(s), d);
}
