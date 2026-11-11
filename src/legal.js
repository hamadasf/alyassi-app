// Privacy policy, terms of use and account deletion — shown in the app and published as web pages next to the web app
// (privacy.html · terms.html · delete-account.html) for Google Play's «Privacy policy» and «Delete account» links.
// Plain data only (no browser code), so the web build can import it too.

export const UPDATED = { ar: '11 نوفمبر 2026', en: '11 November 2026' };
const CO = { phone: '06 744 2027', tel: '+97167442027', mail: 'omaralyassi.realestate@gmail.com', ig: 'omaralyassi.uae3', addr: 'الشارقة – شارع مليحة، مكتب رقم 2، الإمارات العربية المتحدة', addrEn: 'Office 2, Maliha Road, Sharjah, United Arab Emirates' };
export const DELETE_URL = 'https://hamadasf.github.io/alyassi-app/delete-account.html';

const privacyAr = `
<p class="upd">آخر تحديث: ${UPDATED.ar}</p>
<p>تطبيق «عمر الياسي للعقارات» وموقع omaralyassirealestate.com تديرهما شركة <b>عمر الياسي للعقارات</b>، ${CO.addr} («نحن»). نحترم خصوصيتك، وتوضح هذه السياسة البيانات التي نجمعها، ولماذا، ومع من نشاركها، وكيف تتحكم بها وتحذفها.</p>

<h3>1. البيانات التي نجمعها</h3>
<ul>
<li><b>بيانات الحساب:</b> الاسم، البريد الإلكتروني، رقم الجوال، ونوع الحساب (فردي أو شركة / مكتب عقاري) واسم الشركة. كلمة المرور تُحفظ مشفّرة ولا يمكننا قراءتها. عند الدخول بحساب جوجل نستلم الاسم والبريد وصورة الحساب التي يشاركها جوجل فقط.</li>
<li><b>التحقق من البريد:</b> كود من 6 أرقام يُرسل لبريدك عند التسجيل، ويُحذف بعد استخدامه أو خلال 15 دقيقة.</li>
<li><b>صورتك الشخصية وشعار الشركة:</b> ترسلها لتظهر على إعلاناتك، ولا تُعرض إلا بعد اعتماد الإدارة. شعار الشركة يُطلب من الشركات والمكاتب فقط.</li>
<li><b>توثيق المكاتب العقارية:</b> اسم المكتب والمدينة واسم المسؤول ورقم الهاتف.</li>
<li><b>المحتوى الذي تضيفه:</b> إعلانات الأراضي وتفاصيلها وصورها، طلبات «مطلوب أرض»، تنبيهات «أرض تناسبني»، التقييمات.</li>
<li><b>المحادثات:</b> رسائلك الخاصة مع الشركة والصور والملفات المرفقة، ورسائلك في «المجموعة العامة».</li>
<li><b>طلبات التواصل والمعاينة:</b> الاسم ورقم الجوال والرسالة والموعد الذي تختاره.</li>
<li><b>بيانات الاستخدام:</b> معرّف عشوائي للجهاز يُنشأ داخل التطبيق، والإعلانات والمشاريع التي تفتحها، وضغطات الاتصال والواتساب والمشاركة. نستخدمها في إحصائيات مجمّعة واقتراح أراضٍ تناسبك. <b>لا نجمع موقعك الجغرافي</b>، ولا جهات الاتصال، ولا أي بيانات من تطبيقات أخرى.</li>
<li><b>الإشعارات:</b> عند تفعيلها يُنشأ معرّف للجهاز لدى خدمة OneSignal لإرسال الإشعارات إليه، مع اختياراتك (الأسعار، العروض، الأخبار).</li>
<li><b>على جهازك فقط:</b> المفضلة، عمليات البحث المحفوظة، اللغة والإعدادات — لا تصلنا.</li>
</ul>

<h3>2. كيف نستخدم البيانات</h3>
<ul>
<li>إنشاء حسابك وتشغيله، والتحقق من بريدك، ومراجعة إعلاناتك وصورك واعتمادها وعرضها.</li>
<li>الرد على استفساراتك وطلبات الاتصال وحجز المعاينات، ومتابعتك بخصوص الأراضي التي تهمك.</li>
<li>إرسال الإشعارات التي تختارها، وتنبيهات «أرض تناسبني».</li>
<li>إرسال رسالة بريد أسبوعية «أراضٍ مختارة لك» بأراضٍ متاحة تناسب اهتماماتك. يمكنك إيقافها في أي وقت من «إعدادات الإشعارات» أو من رابط إلغاء الاشتراك في كل رسالة.</li>
<li>عرض إحصائيات مجمّعة للمعلنين عن إعلاناتهم (عدد المشاهدات والاتصالات) دون أي بيانات تعرّف بالأشخاص.</li>
<li>حماية المستخدمين ومنع الاحتيال والإساءة — مثلاً يُمنع نشر أرقام الهواتف داخل المحادثات.</li>
<li>تحسين التطبيق وإصلاح الأعطال.</li>
</ul>

<h3>3. مع من نشارك البيانات</h3>
<p><b>لا نبيع بياناتك، ولا نشاركها مع أي جهة لأغراض تسويقية خاصة بها.</b> نشارك فقط ما يلزم مع:</p>
<ul>
<li><b>مزودي خدمات يعملون لصالحنا:</b> استضافة الموقع والخوادم، OneSignal (الإشعارات)، Google (تسجيل الدخول بجوجل)، وGitHub (استضافة ملفات التطبيق وصور الإعلانات العامة). هؤلاء يعالجون البيانات لتقديم الخدمة فقط.</li>
<li><b>ما يظهر للعامة داخل التطبيق والموقع:</b> الإعلانات المعتمدة وصورها، واسم المعلن وصورته وشعار شركته بعد الاعتماد، وتقييمات المعلنين، ورسائلك في «المجموعة العامة» تظهر لباقي الأعضاء باسمك. <b>رقم جوالك لا يظهر</b> للمستخدمين الآخرين؛ التواصل حول الإعلانات يتم عبر الشركة.</li>
<li><b>موظفو الشركة المخوّلون:</b> حسب صلاحيات كل موظف، لخدمتك فقط.</li>
<li><b>الجهات الرسمية:</b> عند وجود طلب قانوني ملزم.</li>
</ul>

<h3>4. مدة الاحتفاظ</h3>
<p>نحتفظ ببيانات حسابك طوال بقاء الحساب. عند حذف الحساب تُحذف بياناته وإعلاناته وصوره خلال 30 يوماً كحد أقصى، إلا ما يلزمنا القانون بالاحتفاظ به. بيانات الاستخدام تُحفظ بشكل مجمّع لفترة محدودة لأغراض الإحصاء.</p>

<h3>5. حقوقك</h3>
<p>وفقاً للتشريعات المعمول بها في دولة الإمارات العربية المتحدة، ومنها المرسوم بقانون اتحادي رقم 45 لسنة 2021 بشأن حماية البيانات الشخصية، يحق لك: الاطلاع على بياناتك، وتصحيحها من «تعديل الملف»، وطلب حذفها، والاعتراض على الرسائل التسويقية وإيقافها، وسحب موافقتك على الإشعارات من إعدادات الجهاز أو التطبيق. لأي طلب راسلنا على ${CO.mail}.</p>

<h3>6. حذف الحساب والبيانات</h3>
<ul>
<li><b>من التطبيق:</b> المزيد ← الإعدادات ← «حذف الحساب». يُحذف الحساب وكل إعلاناته نهائياً.</li>
<li><b>بدون التطبيق:</b> من صفحة <a href="${DELETE_URL}" data-ext>طلب حذف الحساب</a>، أو أرسل من بريدك المسجّل رسالة إلى ${CO.mail} بعنوان «حذف حسابي».</li>
</ul>

<h3>7. الأمان</h3>
<p>نستخدم اتصالاً مشفّراً (HTTPS) بين التطبيق وخوادمنا، وكلمات المرور محفوظة مشفّرة، والوصول إلى البيانات محصور بالموظفين المخوّلين. لا يوجد نظام آمن بنسبة 100%، لذا حافظ على سرية كلمة مرورك.</p>

<h3>8. الأطفال</h3>
<p>التطبيق موجّه لمن أعمارهم 18 سنة فأكثر، ولا نجمع بيانات الأطفال عن قصد. إذا علمنا بوجود حساب لقاصر سنحذفه.</p>

<h3>9. التغييرات على هذه السياسة</h3>
<p>قد نحدّث هذه السياسة، ونغيّر تاريخ «آخر تحديث» أعلاه، ونُعلمك داخل التطبيق عند وجود تغيير جوهري.</p>

<h3>10. التواصل</h3>
<p>عمر الياسي للعقارات · ${CO.addr}<br>الهاتف: <a href="tel:${CO.tel}" dir="ltr">${CO.phone}</a> · البريد: ${CO.mail} · إنستغرام: ${CO.ig}</p>`;

