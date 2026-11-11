<?php
/**
 * Plugin Name: Alyassi App – Saved post designs
 * Description: The post designer's settings saved per plot and per template (texts, positions, sizes, added shapes),
 *              so a design can be opened again later on any phone. The office and members with «تصميم البوستات».
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'design_get', 'design_save', 'design_del', 'proj_lines', 'proj_lines_save', 'proj_public' ) as $a ) {
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
	do_action( 'oay_design_saved', $u, $id, $t );   // team activity + «تصميم جديد» to the team (alyassi-app-team.php)
	oay_acc_ok( array( 't' => $m[ $id ][ $t ]['t'] ) );
}
function oay_acc_design_del() {
	$u = oay_acc_need_perm( 'design' ); $id = oay_design_key(); $t = sanitize_key( (string) oay_acc_arg( 'theme', 20 ) );
	if ( ! oay_design_tpl_ok( $u, $t ) ) { oay_acc_err( 'غير مسموح', 403 ); }
	$m = oay_designs(); unset( $m[ $id ][ $t ] ); if ( empty( $m[ $id ] ) ) { unset( $m[ $id ] ); }
	update_option( 'oay_designs', $m, false ); oay_acc_ok();
}

/* ---------- each project's own lines on the posts (ready to build, who may own, the road…), set by the office ---------- */
function oay_proj_lines_seed() {   // from the office: who may own in each project, and what the office's posts say about it
	$ar = 'تملّك حر للعرب'; $all = 'تملّك حر لجميع الجنسيات';
	return array(
		'muzaira'            => array( 'p1' => 'المنطقة جاهزة للبناء', 'p2' => $ar ),
		'al-sahma'           => array( 'p1' => 'المنطقة جاهزة للبناء', 'p2' => $ar ),
		'al-falah'           => array( 'p1' => 'جاهزة للبناء', 'p2' => $ar ),
		'al-mutraq'          => array( 'p1' => 'تم البدء في البنية التحتية', 'p2' => $ar ),
		'blaida-1'           => array( 'p1' => '', 'p2' => $ar ),
		'blaida-2'           => array( 'p1' => 'شارع قار موجود أمام الأرض', 'p2' => $ar ),
		'blaida-3'           => array( 'p1' => '', 'p2' => $ar ),
		'basateen-al-zubair' => array( 'p1' => '', 'p2' => $ar ),
		'dabdaba-north'      => array( 'p1' => '', 'p2' => $ar ),
		'houshi'             => array( 'p1' => '', 'p2' => $ar ),
		'houshi-marwan'      => array( 'p1' => '', 'p2' => $ar ),
		'al-ruwaidat'        => array( 'p1' => '', 'p2' => $all ),
		'muhathab'           => array( 'p1' => '', 'p2' => $all ),
		'industrial4'        => array( 'p1' => '', 'p2' => $all ),
		'rawdat-al-qurt'     => array( 'p1' => '', 'p2' => 'تملّك حر لجميع العرب' ),
	);
}
function oay_proj_lines_all() { $m = get_option( 'oay_proj_lines', null ); return is_array( $m ) ? $m + oay_proj_lines_seed() : oay_proj_lines_seed(); }
function oay_acc_proj_lines() {
	oay_acc_need_perm( 'design' ); $slug = sanitize_key( (string) oay_acc_arg( 'slug', 40 ) ); $m = oay_proj_lines_all();
	oay_acc_ok( array( 'lines' => isset( $m[ $slug ] ) ? $m[ $slug ] : null ) );
}
function oay_acc_proj_lines_save() {
	oay_acc_need_admin(); $slug = sanitize_key( (string) oay_acc_arg( 'slug', 40 ) ); if ( ! $slug ) { oay_acc_err( 'المشروع؟' ); }
	$m = get_option( 'oay_proj_lines', array() ); if ( ! is_array( $m ) ) { $m = array(); }
	$m[ $slug ] = array( 'p1' => mb_substr( sanitize_text_field( oay_acc_arg( 'p1', 80 ) ), 0, 60 ), 'p2' => mb_substr( sanitize_text_field( oay_acc_arg( 'p2', 80 ) ), 0, 60 ), 'sub' => mb_substr( sanitize_text_field( oay_acc_arg( 'sub', 120 ) ), 0, 80 ) );
	update_option( 'oay_proj_lines', $m, false ); oay_acc_ok( array( 'lines' => $m[ $slug ] ) );
}

/** for everyone (the app's filter «التملّك» / «جاهزة للبناء» and the badges): who may own in each project, and whether it is ready to build */
function oay_acc_proj_public() {
	$out = array();
	foreach ( oay_proj_lines_all() as $slug => $l ) {
		$txt = ( $l['p1'] ?? '' ) . ' ' . ( $l['p2'] ?? '' ) . ' ' . ( $l['sub'] ?? '' );
		$own = false !== mb_strpos( $txt, 'جميع الجنسيات' ) || false !== mb_strpos( $txt, 'لكل الجنسيات' ) ? 'all' : ( false !== mb_strpos( $txt, 'للعرب' ) || false !== mb_strpos( $txt, 'جميع العرب' ) ? 'arab' : '' );
		$out[ $slug ] = array( 'own' => $own, 'ready' => false !== mb_strpos( $txt, 'جاهز' ), 'note' => mb_substr( (string) ( $l['p1'] ?? '' ), 0, 60 ) );
	}
	header( 'Cache-Control: public, max-age=600' );
	oay_acc_ok( array( 'items' => (object) $out ) );
}
