<?php
/**
 * Plugin Name: Alyassi App – Saved post designs
 * Description: The post designer's settings saved per plot and per template (texts, positions, sizes, added shapes),
 *              so a design can be opened again later on any phone. The office and members with «تصميم البوستات».
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'design_get', 'design_save', 'design_del' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}
function oay_designs() { $m = get_option( 'oay_designs', array() ); return is_array( $m ) ? $m : array(); }
function oay_design_key() { $id = (string) oay_acc_arg( 'id', 60 ); if ( ! preg_match( '/^[a-z0-9-]{2,40}:[A-Za-z0-9-]{1,12}$/', $id ) ) { oay_acc_err( 'قطعة غير معروفة' ); } return $id; }
/** a member may only use the templates the office gave them */
function oay_design_tpl_ok( $u, $t ) { return oay_acc_is_admin( $u ) || in_array( $t, function_exists( 'oay_user_tpls' ) ? oay_user_tpls( $u->ID ) : array( 'oy' ), true ); }

function oay_acc_design_get() {
	$u = oay_acc_need_perm( 'design' ); $id = oay_design_key(); $m = oay_designs(); $out = array();
	foreach ( (array) ( $m[ $id ] ?? array() ) as $t => $d ) {
		if ( ! is_array( $d ) || ! oay_design_tpl_ok( $u, $t ) ) { continue; }
		$by = get_userdata( (int) ( $d['by'] ?? 0 ) );
		$out[ $t ] = array( 'v' => $d['v'], 't' => (int) $d['t'], 'by' => $by ? $by->display_name : '' );
	}
	oay_acc_ok( array( 'items' => (object) $out ) );
}
function oay_acc_design_save() {
	$u = oay_acc_need_perm( 'design' ); oay_acc_limit( 'dsave_' . $u->ID, 60 ); $id = oay_design_key();
	$in = oay_acc_in(); $v = $in['v'] ?? null; $t = sanitize_key( (string) ( is_array( $v ) ? ( $v['theme'] ?? '' ) : '' ) );
	if ( ! is_array( $v ) || ! $t ) { oay_acc_err( 'لا يوجد تصميم' ); }
	if ( ! oay_design_tpl_ok( $u, $t ) ) { oay_acc_err( 'هذا القالب غير متاح لحسابك', 403 ); }
	$json = wp_json_encode( $v ); if ( ! $json || strlen( $json ) > 60000 ) { oay_acc_err( 'التصميم كبير جداً' ); }
	$m = oay_designs(); $m[ $id ] = is_array( $m[ $id ] ?? null ) ? $m[ $id ] : array();
	$m[ $id ][ $t ] = array( 'v' => json_decode( $json, true ), 't' => time() * 1000, 'by' => (int) $u->ID );
	if ( count( $m ) > 800 ) {   // keep the newest
		uasort( $m, function ( $a, $b ) { $ta = max( array_map( function ( $x ) { return (int) ( $x['t'] ?? 0 ); }, (array) $a ) ?: array( 0 ) ); $tb = max( array_map( function ( $x ) { return (int) ( $x['t'] ?? 0 ); }, (array) $b ) ?: array( 0 ) ); return $tb <=> $ta; } );
		$m = array_slice( $m, 0, 800, true );
	}
	update_option( 'oay_designs', $m, false );
	oay_acc_ok( array( 't' => $m[ $id ][ $t ]['t'] ) );
}
function oay_acc_design_del() {
	$u = oay_acc_need_perm( 'design' ); $id = oay_design_key(); $t = sanitize_key( (string) oay_acc_arg( 'theme', 20 ) );
	if ( ! oay_design_tpl_ok( $u, $t ) ) { oay_acc_err( 'غير مسموح', 403 ); }
	$m = oay_designs(); unset( $m[ $id ][ $t ] ); if ( empty( $m[ $id ] ) ) { unset( $m[ $id ] ); }
	update_option( 'oay_designs', $m, false ); oay_acc_ok();
}