const termsAr = `
<p class="upd">آخر تحديث: ${UPDATED.ar}</p>
<p>مرحباً بك في تطبيق «عمر الياسي للعقارات». باستخدامك التطبيق أو إنشاء حساب فيه فأنت توافق على هذه الشروط وعلى <a href="#" data-legal="privacy">سياسة الخصوصية</a>. إذا لم توافق فيُرجى عدم استخدام التطبيق.</p>

<h3>1. الخدمة</h3>
<p>التطبيق منصة لعرض الأراضي والمشاريع العقارية التي تسوّقها الشركة في الشارقة والإمارات، والمخططات التفاعلية، وإعلانات الأعضاء والمكاتب العقارية بعد مراجعتها، ووسائل التواصل مع الشركة. الشركة وسيط عقاري، والتطبيق نفسه لا يبيع العقارات ولا يستلم أي مدفوعات.</p>

<h3>2. الأهلية والحساب</h3>
<ul>
<li>يجب أن يكون عمرك 18 سنة فأكثر.</li>
<li>تلتزم بإدخال بيانات صحيحة وتحديثها، ويُتحقق من بريدك بكود عند التسجيل.</li>
<li>تختار نوع الحساب: <b>فردي</b> (صورة شخصية) أو <b>شركة / مكتب عقاري</b> (صورة شخصية وشعار الشركة)، وتُعرض الصور بعد اعتماد الإدارة.</li>
<li>أنت مسؤول عن سرية كلمة المرور وعن كل ما يتم من حسابك، وتُبلغنا فوراً عند أي استخدام غير مصرّح به.</li>
<li>حسابات موظفي الشركة تُنشأ بدعوة من الإدارة وبصلاحيات تحددها، ويُستخدم كل رابط دعوة لحساب واحد فقط.</li>
</ul>

<h3>3. الإعلانات والمحتوى الذي تضيفه</h3>
<ul>
<li>تقرّ بأنك مالك الأرض أو مخوّل بعرضها، وأن تفاصيلها وأسعارها وصورها صحيحة وحديثة ولا تخالف أي قانون أو حق لغيرك.</li>
<li>تُراجع الإدارة كل إعلان وصورة قبل عرضها، ويحق لها تعديلها أو رفضها أو إخفاؤها أو حذفها في أي وقت.</li>
<li>تمنح الشركة ترخيصاً غير حصري ومجانياً لعرض محتوى إعلانك (النصوص والصور) ونسخه وتنسيقه داخل التطبيق والموقع ووسائل التسويق الخاصة بها طوال فترة الإعلان.</li>
<li>عند ذكر رقم قطعة ضمن أحد مشاريعنا قد تُعرض الأرض على المخطط التفاعلي للمشروع بعد الموافقة.</li>
<li>تُحذف الإعلانات المباعة أو غير الصحيحة، ويُرجى تحديث حالة أرضك عند بيعها.</li>
</ul>

<h3>4. التواصل وقواعد السلوك</h3>
<ul>
<li>التواصل حول الإعلانات يتم عبر الشركة. يُمنع نشر أرقام الهواتف أو روابط التواصل الخارجية داخل المحادثات والمجموعة العامة.</li>
<li>يُمنع: المحتوى المسيء أو المضلل أو المخالف للآداب العامة أو لقوانين الدولة، الاحتيال أو انتحال الشخصية، الرسائل المزعجة، محاولة الوصول غير المصرّح به أو تعطيل الخدمة.</li>
<li><b>لا تسامح مطلقاً</b> مع المحتوى المسيء أو المرفوض أو الأعضاء المسيئين. يمكنك الإبلاغ عن أي رسالة أو إعلان بزر «إبلاغ»، وحظر أي عضو بزر «حظر» (وإلغاء الحظر من الإعدادات ← المحظورون). تُراجع الإدارة البلاغات خلال 24 ساعة.</li>
<li>يحق للإدارة حذف أي محتوى مخالف وإيقاف الحساب دون إشعار مسبق.</li>
</ul>

<h3>5. النقاط وباقات التمييز</h3>
<p>النقاط تمنحها الإدارة مجاناً (مثلاً عند توثيق المكتب) وتُستخدم لتمييز الإعلانات فقط. لا قيمة نقدية لها، ولا تُسترد ولا تُحوّل. لا يوجد حالياً أي شراء أو دفع داخل التطبيق.</p>

<h3>6. الأسعار والمعلومات</h3>
<ul>
<li>نسعى لدقة الأسعار والحالات والمساحات والمخططات المعروضة، لكنها للاسترشاد وقابلة للتغيير دون إشعار.</li>
<li>حاسبة الأقساط تقديرية، وخطة السداد للتوضيح وتخضع لبنود العقد الموقّع.</li>
<li>لا يُعد أي محتوى في التطبيق عرضاً ملزماً. المرجع النهائي هو تأكيد الشركة والعقد الموقّع والمستندات الرسمية، ويُنصح بالتحقق من الجهات المختصة قبل أي حجز أو دفع.</li>
</ul>

<h3>7. الإشعارات والبريد الإلكتروني</h3>
<p>بالتسجيل توافق على تلقي رسائل الخدمة (مثل كود التحقق وحالة إعلاناتك) ورسالة أسبوعية بأراضٍ مختارة لك. يمكنك إيقاف الرسائل التسويقية والإشعارات في أي وقت من «إعدادات الإشعارات» أو من رابط إلغاء الاشتراك.</p>

<h3>8. الملكية الفكرية</h3>
<p>اسم وشعار «عمر الياسي للعقارات» وتصميم التطبيق والمخططات التفاعلية وقوالب الإعلانات ملك للشركة، ولا يجوز نسخها أو استخدامها تجارياً دون إذن كتابي.</p>

<h3>9. إخلاء المسؤولية وحدودها</h3>
<p>تُقدَّم الخدمة «كما هي». لا تضمن الشركة خلوّ الخدمة من الانقطاع أو الأخطاء، ولا تتحمل المسؤولية عن إعلانات الأعضاء والمكاتب الأخرى أو عن أي قرار تتخذه بناءً على معلومات التطبيق دون التحقق منها، وذلك إلى الحد الذي يسمح به القانون.</p>

<h3>10. الإيقاف وحذف الحساب</h3>
<p>يمكنك حذف حسابك في أي وقت من «المزيد ← الإعدادات ← حذف الحساب» أو من <a href="${DELETE_URL}" data-ext>صفحة طلب الحذف</a>. ويحق للشركة إيقاف أو حذف أي حساب يخالف هذه الشروط.</p>

<h3>11. تعديل الشروط</h3>
<p>قد نعدّل هذه الشروط ونحدّث تاريخها أعلاه. استمرارك في استخدام التطبيق بعد التعديل يعني موافقتك على الشروط المعدّلة.</p>

<h3>12. القانون الواجب التطبيق</h3>
<p>تخضع هذه الشروط لقوانين دولة الإمارات العربية المتحدة وإمارة الشارقة، وتختص محاكم الشارقة بأي نزاع ينشأ عنها.</p>

<h3>13. التواصل</h3>
<p>عمر الياسي للعقارات · ${CO.addr}<br>الهاتف: <a href="tel:${CO.tel}" dir="ltr">${CO.phone}</a> · البريد: ${CO.mail} · إنستغرام: ${CO.ig}</p>`;

