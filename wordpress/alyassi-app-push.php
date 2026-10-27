<?php
/**
 * Plugin Name: Alyassi App – Instant notifications
 * Description: Sends a push notification to the mobile app the moment a plot's price or status changes on an interactive plan, manages limited-time offers, and serves the live changes / offers list to the app.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

const OAY_APP_ID  = '9ea9b0f0-c240-495a-8c63-3a2d4a1a11be';
const OAY_APP_URL = 'https://hamadasf.github.io/alyassi-app/';

/* Let the web/iPhone app read live availability & the changes list. */
function oay_cors() {
	$o = isset( $_SERVER['HTTP_ORIGIN'] ) ? $_SERVER['HTTP_ORIGIN'] : '';
	if ( 'https://hamadasf.github.io' === $o ) {
		header( 'Access-Control-Allow-Origin: ' . $o );
		header( 'Vary: Origin' );
	}
}
add_action( 'admin_init', function () {
	if ( wp_doing_ajax() && isset( $_REQUEST['action'] ) && in_array( $_REQUEST['action'], array( 'dn_state', 'oay_changes' ), true ) ) { oay_cors(); }
}, 1 );

function oay_ajax_changes() {
	nocache_headers();
	wp_send_json( array( 'at' => time() * 1000, 'items' => get_option( 'oay_changes', array() ), 'offers' => array_values( oay_offers() ) ) );
}
add_action( 'wp_ajax_oay_changes', 'oay_ajax_changes' );
add_action( 'wp_ajax_nopriv_oay_changes', 'oay_ajax_changes' );

/* Watch every project's saved state. */
add_action( 'init', function () {
	if ( ! function_exists( 'dnp_projects' ) ) { return; }
	foreach ( dnp_projects() as $slug => $p ) {
		if ( empty( $p['opt'] ) ) { continue; }
		$name = isset( $p['name'] ) ? $p['name'] : $slug;
		add_action( 'update_option_' . $p['opt'], function ( $old, $new ) use ( $slug, $name ) {
			oay_handle_change( $slug, $name, $old, $new );
		}, 10, 2 );
	}
}, 20 );

function oay_plots( $v ) {
	if ( is_string( $v ) ) { $v = json_decode( $v, true ); }
	return ( is_array( $v ) && isset( $v['plots'] ) && is_array( $v['plots'] ) ) ? $v['plots'] : array();
}

function oay_handle_change( $slug, $name, $old, $new ) {
	$a = oay_plots( $old ); $b = oay_plots( $new );
	if ( ! $b ) { return; }
	$now = (int) round( microtime( true ) * 1000 ); $ch = array();
	foreach ( $b as $n => $p ) {
		$s = isset( $p['s'] ) ? $p['s'] : ''; if ( '' === $s ) { continue; }
		$t = isset( $p['total'] ) ? (int) $p['total'] : 0;
		$base = array( 't' => $now, 'id' => $slug . ':' . $n, 'n' => (string) $n, 'project' => $slug, 'projectName' => $name );
		if ( ! isset( $a[ $n ] ) || empty( $a[ $n ]['s'] ) ) {
			if ( 'av' === $s ) { $ch[] = $base + array( 'kind' => 'new', 'to' => $t ); }
			continue;
		}
		$os = $a[ $n ]['s']; $ot = isset( $a[ $n ]['total'] ) ? (int) $a[ $n ]['total'] : 0;
		if ( $os !== $s ) { $ch[] = $base + array( 'kind' => 'status', 'from' => $os, 'to' => $s ); }
		if ( $ot !== $t && 'sold' !== $s ) { $ch[] = $base + array( 'kind' => 'price', 'from' => $ot, 'to' => $t ); }
	}
	if ( ! $ch ) { return; }
	$log = array_slice( array_merge( $ch, (array) get_option( 'oay_changes', array() ) ), 0, 300 );
	update_option( 'oay_changes', $log, false );
	oay_send( $ch );
}

