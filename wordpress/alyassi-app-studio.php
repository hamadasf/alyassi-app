<?php
/**
 * Plugin Name: Alyassi App – Motion studio from the app
 * Description: Lets the management open «استوديو الحركة» (the map-video studio of the alyassi-dabdaba-plan plugin) from the app.
 *              The app asks for a one-time link (valid two minutes, management only); opening it signs the same account in
 *              on the website and lands on /projects-map/?studio=1. Uses the helpers of alyassi-app-accounts.php.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

add_action( 'wp_ajax_oay_acc_studio_link', 'oay_acc_studio_link' );
add_action( 'wp_ajax_nopriv_oay_acc_studio_link', 'oay_acc_studio_link' );
add_action( 'wp_ajax_oay_studio_enter', 'oay_studio_enter' );
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
