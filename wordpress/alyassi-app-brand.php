<?php
/**
 * Plugin Name: Alyassi App – Advertiser photo & company logo on listings
 * Description: The advertiser strip on every listing in the app (Property Finder style): the advertiser's photo and name,
 *              and the company logo opposite. The office's own (عمر الياسي) is set by the admin from the app's settings and
 *              changes on every listing at once. Members send their personal photo and their company logo; the admin
 *              approves them before they appear on the member's listings.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'brand', 'adm_brand', 'adv_submit', 'adm_advs', 'adm_adv' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}

/** The office's advertiser (عمر الياسي): name, photo and logo. Empty photo / logo = the app's built-in ones. */
function oay_brand() {
	$b = get_option( 'oay_brand', array() ); if ( ! is_array( $b ) ) { $b = array(); }
	return array( 'name' => ( isset( $b['name'] ) && '' !== $b['name'] ) ? (string) $b['name'] : 'عمر الياسي',
		'photo' => (string) ( $b['photo'] ?? '' ), 'logo' => (string) ( $b['logo'] ?? '' ), 'v' => (int) ( $b['v'] ?? 0 ) );
}
/** A picture sent from the phone (data URL, already resized there) saved in the uploads folder → array( url, file ). */
function oay_brand_img( $data, $prefix ) {
	$data = (string) $data;
	if ( ! preg_match( '/^data:image\/(jpeg|png|webp);base64,/', $data ) ) { oay_acc_err( 'صورة غير صالحة' ); }
	$bin = base64_decode( substr( $data, strpos( $data, ',' ) + 1 ), true );
	if ( ! $bin || strlen( $bin ) > 3 * MB_IN_BYTES ) { oay_acc_err( 'حجم الصورة كبير' ); }
	$ext = false !== strpos( substr( $data, 0, 30 ), 'png' ) ? 'png' : ( false !== strpos( substr( $data, 0, 30 ), 'webp' ) ? 'webp' : 'jpg' );
	$up = wp_upload_bits( $prefix . '-' . wp_generate_password( 8, false, false ) . '.' . $ext, null, $bin );
	if ( ! empty( $up['error'] ) || ! @getimagesize( $up['file'] ) ) { if ( ! empty( $up['file'] ) ) { @unlink( $up['file'] ); } oay_acc_err( 'تعذّر رفع الصورة' ); }
	return array( $up['url'], $up['file'] );
}
function oay_brand_rm( $file ) { $up = wp_get_upload_dir(); if ( $file && 0 === strpos( (string) $file, $up['basedir'] ) && file_exists( $file ) ) { @unlink( $file ); } }

function oay_acc_brand() { oay_acc_ok( array( 'brand' => oay_brand() ) ); }

/** Admin (settings): the office's name, photo and logo. photo / logo: a data URL to replace, or 'reset' for the built-in one. */
function oay_acc_adm_brand() {
	oay_acc_need_admin(); $in = oay_acc_in();
	$b = get_option( 'oay_brand', array() ); if ( ! is_array( $b ) ) { $b = array(); }
	if ( isset( $in['name'] ) ) { $n = sanitize_text_field( oay_acc_arg( 'name', 60 ) ); if ( mb_strlen( $n ) < 2 ) { oay_acc_err( 'اكتب اسم المعلن' ); } $b['name'] = $n; }
	foreach ( array( 'photo', 'logo' ) as $k ) {
		if ( empty( $in[ $k ] ) || ! is_string( $in[ $k ] ) ) { continue; }
		if ( 'reset' === $in[ $k ] ) { oay_brand_rm( $b[ $k . '_file' ] ?? '' ); $b[ $k ] = ''; $b[ $k . '_file' ] = ''; continue; }
		list( $url, $file ) = oay_brand_img( $in[ $k ], 'brand-' . $k );
		oay_brand_rm( $b[ $k . '_file' ] ?? '' ); $b[ $k ] = $url; $b[ $k . '_file' ] = $file;
	}
	$b['v'] = time();
	update_option( 'oay_brand', $b, false );
	oay_acc_ok( array( 'brand' => oay_brand() ) );
}

/** A member's approved advertiser details, or null (their listings then show the office's). */
function oay_adv_of( $uid ) {
	$uid = (int) $uid;
	if ( ! $uid || user_can( $uid, 'manage_options' ) ) { return null; }
	$ph = (string) get_user_meta( $uid, 'oay_adv_photo', true ); $lg = (string) get_user_meta( $uid, 'oay_adv_logo', true );
	if ( '' === $ph && '' === $lg ) { return null; }
	$u = get_userdata( $uid ); if ( ! $u ) { return null; }
	return array( 'name' => $u->display_name, 'company' => (string) get_user_meta( $uid, 'oay_company', true ), 'photo' => $ph, 'logo' => $lg, 'verified' => (bool) get_user_meta( $uid, 'oay_verified', true ) );
}
/** What the member sees in their account: approved pictures, the ones waiting, and the admin's note. */
function oay_adv_state( $uid ) {
	$p = get_user_meta( $uid, 'oay_adv_pending', true );
	return array( 'photo' => (string) get_user_meta( $uid, 'oay_adv_photo', true ), 'logo' => (string) get_user_meta( $uid, 'oay_adv_logo', true ),
		'status' => (string) get_user_meta( $uid, 'oay_adv_status', true ), 'note' => (string) get_user_meta( $uid, 'oay_adv_note', true ),
		'pending' => is_array( $p ) ? array( 'photo' => (string) ( $p['photo'] ?? '' ), 'logo' => (string) ( $p['logo'] ?? '' ) ) : null );
}