function oay_send( $ch ) {
	$key = trim( (string) get_option( 'oay_onesignal_key', '' ) );
	if ( '' === $key ) { return; }
	$st = array( 'av' => 'متاحة', 'res' => 'محجوزة', 'sold' => 'مباعة' );
	if ( 1 === count( $ch ) ) {
		$c = $ch[0];
		$title = 'قطعة ' . $c['n'] . ' · ' . $c['projectName'];
		if ( 'price' === $c['kind'] ) { $body = 'السعر الجديد: ' . ( $c['to'] ? number_format( $c['to'] ) . ' د.إ' : 'عند الاستفسار' ); }
		elseif ( 'new' === $c['kind'] ) { $body = 'أرض جديدة متاحة' . ( $c['to'] ? ' · ' . number_format( $c['to'] ) . ' د.إ' : '' ); }
		else { $body = 'أصبحت ' . ( isset( $st[ $c['to'] ] ) ? $st[ $c['to'] ] : $c['to'] ); }
	} else {
		$k = array_count_values( wp_list_pluck( $ch, 'kind' ) );
		$parts = array();
		if ( ! empty( $k['price'] ) ) { $parts[] = $k['price'] . ' سعر'; }
		if ( ! empty( $k['status'] ) ) { $parts[] = $k['status'] . ' حالة'; }
		if ( ! empty( $k['new'] ) ) { $parts[] = $k['new'] . ' أرض جديدة'; }
		$title = 'تحديث ' . count( $ch ) . ' أراضٍ · ' . $ch[0]['projectName'];
		$body  = implode( ' · ', $parts );
	}
	wp_remote_post( 'https://api.onesignal.com/notifications?c=push', array(
		'timeout'  => 8,
		'blocking' => false,
		'headers'  => array( 'Content-Type' => 'application/json', 'Authorization' => 'Key ' . $key ),
		'body'     => wp_json_encode( array(
			'app_id' => OAY_APP_ID, 'target_channel' => 'push', 'included_segments' => array( 'Total Subscriptions' ),
			'headings' => array( 'en' => $title, 'ar' => $title ), 'contents' => array( 'en' => $body, 'ar' => $body ),
			'web_url' => OAY_APP_URL . '#updates', 'data' => array( 'open' => 'updates', 'id' => $ch[0]['id'] ), 'ttl' => 86400,
		) ),
	) );
}

/* Settings → App notifications: key field + test button. */
add_action( 'admin_menu', function () {
	add_options_page( 'إشعارات التطبيق', 'إشعارات التطبيق', 'manage_options', 'oay-push', 'oay_settings_page' );
} );
function oay_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) { return; }
	$msg = '';
	if ( isset( $_POST['oay_nonce'] ) && wp_verify_nonce( $_POST['oay_nonce'], 'oay' ) ) {
		if ( isset( $_POST['oay_key'] ) && '' !== trim( $_POST['oay_key'] ) ) { update_option( 'oay_onesignal_key', sanitize_text_field( wp_unslash( $_POST['oay_key'] ) ), false ); $msg = 'تم حفظ المفتاح.'; }
		if ( isset( $_POST['oay_test'] ) ) { oay_send( array( array( 'kind' => 'new', 'n' => 'تجربة', 'projectName' => 'عمر الياسي للعقارات', 'to' => 0, 'id' => 'test' ) ) ); $msg = 'تم إرسال إشعار تجربة.'; }
	}
	$has = '' !== get_option( 'oay_onesignal_key', '' );
	echo '<div class="wrap" dir="rtl"><h1>إشعارات التطبيق</h1>';
	if ( $msg ) { echo '<div class="notice notice-success"><p>' . esc_html( $msg ) . '</p></div>'; }
	echo '<p>عند تغيير سعر أو حالة أي قطعة في المخططات يُرسل إشعار فوراً لكل من فعّل الإشعارات في التطبيق.</p>';
	echo '<form method="post">'; wp_nonce_field( 'oay', 'oay_nonce' );
	echo '<table class="form-table"><tr><th>مفتاح OneSignal (REST API Key)</th><td><input type="password" name="oay_key" class="regular-text" autocomplete="off" placeholder="' . ( $has ? 'محفوظ ✓ — اتركه فارغاً للإبقاء عليه' : 'الصق المفتاح هنا' ) . '"></td></tr></table>';
	submit_button( 'حفظ' );
	if ( $has ) { echo '<p><button class="button" name="oay_test" value="1">إرسال إشعار تجربة</button></p>'; }
	echo '</form></div>';
}

/* ================= Limited-time offers ================= */
function oay_now_ms() { return (int) round( microtime( true ) * 1000 ); }

/** Active offers (expired ones are dropped). */
function oay_offers() {
	$all = (array) get_option( 'oay_offers', array() ); $now = oay_now_ms(); $out = array();
	foreach ( $all as $id => $o ) { if ( is_array( $o ) && ! empty( $o['until'] ) && (int) $o['until'] > $now ) { $out[ $id ] = $o; } }
	if ( count( $out ) !== count( $all ) ) { update_option( 'oay_offers', $out, false ); }
	return $out;
}

