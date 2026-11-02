<?php
/**
 * Plugin Name: Alyassi App – Weekly e-mail «أراضٍ مختارة لك»
 * Description: Like Bayut's recommendation e-mails: once a week each app member gets five available company lands picked
 *              for them (their «أرض تناسبني» alerts, then the projects they looked at, then featured and new lands), each
 *              with its picture on the plan, price, type, area and a button to the plot. Sent in small batches; every
 *              e-mail has a one-tap unsubscribe link. The admin switches it on, picks the day, sends a test or sends now.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'adm_mail_get', 'adm_mail_save', 'adm_mail_test', 'adm_mail_now' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}
const OAY_MAIL_BATCH = 12;   // e-mails per 5 minutes (shared hosting limits)

function oay_mail_cfg() {
	$c = get_option( 'oay_mail_cfg', array() ); if ( ! is_array( $c ) ) { $c = array(); }
	return array_merge( array( 'on' => false, 'day' => 1, 'hour' => 10, 'last' => '', 'sent' => 0, 'fail' => 0, 'started' => 0 ), $c );
}
function oay_mail_cfg_set( $c ) { update_option( 'oay_mail_cfg', $c, false ); }

/* ---------- the lands that can be suggested: every available company plot with a price ---------- */
function oay_mail_pool() {
	$c = get_transient( 'oay_mail_pool' ); if ( is_array( $c ) ) { return $c; }
	$out = array();
	if ( function_exists( 'dnp_projects' ) && function_exists( 'oay_plots' ) ) {
		foreach ( dnp_projects() as $slug => $p ) {
			if ( empty( $p['opt'] ) ) { continue; }
			$plan = function_exists( 'oay_plan_plots' ) ? oay_plan_plots( $slug ) : array();
			foreach ( oay_plots( get_option( $p['opt'] ) ) as $n => $q ) {
				if ( ( $q['s'] ?? '' ) !== 'av' ) { continue; }
				$ft = (float) ( $q['ft'] ?? ( $plan[ (string) $n ][1] ?? 0 ) );
				$total = ! empty( $q['total'] ) ? (int) $q['total'] : ( ! empty( $q['ppf'] ) && $ft ? (int) round( $q['ppf'] * $ft ) : 0 );
				if ( ! $total ) { continue; }
				$use = (string) ( $plan[ (string) $n ][0] ?? '' );
				$out[] = array( 'id' => $slug . ':' . $n, 'slug' => $slug, 'n' => (string) $n, 'project' => (string) ( $p['name'] ?? $slug ), 'use' => $use ?: 'أرض',
					'cat' => function_exists( 'oay_cat_of' ) ? oay_cat_of( $use ) : '', 'ft' => $ft, 'price' => $total, 'fe' => ! empty( $q['fe'] ), 'inst' => ! empty( $q['inst'] ) );
			}
		}
	}
	set_transient( 'oay_mail_pool', $out, HOUR_IN_SECONDS );
	return $out;
}
/** five lands for this member: their alerts first, then the projects they looked at, then featured / cheaper ones; not the ones sent lately */
function oay_mail_pick( $uid, $pool ) {
	$seen = get_user_meta( $uid, 'oay_mail_seen', true ); $seen = is_array( $seen ) ? array_flip( $seen ) : array();
	$fresh = array_values( array_filter( $pool, function ( $l ) use ( $seen ) { return ! isset( $seen[ $l['id'] ] ); } ) );
	if ( count( $fresh ) < 5 ) { $fresh = $pool; }
	$score = array();
	$alerts = function_exists( 'oay_alerts' ) ? oay_alerts( $uid ) : array();
	$looked = array();
	if ( function_exists( 'dnp_projects' ) ) { foreach ( array_keys( dnp_projects() ) as $s ) { $a = get_option( 'oay_aud_' . sanitize_key( $s ), array() ); if ( is_array( $a ) && isset( $a[ 'u' . $uid ] ) ) { $looked[ $s ] = (int) $a[ 'u' . $uid ]; } } }
	foreach ( $fresh as $i => $l ) {
		$s = 0;
		foreach ( $alerts as $a ) { if ( function_exists( 'oay_alert_match' ) && oay_alert_match( $a, $l['slug'], $l['cat'], $l['price'], $l['ft'] ) ) { $s += 100; break; } }
		if ( isset( $looked[ $l['slug'] ] ) ) { $s += 40; }
		if ( $l['fe'] ) { $s += 15; }
		if ( $l['inst'] ) { $s += 5; }
		$s += wp_rand( 0, 10 );   // a little variety from week to week
		$score[ $i ] = $s;
	}
	arsort( $score );
	$pick = array(); $per = array();
	foreach ( array_keys( $score ) as $i ) {   // at most three from one project, unless that is all there is
		$l = $fresh[ $i ]; if ( ( $per[ $l['slug'] ] ?? 0 ) >= 3 && count( $fresh ) > 8 ) { continue; }
		$pick[] = $l; $per[ $l['slug'] ] = ( $per[ $l['slug'] ] ?? 0 ) + 1; if ( count( $pick ) >= 5 ) { break; }
	}
	return $pick;
}

