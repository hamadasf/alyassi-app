<?php
/**
 * Plugin Name: Alyassi App – Map, service rating, pre-registration
 * Description: (1) Project coordinates for the app's map, worked out once from each project's Google Maps link.
 *              (2) «قيّم خدمتنا»: a client's stars + comment after contacting the office (shown to the office).
 *              (3) «قريباً»: a public page (/app) where people leave their name and phone before the app is in the stores;
 *                  the office sees the list in the app, exports it, and can e-mail everyone on launch day.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'proj_geo', 'svc_rate', 'prereg' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}
foreach ( array( 'adm_rates', 'adm_prereg', 'adm_prereg_mail' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}

/* ====================================== 1. project coordinates ====================================== */
/** [lat, lng] inside the UAE region, from any Google Maps URL or page text, or null */
function oay_geo_parse( $s ) {
	$s = rawurldecode( (string) $s );
	$pats = array(
		'/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/',
		'/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/',
		'/[?&](?:q|ll|query|center|destination|daddr)=(?:loc:)?(-?\d{1,2}\.\d+)\s*,\s*\+?(-?\d{1,3}\.\d+)/',
		'/\/(?:search|place|dir)\/+(-?\d{1,2}\.\d+)\s*,\s*\+?(-?\d{1,3}\.\d+)/',
	);
	foreach ( $pats as $p ) {
		if ( preg_match( $p, $s, $m ) ) { $lat = (float) $m[1]; $lng = (float) $m[2]; if ( $lat > 20 && $lat < 28 && $lng > 50 && $lng < 58 ) { return array( round( $lat, 6 ), round( $lng, 6 ) ); } }
	}
	if ( preg_match( '/APP_INITIALIZATION_STATE=\[\[\[[\d.]+,(-?\d{1,3}\.\d+),(-?\d{1,2}\.\d+)\]/', $s, $m ) ) {   // the map page itself: [zoom, lng, lat]
		$lat = (float) $m[2]; $lng = (float) $m[1]; if ( $lat > 20 && $lat < 28 && $lng > 50 && $lng < 58 ) { return array( round( $lat, 6 ), round( $lng, 6 ) ); }
	}
	return null;
}
function oay_geo_ok_host( $u ) { $h = strtolower( (string) wp_parse_url( $u, PHP_URL_HOST ) ); return (bool) preg_match( '/(^|\.)(goo\.gl|google\.[a-z.]+|maps\.app\.goo\.gl|g\.co)$/', $h ); }
/** follow the short link's redirects by hand (only Google hosts), reading each address for coordinates */
function oay_geo_resolve( $loc ) {
	$u = $loc; $ua = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
	for ( $i = 0; $i < 6 && $u && oay_geo_ok_host( $u ); $i++ ) {
		$c = oay_geo_parse( $u ); if ( $c ) { return $c; }
		$r = wp_remote_get( $u, array( 'redirection' => 0, 'timeout' => 8, 'user-agent' => $ua, 'headers' => array( 'Accept-Language' => 'en' ) ) );
		if ( is_wp_error( $r ) ) { return null; }
		$next = wp_remote_retrieve_header( $r, 'location' );
		if ( ! $next ) { return oay_geo_parse( substr( (string) wp_remote_retrieve_body( $r ), 0, 400000 ) ); }
		if ( is_array( $next ) ) { $next = end( $next ); }
		$u = 0 === strpos( $next, '/' ) ? 'https://' . wp_parse_url( $u, PHP_URL_HOST ) . $next : $next;
	}
	return $u ? oay_geo_parse( $u ) : null;
}
/** a place name from a search-style link (…/maps/search/?api=1&query=الفلاح+الشارقة, ?q=…) when it carries no coordinates */
function oay_geo_query_text( $loc ) {
	$q = array(); parse_str( (string) wp_parse_url( $loc, PHP_URL_QUERY ), $q );
	foreach ( array( 'query', 'q', 'destination', 'daddr' ) as $k ) { if ( ! empty( $q[ $k ] ) && ! preg_match( '/^-?\d{1,2}\.\d+\s*,/', $q[ $k ] ) ) { return trim( preg_replace( '/\s+/', ' ', $q[ $k ] ) ); } }
	if ( preg_match( '#/maps/(?:search|place)/([^/@?]+)#', rawurldecode( $loc ), $m ) ) { return trim( str_replace( '+', ' ', $m[1] ) ); }
	return '';
}
/** OpenStreetMap's geocoder, inside the UAE only: the name as written, then without «الشارقة»/«عجمان» … */
function oay_geo_by_name( $text ) {
	if ( ! $text ) { return null; }
	$tries = array_unique( array_filter( array( $text, trim( preg_replace( '/\s*(الشارقة|عجمان|دبي|sharjah|ajman)\s*/iu', ' ', $text ) ) . ' الشارقة', trim( preg_replace( '/\s*(الشارقة|عجمان|دبي|sharjah|ajman)\s*/iu', ' ', $text ) ) ) ) );
	foreach ( $tries as $q ) {
		$r = wp_remote_get( 'https://nominatim.openstreetmap.org/search?' . http_build_query( array( 'format' => 'json', 'limit' => 1, 'countrycodes' => 'ae', 'accept-language' => 'ar', 'q' => $q ) ),
			array( 'timeout' => 8, 'user-agent' => 'OmarAlYassiRealEstate/1.0 (+' . home_url( '/' ) . ')' ) );
		if ( is_wp_error( $r ) ) { return null; }
		$j = json_decode( wp_remote_retrieve_body( $r ), true );
		if ( ! empty( $j[0]['lat'] ) ) { $lat = (float) $j[0]['lat']; $lng = (float) $j[0]['lon']; if ( $lat > 22 && $lat < 27 && $lng > 51 && $lng < 57 ) { return array( round( $lat, 6 ), round( $lng, 6 ) ); } }
	}
	return null;
}
/* the admin can put a project on the map by hand (from the app's projects map): those pins win over the links */
function oay_proj_pins() { $o = get_option( 'oay_proj_pins', array() ); return is_array( $o ) ? $o : array(); }
add_action( 'wp_ajax_oay_acc_adm_proj_pin', 'oay_acc_adm_proj_pin' ); add_action( 'wp_ajax_nopriv_oay_acc_adm_proj_pin', 'oay_acc_adm_proj_pin' );
function oay_acc_adm_proj_pin() {
	oay_acc_need_admin(); $in = oay_acc_in(); $slug = sanitize_key( (string) ( $in['slug'] ?? '' ) ); if ( ! $slug ) { oay_acc_err( 'اختر المشروع' ); }
	$pins = oay_proj_pins();
	if ( ! empty( $in['clear'] ) ) { unset( $pins[ $slug ] ); }
	else {
		$lat = (float) ( $in['lat'] ?? 0 ); $lng = (float) ( $in['lng'] ?? 0 );
		if ( ! ( $lat > 22 && $lat < 27 && $lng > 51 && $lng < 57 ) ) { oay_acc_err( 'الموقع خارج الإمارات' ); }
		$pins[ $slug ] = array( round( $lat, 6 ), round( $lng, 6 ) );
	}
	update_option( 'oay_proj_pins', $pins, false );
	oay_acc_ok( array( 'pins' => (object) $pins ) );
}
function oay_acc_proj_geo() {
	oay_acc_limit( 'pgeo', 30 );
	$in = oay_acc_in(); $cache = get_option( 'oay_proj_geo', array() ); if ( ! is_array( $cache ) ) { $cache = array(); }
	$out = array(); $tries = 0; $dirty = false; $pins = oay_proj_pins();
	foreach ( array_slice( (array) ( $in['items'] ?? array() ), 0, 60 ) as $it ) {
		$slug = sanitize_key( (string) ( $it['slug'] ?? '' ) ); $loc = esc_url_raw( (string) ( $it['loc'] ?? '' ) );
		if ( $slug && ! empty( $pins[ $slug ] ) ) { $out[ $slug ] = $pins[ $slug ]; continue; }
		if ( ! $slug || ! $loc || ! oay_geo_ok_host( $loc ) ) { continue; }
		$k = md5( $loc ); $c = $cache[ $k ] ?? null;
		if ( ! $c || ( empty( $c['c'] ) && time() - (int) $c['t'] > DAY_IN_SECONDS && $tries < 6 ) ) {
			if ( $tries >= 6 ) { continue; }
			$tries++; $g = oay_geo_resolve( $loc ); if ( ! $g ) { $g = oay_geo_by_name( oay_geo_query_text( $loc ) ); }
			$c = array( 'c' => $g, 't' => time() ); $cache[ $k ] = $c; $dirty = true;
		}
		if ( ! empty( $c['c'] ) ) { $out[ $slug ] = $c['c']; }
	}
	if ( $dirty ) { update_option( 'oay_proj_geo', array_slice( $cache, -200, null, true ), false ); }
	oay_acc_ok( array( 'items' => (object) $out, 'pinned' => array_keys( $pins ) ) );
}

