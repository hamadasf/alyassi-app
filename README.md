# تطبيق عمر الياسي للعقارات (أندرويد)

تطبيق مربوط مباشرة بموقع omaralyassirealestate.com — أي تعديل على حالة القطع أو الأسعار من المخطط في الموقع يظهر في التطبيق تلقائياً.

## الشاشات
الرئيسية · الأراضي (بحث وفلاتر) · المشاريع · المفضلة · تواصل — وتفاصيل كل قطعة وكل مشروع مع المخطط التفاعلي.

## التحميل
كل تعديل يُرفع على الفرع `main` يبني نسخة جديدة تلقائياً. الملفات تظهر في **Releases**:
- `OmarAlYassi-1.0.N.apk` — للتثبيت المباشر على الجوال.
- `OmarAlYassi-1.0.N.aab` — للرفع على Google Play.

## تعديل أرقام التواصل
في الملف `src/config.js`.

## مفتاح التوقيع
مفتاح توقيع التطبيق محفوظ في أسرار المستودع (Settings → Secrets → Actions) باسم `ANDROID_KEYSTORE_BASE64` و`ANDROID_KEYSTORE_PASSWORD` — وليس داخل الملفات. احتفظ بنسخة منه، فبدونه لا يمكن تحديث التطبيق على Google Play.

## نسخة الآيفون (تطبيق ويب)
الرابط: https://hamadasf.github.io/alyassi-app/ — يُفتح من Safari ثم «مشاركة ← إضافة إلى الشاشة الرئيسية».
بيانات الأراضي والأسعار تُجمع من الموقع تلقائياً كل ~10 دقائق.

## iPhone / App Store

The workflow **iPhone app (native)** builds the Capacitor iOS project on every push (unsigned simulator build).
To sign it and upload to TestFlight it needs an Apple Developer account and these repository secrets
(Settings → Secrets and variables → Actions): `APPLE_TEAM_ID`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`,
`APPSTORE_KEY_P8` (the App Store Connect API key, role App Manager). Bundle id: `com.omaralyassi.realestate`.
On iPhone the Google sign-in button is hidden (Apple would require «Sign in with Apple» next to it).

## Store listing

`store/` holds the Google Play assets: feature graphic (1024×500) and eight phone screenshots (1080×1920).
The 512×512 icon is the app icon the build publishes at `https://hamadasf.github.io/alyassi-app/icons/icon-512.png`.