/* ---------- the e-mail ---------- */
function oay_mail_unsub_url( $uid ) { return home_url( '/?oay_unsub=' . (int) $uid . '.' . substr( hash_hmac( 'sha256', 'unsub' . (int) $uid, wp_salt( 'auth' ) ), 0, 20 ) ); }
function oay_mail_html( $uid, $lands, $name ) {
	$logo = plugins_url( 'alyassi-dabdaba-plan/assets/logo.png' );
	$navy = '#24305E'; $gold = '#A88B57';
	$cards = '';
	foreach ( $lands as $l ) {
		$img = 'https://hamadasf.github.io/alyassi-app/og/' . rawurlencode( $l['slug'] ) . '/' . rawurlencode( $l['n'] ) . '.jpg';
		$url = home_url( '/?oay_p=' . rawurlencode( $l['slug'] . '-' . $l['n'] ) . '&utm_source=email&utm_medium=weekly' );
		$cards .= '<tr><td style="padding:0 0 14px">'
			. '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E6E0D4;border-radius:12px;overflow:hidden;background:#fff">'
			. '<tr><td><a href="' . esc_url( $url ) . '"><img src="' . esc_url( $img ) . '" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;border:0"></a></td></tr>'
			. '<tr><td style="padding:14px 18px;direction:rtl;text-align:right;font-family:Tahoma,Arial,sans-serif">'
			. '<div style="font-size:22px;font-weight:bold;color:' . $navy . '">' . esc_html( number_format( $l['price'] ) ) . ' <span style="font-size:14px">درهم</span></div>'
			. '<div style="font-size:14px;color:#334155;margin-top:6px"><b>قطعة ' . esc_html( $l['n'] ) . '</b> · ' . esc_html( $l['use'] ) . ' · ' . esc_html( number_format( $l['ft'] ) ) . ' قدم²' . ( $l['inst'] ? ' · <span style="color:#16a34a">تقسيط متاح</span>' : '' ) . '</div>'
			. '<div style="font-size:13px;color:#64748b;margin-top:4px">📍 ' . esc_html( $l['project'] ) . '، الشارقة</div>'
			. '<div style="margin-top:12px"><a href="' . esc_url( $url ) . '" style="display:block;text-align:center;background:#EEF2F8;color:' . $navy . ';font-weight:bold;font-size:15px;text-decoration:none;padding:11px;border-radius:8px">عرض الأرض على المخطط</a></div>'
			. '</td></tr></table></td></tr>';
	}
	$hi = $name ? 'مرحباً ' . esc_html( $name ) . '،' : 'مرحباً،';
	return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
		. '<body style="margin:0;padding:0;background:#F3F4F6">'
		. '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6"><tr><td align="center" style="padding:20px 10px">'
		. '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">'
		. '<tr><td style="background:#fff;border-radius:12px;padding:22px 18px;text-align:center;font-family:Tahoma,Arial,sans-serif;border-top:5px solid ' . $navy . '">'
		. '<img src="' . esc_url( $logo ) . '" alt="عمر الياسي للعقارات" width="170" style="display:inline-block;width:170px;height:auto;border:0">'
		. '<h1 style="margin:14px 0 6px;font-size:24px;color:' . $navy . '">أراضٍ مختارة لك</h1>'
		. '<p style="margin:0;font-size:14px;color:#475569;line-height:1.8">' . $hi . ' اخترنا لك ' . count( $lands ) . ' أراضٍ متاحة الآن حسب اهتماماتك — قد تكون أرضك القادمة على بُعد ضغطة!</p>'
		. '</td></tr><tr><td style="height:14px"></td></tr>'
		. $cards
		. '<tr><td style="background:' . $navy . ';border-radius:12px;padding:18px;text-align:center;font-family:Tahoma,Arial,sans-serif;color:#fff">'
		. '<div style="font-size:15px;font-weight:bold">للاستفسار والحجز: <a href="tel:+97167442027" style="color:#F3D9A4;text-decoration:none" dir="ltr">06 744 2027</a></div>'
		. '<div style="font-size:12px;color:#CBD5E1;margin-top:6px">عمر الياسي للعقارات · الشارقة – شارع مليحة · Instagram: omaralyassi.uae3</div></td></tr>'
		. '<tr><td style="padding:14px;text-align:center;font-family:Tahoma,Arial,sans-serif;font-size:12px;color:#94a3b8">وصلتك هذه الرسالة لأنك مسجّل في تطبيق عمر الياسي للعقارات. '
		. '<a href="' . esc_url( oay_mail_unsub_url( $uid ) ) . '" style="color:#64748b">إلغاء الاشتراك في هذه الرسائل</a></td></tr>'
		. '</table></td></tr></table></body></html>';
}
function oay_mail_send_one( $uid, $pool = null ) {
	$u = get_userdata( $uid ); if ( ! $u || ! is_email( $u->user_email ) ) { return false; }
	$lands = oay_mail_pick( $uid, $pool ?? oay_mail_pool() ); if ( ! $lands ) { return false; }
	$min = min( array_column( $lands, 'price' ) ); $projs = array_values( array_unique( array_column( $lands, 'project' ) ) );
	$subject = 'أراضٍ مختارة لك في ' . ( 1 === count( $projs ) ? $projs[0] : 'الشارقة' ) . ' تبدأ من ' . number_format( $min ) . ' درهم 🏡';
	$headers = array( 'Content-Type: text/html; charset=UTF-8', 'List-Unsubscribe: <' . oay_mail_unsub_url( $uid ) . '>' );
	$ok = wp_mail( $u->user_email, $subject, oay_mail_html( $uid, $lands, $u->display_name ), $headers );
	if ( $ok ) {   // remember what was sent, so next week brings other lands
		$seen = get_user_meta( $uid, 'oay_mail_seen', true ); $seen = is_array( $seen ) ? $seen : array();
		$seen = array_slice( array_values( array_unique( array_merge( array_column( $lands, 'id' ), $seen ) ) ), 0, 40 );
		update_user_meta( $uid, 'oay_mail_seen', $seen );
	}
	return $ok;
}
/** the members who get it: app members with an e-mail, not banned, not staff, who did not switch it off */
function oay_mail_audience() {
	$ids = get_users( array( 'meta_key' => 'oay_app_user', 'fields' => 'ID', 'number' => 20000 ) ); $out = array();
	foreach ( $ids as $id ) {
		$id = (int) $id;
		if ( get_user_meta( $id, 'oay_banned', true ) || get_user_meta( $id, 'oay_mail_off', true ) || user_can( $id, 'manage_options' ) ) { continue; }
		if ( function_exists( 'oay_notif_prefs' ) && empty( oay_notif_prefs( $id )['mail'] ) ) { continue; }
		$out[] = $id;
	}
	return $out;
}

