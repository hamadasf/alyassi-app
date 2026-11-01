<?php
/**
 * Plugin Name: Alyassi App – Listing statistics
 * Description: How many people saw each listing in the app, and how many called, sent a WhatsApp message, shared it or
 *              asked to be called back, day by day (from the app's own counters, oay_st_YYYYMMDD). The office sees every
 *              listing; a member sees only their own.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'listing_stats', 'my_stats' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}
const OAY_STAT_KINDS = array( 'view', 'call', 'wa', 'share', 'form' );

/** may this user see this listing's numbers? (office: all · member: their own listings) */
function oay_stats_allowed( $u, $id ) {
	if ( oay_acc_can( $u, 'listings' ) || oay_acc_can( $u, 'report' ) ) { return true; }
	if ( ! ctype_digit( (string) $id ) ) { return false; }
	$p = get_post( (int) $id );
	return $p && (int) $p->post_author === (int) $u->ID;
}
/** the last $days days' counters, oldest first: array( array( 'd' => 'YYYY-MM-DD', 'raw' => day array ), … ) */
function oay_stats_days( $days ) {
	$out = array(); $now = time();
	for ( $i = $days - 1; $i >= 0; $i-- ) {
		$ts = $now - $i * DAY_IN_SECONDS; $d = get_option( oay_day_key( $ts ), array() );
		$out[] = array( 'd' => wp_date( 'Y-m-d', $ts ), 'raw' => is_array( $d ) ? $d : array() );
	}
	return $out;
}
function oay_stats_days_arg() { $n = (int) oay_acc_arg( 'days', 3 ); return in_array( $n, array( 7, 30, 90 ), true ) ? $n : 30; }

/** One listing, day by day. id: «slug:n» (a project plot) or the number of a member's listing. */
function oay_acc_listing_stats() {
	$u = oay_acc_need_user();
	$id = substr( preg_replace( '/[^\w:\-]/u', '', oay_acc_arg( 'id', 60 ) ), 0, 60 );
	if ( '' === $id ) { oay_acc_err( 'غير موجود', 404 ); }
	if ( ! oay_stats_allowed( $u, $id ) ) { oay_acc_err( 'غير مسموح', 403 ); }
	$series = array(); $tot = array_fill_keys( OAY_STAT_KINDS, 0 );
	foreach ( oay_stats_days( oay_stats_days_arg() ) as $day ) {
		$row = array( 'd' => $day['d'] );
		foreach ( OAY_STAT_KINDS as $k ) { $n = (int) ( $day['raw'][ $k ][ $id ] ?? 0 ); $row[ $k ] = $n; $tot[ $k ] += $n; }
		$series[] = $row;
	}
	oay_acc_ok( array( 'id' => $id, 'name' => function_exists( 'oay_land_name' ) ? oay_land_name( $id ) : $id, 'series' => $series, 'total' => $tot ) );
}
/** A list of listings with their totals: a member's own listings, or (office) the most seen listings of all. */
function oay_acc_my_stats() {
	$u = oay_acc_need_user(); $days = oay_stats_days_arg();
	$office = oay_acc_can( $u, 'listings' ) || oay_acc_can( $u, 'report' );
	$mine = array();
	if ( ! $office ) {
		$posts = get_posts( array( 'post_type' => 'lands', 'author' => $u->ID, 'post_status' => array( 'publish', 'pending', 'draft' ), 'numberposts' => 200, 'fields' => 'ids' ) );
		foreach ( $posts as $pid ) { $mine[ (string) $pid ] = true; }
	}
	$agg = array();
	foreach ( oay_stats_days( $days ) as $day ) {
		foreach ( OAY_STAT_KINDS as $k ) {
			foreach ( (array) ( $day['raw'][ $k ] ?? array() ) as $id => $n ) {
				$id = (string) $id; if ( ! $office && ! isset( $mine[ $id ] ) ) { continue; }
				if ( ! isset( $agg[ $id ] ) ) { $agg[ $id ] = array_fill_keys( OAY_STAT_KINDS, 0 ); }
				$agg[ $id ][ $k ] += (int) $n;
			}
		}
	}
	if ( ! $office ) { foreach ( array_keys( $mine ) as $id ) { if ( ! isset( $agg[ $id ] ) ) { $agg[ $id ] = array_fill_keys( OAY_STAT_KINDS, 0 ); } } }
	uasort( $agg, function ( $a, $b ) { return ( $b['view'] + 3 * ( $b['call'] + $b['wa'] ) ) <=> ( $a['view'] + 3 * ( $a['call'] + $a['wa'] ) ); } );
	$items = array(); $tot = array_fill_keys( OAY_STAT_KINDS, 0 );
	foreach ( $agg as $id => $c ) { foreach ( OAY_STAT_KINDS as $k ) { $tot[ $k ] += $c[ $k ]; } }
	foreach ( array_slice( $agg, 0, 60, true ) as $id => $c ) { $items[] = array( 'id' => (string) $id, 'name' => function_exists( 'oay_land_name' ) ? oay_land_name( (string) $id ) : (string) $id ) + $c; }
	oay_acc_ok( array( 'office' => $office, 'days' => $days, 'items' => $items, 'total' => $tot ) );
}
