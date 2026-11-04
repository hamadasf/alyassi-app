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
	if ( $ids ) { $m[ $who ] = array( 't' => time(), 'ids' => array_values( array_unique( $ids ) ) ); } else { unset( $m[ $who ] ); }
	if ( count( $m ) > 6000 ) { uasort( $m, function ( $a, $b ) { return ( $b['t'] ?? 0 ) <=> ( $a['t'] ?? 0 ); } ); $m = array_slice( $m, 0, 6000, true ); }
	update_option( 'oay_favs', $m, false );
	oay_acc_ok( array( 'n' => count( $ids ) ) );
}

/* a favourite plot is cheaper or available again → push to whoever saved it */
add_action( 'oay_plot_changes', function ( $slug, $name, $ch, $new ) {
	$key = trim( (string) get_option( 'oay_onesignal_key', '' ) ); if ( '' === $key ) { return; }
	$st = function_exists( 'oay_plots' ) ? oay_plots( $new ) : array(); $m = oay_favs_all(); if ( ! $m ) { return; }
	$hits = array();
	foreach ( (array) $ch as $c ) {
		$n = (string) ( $c['n'] ?? '' ); $q = $st[ $n ] ?? array(); if ( ( $q['s'] ?? '' ) !== 'av' ) { continue; }
		$from = (int) ( $c['from'] ?? 0 ); $to = (int) ( $c['to'] ?? 0 );
		if ( 'price' === ( $c['kind'] ?? '' ) && $from && $to && $to < $from ) { $why = 'نزل السعر من ' . number_format( $from ) . ' إلى ' . number_format( $to ) . ' د.إ'; }
		elseif ( 'status' === ( $c['kind'] ?? '' ) ) { $why = 'رجعت متاحة للبيع' . ( ! empty( $q['total'] ) ? ' · ' . number_format( (int) $q['total'] ) . ' د.إ' : '' ); }
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
					'data' => array( 'open' => 'land', 'id' => $id ), 'web_url' => OAY_APP_URL, 'ttl' => 86400 ) ) ) );
		}
	}
}, 30, 4 );