/* ====================================== 2. «قيّم خدمتنا» ====================================== */
function oay_rates_all() { $m = get_option( 'oay_svc_rates', array() ); return is_array( $m ) ? $m : array(); }
function oay_acc_svc_rate() {
	oay_acc_limit( 'svcrate', 5 );
	$stars = (int) oay_acc_arg( 'stars', 2 ); if ( $stars < 1 || $stars > 5 ) { oay_acc_err( 'اختر عدد النجوم' ); }
	$u = oay_acc_user_from_token( oay_acc_arg( 'token', 120 ) );
	$id = substr( preg_replace( '/[^\w:\-]/u', '', oay_acc_arg( 'id', 60 ) ), 0, 60 );
	$e = array( 't' => (int) round( microtime( true ) * 1000 ), 'stars' => $stars, 'text' => mb_substr( sanitize_textarea_field( oay_acc_arg( 'text', 600 ) ), 0, 500 ),
		'id' => $id, 'name' => $id && function_exists( 'oay_land_name' ) ? oay_land_name( $id ) : '', 'uid' => $u ? $u->ID : 0, 'who' => $u ? $u->display_name : '',
		'dev' => substr( md5( (string) oay_acc_arg( 'dev', 40 ) ), 0, 8 ) );
	$m = oay_rates_all(); array_unshift( $m, $e ); update_option( 'oay_svc_rates', array_slice( $m, 0, 2000 ), false );
	if ( $stars <= 3 && function_exists( 'oay_push_to' ) ) {   // an unhappy client: tell the office at once
		oay_push_to( oay_admin_ids(), '⭐ ' . $stars . '/5 تقييم خدمة يحتاج متابعة', ( $e['who'] ? $e['who'] . ' · ' : '' ) . ( $e['text'] ? $e['text'] : 'بدون تعليق' ), array( 'open' => 'rates' ) );
	}
	oay_acc_ok();
}
function oay_acc_adm_rates() {
	oay_acc_need_perm( 'leads' ); $m = oay_rates_all(); $n = count( $m ); $sum = 0; $dist = array( 1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0 );
	foreach ( $m as $x ) { $sum += (int) $x['stars']; $dist[ (int) $x['stars'] ]++; }
	oay_acc_ok( array( 'n' => $n, 'avg' => $n ? round( $sum / $n, 2 ) : 0, 'dist' => $dist, 'items' => array_slice( $m, 0, 300 ) ) );
}

