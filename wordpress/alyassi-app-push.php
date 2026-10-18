<?php
/**
 * Plugin Name: Alyassi App – Instant notifications
 * Description: Sends a push notification to the mobile app the moment a plot's price or status changes on an interactive plan, and serves the live changes list to the app.
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
	wp_send_json( array( 'at' => time() * 1000, 'items' => get_option( 'oay_changes', array() ) ) );
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
