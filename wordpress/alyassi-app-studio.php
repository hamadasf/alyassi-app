<?php
/**
 * Plugin Name: Alyassi App – Motion studio from the app
 * Description: «استوديو الفيديو» (the map-video studio of the alyassi-dabdaba-plan plugin) for the management, inside the app.
 *              1) oay_acc_studio: the app loads the studio's own code from the website and runs it in its own screen; every
 *                 call the studio makes (plots, AI, voice) comes here with the app's sign-in and is answered by the plugin's
 *                 own handlers, as the management. 2) oay_acc_studio_link: a one-time link (two minutes) that opens the
 *                 studio on the website in the phone's browser instead. Uses the helpers of alyassi-app-accounts.php.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

add_action( 'wp_ajax_oay_acc_studio_link', 'oay_acc_studio_link' );
add_action( 'wp_ajax_nopriv_oay_acc_studio_link', 'oay_acc_studio_link' );
add_action( 'wp_ajax_oay_studio_enter', 'oay_studio_enter' );
add_action( 'wp_ajax_oay_acc_studio', 'oay_acc_studio' );
add_action( 'wp_ajax_nopriv_oay_acc_studio', 'oay_acc_studio' );

class Oay_Studio_Done extends Exception {}

/** the studio inside the app: what it needs to start, and its calls answered by the plugin's own handlers */
function oay_acc_studio() {
	if ( ! function_exists( 'oay_acc_need_admin' ) ) { wp_send_json( array( 'ok' => false, 'error' => 'غير متاح' ), 500 ); }
	oay_acc_cors();
	$u = oay_acc_need_admin();
	if ( ! function_exists( 'dnp_map_data' ) || ! function_exists( 'dnp_ai_public' ) || ! function_exists( 'dnp_media_public' ) ) {
		oay_acc_err( 'حدّث إضافة المخططات على الموقع (نسخة 2.67.0 أو أحدث)' );
	}
	wp_set_current_user( $u->ID );
	$a = oay_acc_arg( 'a', 40 );
	if ( 'boot' === $a ) {
		$logo = DNP_DIR . '/assets/logo.png';
		oay_acc_ok( array( 'boot' => array(
			'map'   => dnp_map_data(),
			'logo'  => is_readable( $logo ) && filesize( $logo ) < 1500000 ? 'data:image/png;base64,' . base64_encode( (string) file_get_contents( $logo ) ) : dnp_logo_url(), // phpcs:ignore
			'ai'    => dnp_ai_public(),
			'media' => dnp_media_public(),
			'notes' => function_exists( 'dnp_notes_all' ) ? (object) dnp_notes_all() : (object) array(),
			'css'   => array( dnp_asset( 'studio/maplibre-gl.css' ), dnp_asset( 'studio/studio.css' ) ),
			'js'    => array( dnp_asset( 'studio/maplibre-gl.js' ), dnp_asset( 'studio/mp4-muxer.js' ), dnp_asset( 'studio/studio.js' ) ),
			'fonts' => array( dnp_asset( 'fonts/tajawal-400.woff2' ), dnp_asset( 'fonts/tajawal-800.woff2' ) ),
			'ver'   => defined( 'DNP_VERSION' ) ? DNP_VERSION : '',
		) ) );
	}
	$map = array( 'dn_mapplots' => array( 'dnp_ajax_mapplots', '' ), 'dn_ai' => array( 'dnp_ajax_ai', 'dnp_ai' ), 'dn_ai_save' => array( 'dnp_ajax_ai_save', 'dnp_ai' ), 'dn_ai_models' => array( 'dnp_ajax_ai_models', 'dnp_ai' ), 'dn_notes_save' => array( 'dnp_ajax_notes_save', 'dnp_ai' ),
		'dn_media_save' => array( 'dnp_ajax_media_save', 'dnp_media' ), 'dn_tts' => array( 'dnp_ajax_tts', 'dnp_media' ), 'dn_voices' => array( 'dnp_ajax_voices', 'dnp_media' ), 'dn_voice_use' => array( 'dnp_ajax_voice_use', 'dnp_media' ) );
	if ( ! isset( $map[ $a ] ) || ! function_exists( $map[ $a ][0] ) ) { oay_acc_err( 'غير مسموح', 403 ); }
	$in = oay_acc_in(); $d = isset( $in['d'] ) && is_array( $in['d'] ) ? $in['d'] : array();
	$req = array();
	foreach ( $d as $k => $v ) { if ( is_scalar( $v ) && preg_match( '/^[a-z_]{1,20}$/', (string) $k ) ) { $req[ $k ] = wp_slash( (string) $v ); } }
	if ( $map[ $a ][1] ) { $req['nonce'] = wp_create_nonce( $map[ $a ][1] ); }
	$_POST = $req; $_GET = $req; $_REQUEST = $req; // phpcs:ignore WordPress.Security.NonceVerification
	// the handler answers with wp_send_json(): keep its answer and hand it back inside ours
	$stop = function () { throw new Oay_Studio_Done(); };
	$hand = function () use ( $stop ) { return $stop; };
	add_filter( 'wp_die_ajax_handler', $hand, 99 );
	ob_start();
	try { call_user_func( $map[ $a ][0] ); } catch ( Oay_Studio_Done $e ) { /* answered */ }
	$out = (string) ob_get_clean();
	remove_filter( 'wp_die_ajax_handler', $hand, 99 );
	status_header( 200 );
	$j = json_decode( $out, true );
	if ( ! is_array( $j ) ) { oay_acc_err( 'رد غير متوقع من الإضافة' ); }
	oay_acc_ok( array( 'j' => $j ) );
}
add_action( 'wp_ajax_nopriv_oay_studio_enter', 'oay_studio_enter' );

