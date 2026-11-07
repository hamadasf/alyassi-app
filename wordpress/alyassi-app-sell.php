<?php
/**
 * Plugin Name: Alyassi App – «لدي أرض للبيع»
 * Description: A short form anyone may send from the app, signed in or not: name, phone, area, city, kind, use, size,
 *              asking price, details and up to 4 photos. It reaches the office's contact log («سجل التواصل») with a push.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
add_action( 'wp_ajax_oay_acc_sell_req', 'oay_acc_sell_req' );
add_action( 'wp_ajax_nopriv_oay_acc_sell_req', 'oay_acc_sell_req' );

function oay_sell_photo( $b64 ) {   // one resized photo from the phone → a file in uploads (not a media library item)
	if ( ! preg_match( '/^data:image\/(jpeg|png|webp);base64,/', (string) $b64, $m ) ) { return ''; }
	$bin = base64_decode( substr( $b64, strpos( $b64, ',' ) + 1 ), true );
	if ( ! $bin || strlen( $bin ) > 3 * MB_IN_BYTES || ! @getimagesizefromstring( $bin ) ) { return ''; }
	$up = wp_upload_bits( 'sell-' . wp_generate_password( 12, false, false ) . '.' . ( 'jpeg' === $m[1] ? 'jpg' : $m[1] ), null, $bin );
	return empty( $up['error'] ) ? $up['url'] : '';
}
function oay_acc_sell_req() {
	oay_acc_limit( 'sellreq', 6 );
	$t = function ( $k, $n ) { return mb_substr( sanitize_text_field( oay_acc_arg( $k, $n * 2 ) ), 0, $n ); };
	$name = $t( 'name', 60 ); $phone = preg_replace( '/[^\d+]/', '', oay_acc_arg( 'phone', 20 ) ); $region = $t( 'region', 60 );
	$price = (int) preg_replace( '/\D/', '', oay_acc_arg( 'price', 20 ) );
	if ( '' === $name ) { oay_acc_err( 'اكتب الاسم' ); }
	if ( strlen( preg_replace( '/\D/', '', $phone ) ) < 9 ) { oay_acc_err( 'اكتب رقم هاتف صحيح' ); }
	if ( '' === $region ) { oay_acc_err( 'اكتب المنطقة' ); }
	if ( $price < 1000 ) { oay_acc_err( 'اكتب السعر المطلوب' ); }
	$in = oay_acc_in(); $photos = array();
	foreach ( array_slice( (array) ( $in['photos'] ?? array() ), 0, 4 ) as $p ) { $u = oay_sell_photo( $p ); if ( $u ) { $photos[] = $u; } }
	$u = oay_acc_user_from_token( oay_acc_arg( 'token', 120 ) );
	$e = array( 'kind' => 'sell', 'id' => '', 'name' => trim( implode( ' · ', array_filter( array( $t( 'ptype', 30 ), $t( 'use', 30 ), $region, $t( 'city', 30 ) ) ) ) ), 'ref' => '',
		'uid' => $u ? $u->ID : 0, 'who' => $name, 'phone' => $phone, 'region' => $region, 'city' => $t( 'city', 30 ), 'ptype' => $t( 'ptype', 30 ), 'use' => $t( 'use', 30 ),
		'ft' => (int) preg_replace( '/\D/', '', oay_acc_arg( 'ft', 20 ) ), 'price' => $price, 'msg' => mb_substr( sanitize_textarea_field( oay_acc_arg( 'msg', 1000 ) ), 0, 1000 ), 'photos' => $photos, 'done' => false );
	oay_contact_log( $e );
	if ( $u && ! get_user_meta( $u->ID, 'oay_phone', true ) ) { update_user_meta( $u->ID, 'oay_phone', $phone ); }
	if ( function_exists( 'oay_push_to' ) ) { oay_push_to( oay_admin_ids(), '🏷️ أرض للبيع · ' . $name, $e['name'] . ' · ' . number_format( $price ) . ' د.إ · ' . $phone, array( 'open' => 'contacts' ) ); }
	oay_acc_ok();
}