/* ---------- schedule: start the week's round on the chosen day, then send a few every 5 minutes ---------- */
add_action( 'init', function () {
	if ( ! wp_next_scheduled( 'oay_mail_tick' ) ) { wp_schedule_event( time() + 120, 'oay_5min', 'oay_mail_tick' ); }
} );
add_action( 'oay_mail_tick', 'oay_mail_tick' );
function oay_mail_start() {
	update_option( 'oay_mail_q', oay_mail_audience(), false );
	delete_transient( 'oay_mail_pool' );
	$c = oay_mail_cfg(); $c['last'] = wp_date( 'o-W' ); $c['sent'] = 0; $c['fail'] = 0; $c['started'] = time(); oay_mail_cfg_set( $c );
}
function oay_mail_tick() {
	$c = oay_mail_cfg();
	if ( $c['on'] && (int) wp_date( 'N' ) === (int) $c['day'] && (int) wp_date( 'G' ) >= (int) $c['hour'] && $c['last'] !== wp_date( 'o-W' ) ) { oay_mail_start(); $c = oay_mail_cfg(); }
	$q = get_option( 'oay_mail_q', array() ); if ( ! is_array( $q ) || ! $q ) { return; }
	if ( get_transient( 'oay_mail_lock' ) ) { return; } set_transient( 'oay_mail_lock', 1, 240 );
	$pool = oay_mail_pool(); $batch = array_splice( $q, 0, OAY_MAIL_BATCH ); update_option( 'oay_mail_q', $q, false );
	foreach ( $batch as $uid ) { if ( oay_mail_send_one( (int) $uid, $pool ) ) { $c['sent']++; } else { $c['fail']++; } }
	oay_mail_cfg_set( $c ); delete_transient( 'oay_mail_lock' );
}