/** the app (management only) → a one-time sign-in link to the studio */
function oay_acc_studio_link() {
	if ( ! function_exists( 'oay_acc_need_admin' ) ) { wp_send_json( array( 'ok' => false, 'error' => 'غير متاح' ), 500 ); }
	oay_acc_cors();
	$u = oay_acc_need_admin();
	if ( ! function_exists( 'dnp_studio_page' ) ) { oay_acc_err( 'حدّث إضافة المخططات على الموقع (نسخة 2.66.0 أو أحدث)' ); }
	$k = bin2hex( random_bytes( 24 ) );
	set_transient( 'oay_st_' . hash( 'sha256', $k ), (int) $u->ID, 2 * MINUTE_IN_SECONDS );
	oay_acc_ok( array( 'url' => admin_url( 'admin-ajax.php?action=oay_studio_enter&k=' . $k ) ) );
}

/** the link itself: used once, then the website session opens the studio */
function oay_studio_enter() {
	nocache_headers();
	$k   = isset( $_GET['k'] ) ? preg_replace( '/[^a-f0-9]/', '', (string) wp_unslash( $_GET['k'] ) ) : '';
	$key = 'oay_st_' . hash( 'sha256', $k );
	$uid = 48 === strlen( $k ) ? (int) get_transient( $key ) : 0;
	delete_transient( $key );
	$u = $uid ? get_userdata( $uid ) : null;
	if ( ! $u || ! user_can( $u, 'manage_options' ) || get_user_meta( $uid, 'oay_banned', true ) ) {
		wp_die( 'انتهت صلاحية الرابط — افتح الاستوديو من التطبيق مرة أخرى.', 'استوديو الحركة', array( 'response' => 403 ) );
	}
	if ( get_current_user_id() !== $uid ) {
		wp_set_current_user( $uid );
		wp_set_auth_cookie( $uid, true, is_ssl() );
	}
	wp_safe_redirect( home_url( '/projects-map/?studio=1&app=1' ) );
	exit;
}