const deleteAr = `
<p class="upd">آخر تحديث: ${UPDATED.ar}</p>
<p>يمكنك حذف حسابك في تطبيق «عمر الياسي للعقارات» وكل البيانات المرتبطة به في أي وقت.</p>
<h3>الطريقة الأولى — من التطبيق</h3>
<ol><li>افتح التطبيق وسجّل الدخول.</li><li>اذهب إلى «المزيد» ← «الإعدادات».</li><li>اضغط «حذف الحساب» وأكّد.</li></ol>
<h3>الطريقة الثانية — بدون التطبيق</h3>
<p>أرسل من بريدك المسجّل في التطبيق رسالة إلى <a href="mailto:${CO.mail}?subject=${encodeURIComponent('حذف حسابي')}">${CO.mail}</a> بعنوان «حذف حسابي». سنحذف الحساب خلال 7 أيام عمل ونرسل لك تأكيداً.</p>
<h3>ما الذي يُحذف</h3>
<ul><li>بيانات الحساب: الاسم والبريد ورقم الجوال وكلمة المرور.</li><li>صورتك الشخصية وشعار الشركة، وإعلاناتك وصورها، وطلبات «مطلوب أرض» وتنبيهاتك.</li><li>محادثاتك الخاصة واشتراكك في الرسائل البريدية والإشعارات.</li></ul>
<p>تُحذف البيانات نهائياً خلال 30 يوماً كحد أقصى، باستثناء ما يلزمنا القانون بالاحتفاظ به (مثل سجلات المعاملات الرسمية إن وُجدت). الإحصائيات المجمّعة التي لا تعرّف بك لا تُحذف.</p>
<p>للاستفسار: <a href="tel:${CO.tel}" dir="ltr">${CO.phone}</a></p>`;

