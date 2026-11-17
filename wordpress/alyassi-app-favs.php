<?php
/**
 * Plugin Name: Alyassi App – Favourites alerts
 * Description: The app sends each phone's favourite lands (signed in: by member · otherwise: by the phone's random id).
 *              When a favourite company plot gets a lower price or becomes available again, that phone gets a push.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'favs_sync' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}

/** who → [land ids]   (who = «u<user id>» or «d<phone id>») */
function oay_favs_all() { $m = get_option( 'oay_favs', array() ); return is_array( $m ) ? $m : array(); }

function oay_acc_favs_sync() {
	oay_acc_limit( 'favs', 60 );
	$u = oay_acc_user_from_token( oay_acc_arg( 'token', 120 ) );
	$dev = preg_replace( '/[^a-z0-9]/', '', strtolower( oay_acc_arg( 'dev', 40 ) ) );
	$who = $u ? 'u' . $u->ID : ( strlen( $dev ) >= 8 ? 'd' . $dev : '' );
	if ( ! $who ) { oay_acc_err( 'bad' ); }
	$in = oay_acc_in(); $ids = array();
	foreach ( array_slice( (array) ( $in['ids'] ?? array() ), 0, 100 ) as $id ) {
		$id = (string) $id; if ( preg_match( '/^[a-z0-9-]{2,40}:[A-Za-z0-9-]{1,12}$/', $id ) ) { $ids[] = $id; }
	}
	$m = oay_favs_all();
	if ( $u && strlen( $dev ) >= 8 ) { unset( $m[ 'd' . $dev ] ); }   // signed in now: one entry per person
	$before = (array) ( $m[ $who ]['ids'] ?? array() );
	if ( $ids ) { $m[ $who ] = array( 't' => time(), 'ids' => array_values( array_unique( $ids ) ) ); } else { unset( $m[ $who ] ); }
	if ( $u && $before ) { foreach ( array_diff( $ids, $before ) as $nid ) { do_action( 'oay_fav_added', $u->ID, $nid ); } }   // a phone's first sync is not «new»
	if ( count( $m ) > 6000 ) { uasort( $m, function ( $a, $b ) { return ( $b['t'] ?? 0 ) <=> ( $a['t'] ?? 0 ); } ); $m = array_slice( $m, 0, 6000, true ); }
	update_option( 'oay_favs', $m, false );
	oay_acc_ok( array( 'n' => count( $ids ) ) );
}

/* a favourite plot is cheaper or available again → push to whoever saved it */
add_action( 'oay_plot_changes', function ( $slug, $name, $ch, $new ) {
	if ( ! empty( $GLOBALS['oay_no_push'] ) ) { return; }
	$key = trim( (string) get_option( 'oay_onesignal_key', '' ) ); if ( '' === $key ) { return; }
	$st = function_exists( 'oay_plots' ) ? oay_plots( $new ) : array(); $m = oay_favs_all(); if ( ! $m ) { return; }
	$hits = array();
	foreach ( (array) $ch as $c ) {
		$n = (string) ( $c['n'] ?? '' ); $q = $st[ $n ] ?? array(); if ( ( $q['s'] ?? '' ) !== 'av' ) { continue; }
		$from = (int) ( $c['from'] ?? 0 ); $to = (int) ( $c['to'] ?? 0 );
		if ( 'price' === ( $c['kind'] ?? '' ) && $from && $to && $to < $from ) { $why = 'نزل السعر من ' . number_format( $from ) . ' إلى ' . number_format( $to ) . ' د.إ'; }
		elseif ( 'status' === ( $c['kind'] ?? '' ) ) { $why = 'عادت متاحة للبيع' . ( ! empty( $q['total'] ) ? ' · ' . number_format( (int) $q['total'] ) . ' د.إ' : '' ); }
		else { continue; }
		$hits[ $slug . ':' . $n ] = array( 'n' => $n, 'why' => $why );
	}
	if ( ! $hits ) { return; }
	foreach ( $hits as $id => $h ) {
		$al = array();
		foreach ( $m as $who => $e ) { if ( in_array( $id, (array) ( $e['ids'] ?? array() ), true ) ) { $al[] = ( 'u' === $who[0] ? 'oay-' : 'dev-' ) . substr( $who, 1 ); } }
		if ( ! $al ) { continue; }
		$title = '❤️ أرض في مفضلتك: قطعة ' . $h['n'] . ' · ' . $name;
		foreach ( array_chunk( $al, 2000 ) as $part ) {
			wp_remote_post( 'https://api.onesignal.com/notifications?c=push', array( 'timeout' => 8, 'blocking' => false,
				'headers' => array( 'Content-Type' => 'application/json', 'Authorization' => 'Key ' . $key ),
				'body' => wp_json_encode( array( 'app_id' => OAY_APP_ID, 'target_channel' => 'push', 'include_aliases' => array( 'external_id' => $part ),
					'headings' => array( 'en' => $title, 'ar' => $title ), 'contents' => array( 'en' => $h['why'], 'ar' => $h['why'] ),
					'data' => array( 'open' => 'land', 'id' => $id ), 'web_url' => OAY_APP_URL, 'ttl' => 86400 ) + ( function_exists( 'oay_push_img' ) ? oay_push_img( array( 'id' => $id ) ) : array() ) ) ) );
		}
	}
}, 30, 4 );

