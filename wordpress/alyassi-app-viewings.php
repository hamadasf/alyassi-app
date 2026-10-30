<?php
/**
 * Plugin Name: Alyassi App – Viewing appointments
 * Description: «احجز معاينة»: clients pick a day and time for a land; the office confirms, reschedules or cancels;
 *              reminders before the visit. Uses the helpers of alyassi-app-accounts.php and alyassi-app-crm.php.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'view_cfg', 'view_slots', 'view_book', 'view_mine', 'view_cancel', 'adm_views', 'adm_view_save', 'adm_view_cfg' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}
add_action( 'init', function () {
	register_post_type( 'oay_viewing', array( 'public' => false, 'show_ui' => false, 'supports' => array( 'title', 'author' ), 'label' => 'مواعيد المعاينة' ) );
	if ( ! wp_next_scheduled( 'oay_view_tick' ) ) { wp_schedule_event( time() + 300, 'hourly', 'oay_view_tick' ); }
} );

const OAY_VIEW_ST = array( 'pending' => 'بانتظار التأكيد', 'confirmed' => 'مؤكد', 'done' => 'تمت المعاينة', 'noshow' => 'لم يحضر', 'cancelled' => 'ملغي' );
/** Working days (0 = Sunday … 6 = Saturday), hours and visits per slot — the office can change them. */
function oay_view_cfg() {
	$d = array( 'days' => array( 0, 1, 2, 3, 4, 6 ), 'from' => 9, 'to' => 18, 'step' => 60, 'max' => 2, 'ahead' => 14 );
	$c = get_option( 'oay_view_cfg', array() ); return is_array( $c ) ? array_merge( $d, array_intersect_key( $c, $d ) ) : $d;
}
function oay_acc_view_cfg() { oay_acc_ok( array( 'cfg' => oay_view_cfg() ) ); }
function oay_view_ts( $date, $time ) { $dt = date_create_immutable( $date . ' ' . $time, wp_timezone() ); return $dt ? $dt->getTimestamp() : 0; }
function oay_view_slots( $date ) {
	$c = oay_view_cfg(); $dt = date_create_immutable( $date . ' 00:00', wp_timezone() ); if ( ! $dt ) { return array(); }
	if ( ! in_array( (int) $dt->format( 'w' ), array_map( 'intval', $c['days'] ), true ) ) { return array(); }
	$taken = array();
	foreach ( get_posts( array( 'post_type' => 'oay_viewing', 'post_status' => 'private', 'numberposts' => 300, 'meta_query' => array( array( 'key' => 'date', 'value' => $date ), array( 'key' => 'status', 'value' => array( 'pending', 'confirmed' ), 'compare' => 'IN' ) ) ) ) as $v ) {
		$t = get_post_meta( $v->ID, 'time', true ); $taken[ $t ] = ( $taken[ $t ] ?? 0 ) + 1;
	}
	$out = array(); $now = time() + HOUR_IN_SECONDS;
	for ( $m = $c['from'] * 60; $m < $c['to'] * 60; $m += max( 15, (int) $c['step'] ) ) {
		$t = sprintf( '%02d:%02d', intdiv( $m, 60 ), $m % 60 );
		$out[] = array( 't' => $t, 'free' => ( $taken[ $t ] ?? 0 ) < $c['max'] && oay_view_ts( $date, $t ) > $now );
	}
	return $out;
}
function oay_acc_view_slots() {
	$date = preg_replace( '/[^\d-]/', '', oay_acc_arg( 'date', 10 ) );
	oay_acc_ok( array( 'slots' => preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) ? oay_view_slots( $date ) : array() ) );
}
function oay_view_card( $p, $office = false ) {
	$m = function ( $k ) use ( $p ) { return get_post_meta( $p->ID, $k, true ); };
	$c = array( 'id' => $p->ID, 'lid' => (string) $m( 'lid' ), 'title' => $p->post_title, 'ref' => (string) $m( 'ref' ), 'date' => (string) $m( 'date' ), 'time' => (string) $m( 'time' ),
		'status' => (string) $m( 'status' ) ?: 'pending', 'loc' => (string) $m( 'loc' ), 'notes' => (string) $m( 'notes' ), 'officeNote' => (string) $m( 'onote' ), 'created' => get_post_time( 'U', true, $p ) * 1000 );
	if ( $office ) { $c += array( 'name' => (string) $m( 'name' ), 'phone' => (string) $m( 'phone' ), 'uid' => (int) $p->post_author ); }
	return $c;
}
function oay_view_label( $date, $time ) { $ts = oay_view_ts( $date, $time ); return $ts ? wp_date( 'l j/n', $ts ) . ' · ' . wp_date( 'g:i A', $ts ) : $date . ' ' . $time; }
function oay_acc_view_book() {
	oay_acc_limit( 'vbook', 10 );
	$u = oay_acc_user_from_token( oay_acc_arg( 'token', 120 ) );
	$date = preg_replace( '/[^\d-]/', '', oay_acc_arg( 'date', 10 ) ); $time = preg_replace( '/[^\d:]/', '', oay_acc_arg( 'time', 5 ) );
	$name = mb_substr( sanitize_text_field( oay_acc_arg( 'name', 60 ) ), 0, 60 ); $phone = preg_replace( '/[^\d+]/', '', oay_acc_arg( 'phone', 20 ) );
	if ( '' === $name || strlen( preg_replace( '/\D/', '', $phone ) ) < 9 ) { oay_acc_err( 'اكتب الاسم ورقم جوال صحيح' ); }
	$ok = false; foreach ( oay_view_slots( $date ) as $s ) { if ( $s['t'] === $time && $s['free'] ) { $ok = true; } }
	if ( ! $ok ) { oay_acc_err( 'هذا الموعد لم يعد متاحاً — اختر وقتاً آخر' ); }
	$lid = substr( preg_replace( '/[^\w:\-]/u', '', oay_acc_arg( 'id', 60 ) ), 0, 60 );
	$title = $lid && function_exists( 'oay_land_name' ) ? oay_land_name( $lid ) : mb_substr( sanitize_text_field( oay_acc_arg( 'title', 120 ) ), 0, 120 );
	$id = wp_insert_post( array( 'post_type' => 'oay_viewing', 'post_status' => 'private', 'post_title' => $title, 'post_author' => $u ? $u->ID : 0 ) );
	if ( ! $id || is_wp_error( $id ) ) { oay_acc_err( 'تعذّر الحجز' ); }
	$ref = $lid && function_exists( 'oay_ref_of' ) ? oay_ref_of( $lid ) : '';
	foreach ( array( 'lid' => $lid, 'ref' => $ref, 'date' => $date, 'time' => $time, 'name' => $name, 'phone' => $phone, 'status' => 'pending',
		'loc' => esc_url_raw( oay_acc_arg( 'loc', 400 ) ), 'notes' => mb_substr( sanitize_textarea_field( oay_acc_arg( 'notes', 400 ) ), 0, 400 ) ) as $k => $v ) { update_post_meta( $id, $k, $v ); }
	if ( $u && function_exists( 'oay_lead_add' ) ) { if ( ! get_user_meta( $u->ID, 'oay_phone', true ) ) { update_user_meta( $u->ID, 'oay_phone', $phone ); } oay_lead_add( $u->ID, 'view', $lid, $title ); }
	if ( function_exists( 'oay_contact_log' ) ) { oay_contact_log( array( 'kind' => 'view', 'id' => $lid, 'name' => $title, 'ref' => $ref, 'uid' => $u ? $u->ID : 0, 'who' => $name, 'phone' => $phone, 'msg' => '📅 ' . oay_view_label( $date, $time ), 'done' => false ) ); }
	if ( function_exists( 'oay_push_to' ) ) { oay_push_to( oay_view_staff(), '📅 طلب معاينة · ' . $name, $title . ' · ' . oay_view_label( $date, $time ), array( 'open' => 'views' ) ); }
	oay_acc_ok( array( 'item' => oay_view_card( get_post( $id ) ) ) );
}
function oay_view_staff() {
	$ids = get_users( array( 'capability' => 'manage_options', 'fields' => 'ID' ) );
	foreach ( get_users( array( 'meta_key' => 'oay_staff', 'fields' => 'ID' ) ) as $s ) { if ( in_array( 'viewings', oay_staff_perms( $s ), true ) ) { $ids[] = $s; } }
	return array_values( array_unique( array_map( 'intval', $ids ) ) );
}
function oay_acc_view_mine() {
	$u = oay_acc_need_user();
	oay_acc_ok( array( 'items' => array_map( 'oay_view_card', get_posts( array( 'post_type' => 'oay_viewing', 'post_status' => 'private', 'author' => $u->ID, 'numberposts' => 50 ) ) ), 'labels' => OAY_VIEW_ST ) );
}
function oay_acc_view_cancel() {
	$u = oay_acc_need_user(); $p = get_post( absint( oay_acc_arg( 'id', 12 ) ) );
	if ( ! $p || 'oay_viewing' !== $p->post_type || (int) $p->post_author !== $u->ID ) { oay_acc_err( 'غير موجود', 404 ); }
	update_post_meta( $p->ID, 'status', 'cancelled' );
	if ( function_exists( 'oay_push_to' ) ) { oay_push_to( oay_view_staff(), 'أُلغي موعد معاينة', $p->post_title . ' · ' . oay_view_label( get_post_meta( $p->ID, 'date', true ), get_post_meta( $p->ID, 'time', true ) ), array( 'open' => 'views' ) ); }
	oay_acc_ok();
}
function oay_acc_adm_views() {
	oay_acc_need_perm( 'viewings' ); $tab = oay_acc_arg( 'tab', 10 ); $today = wp_date( 'Y-m-d' );
	$all = array_map( function ( $p ) { return oay_view_card( $p, true ); }, get_posts( array( 'post_type' => 'oay_viewing', 'post_status' => 'private', 'numberposts' => 500 ) ) );
	$f = array( 'today' => function ( $v ) use ( $today ) { return $v['date'] === $today && in_array( $v['status'], array( 'pending', 'confirmed' ), true ); },
		'pending' => function ( $v ) { return 'pending' === $v['status']; },
		'next' => function ( $v ) use ( $today ) { return $v['date'] >= $today && in_array( $v['status'], array( 'pending', 'confirmed' ), true ); },
		'past' => function ( $v ) use ( $today ) { return $v['date'] < $today || in_array( $v['status'], array( 'done', 'noshow', 'cancelled' ), true ); } );
	$counts = array(); foreach ( $f as $k => $fn ) { $counts[ $k ] = count( array_filter( $all, $fn ) ); }
	$items = array_values( array_filter( $all, $f[ $tab ] ?? $f['next'] ) );
	usort( $items, function ( $a, $b ) use ( $tab ) { $x = $a['date'] . $a['time']; $y = $b['date'] . $b['time']; return 'past' === $tab ? strcmp( $y, $x ) : strcmp( $x, $y ); } );
	oay_acc_ok( array( 'items' => $items, 'counts' => $counts, 'labels' => OAY_VIEW_ST, 'cfg' => oay_view_cfg() ) );
}
function oay_acc_adm_view_save() {
	oay_acc_need_perm( 'viewings' ); $p = get_post( absint( oay_acc_arg( 'id', 12 ) ) ); if ( ! $p || 'oay_viewing' !== $p->post_type ) { oay_acc_err( 'غير موجود', 404 ); }
	$in = oay_acc_in(); $old = oay_view_card( $p, true ); $msg = '';
	if ( isset( $in['date'], $in['time'] ) && ( $in['date'] !== $old['date'] || $in['time'] !== $old['time'] ) ) {
		$d = preg_replace( '/[^\d-]/', '', (string) $in['date'] ); $t = preg_replace( '/[^\d:]/', '', (string) $in['time'] );
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $d ) || ! preg_match( '/^\d{2}:\d{2}$/', $t ) ) { oay_acc_err( 'التاريخ أو الوقت غير صحيح' ); }
		update_post_meta( $p->ID, 'date', $d ); update_post_meta( $p->ID, 'time', $t ); delete_post_meta( $p->ID, 'reminded' ); update_post_meta( $p->ID, 'status', 'confirmed' );
		$msg = 'تم تغيير موعد المعاينة إلى ' . oay_view_label( $d, $t );
	}
	if ( isset( $in['status'] ) && isset( OAY_VIEW_ST[ $in['status'] ] ) && $in['status'] !== $old['status'] ) {
		update_post_meta( $p->ID, 'status', $in['status'] );
		if ( 'confirmed' === $in['status'] && ! $msg ) { $msg = 'تم تأكيد موعد المعاينة: ' . oay_view_label( $old['date'], $old['time'] ); }
		if ( 'cancelled' === $in['status'] ) { $msg = 'نعتذر، تم إلغاء موعد المعاينة — تواصل معنا لموعد آخر'; }
	}
	if ( isset( $in['note'] ) ) { update_post_meta( $p->ID, 'onote', mb_substr( sanitize_textarea_field( (string) $in['note'] ), 0, 400 ) ); }
	if ( $msg && $old['uid'] && function_exists( 'oay_push_to' ) ) { oay_push_to( array( $old['uid'] ), '📅 ' . $p->post_title, $msg, array( 'open' => 'myviews' ) ); }
	oay_acc_ok( array( 'item' => oay_view_card( get_post( $p->ID ), true ) ) );
}
function oay_acc_adm_view_cfg() {
	oay_acc_need_perm( 'viewings' ); $in = oay_acc_in(); $c = oay_view_cfg();
	if ( isset( $in['days'] ) ) { $c['days'] = array_values( array_unique( array_filter( array_map( 'intval', (array) $in['days'] ), function ( $d ) { return $d >= 0 && $d <= 6; } ) ) ); }
	foreach ( array( 'from' => array( 0, 23 ), 'to' => array( 1, 24 ), 'step' => array( 15, 240 ), 'max' => array( 1, 20 ), 'ahead' => array( 1, 60 ) ) as $k => $r ) { if ( isset( $in[ $k ] ) ) { $c[ $k ] = max( $r[0], min( $r[1], (int) $in[ $k ] ) ); } }
	if ( $c['to'] <= $c['from'] ) { $c['to'] = $c['from'] + 1; }
	update_option( 'oay_view_cfg', $c, false );
	oay_acc_ok( array( 'cfg' => $c ) );
}
// every hour: reminders two hours before confirmed visits, and the office's list for the day each morning
add_action( 'oay_view_tick', function () {
	if ( ! function_exists( 'oay_push_to' ) ) { return; }
	$now = time();
	foreach ( get_posts( array( 'post_type' => 'oay_viewing', 'post_status' => 'private', 'numberposts' => 300, 'meta_query' => array( array( 'key' => 'status', 'value' => 'confirmed' ), array( 'key' => 'reminded', 'compare' => 'NOT EXISTS' ) ) ) ) as $p ) {
		$ts = oay_view_ts( get_post_meta( $p->ID, 'date', true ), get_post_meta( $p->ID, 'time', true ) );
		if ( $ts > $now && $ts - $now <= 3 * HOUR_IN_SECONDS ) {
			update_post_meta( $p->ID, 'reminded', 1 );
			$when = wp_date( 'g:i A', $ts );
			if ( $p->post_author ) { oay_push_to( array( (int) $p->post_author ), '⏰ تذكير بموعد المعاينة', $p->post_title . ' · الساعة ' . $when, array( 'open' => 'myviews' ) ); }
			oay_push_to( oay_view_staff(), '⏰ معاينة الساعة ' . $when, $p->post_title . ' · ' . get_post_meta( $p->ID, 'name', true ), array( 'open' => 'views' ) );
		}
	}
	if ( '07' === wp_date( 'H' ) ) {
		$today = wp_date( 'Y-m-d' ); $n = count( get_posts( array( 'post_type' => 'oay_viewing', 'post_status' => 'private', 'numberposts' => 100, 'fields' => 'ids', 'meta_query' => array( array( 'key' => 'date', 'value' => $today ), array( 'key' => 'status', 'value' => array( 'pending', 'confirmed' ), 'compare' => 'IN' ) ) ) ) );
		if ( $n && get_option( 'oay_view_digest' ) !== $today ) { update_option( 'oay_view_digest', $today, false ); oay_push_to( oay_view_staff(), '📅 مواعيد المعاينة اليوم: ' . $n, 'افتح التطبيق لعرض التفاصيل', array( 'open' => 'views' ) ); }
	}
} );