const privacyEn = `
<p class="upd">Last updated: ${UPDATED.en}</p>
<p>The «Omar Al Yassi Real Estate» app and the website omaralyassirealestate.com are operated by <b>Omar Al Yassi Real Estate</b>, ${CO.addrEn} ("we"). This policy explains what data we collect, why, who we share it with, and how you control and delete it.</p>
<h3>1. Data we collect</h3>
<ul>
<li><b>Account data:</b> name, email, mobile number, account type (individual or company / real-estate office) and company name. Passwords are stored hashed. With Google sign-in we receive only the name, email and profile photo Google shares.</li>
<li><b>Email verification:</b> a 6-digit code sent at sign-up, deleted after use or within 15 minutes.</li>
<li><b>Your photo and company logo:</b> sent by you to appear on your listings, shown only after the office approves them. A company logo is requested from companies and offices only.</li>
<li><b>Office verification:</b> office name, city, contact name and phone number.</li>
<li><b>Content you add:</b> land listings with details and photos, «wanted land» requests, «lands for me» alerts, ratings.</li>
<li><b>Chats:</b> your private messages with the office and attached photos / files, and your messages in the public group.</li>
<li><b>Call-back and viewing requests:</b> the name, mobile number, message and time you choose.</li>
<li><b>Usage data:</b> a random device identifier created in the app, the listings and projects you open, and taps on call, WhatsApp and share — used for aggregated statistics and to suggest suitable lands. <b>We do not collect your location</b>, contacts or data from other apps.</li>
<li><b>Notifications:</b> when enabled, a device identifier is created with OneSignal to deliver them, with your choices (prices, offers, news).</li>
<li><b>On your device only:</b> favourites, saved searches, language and settings.</li>
</ul>
<h3>2. How we use it</h3>
<ul><li>To create and run your account, verify your email, and review, approve and show your listings and photos.</li>
<li>To answer your enquiries, call-back and viewing requests.</li><li>To send the notifications you choose and «lands for me» alerts.</li>
<li>To send a weekly «Lands picked for you» email; you can stop it any time in notification settings or with the unsubscribe link in every email.</li>
<li>To show advertisers aggregated statistics about their listings (views, calls) without identifying anyone.</li>
<li>To protect users and prevent fraud and abuse (for example, phone numbers are not allowed in chats), and to improve the app.</li></ul>
<h3>3. Sharing</h3>
<p><b>We do not sell your data or share it for others' marketing.</b> We share only what is needed with: service providers working for us (website hosting, OneSignal for notifications, Google for sign-in, GitHub for app files and public listing images); the public, for approved listings, the advertiser's name / photo / logo after approval, ratings and your public-group messages — <b>your mobile number is never shown</b>; authorised office staff; and authorities when legally required.</p>
<h3>4. Retention</h3><p>We keep account data while the account exists. When an account is deleted, its data, listings and photos are deleted within 30 days, except what the law requires us to keep. Usage data is kept aggregated for a limited period.</p>
<h3>5. Your rights</h3><p>Under the laws of the United Arab Emirates, including Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data, you may access, correct and delete your data, object to marketing, and withdraw consent to notifications. Contact ${CO.mail}.</p>
<h3>6. Deleting your account</h3><ul><li><b>In the app:</b> More → Settings → «Delete account».</li><li><b>Without the app:</b> use the <a href="${DELETE_URL}" data-ext>account deletion page</a> or email ${CO.mail} from your registered address with the subject «Delete my account».</li></ul>
<h3>7. Security</h3><p>Connections use HTTPS, passwords are hashed and access is limited to authorised staff.</p>
<h3>8. Children</h3><p>The app is intended for users aged 18 and over. We do not knowingly collect children's data.</p>
<h3>9. Changes</h3><p>We may update this policy and its date above, and will tell you in the app about significant changes.</p>
<h3>10. Contact</h3><p>Omar Al Yassi Real Estate · ${CO.addrEn}<br>Phone: <a href="tel:${CO.tel}">${CO.phone}</a> · Email: ${CO.mail} · Instagram: ${CO.ig}</p>`;