/* a new plot like one in a favourites list (same project, same use, area within 15%) → push to whoever saved that one.
   One push per person per project change, and never for a plot already in their list. */
add_action( 'oay_plot_changes', function ( $slug, $name, $ch, $new ) {
	if ( ! empty( $GLOBALS['oay_no_push'] ) || ! function_exists( 'oay_plan_plots' ) ) { return; }
	$key = trim( (string) get_option( 'oay_onesignal_key', '' ) ); if ( '' === $key ) { return; }
	$m = oay_favs_all(); if ( ! $m ) { return; }
	$pp = oay_plan_plots( $slug ); $st = function_exists( 'oay_plots' ) ? oay_plots( $new ) : array();
	$ft = function ( $n ) use ( $pp, $st ) { $s = (float) ( $st[ $n ]['ft'] ?? 0 ); return $s > 0 ? $s : (float) ( $pp[ $n ][1] ?? 0 ); };
	$fresh = array();
	foreach ( (array) $ch as $c ) {
		$n = (string) ( $c['n'] ?? '' ); if ( 'new' !== ( $c['kind'] ?? '' ) || ( $st[ $n ]['s'] ?? '' ) !== 'av' || ! isset( $pp[ $n ] ) ) { continue; }
		$fresh[ $n ] = array( $pp[ $n ][0], $ft( $n ), (int) ( $st[ $n ]['total'] ?? 0 ) );
	}
	if ( ! $fresh ) { return; }
	$sent = array();
	foreach ( $m as $who => $e ) {
		$ids = (array) ( $e['ids'] ?? array() ); $best = null;
		foreach ( $ids as $id ) {
			if ( 0 !== strpos( $id, $slug . ':' ) ) { continue; }
			$fn = substr( $id, strlen( $slug ) + 1 ); if ( ! isset( $pp[ $fn ] ) ) { continue; }
			$fu = $pp[ $fn ][0]; $ff = $ft( $fn ); if ( $ff <= 0 ) { continue; }
			foreach ( $fresh as $n => $f ) {
				if ( in_array( $slug . ':' . $n, $ids, true ) || $f[0] !== $fu || $f[1] <= 0 || abs( $f[1] - $ff ) / $ff > 0.15 ) { continue; }
				$best = array( $n, $f, $fn ); break 2;
			}
		}
		if ( $best ) { $sent[ ( 'u' === $who[0] ? 'oay-' : 'dev-' ) . substr( $who, 1 ) ] = $best; }
	}
	foreach ( $sent as $alias => $b ) {
		list( $n, $f, $fn ) = $b; $id = $slug . ':' . $n;
		$title = '✨ أرض جديدة مشابهة لأرض في مفضلتك · ' . $name;
		$body = 'قطعة ' . $n . ' · ' . number_format( (int) round( $f[1] ) ) . ' قدم²' . ( $f[2] ? ' · ' . number_format( $f[2] ) . ' د.إ' : '' ) . ' — مشابهة للقطعة ' . $fn;
		wp_remote_post( 'https://api.onesignal.com/notifications?c=push', array( 'timeout' => 8, 'blocking' => false,
			'headers' => array( 'Content-Type' => 'application/json', 'Authorization' => 'Key ' . $key ),
			'body' => wp_json_encode( array( 'app_id' => OAY_APP_ID, 'target_channel' => 'push', 'include_aliases' => array( 'external_id' => array( $alias ) ),
				'headings' => array( 'en' => $title, 'ar' => $title ), 'contents' => array( 'en' => $body, 'ar' => $body ),
				'data' => array( 'open' => 'land', 'id' => $id ), 'web_url' => OAY_APP_URL, 'ttl' => 86400 ) + ( function_exists( 'oay_push_img' ) ? oay_push_img( array( 'id' => $id ) ) : array() ) ) ) );
		if ( count( $sent ) > 300 ) { break; }
	}
}, 31, 4 );