/** Live info for one plot from the plan's saved state. */
function oay_plot_info( $slug, $n ) {
	if ( ! function_exists( 'dnp_projects' ) ) { return null; }
	$ps = dnp_projects(); if ( empty( $ps[ $slug ] ) ) { return null; }
	$p = $ps[ $slug ]; $plots = empty( $p['opt'] ) ? array() : oay_plots( get_option( $p['opt'] ) );
	if ( ! isset( $plots[ $n ] ) || empty( $plots[ $n ]['s'] ) ) { return null; }
	$q = $plots[ $n ];
	$total = ! empty( $q['total'] ) ? (int) $q['total'] : ( ( ! empty( $q['ppf'] ) && ! empty( $q['ft'] ) ) ? (int) round( $q['ppf'] * $q['ft'] ) : 0 );
	return array( 'name' => isset( $p['name'] ) ? $p['name'] : $slug, 's' => $q['s'], 'total' => $total );
}

function oay_fmt_until( $ms ) { return wp_date( 'j/n/Y', (int) floor( $ms / 1000 ) ); }

function oay_send_offer( $o ) {
	$key = trim( (string) get_option( 'oay_onesignal_key', '' ) );
	if ( '' === $key ) { return false; }
	$title = '🔥 عرض لفترة محدودة · مشروع ' . $o['projectName'];
	$price = (int) $o['price'] ? (int) $o['price'] : (int) $o['old'];
	$body  = 'أرض مميزة رقم ' . $o['n'] . ( $price ? ' بسعر ' . number_format( $price ) . ' درهم' : '' );
	if ( (int) $o['price'] && (int) $o['old'] > (int) $o['price'] ) { $body .= ' بدلاً من ' . number_format( $o['old'] ); }
	if ( ! empty( $o['note'] ) ) { $body .= ' · ' . $o['note']; }
	$body .= ' · العرض حتى ' . oay_fmt_until( $o['until'] );
	$r = wp_remote_post( 'https://api.onesignal.com/notifications?c=push', array(
		'timeout' => 10,
		'headers' => array( 'Content-Type' => 'application/json', 'Authorization' => 'Key ' . $key ),
		'body'    => wp_json_encode( array(
			'app_id' => OAY_APP_ID, 'target_channel' => 'push', 'included_segments' => array( 'Total Subscriptions' ),
			'headings' => array( 'en' => $title, 'ar' => $title ), 'contents' => array( 'en' => $body, 'ar' => $body ),
			'web_url' => OAY_APP_URL . '#land=' . rawurlencode( $o['id'] ), 'data' => array( 'open' => 'land', 'id' => $o['id'] ),
			'ttl' => 86400, 'priority' => 10,
		) ),
	) );
	return ! is_wp_error( $r ) && wp_remote_retrieve_response_code( $r ) < 300;
}

add_action( 'admin_menu', function () {
	add_menu_page( 'عروض التطبيق', 'عروض التطبيق', 'manage_options', 'oay-offers', 'oay_offers_page', 'dashicons-megaphone', 26 );
} );