/** Member: personal photo + company logo, sent for the admin's approval (both needed the first time). */
function oay_acc_adv_submit() {
	$u = oay_acc_need_user(); $in = oay_acc_in();
	$cur = oay_adv_state( $u->ID ); $old = get_user_meta( $u->ID, 'oay_adv_pending', true ); if ( ! is_array( $old ) ) { $old = array(); }
	$has = array( 'photo' => ! empty( $in['photo'] ) || $cur['photo'] || ! empty( $old['photo'] ), 'logo' => ! empty( $in['logo'] ) || $cur['logo'] || ! empty( $old['logo'] ) );
	if ( ! $has['photo'] ) { oay_acc_err( 'أضف صورتك الشخصية' ); }
	if ( ! $has['logo'] ) { oay_acc_err( 'أضف صورة أو شعار الشركة' ); }
	if ( empty( $in['photo'] ) && empty( $in['logo'] ) ) { oay_acc_err( 'اختر صورة' ); }
	$p = $old;
	foreach ( array( 'photo', 'logo' ) as $k ) {
		if ( empty( $in[ $k ] ) || ! is_string( $in[ $k ] ) ) { continue; }
		list( $url, $file ) = oay_brand_img( $in[ $k ], 'adv-' . $k . '-' . $u->ID );
		oay_brand_rm( $p[ $k . '_file' ] ?? '' ); $p[ $k ] = $url; $p[ $k . '_file' ] = $file;
	}
	$p['t'] = time() * 1000;
	update_user_meta( $u->ID, 'oay_adv_pending', $p ); update_user_meta( $u->ID, 'oay_adv_status', 'pending' ); delete_user_meta( $u->ID, 'oay_adv_note' );
	if ( function_exists( 'oay_push_to' ) ) { oay_push_to( oay_admin_ids(), 'صورة معلن للمراجعة', ( get_user_meta( $u->ID, 'oay_company', true ) ?: $u->display_name ) . ' أرسل صورته وشعار شركته', array( 'open' => 'admin' ) ); }
	oay_acc_ok( array( 'adv' => oay_adv_state( $u->ID ) ) );
}
/** Admin: members waiting for their pictures to be approved. */
function oay_acc_adm_advs() {
	oay_acc_need_perm( 'listings' );
	$users = get_users( array( 'meta_key' => 'oay_adv_status', 'meta_value' => 'pending', 'number' => 200 ) );
	oay_acc_ok( array( 'items' => array_map( function ( $u ) {
		$p = get_user_meta( $u->ID, 'oay_adv_pending', true ); if ( ! is_array( $p ) ) { $p = array(); }
		return array( 'id' => $u->ID, 'name' => $u->display_name, 'email' => $u->user_email, 'company' => (string) get_user_meta( $u->ID, 'oay_company', true ),
			'verified' => (bool) get_user_meta( $u->ID, 'oay_verified', true ), 'photo' => (string) ( $p['photo'] ?? '' ), 'logo' => (string) ( $p['logo'] ?? '' ), 't' => (int) ( $p['t'] ?? 0 ),
			'cur' => array( 'photo' => (string) get_user_meta( $u->ID, 'oay_adv_photo', true ), 'logo' => (string) get_user_meta( $u->ID, 'oay_adv_logo', true ) ) );
	}, $users ), 'count' => count( $users ) ) );
}
/** Admin: approve (the pictures go on the member's listings) or reject (with a note). */
function oay_acc_adm_adv() {
	oay_acc_need_perm( 'listings' ); $u = oay_acc_adm_target();
	$p = get_user_meta( $u->ID, 'oay_adv_pending', true ); if ( ! is_array( $p ) || ! $p ) { oay_acc_err( 'لا يوجد طلب' ); }
	if ( '1' === oay_acc_arg( 'approve', 1 ) ) {
		foreach ( array( 'photo', 'logo' ) as $k ) {
			if ( empty( $p[ $k ] ) ) { continue; }
			oay_brand_rm( get_user_meta( $u->ID, 'oay_adv_' . $k . '_file', true ) );
			update_user_meta( $u->ID, 'oay_adv_' . $k, $p[ $k ] ); update_user_meta( $u->ID, 'oay_adv_' . $k . '_file', $p[ $k . '_file' ] ?? '' );
		}
		update_user_meta( $u->ID, 'oay_adv_status', 'approved' ); delete_user_meta( $u->ID, 'oay_adv_note' );
		if ( ! get_user_meta( $u->ID, 'oay_avatar_own', true ) && ! empty( $p['photo'] ) ) { update_user_meta( $u->ID, 'oay_avatar', $p['photo'] ); }   // also their profile picture, if they had none of their own
		$msg = array( 'تمت الموافقة على صورتك ✓', 'تظهر صورتك وشعار شركتك الآن على إعلاناتك' );
	} else {
		foreach ( array( 'photo', 'logo' ) as $k ) { oay_brand_rm( $p[ $k . '_file' ] ?? '' ); }
		update_user_meta( $u->ID, 'oay_adv_status', 'rejected' ); update_user_meta( $u->ID, 'oay_adv_note', sanitize_text_field( oay_acc_arg( 'note', 200 ) ) );
		$msg = array( 'بخصوص صورة المعلن', 'لم تتم الموافقة على الصورة — افتح حسابك لإرسال صورة أخرى' );
	}
	delete_user_meta( $u->ID, 'oay_adv_pending' );
	if ( function_exists( 'oay_push_to' ) ) { oay_push_to( array( $u->ID ), $msg[0], $msg[1], array( 'open' => 'account' ) ); }
	oay_acc_ok();
}
