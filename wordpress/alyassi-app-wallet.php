<?php
/**
 * Plugin Name: Alyassi App – Broker wallet
 * Description: «محفظتي» for every real-estate office / broker account: their listings, and their deals — lands they
 *              bought (instalments they pay) and lands they sold (instalments they receive, with their commission) — with
 *              the next payment, the upcoming instalments and their earnings. The broker keeps it; the office can view,
 *              add and edit it too. A reminder is pushed the day before and on the day an instalment falls due.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'wallet_get', 'wallet_save', 'wallet_del', 'wallet_pay' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}

/** whose wallet: the signed-in user's own, or (office with «listings») the one asked for */
function oay_wallet_owner() {
	$u = oay_acc_need_user(); $uid = absint( oay_acc_arg( 'uid', 12 ) );
	if ( ! $uid || $uid === (int) $u->ID ) { return array( (int) $u->ID, false ); }
	if ( ! oay_acc_can( $u, 'listings' ) ) { oay_acc_err( 'غير مسموح', 403 ); }
	if ( ! get_userdata( $uid ) ) { oay_acc_err( 'غير موجود', 404 ); }
	return array( $uid, true );
}
function oay_wallet( $uid ) { $w = get_user_meta( $uid, 'oay_wallet', true ); return is_array( $w ) ? array_values( array_filter( $w, 'is_array' ) ) : array(); }
function oay_wallet_put( $uid, $w ) { update_user_meta( $uid, 'oay_wallet', array_values( $w ) ); }
function oay_wallet_out( $uid ) {
	$u = get_userdata( $uid );
	$ads = get_posts( array( 'post_type' => 'lands', 'author' => $uid, 'post_status' => array( 'publish', 'pending', 'draft' ), 'numberposts' => 300 ) );
	$live = 0; $value = 0;
	foreach ( $ads as $p ) { if ( 'publish' === $p->post_status ) { $live++; $value += (float) get_post_meta( $p->ID, '_oay_price', true ); } }
	return array( 'deals' => oay_wallet( $uid ), 'listings' => array( 'live' => $live, 'all' => count( $ads ), 'value' => $value ),
		'who' => $u ? array( 'id' => $uid, 'name' => ( get_user_meta( $uid, 'oay_company', true ) ?: $u->display_name ) ) : null );
}
function oay_acc_wallet_get() { list( $uid ) = oay_wallet_owner(); oay_acc_ok( oay_wallet_out( $uid ) ); }

