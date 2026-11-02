<?php
/**
 * Plugin Name: Alyassi App – Broker wallet
 * Description: «محفظتي» for every real-estate office / broker account: their listings, and their deals — lands they
 *              bought (instalments they pay) and lands they sold (instalments they receive, with their commission) — with
 *              the next payment, the upcoming instalments and their earnings. The broker keeps it; the office can view,
 *              add and edit it too. A reminder is pushed the day before and on the day an instalment falls due.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'wallet_get', 'wallet_save', 'wallet_del', 'wallet_pay', 'adm_deals', 'adm_deal_review' ) as $a ) {
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
	$out = array( 'deals' => oay_wallet( $uid ), 'listings' => array( 'live' => $live, 'all' => count( $ads ), 'value' => $value ),
		'who' => $u ? array( 'id' => $uid, 'name' => ( get_user_meta( $uid, 'oay_company', true ) ?: $u->display_name ) ) : null );
	if ( $u && user_can( $u, 'manage_options' ) ) { $out['company'] = oay_wallet_company(); }   // the company's own wallet: all its lands and every broker's deals
	return $out;
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
		'phone' => substr( preg_replace( '/[^\d+]/', '', (string) ( $d['phone'] ?? '' ) ), 0, 20 ),
		'project' => sanitize_key( (string) ( $d['project'] ?? '' ) ), 'plot' => mb_substr( sanitize_text_field( (string) ( $d['plot'] ?? '' ) ), 0, 20 ),
		'price' => $price, 'pct' => 'sell' === $type ? max( 0, min( 50, round( (float) ( $d['pct'] ?? 0 ), 2 ) ) ) : 0,
		'comm' => 'sell' === $type ? round( max( 0, (float) ( $d['comm'] ?? 0 ) ) ) : 0,   // a fixed commission instead of a percentage (optional)
		'date' => preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) ( $d['date'] ?? '' ) ) ? (string) $d['date'] : wp_date( 'Y-m-d' ),
		'note' => mb_substr( sanitize_textarea_field( (string) ( $d['note'] ?? '' ) ), 0, 500 ), 'sched' => $s, 'done' => ! empty( $d['done'] ),
		'by' => (int) $by, 't' => time() * 1000,
		// where the deal comes from: «own» = the broker's own listing (number), «company» = a company plot (slug:n), «manual»
		'src' => in_array( $d['src'] ?? '', array( 'own', 'company', 'manual' ), true ) ? $d['src'] : 'manual',
		'ref' => substr( preg_replace( '/[^\w:\-]/u', '', (string) ( $d['ref'] ?? '' ) ), 0, 60 ),
	);
}
function oay_acc_wallet_save() {
	list( $uid, $office ) = oay_wallet_owner(); $me = oay_acc_user_from_token( oay_acc_arg( 'token', 120 ) );
	$in = oay_acc_in(); $d = oay_wallet_clean( is_array( $in['deal'] ?? null ) ? $in['deal'] : array(), $me ? $me->ID : $uid );
	$w = oay_wallet( $uid ); $idx = null;
	foreach ( $w as $i => $x ) { if ( ( $x['id'] ?? '' ) === $d['id'] ) { $idx = $i; } }
	$prev = null !== $idx ? $w[ $idx ] : null;
	// approval: the office (or the company's own account) approves as it saves; a broker's own listing needs none;
	// anything else (a company plot, a land outside the app) waits for the office
	$admin_self = $me && oay_acc_is_admin( $me );
	$own = 'own' === $d['src'] && ctype_digit( $d['ref'] ) && ( $p = get_post( (int) $d['ref'] ) ) && 'lands' === $p->post_type && (int) $p->post_author === (int) $uid;
	if ( 'own' === $d['src'] && ! $own ) { $d['src'] = 'manual'; }
	if ( $office || $admin_self || $own ) { $d['st'] = 'ok'; if ( $office || $admin_self ) { $d['okby'] = $me ? (int) $me->ID : 0; } }
	else {
		$same = $prev && 'ok' === ( $prev['st'] ?? '' ) && $prev['price'] === $d['price'] && $prev['title'] === $d['title'] && $prev['type'] === $d['type'] && (float) $prev['pct'] === (float) $d['pct'] && (int) $prev['comm'] === (int) $d['comm'];
		$d['st'] = $same ? 'ok' : 'pending';   // changing the price, the land or the commission sends it back for approval
		if ( $same && isset( $prev['okby'] ) ) { $d['okby'] = $prev['okby']; }
	}
	if ( null !== $idx ) { $w[ $idx ] = $d; } else { if ( count( $w ) >= 300 ) { oay_acc_err( 'وصلت للحد الأقصى من الصفقات' ); } $w[] = $d; }
	oay_wallet_put( $uid, $w ); oay_wallet_flag( $uid );
	if ( 'pending' === $d['st'] && ( ! $prev || 'pending' !== ( $prev['st'] ?? '' ) ) && function_exists( 'oay_push_to' ) ) {
		$u = get_userdata( $uid );
		oay_push_to( oay_admin_ids(), '💼 طلب تسجيل صفقة', ( $u ? ( get_user_meta( $uid, 'oay_company', true ) ?: $u->display_name ) : '' ) . ' · ' . $d['title'] . ' · ' . number_format( $d['price'] ) . ' د.إ', array( 'open' => 'admin' ) );
	}
	oay_acc_ok( oay_wallet_out( $uid ) );
}
/** remembers who has deals waiting, so the office's list is quick */
function oay_wallet_flag( $uid ) {
	$n = 0; foreach ( oay_wallet( $uid ) as $x ) { if ( 'pending' === ( $x['st'] ?? '' ) ) { $n++; } }
	if ( $n ) { update_user_meta( $uid, 'oay_wallet_pend', $n ); } else { delete_user_meta( $uid, 'oay_wallet_pend' ); }
}
/** Office: the deals waiting for approval */
function oay_acc_adm_deals() {
	oay_acc_need_perm( 'listings' ); $items = array();
	foreach ( get_users( array( 'meta_key' => 'oay_wallet_pend', 'number' => 300 ) ) as $u ) {
		foreach ( oay_wallet( $u->ID ) as $d ) {
			if ( 'pending' !== ( $d['st'] ?? '' ) ) { continue; }
			$plot = null;
			if ( 'company' === $d['src'] && strpos( $d['ref'], ':' ) && function_exists( 'oay_plot_info' ) ) { list( $sl, $n ) = explode( ':', $d['ref'], 2 ); $plot = oay_plot_info( $sl, $n ); }
			$items[] = array( 'uid' => $u->ID, 'who' => get_user_meta( $u->ID, 'oay_company', true ) ?: $u->display_name, 'email' => $u->user_email, 'deal' => $d, 'plot' => $plot ? array( 's' => $plot['s'], 'total' => $plot['total'] ) : null );
		}
	}
	usort( $items, function ( $a, $b ) { return $b['deal']['t'] <=> $a['deal']['t']; } );
	oay_acc_ok( array( 'items' => $items ) );
}
/** Office: approve (optionally marking the company plot reserved / sold) or reject with a note */
function oay_acc_adm_deal_review() {
	$me = oay_acc_need_perm( 'listings' ); $uid = absint( oay_acc_arg( 'uid', 12 ) ); $id = (string) oay_acc_arg( 'id', 20 );
	$ok = '1' === oay_acc_arg( 'approve', 1 ); $mark = oay_acc_arg( 'mark', 5 );
	$w = oay_wallet( $uid ); $deal = null;
	foreach ( $w as $i => $x ) {
		if ( ( $x['id'] ?? '' ) !== $id ) { continue; }
		$w[ $i ]['st'] = $ok ? 'ok' : 'rejected'; $w[ $i ]['okby'] = (int) $me->ID; $w[ $i ]['rnote'] = $ok ? '' : sanitize_text_field( oay_acc_arg( 'note', 200 ) ); $deal = $w[ $i ];
	}
	if ( ! $deal ) { oay_acc_err( 'غير موجود', 404 ); }
	oay_wallet_put( $uid, $w ); oay_wallet_flag( $uid ); delete_transient( 'oay_wallet_co' );
	$marked = false;
	if ( $ok && in_array( $mark, array( 'res', 'sold' ), true ) && 'company' === $deal['src'] && strpos( $deal['ref'], ':' ) ) { $marked = oay_wallet_mark_plot( $deal['ref'], $mark ); }
	if ( function_exists( 'oay_push_to' ) ) {
		oay_push_to( array( $uid ), $ok ? '✓ تم اعتماد صفقتك' : 'بخصوص طلب الصفقة', $deal['title'] . ( $ok ? ' — أُضيفت إلى محفظتك' : ' — لم تُعتمد' . ( $deal['rnote'] ? ': ' . $deal['rnote'] : '' ) ), array( 'open' => 'wallet' ) );
	}
	oay_acc_ok( array( 'marked' => $marked ) );
}
/** changes a company plot's status in its project (reserved / sold), the same as the plan's own admin does */
function oay_wallet_mark_plot( $ref, $st ) {
	if ( ! function_exists( 'dnp_projects' ) ) { return false; }
	list( $slug, $n ) = explode( ':', $ref, 2 ); $ps = dnp_projects(); if ( empty( $ps[ $slug ]['opt'] ) ) { return false; }
	$opt = $ps[ $slug ]['opt']; $raw = get_option( $opt ); $isStr = is_string( $raw );
	$v = $isStr ? json_decode( $raw, true ) : $raw;
	if ( ! is_array( $v ) || ! isset( $v['plots'][ $n ] ) || ! is_array( $v['plots'][ $n ] ) ) { return false; }
	$v['plots'][ $n ]['s'] = $st;
	if ( isset( $v['updated'] ) ) { $v['updated'] = time() * ( $v['updated'] > 1e11 ? 1000 : 1 ); }
	update_option( $opt, $isStr ? wp_json_encode( $v, JSON_UNESCAPED_UNICODE ) : $v );
	delete_transient( 'oay_mail_pool' ); delete_transient( 'oay_wallet_co' );
	return true;
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

/** the company's lands across all projects (available / reserved / sold, values, buyers' coming instalments) and the brokers' approved deals */
function oay_wallet_company() {
	$c = get_transient( 'oay_wallet_co' ); if ( is_array( $c ) ) { return $c; }
	$today = wp_date( 'Y-m-d' ); $projects = array(); $tot = array( 'av' => 0, 'res' => 0, 'sold' => 0, 'avValue' => 0, 'soldValue' => 0 ); $due = array();
	if ( function_exists( 'dnp_projects' ) && function_exists( 'oay_plots' ) ) {
		foreach ( dnp_projects() as $slug => $p ) {
			if ( empty( $p['opt'] ) ) { continue; }
			$plan = function_exists( 'oay_plan_plots' ) ? oay_plan_plots( $slug ) : array();
			$row = array( 'slug' => $slug, 'name' => (string) ( $p['name'] ?? $slug ), 'av' => 0, 'res' => 0, 'sold' => 0, 'avValue' => 0, 'soldValue' => 0 );
			foreach ( oay_plots( get_option( $p['opt'] ) ) as $n => $q ) {
				$st = (string) ( $q['s'] ?? '' ); if ( ! isset( $row[ $st ] ) || ! in_array( $st, array( 'av', 'res', 'sold' ), true ) ) { continue; }
				$ft = (float) ( $q['ft'] ?? ( $plan[ (string) $n ][1] ?? 0 ) );
				$price = ! empty( $q['total'] ) ? (float) $q['total'] : ( ! empty( $q['ppf'] ) && $ft ? round( $q['ppf'] * $ft ) : 0 );
				$row[ $st ]++;
				if ( 'av' === $st ) { $row['avValue'] += $price; }
				else {
					$row['soldValue'] += $price;
					foreach ( (array) ( $q['inst'] ?? array() ) as $x ) { if ( is_array( $x ) && (string) ( $x[0] ?? '' ) >= $today && ( $amt = (float) ( $x[1] ?? 0 ) ) > 0 ) { $due[] = array( 'd' => substr( (string) $x[0], 0, 10 ), 'a' => $amt, 'title' => 'قطعة ' . $n . ' · ' . $row['name'] ); } }
				}
			}
			foreach ( array( 'av', 'res', 'sold', 'avValue', 'soldValue' ) as $k ) { $tot[ $k ] += $row[ $k ]; }
			$projects[] = $row;
		}
	}
	usort( $due, function ( $a, $b ) { return strcmp( $a['d'], $b['d'] ); } );
	$brokers = array();
	foreach ( get_users( array( 'meta_key' => 'oay_wallet', 'number' => 2000 ) ) as $u ) {
		$sales = 0; $comm = 0; $n = 0;
		foreach ( oay_wallet( $u->ID ) as $d ) { if ( 'ok' !== ( $d['st'] ?? 'ok' ) || 'sell' !== $d['type'] ) { continue; } $n++; $sales += $d['price']; $comm += $d['comm'] ?: round( $d['price'] * $d['pct'] / 100 ); }
		if ( $n && ! user_can( $u, 'manage_options' ) ) { $brokers[] = array( 'id' => $u->ID, 'name' => get_user_meta( $u->ID, 'oay_company', true ) ?: $u->display_name, 'deals' => $n, 'sales' => $sales, 'comm' => $comm ); }
	}
	usort( $brokers, function ( $a, $b ) { return $b['sales'] <=> $a['sales']; } );
	$c = array( 'total' => $tot, 'projects' => $projects, 'due' => array_slice( $due, 0, 60 ), 'dueSum' => array_sum( array_column( $due, 'a' ) ), 'brokers' => array_slice( $brokers, 0, 30 ) );
	set_transient( 'oay_wallet_co', $c, 10 * MINUTE_IN_SECONDS );
	return $c;
}