/* ---------- unsubscribe (one tap from the e-mail) ---------- */
add_action( 'template_redirect', function () {
	if ( empty( $_GET['oay_unsub'] ) ) { return; }
	$raw = sanitize_text_field( wp_unslash( $_GET['oay_unsub'] ) ); list( $uid, $sig ) = array_pad( explode( '.', $raw, 2 ), 2, '' );
	$ok = (int) $uid && hash_equals( substr( hash_hmac( 'sha256', 'unsub' . (int) $uid, wp_salt( 'auth' ) ), 0, 20 ), (string) $sig );
	if ( $ok ) { update_user_meta( (int) $uid, 'oay_mail_off', 1 ); }
	status_header( 200 ); nocache_headers(); header( 'Content-Type: text/html; charset=utf-8' );
	echo '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>إلغاء الاشتراك</title></head>'
		. '<body style="font-family:Tahoma,Arial,sans-serif;text-align:center;padding:60px 20px;color:#24305E"><h2>' . ( $ok ? 'تم إلغاء اشتراكك ✓' : 'الرابط غير صالح' ) . '</h2>'
		. '<p style="color:#64748b">' . ( $ok ? 'لن تصلك رسائل «أراضٍ مختارة لك» بعد الآن. يمكنك إعادة تفعيلها من إعدادات الإشعارات في التطبيق.' : '' ) . '</p>'
		. '<p><a href="' . esc_url( home_url( '/' ) ) . '" style="color:#A88B57">عمر الياسي للعقارات</a></p></body></html>';
	exit;
}, 0 );

/* ---------- admin (from the app) ---------- */
function oay_mail_state() {
	$c = oay_mail_cfg(); $q = get_option( 'oay_mail_q', array() );
	return array( 'on' => (bool) $c['on'], 'day' => (int) $c['day'], 'hour' => (int) $c['hour'], 'sent' => (int) $c['sent'], 'fail' => (int) $c['fail'],
		'started' => (int) $c['started'] * 1000, 'queue' => is_array( $q ) ? count( $q ) : 0, 'audience' => count( oay_mail_audience() ), 'pool' => count( oay_mail_pool() ) );
}
function oay_acc_adm_mail_get() { oay_acc_need_admin(); oay_acc_ok( array( 'state' => oay_mail_state() ) ); }
function oay_acc_adm_mail_save() {
	oay_acc_need_admin(); $in = oay_acc_in(); $c = oay_mail_cfg();
	if ( isset( $in['on'] ) ) { $c['on'] = (bool) $in['on']; }
	if ( isset( $in['day'] ) ) { $c['day'] = max( 1, min( 7, (int) $in['day'] ) ); }
	if ( isset( $in['hour'] ) ) { $c['hour'] = max( 0, min( 23, (int) $in['hour'] ) ); }
	oay_mail_cfg_set( $c ); oay_acc_ok( array( 'state' => oay_mail_state() ) );
}
function oay_acc_adm_mail_test() {
	$u = oay_acc_need_admin(); oay_acc_limit( 'mailtest', 6 );
	if ( ! oay_mail_send_one( $u->ID ) ) { oay_acc_err( 'تعذّر الإرسال — تأكد من إعدادات البريد في الموقع أو من وجود أراضٍ متاحة بأسعار' ); }
	oay_acc_ok( array( 'to' => $u->user_email ) );
}
function oay_acc_adm_mail_now() {
	oay_acc_need_admin();
	$q = get_option( 'oay_mail_q', array() ); if ( is_array( $q ) && $q ) { oay_acc_err( 'يوجد إرسال جارٍ — انتظر حتى ينتهي' ); }
	oay_mail_start(); oay_acc_ok( array( 'state' => oay_mail_state() ) );
}