/* ====================================== 3. «قريباً» — pre-registration ====================================== */
function oay_prereg_all() { $m = get_option( 'oay_prereg', array() ); return is_array( $m ) ? $m : array(); }
function oay_prereg_phone( $p ) {   // 05X XXX XXXX / 9715… / +9715… → 9715XXXXXXXX (UAE) or digits as typed
	$d = preg_replace( '/\D/', '', strtr( (string) $p, array( '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9' ) ) );
	if ( preg_match( '/^00/', $d ) ) { $d = substr( $d, 2 ); }
	if ( preg_match( '/^0(5\d{8})$/', $d, $m ) ) { $d = '971' . $m[1]; }
	if ( preg_match( '/^5\d{8}$/', $d ) ) { $d = '971' . $d; }
	return $d;
}
function oay_acc_prereg() {
	oay_acc_limit( 'prereg', 10 );
	$name = mb_substr( sanitize_text_field( oay_acc_arg( 'name', 120 ) ), 0, 60 ); $phone = oay_prereg_phone( oay_acc_arg( 'phone', 30 ) );
	$email = sanitize_email( oay_acc_arg( 'email', 120 ) ); $kind = sanitize_key( oay_acc_arg( 'kind', 20 ) );
	if ( '' === $name ) { oay_acc_err( 'اكتب الاسم' ); }
	if ( strlen( $phone ) < 9 || strlen( $phone ) > 15 ) { oay_acc_err( 'اكتب رقم جوال صحيح' ); }
	if ( $email && ! is_email( $email ) ) { $email = ''; }
	$m = oay_prereg_all();
	foreach ( $m as $x ) { if ( $x['phone'] === $phone ) { oay_acc_ok( array( 'again' => true ) ); } }   // already on the list
	array_unshift( $m, array( 't' => (int) round( microtime( true ) * 1000 ), 'name' => $name, 'phone' => $phone, 'email' => $email,
		'kind' => in_array( $kind, array( 'buyer', 'seller', 'broker' ), true ) ? $kind : 'buyer', 'src' => mb_substr( sanitize_key( oay_acc_arg( 'src', 30 ) ), 0, 20 ) ) );
	update_option( 'oay_prereg', array_slice( $m, 0, 20000 ), false );
	$n = count( $m );
	if ( function_exists( 'oay_push_to' ) && ( $n <= 20 || 0 === $n % 25 ) ) { oay_push_to( oay_admin_ids(), '🚀 تسجيل مسبق جديد · ' . $name, 'العدد الآن: ' . number_format( $n ), array( 'open' => 'prereg' ) ); }
	oay_acc_ok( array( 'n' => $n ) );
}
function oay_acc_adm_prereg() {
	oay_acc_need_perm( 'leads' ); $m = oay_prereg_all(); $k = array( 'buyer' => 0, 'seller' => 0, 'broker' => 0 );
	foreach ( $m as $x ) { if ( isset( $k[ $x['kind'] ] ) ) { $k[ $x['kind'] ]++; } }
	oay_acc_ok( array( 'n' => count( $m ), 'kinds' => $k, 'mailed' => (int) get_option( 'oay_prereg_mailed', 0 ), 'items' => $m ) );
}
/** launch day: one e-mail to everyone who left an address (once; the office writes the store links) */
function oay_acc_adm_prereg_mail() {
	oay_acc_need_admin();
	if ( get_option( 'oay_prereg_mailed', 0 ) ) { oay_acc_err( 'تم إرسال رسالة الإطلاق من قبل' ); }
	$android = esc_url_raw( oay_acc_arg( 'android', 300 ) ); $ios = esc_url_raw( oay_acc_arg( 'ios', 300 ) );
	if ( ! $android && ! $ios ) { oay_acc_err( 'اكتب رابط المتجر' ); }
	$sent = 0;
	foreach ( oay_prereg_all() as $x ) {
		if ( empty( $x['email'] ) ) { continue; }
		$body = '<div dir="rtl" style="font-family:Tahoma,Arial;font-size:15px;line-height:1.8;color:#14203a">مرحباً ' . esc_html( $x['name'] ) . '،<br>'
			. 'تطبيق <b>عمر الياسي للعقارات</b> متاح الآن! كل أراضي الشارقة بأسعارها وتنبيهات فورية لما ينزل السعر.<br><br>'
			. ( $android ? '<a href="' . esc_url( $android ) . '" style="display:inline-block;background:#0e1c36;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;margin:4px">حمّل من Google Play</a>' : '' )
			. ( $ios ? '<a href="' . esc_url( $ios ) . '" style="display:inline-block;background:#0e1c36;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;margin:4px">حمّل من App Store</a>' : '' )
			. '<br><br>للتواصل: 06 744 2027 · instagram.com/omaralyassi.uae3</div>';
		if ( wp_mail( $x['email'], 'تطبيق عمر الياسي للعقارات متاح الآن 🎉', $body, array( 'Content-Type: text/html; charset=UTF-8' ) ) ) { $sent++; }
	}
	update_option( 'oay_prereg_mailed', time(), false );
	oay_acc_ok( array( 'sent' => $sent ) );
}