/** one deal, cleaned: type buy|sell, title, party, price, commission %, schedule [{d, a, p}] */
function oay_wallet_clean( $d, $by ) {
	$type = ( $d['type'] ?? '' ) === 'buy' ? 'buy' : 'sell';
	$s = array();
	foreach ( array_slice( (array) ( $d['sched'] ?? array() ), 0, 120 ) as $r ) {
		if ( ! is_array( $r ) ) { continue; }
		$date = preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) ( $r['d'] ?? '' ) ) ? (string) $r['d'] : '';
		$amt = round( max( 0, (float) ( $r['a'] ?? 0 ) ), 2 ); if ( ! $date || ! $amt ) { continue; }
		$s[] = array( 'd' => $date, 'a' => $amt, 'p' => ! empty( $r['p'] ), 'l' => mb_substr( sanitize_text_field( (string) ( $r['l'] ?? '' ) ), 0, 40 ) );
	}
	usort( $s, function ( $a, $b ) { return strcmp( $a['d'], $b['d'] ); } );
	$title = mb_substr( sanitize_text_field( (string) ( $d['title'] ?? '' ) ), 0, 100 );
	if ( mb_strlen( $title ) < 2 ) { oay_acc_err( 'اكتب اسم الأرض أو رقمها' ); }
	$price = round( max( 0, (float) ( $d['price'] ?? 0 ) ) );
	if ( ! $price ) { oay_acc_err( 'اكتب سعر الأرض' ); }
	return array(
		'id' => preg_match( '/^[a-z0-9]{6,20}$/', (string) ( $d['id'] ?? '' ) ) ? (string) $d['id'] : strtolower( wp_generate_password( 10, false, false ) ),
		'type' => $type, 'title' => $title, 'party' => mb_substr( sanitize_text_field( (string) ( $d['party'] ?? '' ) ), 0, 80 ),
		'project' => sanitize_key( (string) ( $d['project'] ?? '' ) ), 'plot' => mb_substr( sanitize_text_field( (string) ( $d['plot'] ?? '' ) ), 0, 20 ),
		'price' => $price, 'pct' => 'sell' === $type ? max( 0, min( 50, round( (float) ( $d['pct'] ?? 0 ), 2 ) ) ) : 0,
		'comm' => 'sell' === $type ? round( max( 0, (float) ( $d['comm'] ?? 0 ) ) ) : 0,   // a fixed commission instead of a percentage (optional)
		'date' => preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) ( $d['date'] ?? '' ) ) ? (string) $d['date'] : wp_date( 'Y-m-d' ),
		'note' => mb_substr( sanitize_textarea_field( (string) ( $d['note'] ?? '' ) ), 0, 500 ), 'sched' => $s, 'done' => ! empty( $d['done'] ),
		'by' => (int) $by, 't' => time() * 1000,
	);
}
function oay_acc_wallet_save() {
	list( $uid ) = oay_wallet_owner(); $me = oay_acc_user_from_token( oay_acc_arg( 'token', 120 ) );
	$in = oay_acc_in(); $d = oay_wallet_clean( is_array( $in['deal'] ?? null ) ? $in['deal'] : array(), $me ? $me->ID : $uid );
	$w = oay_wallet( $uid ); $found = false;
	foreach ( $w as $i => $x ) { if ( ( $x['id'] ?? '' ) === $d['id'] ) { $w[ $i ] = $d; $found = true; } }
	if ( ! $found ) { if ( count( $w ) >= 300 ) { oay_acc_err( 'وصلت للحد الأقصى من الصفقات' ); } $w[] = $d; }
	oay_wallet_put( $uid, $w );
	oay_acc_ok( oay_wallet_out( $uid ) );
}
function oay_acc_wallet_del() {
	list( $uid ) = oay_wallet_owner(); $id = (string) oay_acc_arg( 'id', 20 );
	oay_wallet_put( $uid, array_filter( oay_wallet( $uid ), function ( $x ) use ( $id ) { return ( $x['id'] ?? '' ) !== $id; } ) );
	oay_acc_ok( oay_wallet_out( $uid ) );
}
/** marks one instalment paid / not paid */
function oay_acc_wallet_pay() {
	list( $uid ) = oay_wallet_owner(); $id = (string) oay_acc_arg( 'id', 20 ); $i = (int) oay_acc_arg( 'i', 4 ); $paid = '1' === oay_acc_arg( 'paid', 1 );
	$w = oay_wallet( $uid );
	foreach ( $w as $k => $x ) { if ( ( $x['id'] ?? '' ) === $id && isset( $x['sched'][ $i ] ) ) { $w[ $k ]['sched'][ $i ]['p'] = $paid; } }
	oay_wallet_put( $uid, $w );
	oay_acc_ok( oay_wallet_out( $uid ) );
}

/* reminders: the day before and on the day an unpaid instalment falls due (checked once a day, in the morning) */
add_action( 'init', function () { if ( ! wp_next_scheduled( 'oay_wallet_daily' ) ) { wp_schedule_event( strtotime( 'tomorrow 05:30' ) ?: time() + DAY_IN_SECONDS, 'daily', 'oay_wallet_daily' ); } } );
add_action( 'oay_wallet_daily', function () {
	if ( ! function_exists( 'oay_push_to' ) ) { return; }
	$today = wp_date( 'Y-m-d' ); $tomorrow = wp_date( 'Y-m-d', time() + DAY_IN_SECONDS );
	foreach ( get_users( array( 'meta_key' => 'oay_wallet', 'fields' => 'ID', 'number' => 5000 ) ) as $uid ) {
		foreach ( oay_wallet( (int) $uid ) as $d ) {
			if ( ! empty( $d['done'] ) ) { continue; }
			foreach ( (array) $d['sched'] as $r ) {
				if ( ! empty( $r['p'] ) || ( $r['d'] !== $today && $r['d'] !== $tomorrow ) ) { continue; }
				$when = $r['d'] === $today ? 'اليوم' : 'غداً';
				$what = 'buy' === $d['type'] ? 'قسط مستحق عليك' : 'قسط مستحق لك';
				oay_push_to( array( (int) $uid ), '💼 ' . $what . ' ' . $when, number_format( $r['a'] ) . ' د.إ · ' . $d['title'] . ( $d['party'] ? ' · ' . $d['party'] : '' ), array( 'open' => 'wallet' ) );
			}
		}
	}
} );