const termsEn = `
<p class="upd">Last updated: ${UPDATED.en}</p>
<p>By using the «Omar Al Yassi Real Estate» app or creating an account you agree to these terms and to the <a href="#" data-legal="privacy">privacy policy</a>.</p>
<h3>1. The service</h3><p>The app shows lands and projects marketed by the company in Sharjah and the UAE, interactive plans, listings by members and real-estate offices after review, and ways to contact the company. The company acts as a real-estate broker; the app itself does not sell property or take payments.</p>
<h3>2. Eligibility and accounts</h3><ul><li>You must be 18 or older.</li><li>You must give correct details; your email is verified with a code at sign-up.</li>
<li>You choose an <b>individual</b> account (personal photo) or a <b>company / office</b> account (personal photo and company logo); photos are shown after approval.</li>
<li>You are responsible for your password and everything done with your account.</li><li>Staff accounts are created by invitation from the office, each invitation link for one account only.</li></ul>
<h3>3. Listings and your content</h3><ul><li>You confirm you own the land or are authorised to offer it, and that its details, prices and photos are correct and lawful.</li>
<li>The office reviews every listing and photo and may edit, reject, hide or delete it at any time.</li>
<li>You grant the company a free, non-exclusive licence to display, copy and format your listing content in the app, website and its marketing while the listing is live.</li>
<li>If you give a plot number in one of our projects, the land may appear on that project's interactive plan after approval.</li></ul>
<h3>4. Contact and conduct</h3><ul><li>Contact about listings goes through the company. Phone numbers and outside contact links are not allowed in chats or the public group.</li>
<li>Abusive, misleading or unlawful content, fraud, impersonation, spam and attempts to disrupt the service are forbidden; the office may remove content and suspend accounts without notice.</li>
<li><b>Zero tolerance</b> for objectionable content or abusive users. You can report any message or listing with «Report» and block any member with «Block» (unblock in Settings → Blocked). The office reviews reports within 24 hours.</li></ul>
<h3>5. Points and featured listings</h3><p>Points are granted free by the office and used only to feature listings; they have no cash value and cannot be refunded or transferred. There are currently no purchases or payments in the app.</p>
<h3>6. Prices and information</h3><p>Prices, statuses, areas and plans are for guidance and may change without notice. The instalment calculator is an estimate and payment plans are illustrative and subject to the signed contract. Nothing in the app is a binding offer; the final reference is the company's confirmation, the signed contract and official documents.</p>
<h3>7. Notifications and email</h3><p>By signing up you agree to service messages (such as verification codes and listing status) and a weekly «Lands picked for you» email. You can stop marketing emails and notifications at any time.</p>
<h3>8. Intellectual property</h3><p>The «Omar Al Yassi Real Estate» name and logo, the app design, interactive plans and ad templates belong to the company and may not be copied or used commercially without written permission.</p>
<h3>9. Disclaimer</h3><p>The service is provided "as is". To the extent permitted by law, the company is not liable for interruptions or errors, for listings by other members and offices, or for decisions made on app information without verification.</p>
<h3>10. Suspension and deletion</h3><p>You can delete your account at any time in the app or via the <a href="${DELETE_URL}" data-ext>deletion page</a>. The company may suspend or delete accounts that break these terms.</p>
<h3>11. Changes</h3><p>We may change these terms and update their date; continuing to use the app means you accept the changes.</p>
<h3>12. Governing law</h3><p>These terms are governed by the laws of the United Arab Emirates and the Emirate of Sharjah; the courts of Sharjah have jurisdiction.</p>
<h3>13. Contact</h3><p>Omar Al Yassi Real Estate · ${CO.addrEn}<br>Phone: <a href="tel:${CO.tel}">${CO.phone}</a> · Email: ${CO.mail} · Instagram: ${CO.ig}</p>`;