function oay_offers_page() {
	if ( ! current_user_can( 'manage_options' ) ) { return; }
	$msg = ''; $err = '';
	$projects = function_exists( 'dnp_projects' ) ? dnp_projects() : array();
	if ( isset( $_POST['oay_nonce'] ) && wp_verify_nonce( $_POST['oay_nonce'], 'oay_offers' ) ) {
		$offers = oay_offers();
		if ( isset( $_POST['oay_add'] ) ) {
			$slug  = sanitize_key( wp_unslash( isset( $_POST['project'] ) ? $_POST['project'] : '' ) );
			$n     = preg_replace( '/[^0-9A-Za-z\-]/', '', wp_unslash( isset( $_POST['n'] ) ? $_POST['n'] : '' ) );
			$price = (int) preg_replace( '/[^0-9]/', '', wp_unslash( isset( $_POST['price'] ) ? $_POST['price'] : '' ) );
			$date  = sanitize_text_field( wp_unslash( isset( $_POST['until'] ) ? $_POST['until'] : '' ) );
			$note  = mb_substr( sanitize_text_field( wp_unslash( isset( $_POST['note'] ) ? $_POST['note'] : '' ) ), 0, 80 );
			$info  = oay_plot_info( $slug, $n );
			$end   = $date ? date_create( $date . ' 23:59:59', wp_timezone() ) : false;
			if ( ! $info ) { $err = 'لم يتم العثور على القطعة رقم ' . esc_html( $n ) . ' في هذا المشروع.'; }
			elseif ( 'av' !== $info['s'] ) { $err = 'القطعة رقم ' . esc_html( $n ) . ' غير متاحة حالياً (محجوزة أو مباعة).'; }
			elseif ( ! $end || $end->getTimestamp() * 1000 <= oay_now_ms() ) { $err = 'اختر تاريخ انتهاء في المستقبل.'; }
			else {
				$id = $slug . ':' . $n;
				$o = array( 'id' => $id, 'project' => $slug, 'projectName' => $info['name'], 'n' => (string) $n, 'price' => $price,
					'old' => $info['total'], 'until' => $end->getTimestamp() * 1000, 'note' => $note, 't' => oay_now_ms() );
				$offers[ $id ] = $o;
				update_option( 'oay_offers', $offers, false );
				$log = (array) get_option( 'oay_changes', array() );
				array_unshift( $log, array( 't' => $o['t'], 'id' => $id, 'n' => $o['n'], 'project' => $slug, 'projectName' => $o['projectName'],
					'kind' => 'offer', 'from' => $o['old'], 'to' => $price, 'until' => $o['until'], 'note' => $note ) );
				update_option( 'oay_changes', array_slice( $log, 0, 300 ), false );
				$msg = 'تمت إضافة العرض على القطعة ' . $n . '.';
				if ( ! empty( $_POST['notify'] ) ) { $msg .= oay_send_offer( $o ) ? ' تم إرسال الإشعار ✓' : ' (تعذّر إرسال الإشعار — تأكد من مفتاح OneSignal في الإعدادات ← إشعارات التطبيق)'; }
			}
		}
		if ( ! empty( $_POST['del'] ) ) { $id = sanitize_text_field( wp_unslash( $_POST['del'] ) ); unset( $offers[ $id ] ); update_option( 'oay_offers', $offers, false ); $msg = 'تم إيقاف العرض.'; }
		if ( ! empty( $_POST['resend'] ) ) { $id = sanitize_text_field( wp_unslash( $_POST['resend'] ) ); if ( isset( $offers[ $id ] ) ) { $msg = oay_send_offer( $offers[ $id ] ) ? 'تم إرسال الإشعار مرة أخرى ✓' : 'تعذّر إرسال الإشعار.'; } }
	}
	$offers = oay_offers();
	echo '<div class="wrap" dir="rtl"><h1>🔥 عروض لفترة محدودة</h1>';
	if ( $msg ) { echo '<div class="notice notice-success"><p>' . esc_html( $msg ) . '</p></div>'; }
	if ( $err ) { echo '<div class="notice notice-error"><p>' . $err . '</p></div>'; }
	echo '<p>اختر المشروع ورقم القطعة. تظهر الأرض في التطبيق ضمن «عروض لفترة محدودة» مع عدّاد للوقت المتبقي، ويصل إشعار فوري لكل المشتركين. ينتهي العرض تلقائياً في التاريخ المحدد، أو يختفي إذا حُجزت القطعة أو بيعت.</p>';
	echo '<form method="post" style="background:#fff;padding:16px 20px;border:1px solid #dcdcde;border-radius:8px;max-width:720px">'; wp_nonce_field( 'oay_offers', 'oay_nonce' );
	echo '<table class="form-table"><tr><th>المشروع</th><td><select name="project" required>';
	foreach ( $projects as $slug => $p ) { echo '<option value="' . esc_attr( $slug ) . '">' . esc_html( isset( $p['name'] ) ? $p['name'] : $slug ) . '</option>'; }
	echo '</select></td></tr>';
	echo '<tr><th>رقم القطعة</th><td><input name="n" required class="regular-text" inputmode="numeric" style="max-width:160px"></td></tr>';
	echo '<tr><th>سعر العرض (درهم)</th><td><input name="price" class="regular-text" inputmode="numeric" style="max-width:200px" placeholder="مثال: 350000"><p class="description">اتركه فارغاً لعرض السعر الحالي في المخطط.</p></td></tr>';
	echo '<tr><th>ينتهي العرض في</th><td><input type="date" name="until" required value="' . esc_attr( wp_date( 'Y-m-d', time() + 7 * DAY_IN_SECONDS ) ) . '"></td></tr>';
	echo '<tr><th>ملاحظة قصيرة (اختياري)</th><td><input name="note" class="regular-text" maxlength="80" placeholder="مثال: خصم خاص للدفع النقدي"></td></tr>';
	echo '<tr><th>إشعار</th><td><label><input type="checkbox" name="notify" value="1" checked> إرسال إشعار فوري للمشتركين</label></td></tr></table>';
	submit_button( 'إضافة العرض', 'primary', 'oay_add' );
	echo '</form>';
	echo '<h2 style="margin-top:28px">العروض الحالية (' . count( $offers ) . ')</h2>';
	if ( ! $offers ) { echo '<p>لا توجد عروض حالياً.</p>'; }
	else {
		echo '<form method="post">'; wp_nonce_field( 'oay_offers', 'oay_nonce' );
		echo '<table class="widefat striped" style="max-width:980px"><thead><tr><th>المشروع</th><th>القطعة</th><th>سعر العرض</th><th>السعر الأصلي</th><th>ينتهي</th><th>الحالة</th><th></th></tr></thead><tbody>';
		$st = array( 'av' => 'متاحة', 'res' => 'محجوزة', 'sold' => 'مباعة' );
		foreach ( $offers as $id => $o ) {
			$i = oay_plot_info( $o['project'], $o['n'] ); $s = $i ? $i['s'] : '';
			echo '<tr><td>' . esc_html( $o['projectName'] ) . '</td><td><b>' . esc_html( $o['n'] ) . '</b>' . ( $o['note'] ? '<br><small>' . esc_html( $o['note'] ) . '</small>' : '' ) . '</td>';
			echo '<td>' . ( $o['price'] ? number_format( $o['price'] ) : '—' ) . '</td><td>' . ( $i && $i['total'] ? number_format( $i['total'] ) : '—' ) . '</td>';
			echo '<td>' . esc_html( oay_fmt_until( $o['until'] ) ) . '</td><td>' . esc_html( isset( $st[ $s ] ) ? $st[ $s ] : '—' ) . ( 'av' !== $s ? ' <small>(مخفي في التطبيق)</small>' : '' ) . '</td>';
			echo '<td><button class="button" name="resend" value="' . esc_attr( $id ) . '">إعادة الإشعار</button> <button class="button button-link-delete" name="del" value="' . esc_attr( $id ) . '" onclick="return confirm(\'إيقاف هذا العرض؟\')">إيقاف</button></td></tr>';
		}
		echo '</tbody></table></form>';
	}
	echo '</div>';
}

