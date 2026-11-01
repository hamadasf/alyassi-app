<?php
/**
 * Plugin Name: Alyassi App – Staff invitations
 * Description: The admin makes a one-time invitation code (shared as a link); the person who signs up with it — one
 *              account only — joins the office team with the permissions chosen for the invitation (by default: sending
 *              payment plans). An existing account can also use an unused code from its account page.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'adm_invite_new', 'adm_invites', 'adm_invite_del', 'invite_check', 'invite_redeem' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}
function oay_invites() { $v = get_option( 'oay_invites', array() ); return is_array( $v ) ? $v : array(); }
function oay_invite_code_norm( $c ) { return strtoupper( preg_replace( '/[^A-Za-z0-9]/', '', (string) $c ) ); }
/** an unused invitation, or null */
function oay_invite_get( $code ) {
	$code = oay_invite_code_norm( $code ); if ( '' === $code ) { return null; }
	$all = oay_invites(); $i = $all[ $code ] ?? null;
	return is_array( $i ) && empty( $i['uid'] ) ? $i : null;
}
/** gives the invitation's permissions to the account and marks the code used (once only) */
function oay_invite_apply( $uid, $code ) {
	$code = oay_invite_code_norm( $code ); $all = oay_invites(); $i = $all[ $code ] ?? null;
	if ( ! is_array( $i ) || ! empty( $i['uid'] ) ) { return false; }
	$cur = get_user_meta( $uid, 'oay_staff', true ); $cur = is_array( $cur ) ? $cur : array();
	$perms = array_values( array_unique( array_merge( $cur, array_intersect( (array) $i['perms'], array_keys( OAY_STAFF_PERMS ) ) ) ) );
	update_user_meta( $uid, 'oay_staff', $perms );
	$all[ $code ]['uid'] = (int) $uid; $all[ $code ]['ut'] = time() * 1000;
	update_option( 'oay_invites', $all, false );
	if ( function_exists( 'oay_push_to' ) ) {
		$u = get_userdata( $uid );
		oay_push_to( array_values( array_filter( (array) get_users( array( 'capability' => 'manage_options', 'fields' => 'ID' ) ) ) ), 'انضم موظف جديد', ( $u ? $u->display_name : '' ) . ' سجّل برابط الدعوة', array( 'open' => 'admin' ) );
	}
	return true;
}

/** Admin: a new one-time code. perms: the permissions it gives (default: payment plans). */
function oay_acc_adm_invite_new() {
	$me = oay_acc_need_admin(); $in = oay_acc_in();
	$perms = array_values( array_intersect( (array) ( $in['perms'] ?? array( 'payplan' ) ), array_keys( OAY_STAFF_PERMS ) ) );
	if ( ! $perms ) { $perms = array( 'payplan' ); }
	$abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $all = oay_invites();
	do { $code = ''; for ( $i = 0; $i < 8; $i++ ) { $code .= $abc[ wp_rand( 0, strlen( $abc ) - 1 ) ]; } } while ( isset( $all[ $code ] ) );
	$all[ $code ] = array( 't' => time() * 1000, 'by' => $me->ID, 'perms' => $perms, 'note' => sanitize_text_field( oay_acc_arg( 'note', 60 ) ), 'uid' => 0 );
	update_option( 'oay_invites', $all, false );
	oay_acc_ok( array( 'code' => $code, 'perms' => $perms ) );
}
function oay_acc_adm_invites() {
	oay_acc_need_admin(); $out = array();
	foreach ( oay_invites() as $code => $i ) {
		$u = ! empty( $i['uid'] ) ? get_userdata( (int) $i['uid'] ) : null;
		$out[] = array( 'code' => (string) $code, 't' => (int) $i['t'], 'perms' => (array) $i['perms'], 'note' => (string) ( $i['note'] ?? '' ),
			'used' => ! empty( $i['uid'] ), 'uid' => (int) ( $i['uid'] ?? 0 ), 'ut' => (int) ( $i['ut'] ?? 0 ), 'user' => $u ? ( $u->display_name . ' · ' . $u->user_email ) : '' );
	}
	usort( $out, function ( $a, $b ) { return $b['t'] <=> $a['t']; } );
	oay_acc_ok( array( 'items' => array_slice( $out, 0, 100 ), 'labels' => OAY_STAFF_PERMS ) );
}
function oay_acc_adm_invite_del() {
	oay_acc_need_admin(); $all = oay_invites(); $code = oay_invite_code_norm( oay_acc_arg( 'code', 20 ) );
	unset( $all[ $code ] ); update_option( 'oay_invites', $all, false ); oay_acc_ok();
}
/** Public: is this code valid (shown on the sign-up form)? */
function oay_acc_invite_check() {
	oay_acc_limit( 'invchk', 30 );
	$i = oay_invite_get( oay_acc_arg( 'code', 20 ) );
	if ( ! $i ) { oay_acc_err( 'كود الدعوة غير صحيح أو مستخدم من قبل' ); }
	oay_acc_ok( array( 'perms' => array_values( array_map( function ( $p ) { return OAY_STAFF_PERMS[ $p ] ?? $p; }, (array) $i['perms'] ) ) ) );
}
/** Signed in: use a code with the current account. */
function oay_acc_invite_redeem() {
	$u = oay_acc_need_user(); oay_acc_limit( 'invred', 10 );
	if ( ! oay_invite_apply( $u->ID, oay_acc_arg( 'code', 20 ) ) ) { oay_acc_err( 'كود الدعوة غير صحيح أو مستخدم من قبل' ); }
	oay_acc_ok( array( 'user' => oay_acc_userdata( get_userdata( $u->ID ) ) ) );
}