const deleteEn = `
<p class="upd">Last updated: ${UPDATED.en}</p>
<p>You can delete your «Omar Al Yassi Real Estate» account and the data linked to it at any time.</p>
<h3>Option 1 — in the app</h3><ol><li>Open the app and sign in.</li><li>Go to More → Settings.</li><li>Tap «Delete account» and confirm.</li></ol>
<h3>Option 2 — without the app</h3><p>Email <a href="mailto:${CO.mail}?subject=Delete%20my%20account">${CO.mail}</a> from your registered address with the subject «Delete my account». We delete the account within 7 working days and confirm by email.</p>
<h3>What is deleted</h3><ul><li>Account data: name, email, mobile number, password.</li><li>Your photo and company logo, your listings and their photos, wanted-land requests and alerts.</li><li>Your private chats and your email / notification subscriptions.</li></ul>
<p>Data is permanently deleted within 30 days at most, except what the law requires us to keep. Aggregated statistics that do not identify you are not deleted.</p>`;

export const LEGAL = {
  privacy: ['سياسة الخصوصية', privacyAr],
  terms: ['شروط الاستخدام', termsAr],
  delete: ['حذف الحساب والبيانات', deleteAr],
};
export const LEGAL_EN = {
  privacy: ['Privacy policy', `<div class="notr" dir="ltr">${privacyEn}</div>`],
  terms: ['Terms of use', `<div class="notr" dir="ltr">${termsEn}</div>`],
  delete: ['Delete your account and data', `<div class="notr" dir="ltr">${deleteEn}</div>`],
};
export const RAW_EN = { privacy: privacyEn, terms: termsEn, delete: deleteEn };