/* ================= Plot PDF for the app's share card =================
 * The iPhone (web) app cannot read files from another site, so the plot PDF is served here with CORS.
 * Only PDF attachments are served. */
function oay_ajax_doc() {
	$id = isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0;
	$post = $id ? get_post( $id ) : null;
	if ( ! $post || 'attachment' !== $post->post_type || 'application/pdf' !== get_post_mime_type( $post ) ) { status_header( 404 ); exit; }
	$file = get_attached_file( $id );
	if ( ! $file || ! is_readable( $file ) || filesize( $file ) > 30 * MB_IN_BYTES ) { status_header( 404 ); exit; }
	header( 'Access-Control-Allow-Origin: *' );
	header( 'Content-Type: application/pdf' );
	header( 'Content-Length: ' . filesize( $file ) );
	header( 'Cache-Control: public, max-age=3600' );
	readfile( $file );
	exit;
}
add_action( 'wp_ajax_oay_doc', 'oay_ajax_doc' );
add_action( 'wp_ajax_nopriv_oay_doc', 'oay_ajax_doc' );

/* Project plan files with CORS, so the app can draw the plot's location exactly like the website's plan:
 * kind=bg (aerial photo, small), bgraw (aerial photo, full size), vec (the plan's line drawing). Only these files are served. */
function oay_ajax_img() {
	$slug  = isset( $_GET['project'] ) ? sanitize_key( wp_unslash( $_GET['project'] ) ) : '';
	$kinds = array( 'bg' => array( 'bg.jpg', 'image/jpeg' ), 'bgraw' => array( 'bg.bin', 'application/octet-stream' ), 'vec' => array( 'vec.bin', 'application/octet-stream' ) );
	$kind  = isset( $_GET['kind'], $kinds[ $_GET['kind'] ] ) ? $_GET['kind'] : 'bg';
	$file  = $slug ? WP_PLUGIN_DIR . '/alyassi-dabdaba-plan/assets/p/' . $slug . '/' . $kinds[ $kind ][0] : '';
	if ( ! $file || ! is_readable( $file ) ) { status_header( 404 ); exit; }
	header( 'Access-Control-Allow-Origin: *' );
	header( 'Content-Type: ' . $kinds[ $kind ][1] );
	header( 'Content-Length: ' . filesize( $file ) );
	header( 'Cache-Control: public, max-age=86400' );
	readfile( $file );
	exit;
}
add_action( 'wp_ajax_oay_img', 'oay_ajax_img' );
add_action( 'wp_ajax_nopriv_oay_img', 'oay_ajax_img' );