/** the public page: omaralyassirealestate.com/app (also ?oay_app=1) */
add_action( 'template_redirect', function () {
	$path = trim( (string) wp_parse_url( isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '', PHP_URL_PATH ), '/' );
	if ( 'app' !== $path && empty( $_GET['oay_app'] ) ) { return; }
	$ajax = admin_url( 'admin-ajax.php' );
	$logo = 'https://omaralyassirealestate.com/wp-content/uploads/2026/07/logo-2.png';
	$src = isset( $_GET['src'] ) ? sanitize_key( wp_unslash( $_GET['src'] ) ) : 'ig';
	status_header( 200 ); nocache_headers(); header( 'Content-Type: text/html; charset=utf-8' );
	?><!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>تطبيق عمر الياسي للعقارات · قريباً</title>
<meta name="description" content="سجّل الآن ويوصلك إشعار أول ما ينزل تطبيق عمر الياسي للعقارات على أندرويد وآيفون — كل أراضي الشارقة بأسعارها.">
<meta property="og:title" content="تطبيق عمر الياسي للعقارات · قريباً"><meta property="og:description" content="سجّل الآن ويوصلك إشعار أول ما ينزل التطبيق على أندرويد وآيفون.">
<meta property="og:image" content="<?php echo esc_url( $logo ); ?>"><meta name="theme-color" content="#0e1c36">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Tajawal,Tahoma,sans-serif;background:#0e1c36;color:#fff;display:flex;flex-direction:column;align-items:center}
.w{width:100%;max-width:460px;padding:36px 20px 28px;display:flex;flex-direction:column;align-items:center;text-align:center}
.lg{height:110px;width:auto;margin-bottom:10px}
h1{margin:6px 0 4px;font-size:30px;font-weight:800}.gold{color:#e6c77f}
.sub{margin:0 0 6px;color:#c9d1e6;font-size:16px;line-height:1.7}
.soon{display:inline-block;margin:10px 0 18px;padding:6px 18px;border-radius:999px;background:linear-gradient(90deg,#b8955a,#e6c77f);color:#0e1c36;font-weight:800}
.feats{list-style:none;padding:0;margin:0 0 18px;display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}
.feats li::before{content:'✓';display:inline-flex;width:18px;height:18px;margin-left:6px;border-radius:50%;background:#c9a14a;color:#0e1c36;font-size:11px;font-weight:800;align-items:center;justify-content:center;vertical-align:-3px}.feats li{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:10px 8px;font-size:13.5px;color:#e5e9f3}
form{width:100%;background:#fff;color:#14203a;border-radius:22px;padding:20px 16px;text-align:right;box-shadow:0 20px 50px rgba(0,0,0,.35)}
form h2{margin:0 0 4px;font-size:19px}form p{margin:0 0 14px;color:#6b7488;font-size:13.5px}
label{display:block;font-size:13px;color:#4b5563;margin:10px 0 6px;font-weight:700}
input{width:100%;font:inherit;font-size:16px;padding:12px;border:1.5px solid #e3e6ec;border-radius:12px;outline:0}input:focus{border-color:#c9a14a;box-shadow:0 0 0 3px rgba(201,161,74,.18)}
.k{display:flex;gap:6px;flex-wrap:wrap}.k label{margin:0;flex:1}.k input{display:none}.k span{display:block;text-align:center;padding:9px 6px;border:1.5px solid #e3e6ec;border-radius:999px;font-weight:700;font-size:13px;color:#4b5563;cursor:pointer}
.k input:checked+span{background:#0e1c36;border-color:#0e1c36;color:#fff}
button{width:100%;margin-top:16px;min-height:54px;border:0;border-radius:16px;background:linear-gradient(135deg,#1b2f55,#0e1c36);color:#fff;font:inherit;font-size:18px;font-weight:800;box-shadow:inset 0 -3px 0 #c9a14a;cursor:pointer}
.err{color:#b91c1c;background:#fdecec;border-radius:10px;padding:8px 10px;margin-top:10px;font-size:14px;display:none}
.ok{display:none;background:#fff;color:#14203a;border-radius:22px;padding:28px 18px;width:100%}.ok i{display:flex;width:70px;height:70px;margin:0 auto 10px;border-radius:50%;background:#e7f6ee;color:#0f7b4e;font-size:36px;font-style:normal;align-items:center;justify-content:center}
.ok b{font-size:20px}.ok p{color:#6b7488}
.ct{margin-top:22px;color:#c9d1e6;font-size:14px;line-height:2}.ct a{color:#e6c77f;text-decoration:none;font-weight:700}
.note{font-size:12px;color:#94a3b8;margin-top:10px}
</style></head><body><div class="w">
<img class="lg" src="<?php echo esc_url( $logo ); ?>" alt="عمر الياسي للعقارات" onerror="this.remove()">
<h1>تطبيق <span class="gold">عمر الياسي</span> للعقارات</h1>
<p class="sub">كل أراضي الشارقة بأسعارها ومخططاتها في جيبك</p>
<span class="soon">قريباً على أندرويد وآيفون</span>
<ul class="feats"><li>مخططات تفاعلية</li><li>تنبيه لما ينزل السعر</li><li>استفسار بضغطة واتساب</li><li>اعرض أرضك للبيع</li></ul>
<form id="f" novalidate><h2>سجّل الآن واعرف أول واحد</h2><p>يوصلك إشعار يوم ما ينزل التطبيق على المتاجر</p>
<label>الاسم</label><input name="name" autocomplete="name" placeholder="الاسم الكامل" required>
<label>رقم الجوال</label><input name="phone" type="tel" inputmode="tel" dir="ltr" placeholder="05X XXX XXXX" autocomplete="tel" required>
<label>البريد الإلكتروني (اختياري)</label><input name="email" type="email" dir="ltr" placeholder="name@email.com" autocomplete="email">
<label>أنت</label><div class="k"><label><input type="radio" name="kind" value="buyer" checked><span>أبحث عن أرض</span></label><label><input type="radio" name="kind" value="seller"><span>عندي أرض للبيع</span></label><label><input type="radio" name="kind" value="broker"><span>مكتب / وسيط</span></label></div>
<div class="err" id="e"></div><button id="b">سجّلني</button>
<div class="note">بياناتك تصل لمكتب عمر الياسي للعقارات فقط</div></form>
<div class="ok" id="ok"><i>✓</i><b>تم تسجيلك بنجاح!</b><p>هنبعتلك أول ما التطبيق ينزل على المتاجر.</p></div>
<div class="ct">للتواصل: <a href="tel:+97167442027" dir="ltr">06 744 2027</a><br><a href="https://www.instagram.com/omaralyassi.uae3" dir="ltr">@omaralyassi.uae3</a></div>
</div>
<script>
(function(){var f=document.getElementById('f'),e=document.getElementById('e'),b=document.getElementById('b');
f.onsubmit=function(ev){ev.preventDefault();e.style.display='none';
var d={name:f.name.value.trim(),phone:f.phone.value.trim(),email:f.email.value.trim(),kind:(f.querySelector('[name=kind]:checked')||{}).value||'buyer',src:<?php echo wp_json_encode( $src ); ?>};
if(!d.name){e.textContent='اكتب الاسم';e.style.display='block';return;}
if(d.phone.replace(/\D/g,'').length<9){e.textContent='اكتب رقم جوال صحيح';e.style.display='block';return;}
b.disabled=true;b.textContent='جارِ التسجيل…';
fetch(<?php echo wp_json_encode( $ajax ); ?>+'?action=oay_acc_prereg',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(function(r){return r.json();}).then(function(j){
if(j&&j.ok){f.style.display='none';document.getElementById('ok').style.display='block';}else{throw new Error(j&&j.error||'تعذّر التسجيل');}
}).catch(function(x){e.textContent=x.message||'تعذّر التسجيل، حاول مرة أخرى';e.style.display='block';b.disabled=false;b.textContent='سجّلني';});};})();
</script></body></html><?php
	exit;
}, 1 );
