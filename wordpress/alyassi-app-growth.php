<?php
/**
 * Plugin Name: Alyassi App – Interested clients, demand, invitations, «أرضي», total cost
 * Description: 1) «عميل مهتم»: a member who opens the same land 3 times (or saves a land and does not get in touch) → the office is told.
 *              2) Demand: what visitors search for and do not find, and the most-viewed lands still unsold.
 *              3) Member invitation codes: who brought whom.
 *              4) «أرضي»: the office links a bought plot to the buyer's account → the buyer sees the payments and gets reminders.
 *              5) The total-cost calculator's fees (set by the admin).
 *              Uses the helpers of alyassi-app-accounts.php / -crm.php / -push.php.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'adm_demand', 'ref_me', 'adm_refs', 'mylands_get', 'adm_mylands', 'adm_myland_link', 'cost_cfg', 'adm_cost_save' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}
function oay_g_ms() { return (int) round( microtime( true ) * 1000 ); }
/** the office people who follow clients */
function oay_g_leads_staff() {
	if ( ! function_exists( 'oay_admin_ids' ) ) { return array(); }
	return array_values( array_filter( oay_admin_ids(), function ( $id ) {
		$u = get_userdata( $id ); return $u && ( user_can( $u, 'manage_options' ) || ( function_exists( 'oay_acc_can' ) && oay_acc_can( $u, 'leads' ) ) );
	} ) );
}
function oay_g_who( $uid ) { $u = get_userdata( $uid ); return $u ? ( get_user_meta( $uid, 'oay_company', true ) ?: $u->display_name ) : ''; }

/* ======================================================================================
 * 1. «عميل مهتم»
 * ==================================================================================== */
add_action( 'oay_tracked', function ( $uid, $dev, $ev ) {
	oay_demand_note( $ev );
	if ( ! $uid ) { return; }
	$views = array();
	foreach ( $ev as $e ) { if ( is_array( $e ) && 'view' === ( $e['e'] ?? '' ) ) { $id = substr( preg_replace( '/[^\w:\-]/u', '', (string) ( $e['id'] ?? '' ) ), 0, 60 ); if ( $id ) { $views[ $id ] = ( $views[ $id ] ?? 0 ) + 1; } } }
	if ( ! $views ) { return; }
	$vc = get_user_meta( $uid, 'oay_viewc', true ); $vc = is_array( $vc ) ? $vc : array(); $now = time();
	foreach ( $vc as $id => $v ) { if ( $now - (int) ( $v['t'] ?? 0 ) > 14 * DAY_IN_SECONDS ) { unset( $vc[ $id ] ); } }
	$hot = array(); $two = array();
	foreach ( $views as $id => $k ) {
		$v = $vc[ $id ] ?? array( 'n' => 0, 't' => $now, 'h' => 0, 'l' => 0 );
		if ( $now - (int) ( $v['l'] ?? 0 ) > 10 * MINUTE_IN_SECONDS ) { $v['n']++; }   // opening it again within 10 minutes is the same visit
		$v['l'] = $now;
		if ( $v['n'] >= 3 && ! $v['h'] ) { $v['h'] = 1; $hot[] = $id; }
		elseif ( 2 === $v['n'] && empty( $v['t2'] ) ) { $v['t2'] = 1; $two[] = $id; }   // a second visit: counts toward «عميل ساخن» with a favourite or a call
		$vc[ $id ] = $v;
	}
	if ( count( $vc ) > 80 ) { uasort( $vc, function ( $a, $b ) { return $b['t'] <=> $a['t']; } ); $vc = array_slice( $vc, 0, 80, true ); }
	update_user_meta( $uid, 'oay_viewc', $vc );
	// the push («عميل ساخن») goes from oay_lead_add() to whoever follows the client
	foreach ( $two as $id ) { if ( function_exists( 'oay_lead_add' ) ) { oay_lead_add( $uid, 'view2', $id, function_exists( 'oay_land_name' ) ? oay_land_name( $id ) : $id ); } }
	foreach ( $hot as $id ) { if ( function_exists( 'oay_lead_add' ) ) { oay_lead_add( $uid, 'hot', $id, function_exists( 'oay_land_name' ) ? oay_land_name( $id ) : $id ); } }
}, 10, 3 );

/* a member saved a land: noted; if they have not got in touch a day later, the office gets one push a day listing them */
add_action( 'oay_fav_added', function ( $uid, $id ) {
	$q = get_user_meta( $uid, 'oay_favq', true ); $q = is_array( $q ) ? $q : array();
	if ( ! isset( $q[ $id ] ) ) { $q[ $id ] = time(); update_user_meta( $uid, 'oay_favq', array_slice( $q, -20, null, true ) ); update_user_meta( $uid, 'oay_has_favq', 1 ); }
	if ( function_exists( 'oay_lead_add' ) ) { oay_lead_add( $uid, 'fav', $id ); }
}, 10, 2 );
add_action( 'init', function () { if ( ! wp_next_scheduled( 'oay_growth_daily' ) ) { wp_schedule_event( strtotime( 'tomorrow 05:00 UTC' ), 'daily', 'oay_growth_daily' ); } } );
add_action( 'oay_growth_daily', function () {
	// 1) saved but no contact
	$names = array(); $n = 0;
	foreach ( get_users( array( 'meta_key' => 'oay_has_favq', 'meta_value' => '1', 'fields' => 'ID', 'number' => 2000 ) ) as $uid ) {
		$q = get_user_meta( $uid, 'oay_favq', true ); $q = is_array( $q ) ? $q : array(); $l = function_exists( 'oay_lead_get' ) ? oay_lead_get( $uid ) : null;
		$keep = array(); $hit = false;
		foreach ( $q as $id => $t ) {
			if ( time() - $t < 20 * HOUR_IN_SECONDS ) { $keep[ $id ] = $t; continue; }
			$talked = false; foreach ( (array) ( $l['items'] ?? array() ) as $it ) { if ( in_array( $it['src'], array( 'wa', 'call', 'chat' ), true ) && $it['t'] >= $t * 1000 ) { $talked = true; break; } }
			if ( ! $talked && ! in_array( $l['status'] ?? 'new', array( 'won', 'lost' ), true ) ) { $hit = true; }
		}
		update_user_meta( $uid, 'oay_favq', $keep ); if ( ! $keep ) { delete_user_meta( $uid, 'oay_has_favq' ); }
		if ( $hit ) { $n++; if ( count( $names ) < 3 ) { $names[] = oay_g_who( $uid ); } }
	}
	if ( $n && function_exists( 'oay_push_to' ) ) { oay_push_to( oay_g_leads_staff(), '❤️ ' . $n . ( $n > 1 ? ' عملاء أضافوا أراضي للمفضلة' : ' عميل أضاف أرضاً للمفضلة' ) . ' ولم يتواصل', implode( '، ', $names ) . ( $n > 3 ? ' وغيرهم' : '' ) . ' — تابعهم من «متابعة العملاء»', array( 'open' => 'leads' ) ); }
	// 2) «أرضي»: payment reminders 3 days before and the day before
	oay_mylands_remind();
} );

/* ======================================================================================
 * 2. Demand: searches / filters that found nothing (per day), and the most-viewed unsold lands
 * ==================================================================================== */
function oay_demand_note( $ev ) {
	$terms = array();
	foreach ( (array) $ev as $e ) {
		if ( ! is_array( $e ) || 'nores' !== ( $e['e'] ?? '' ) ) { continue; }
		$t = trim( mb_substr( preg_replace( '/\s+/u', ' ', sanitize_text_field( (string) ( $e['id'] ?? '' ) ) ), 0, 80 ) );
		if ( mb_strlen( $t ) >= 2 ) { $terms[] = $t; }
	}
	if ( ! $terms ) { return; }
	$k = 'oay_dm_' . wp_date( 'Ymd' ); $d = get_option( $k, array() ); $d = is_array( $d ) ? $d : array();
	foreach ( array_slice( $terms, 0, 10 ) as $t ) { if ( isset( $d[ $t ] ) || count( $d ) < 1500 ) { $d[ $t ] = ( $d[ $t ] ?? 0 ) + 1; } }
	update_option( $k, $d, false );
}
function oay_acc_adm_demand() {
	oay_acc_need_perm( 'report' ); $w = min( 52, absint( oay_acc_arg( 'weeks', 3 ) ) ); $end = time() - $w * WEEK_IN_SECONDS;
	$terms = array(); $views = array(); $wa = array();
	for ( $i = 0; $i < 30; $i++ ) {   // searches: the last 30 days (they are few); views: the report's week
		$ts = $end - $i * DAY_IN_SECONDS;
		foreach ( (array) get_option( 'oay_dm_' . wp_date( 'Ymd', $ts ), array() ) as $t => $c ) { $terms[ $t ] = ( $terms[ $t ] ?? 0 ) + (int) $c; }
		if ( $i < 7 ) { $d = get_option( 'oay_st_' . wp_date( 'Ymd', $ts ), array() ); foreach ( (array) ( $d['view'] ?? array() ) as $id => $c ) { $views[ $id ] = ( $views[ $id ] ?? 0 ) + $c; } foreach ( (array) ( $d['wa'] ?? array() ) as $id => $c ) { $wa[ $id ] = ( $wa[ $id ] ?? 0 ) + $c; } }
	}
	arsort( $terms ); arsort( $views );
	$unsold = array();
	foreach ( $views as $id => $c ) {
		if ( count( $unsold ) >= 10 ) { break; }
		if ( ! strpos( (string) $id, ':' ) || ! function_exists( 'oay_plot_info' ) ) { continue; }
		list( $slug, $n ) = explode( ':', $id, 2 ); $p = oay_plot_info( $slug, $n );
		if ( $p && 'av' === $p['s'] ) { $unsold[] = array( 'id' => (string) $id, 'name' => 'قطعة ' . $n . ' · ' . $p['name'], 'n' => (int) $c, 'wa' => (int) ( $wa[ $id ] ?? 0 ), 'price' => (int) $p['total'] ); }
	}
	$out = array(); foreach ( array_slice( $terms, 0, 15, true ) as $t => $c ) { $out[] = array( 'q' => (string) $t, 'n' => (int) $c ); }
	oay_acc_ok( array( 'nores' => $out, 'unsold' => $unsold ) );
}

/* ======================================================================================
 * 3. Member invitations: every member has a code (M + 6); a new member who signs up with it is linked to them
 * ==================================================================================== */
function oay_ref_code( $uid ) {
	$c = (string) get_user_meta( $uid, 'oay_refcode', true ); if ( $c ) { return $c; }
	$abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	for ( $i = 0; $i < 20; $i++ ) { $c = 'M'; for ( $k = 0; $k < 6; $k++ ) { $c .= $abc[ wp_rand( 0, 31 ) ]; } if ( ! oay_ref_owner( $c ) ) { break; } }
	update_user_meta( $uid, 'oay_refcode', $c ); return $c;
}
function oay_ref_owner( $code ) {
	$code = strtoupper( preg_replace( '/[^A-Za-z0-9]/', '', (string) $code ) ); if ( ! preg_match( '/^M[A-Z0-9]{6}$/', $code ) ) { return 0; }
	$u = get_users( array( 'meta_key' => 'oay_refcode', 'meta_value' => $code, 'fields' => 'ID', 'number' => 1 ) ); return $u ? (int) $u[0] : 0;
}
/** the sign-up form's «كود الدعوة»: a staff invitation, or a member's code */
function oay_invite_ok( $code ) { return ( function_exists( 'oay_invite_get' ) && oay_invite_get( $code ) ) || oay_ref_owner( $code ); }
add_action( 'oay_registered', function ( $uid, $code ) {
	$by = oay_ref_owner( $code ); if ( ! $by || $by === (int) $uid ) { return; }
	update_user_meta( $uid, 'oay_ref_by', $by ); update_user_meta( $uid, 'oay_ref_t', oay_g_ms() );
	$list = get_user_meta( $by, 'oay_refs', true ); $list = is_array( $list ) ? $list : array(); $list[] = (int) $uid; update_user_meta( $by, 'oay_refs', array_values( array_unique( $list ) ) );
	update_user_meta( $by, 'oay_has_refs', 1 );
	$name = oay_g_who( $uid );
	if ( function_exists( 'oay_push_to' ) ) {
		oay_push_to( array( $by ), '🎉 انضم ' . $name . ' عن طريق دعوتك', 'شكراً لمشاركتك تطبيق عمر الياسي للعقارات', array( 'open' => 'invite' ) );
	}
	if ( function_exists( 'oay_lead_add' ) ) { oay_lead_add( $uid, 'ref', '', 'سجّل بدعوة من ' . oay_g_who( $by ) ); }
}, 10, 2 );
function oay_ref_rows( $uid ) {
	$out = array();
	foreach ( (array) get_user_meta( $uid, 'oay_refs', true ) as $id ) {
		$u = get_userdata( $id ); if ( ! $u ) { continue; }
		$l = function_exists( 'oay_lead_get' ) ? oay_lead_get( $id ) : null;
		$out[] = array( 'id' => (int) $id, 'name' => $u->display_name, 't' => (int) get_user_meta( $id, 'oay_ref_t', true ), 'won' => $l && 'won' === $l['status'] );
	}
	usort( $out, function ( $a, $b ) { return $b['t'] <=> $a['t']; } ); return $out;
}
function oay_acc_ref_me() {
	$u = oay_acc_need_user(); $rows = oay_ref_rows( $u->ID );
	oay_acc_ok( array( 'code' => oay_ref_code( $u->ID ), 'n' => count( $rows ), 'won' => count( array_filter( $rows, function ( $r ) { return $r['won']; } ) ),
		'items' => array_map( function ( $r ) { return array( 'name' => $r['name'], 't' => $r['t'] ); }, array_slice( $rows, 0, 50 ) ) ) );
}
function oay_acc_adm_refs() {
	oay_acc_need_perm( 'leads' ); $out = array();
	foreach ( get_users( array( 'meta_key' => 'oay_has_refs', 'meta_value' => '1', 'number' => 500 ) ) as $u ) {
		$rows = oay_ref_rows( $u->ID ); if ( ! $rows ) { continue; }
		$out[] = array( 'id' => $u->ID, 'name' => oay_g_who( $u->ID ), 'n' => count( $rows ), 'won' => count( array_filter( $rows, function ( $r ) { return $r['won']; } ) ), 'items' => array_slice( $rows, 0, 30 ) );
	}
	usort( $out, function ( $a, $b ) { return array( $b['won'], $b['n'] ) <=> array( $a['won'], $a['n'] ); } );
	oay_acc_ok( array( 'items' => $out ) );
}

/* ======================================================================================
 * 4. «أرضي»: plots the buyer bought from the company (linked by the office) with their payments
 * ==================================================================================== */
/** live price + payment plan of a company plot (from the plan's saved state) */
function oay_plot_plan( $id ) {
	if ( ! strpos( (string) $id, ':' ) || ! function_exists( 'dnp_projects' ) || ! function_exists( 'oay_plots' ) ) { return null; }
	list( $slug, $n ) = explode( ':', $id, 2 ); $ps = dnp_projects(); if ( empty( $ps[ $slug ] ) ) { return null; }
	$p = $ps[ $slug ]; $plots = empty( $p['opt'] ) ? array() : oay_plots( get_option( $p['opt'] ) ); $q = $plots[ $n ] ?? null; if ( ! is_array( $q ) ) { return null; }
	$total = ! empty( $q['total'] ) ? (int) $q['total'] : ( ( ! empty( $q['ppf'] ) && ! empty( $q['ft'] ) ) ? (int) round( $q['ppf'] * $q['ft'] ) : 0 );
	$inst = array(); foreach ( (array) ( $q['inst'] ?? array() ) as $x ) { if ( is_array( $x ) && ! empty( $x[0] ) ) { $inst[] = array( substr( (string) $x[0], 0, 10 ), (float) ( $x[1] ?? 0 ) ); } }
	usort( $inst, function ( $a, $b ) { return strcmp( $a[0], $b[0] ); } );
	$first = isset( $q['first'] ) ? (float) $q['first'] : max( 0, $total - array_sum( array_column( $inst, 1 ) ) );
	return array( 'id' => (string) $id, 'n' => (string) $n, 'project' => $slug, 'name' => isset( $p['name'] ) ? $p['name'] : $slug, 'total' => $total, 'first' => $first, 'inst' => $inst, 'ft' => (float) ( $q['ft'] ?? 0 ) );
}
function oay_mylands( $uid ) { $m = get_user_meta( $uid, 'oay_mylands', true ); return is_array( $m ) ? array_values( array_filter( $m, 'is_array' ) ) : array(); }
function oay_mylands_out( $uid ) { $out = array(); foreach ( oay_mylands( $uid ) as $m ) { $p = oay_plot_plan( $m['id'] ); $out[] = ( $p ?: array( 'id' => $m['id'], 'name' => $m['id'], 'inst' => array(), 'total' => 0, 'first' => 0 ) ) + array( 't' => (int) ( $m['t'] ?? 0 ) ); } return $out; }
function oay_acc_mylands_get() { $u = oay_acc_need_user(); oay_acc_ok( array( 'items' => oay_mylands_out( $u->ID ) ) ); }
function oay_acc_adm_mylands() { oay_acc_need_perm( 'leads' ); $uid = absint( oay_acc_arg( 'id', 12 ) ); oay_acc_ok( array( 'items' => oay_mylands_out( $uid ) ) ); }
function oay_acc_adm_myland_link() {
	oay_acc_need_perm( 'leads' ); $uid = absint( oay_acc_arg( 'id', 12 ) ); $u = get_userdata( $uid ); if ( ! $u ) { oay_acc_err( 'غير موجود', 404 ); }
	$land = preg_replace( '/[^a-z0-9:\-A-Z]/', '', oay_acc_arg( 'land', 60 ) ); $on = (int) oay_acc_arg( 'on', 2 );
	$m = array_values( array_filter( oay_mylands( $uid ), function ( $x ) use ( $land ) { return $x['id'] !== $land; } ) );
	if ( $on ) {
		if ( ! oay_plot_plan( $land ) ) { oay_acc_err( 'لم يتم العثور على هذه القطعة — تأكد من المشروع ورقم القطعة' ); }
		$m[] = array( 'id' => $land, 't' => oay_g_ms() );
		if ( function_exists( 'oay_push_to' ) ) { $p = oay_plot_plan( $land ); oay_push_to( array( $uid ), '🏡 تمت إضافة أرضك إلى «أرضي»', 'قطعة ' . $p['n'] . ' · ' . $p['name'] . ' — تابع دفعاتك وسيصلك تذكير قبل كل قسط', array( 'open' => 'mylands' ) ); }
		update_user_meta( $uid, 'oay_has_mylands', 1 );
	}
	update_user_meta( $uid, 'oay_mylands', $m ); if ( ! $m ) { delete_user_meta( $uid, 'oay_has_mylands' ); }
	oay_acc_ok( array( 'items' => oay_mylands_out( $uid ) ) );
}
function oay_mylands_remind() {
	if ( ! function_exists( 'oay_push_to' ) ) { return; }
	$d1 = wp_date( 'Y-m-d', time() + DAY_IN_SECONDS ); $d3 = wp_date( 'Y-m-d', time() + 3 * DAY_IN_SECONDS );
	foreach ( get_users( array( 'meta_key' => 'oay_has_mylands', 'meta_value' => '1', 'fields' => 'ID', 'number' => 3000 ) ) as $uid ) {
		foreach ( oay_mylands_out( $uid ) as $p ) {
			foreach ( (array) $p['inst'] as $x ) {
				if ( $x[0] !== $d1 && $x[0] !== $d3 ) { continue; }
				$when = $x[0] === $d1 ? 'غداً' : 'بعد 3 أيام';
				oay_push_to( array( $uid ), '⏰ تذكير بقسط أرضك ' . $when, 'قطعة ' . $p['n'] . ' · ' . $p['name'] . ' — ' . number_format( $x[1] ) . ' د.إ بتاريخ ' . wp_date( 'j/n/Y', strtotime( $x[0] ) ), array( 'open' => 'mylands' ) );
			}
		}
	}
}

/* ======================================================================================
 * 5. Total cost: the fees the calculator adds (the admin sets them)
 * ==================================================================================== */
function oay_cost_cfg() {
	$d = array( 'reg' => 2, 'regOn' => 'buyer', 'comm' => 2, 'fixed' => array( array( 'رسوم إدارية وإصدار سند', 0 ) ), 'note' => 'النسب تقديرية — تؤكدها الإدارة قبل التوقيع.', 't' => 0 );
	$c = get_option( 'oay_costcfg', array() ); return is_array( $c ) ? array_merge( $d, $c ) : $d;
}
function oay_acc_cost_cfg() { oay_acc_ok( array( 'cfg' => oay_cost_cfg() ) ); }
function oay_acc_adm_cost_save() {
	oay_acc_need_admin(); $in = oay_acc_in(); $c = oay_cost_cfg();
	$c['reg'] = max( 0, min( 20, (float) ( $in['reg'] ?? $c['reg'] ) ) ); $c['comm'] = max( 0, min( 20, (float) ( $in['comm'] ?? $c['comm'] ) ) );
	$fx = array(); foreach ( array_slice( (array) ( $in['fixed'] ?? array() ), 0, 6 ) as $f ) { if ( is_array( $f ) && '' !== trim( (string) ( $f[0] ?? '' ) ) ) { $fx[] = array( mb_substr( sanitize_text_field( (string) $f[0] ), 0, 60 ), max( 0, (float) ( $f[1] ?? 0 ) ) ); } }
	$c['fixed'] = $fx; $c['note'] = mb_substr( sanitize_text_field( (string) ( $in['note'] ?? $c['note'] ) ), 0, 200 ); $c['t'] = oay_g_ms();
	update_option( 'oay_costcfg', $c, false ); oay_acc_ok( array( 'cfg' => $c ) );
}

/* ======================================================================================
 * 6. A limited-time offer on a land someone saved → a push to them (with the plot's picture)
 * ==================================================================================== */
add_action( 'oay_offer_sent', function ( $o ) {
	if ( ! function_exists( 'oay_favs_all' ) || empty( $o['id'] ) ) { return; }
	$key = trim( (string) get_option( 'oay_onesignal_key', '' ) ); if ( '' === $key ) { return; }
	$al = array(); foreach ( oay_favs_all() as $who => $e ) { if ( in_array( $o['id'], (array) ( $e['ids'] ?? array() ), true ) ) { $al[] = ( 'u' === $who[0] ? 'oay-' : 'dev-' ) . substr( $who, 1 ); } }
	if ( ! $al ) { return; }
	$price = (int) ( $o['price'] ?? 0 ); $title = '❤️ عرض على أرض في مفضلتك';
	$body = 'قطعة ' . $o['n'] . ' · ' . $o['projectName'] . ( $price ? ' بسعر ' . number_format( $price ) . ' د.إ' : '' ) . ' — العرض لفترة محدودة';
	foreach ( array_chunk( $al, 2000 ) as $part ) {
		wp_remote_post( 'https://api.onesignal.com/notifications?c=push', array( 'timeout' => 8, 'blocking' => false,
			'headers' => array( 'Content-Type' => 'application/json', 'Authorization' => 'Key ' . $key ),
			'body' => wp_json_encode( array( 'app_id' => OAY_APP_ID, 'target_channel' => 'push', 'include_aliases' => array( 'external_id' => $part ),
				'headings' => array( 'en' => $title, 'ar' => $title ), 'contents' => array( 'en' => $body, 'ar' => $body ),
				'data' => array( 'open' => 'land', 'id' => $o['id'] ), 'web_url' => OAY_APP_URL, 'ttl' => 86400 ) + ( function_exists( 'oay_push_img' ) ? oay_push_img( $o ) : array() ) ) ) );
	}
} );

/* ======================================================================================
 * 7. Management: add / edit a company plot on a project's plan from the app —
 *    status (متاحة / محجوزة / مباعة, or off the plan), price, area, «مميزة» and the payment plan.
 *    Writes the same plan data the website's plan editor writes (pictures, documents and the rest are kept).
 * ==================================================================================== */
foreach ( array( 'adm_plot_get', 'adm_plot_save' ) as $a ) { add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a ); add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a ); }
function oay_plot_args() {
	$slug = sanitize_key( oay_acc_arg( 'project', 60 ) ); $n = trim( preg_replace( '/[^\w\-]/u', '', (string) oay_acc_arg( 'n', 20 ) ) );
	if ( ! $slug || '' === $n || ! function_exists( 'oay_plan_plot' ) ) { oay_acc_err( 'اختر المشروع واكتب رقم القطعة' ); }
	$i = oay_plan_plot( $slug, $n ); if ( ! $i ) { oay_acc_err( 'القطعة رقم ' . $n . ' غير موجودة في مخطط هذا المشروع' ); }
	return array( $slug, $n, $i );
}
function oay_plot_out( $n, $i ) {
	$c = is_array( $i['cur'] ) ? $i['cur'] : array(); $q = $i['plot'];
	return array( 'n' => (string) $n, 'listed' => ! empty( $c['s'] ), 's' => (string) ( $c['s'] ?? '' ), 'total' => (int) ( $c['total'] ?? 0 ), 'ppf' => (float) ( $c['ppf'] ?? 0 ),
		'ft' => (float) ( $c['ft'] ?? 0 ), 'planFt' => (float) ( $q['ft'] ?? 0 ), 'fe' => ! empty( $c['fe'] ), 'lo' => (string) ( $c['lo'] ?? '' ),
		'inst' => array_values( array_filter( (array) ( $c['inst'] ?? array() ), 'is_array' ) ), 'type' => (string) ( $q['t'] ?? '' ) );
}
function oay_acc_adm_plot_get() { oay_acc_need_perm( 'plots' ); list( , $n, $i ) = oay_plot_args(); oay_acc_ok( array( 'plot' => oay_plot_out( $n, $i ) ) ); }
function oay_acc_adm_plot_save() {
	$me = oay_acc_need_perm( 'plots' ); list( $slug, $n, $i ) = oay_plot_args(); $in = oay_acc_in();   // the admin, or staff given «إضافة / تعديل القطع»
	if ( function_exists( 'oay_approval_needed' ) && ! oay_acc_is_admin( $me ) ) {   // a big price cut or «مباعة» by a team member waits for the admin
		$why = oay_approval_needed( $i, $in );
		if ( $why ) { oay_approval_add( $me, $slug, $n, $in, $why, $i ); oay_acc_ok( array( 'pending' => true, 'why' => $why, 'plot' => oay_plot_out( $n, $i ) ) ); }
	}
	oay_acc_ok( array( 'plot' => oay_plot_save_do( $me, $slug, $n, $i, $in ) ) );
}
/** writes a plot's status / price / payment plan (from the app's plot editor, or an approved request) → the plot as the editor shows it */
function oay_plot_save_do( $me, $slug, $n, $i, $in ) {
	$s = (string) ( $in['s'] ?? '' ); if ( ! in_array( $s, array( 'av', 'res', 'sold', '' ), true ) ) { oay_acc_err( 'حالة غير صحيحة' ); }
	$total = max( 0, (int) round( (float) ( $in['total'] ?? 0 ) ) ); $ppf = max( 0, round( (float) ( $in['ppf'] ?? 0 ), 2 ) ); $ft = max( 0, round( (float) ( $in['ft'] ?? 0 ), 2 ) );
	$inst = array();
	foreach ( array_slice( (array) ( $in['inst'] ?? array() ), 0, 120 ) as $x ) {
		if ( ! is_array( $x ) ) { continue; } $d = substr( preg_replace( '/[^\d\-]/', '', (string) ( $x[0] ?? '' ) ), 0, 10 ); $a = max( 0, (float) ( $x[1] ?? 0 ) );
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $d ) && $a > 0 ) { $inst[] = array( $d, $a ); }
	}
	usort( $inst, function ( $a, $b ) { return strcmp( $a[0], $b[0] ); } );
	$area = $ft ?: (float) ( $i['plot']['ft'] ?? 0 );
	if ( ! $total && $ppf && $area ) { $total = (int) round( $ppf * $area ); }
	if ( $total && ! $ppf && $area ) { $ppf = (int) round( $total / $area ); }
	if ( $inst && $total && array_sum( array_column( $inst, 1 ) ) > $total ) { oay_acc_err( 'مجموع الأقساط أكبر من سعر الأرض' ); }
	$lo = esc_url_raw( (string) ( $in['lo'] ?? '' ) ); $lo = preg_match( '#^https://#', $lo ) ? $lo : '';
	$was = is_array( $i['cur'] ?? null ) ? (string) ( $i['cur']['s'] ?? '' ) : '';
	$GLOBALS['oay_no_push'] = ! empty( $in['quiet'] ) && ( oay_acc_is_admin( $me ) || ( function_exists( 'oay_role' ) && 'mgr' === oay_role( $me ) ) );   // «حفظ بدون إشعار»: the management and the managers only
	$GLOBALS['oay_by'] = (int) $me->ID;   // «من غيّرها» in «آخر التحديثات» (the admin only)
	$ok = oay_plan_write( $i['proj'], function ( &$st ) use ( $n, $s, $total, $ppf, $ft, $inst, $in, $lo ) {
		$e = isset( $st['plots'][ (string) $n ] ) && is_array( $st['plots'][ (string) $n ] ) ? $st['plots'][ (string) $n ] : array();   // keeps pictures, documents, sketches
		if ( '' === $s ) { unset( $e['s'] ); } else { $e['s'] = $s; }
		foreach ( array( 'total' => $total, 'ppf' => $ppf, 'ft' => $ft ) as $k => $v ) { if ( $v ) { $e[ $k ] = $v; } else { unset( $e[ $k ] ); } }
		if ( $inst ) { $e['inst'] = $inst; } else { unset( $e['inst'] ); }
		if ( ! empty( $in['fe'] ) ) { $e['fe'] = 1; } else { unset( $e['fe'] ); }
		if ( $lo ) { $e['lo'] = $lo; } elseif ( array_key_exists( 'lo', $in ) ) { unset( $e['lo'] ); }
		if ( $e ) { $st['plots'][ (string) $n ] = $e; } else { unset( $st['plots'][ (string) $n ] ); }
	} );
	if ( ! $ok ) { oay_acc_err( 'تعذّر حفظ المخطط — حاول مرة أخرى' ); }
	$log = get_option( 'oay_plot_log', array() ); $log = is_array( $log ) ? $log : array();
	$after = oay_plan_plot( $slug, $n ); $after = $after && is_array( $after['cur'] ?? null ) ? $after['cur'] : null;
	array_unshift( $log, array( 't' => oay_g_ms(), 'uid' => (int) $me->ID, 'id' => $slug . ':' . $n, 's' => $s, 'total' => $total, 'b' => is_array( $i['cur'] ?? null ) ? $i['cur'] : null, 'a' => $after ) );   // before / after: «سجل التغييرات» and «تراجع»
	update_option( 'oay_plot_log', array_slice( $log, 0, 300 ), false );
	do_action( 'oay_plot_saved', $me, $slug, (string) $n, $was, $s, $total ? $total : ( $ppf && $ft ? (int) round( $ppf * $ft ) : 0 ) );   // team activity + «أرض جديدة» to the team
	if ( function_exists( 'oay_audit_plot' ) ) { oay_audit_plot( $me, $slug, $n, is_array( $i['cur'] ?? null ) ? $i['cur'] : array(), is_array( $after ) ? $after : array(), (float) ( $i['plot']['ft'] ?? 0 ) ); }
	return oay_plot_out( $n, oay_plan_plot( $slug, $n ) );
}

/* ======================================================================================
 * 8. Land owners (the partner in charge of each plot) — staff only, never in the public plan data —
 *    and the Excel import: owners for every plot in the sheet; plots not yet on the plan are added with
 *    their status and total price (plots already on the plan are left exactly as they are).
 * ==================================================================================== */
foreach ( array( 'owners_get', 'adm_import' ) as $a ) { add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a ); add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a ); }
/* the new «رؤية اسم مالك الأرض» permission: every member of staff has it to start with (the admin can take it away) */
add_action( 'init', function () {
	if ( get_option( 'oay_owners_mig' ) ) { return; }
	foreach ( get_users( array( 'meta_key' => 'oay_staff', 'fields' => 'ID', 'number' => 500 ) ) as $uid ) {
		$p = get_user_meta( $uid, 'oay_staff', true ); if ( is_array( $p ) && $p && ! in_array( 'owners', $p, true ) ) { $p[] = 'owners'; update_user_meta( $uid, 'oay_staff', $p ); }
	}
	update_option( 'oay_owners_mig', 1, false );
}, 30 );
function oay_owners() { $o = get_option( 'oay_owners', array() ); return is_array( $o ) ? $o : array(); }
function oay_acc_owners_get() {
	$u = oay_acc_need_user(); if ( ! oay_acc_can( $u, 'owners' ) ) { oay_acc_err( 'غير مسموح', 403 ); }
	oay_acc_ok( array( 'owners' => (object) oay_owners() ) );
}
function oay_acc_adm_import() {
	oay_acc_need_admin(); $in = oay_acc_in(); $dry = ! empty( $in['dry'] );
	if ( ! function_exists( 'oay_plan_plot' ) || ! function_exists( 'dnp_projects' ) ) { oay_acc_err( 'المخططات غير متاحة' ); }
	$ps = dnp_projects(); $owners = oay_owners(); $res = array(); $add = array(); $seen = array();
	foreach ( array_slice( (array) ( $in['rows'] ?? array() ), 0, 3000 ) as $r ) {
		$slug = sanitize_key( (string) ( $r['p'] ?? '' ) ); $n = trim( preg_replace( '/[^\w\-]/u', '', (string) ( $r['n'] ?? '' ) ) );
		$o = mb_substr( sanitize_text_field( (string) ( $r['o'] ?? '' ) ), 0, 60 );
		$s = in_array( $r['s'] ?? '', array( 'av', 'res', 'sold' ), true ) ? $r['s'] : 'av'; $t = max( 0, (int) round( (float) ( $r['t'] ?? 0 ) ) );
		$k = $slug . ':' . $n;
		if ( ! $slug || empty( $ps[ $slug ] ) ) { $res[] = array( 'k' => $k, 'r' => 'noproj' ); continue; }
		if ( isset( $seen[ $k ] ) ) { $res[] = array( 'k' => $k, 'r' => 'dup' ); continue; } $seen[ $k ] = 1;
		$i = oay_plan_plot( $slug, $n ); if ( ! $i ) { $res[] = array( 'k' => $k, 'r' => 'noplot' ); continue; }
		if ( $o ) { $owners[ $k ] = $o; }
		if ( ! empty( $i['cur']['s'] ) ) { $res[] = array( 'k' => $k, 'r' => 'exists', 's' => $i['cur']['s'] ); continue; }
		$res[] = array( 'k' => $k, 'r' => 'add', 's' => $s, 't' => $t ); $add[ $slug ][ $n ] = array( $s, $t, (float) ( $i['plot']['ft'] ?? 0 ) );
	}
	if ( ! $dry ) {
		update_option( 'oay_owners', $owners, false );
		$GLOBALS['oay_quiet_import'] = 1;
		foreach ( $add as $slug => $list ) {
			oay_plan_write( $ps[ $slug ], function ( &$st ) use ( $list ) {
				foreach ( $list as $n => $x ) {
					$e = isset( $st['plots'][ (string) $n ] ) && is_array( $st['plots'][ (string) $n ] ) ? $st['plots'][ (string) $n ] : array();
					if ( ! empty( $e['s'] ) ) { continue; }   // listed meanwhile: leave it
					$e['s'] = $x[0]; if ( $x[1] ) { $e['total'] = $x[1]; if ( $x[2] ) { $e['ppf'] = (int) round( $x[1] / $x[2] ); } }
					$st['plots'][ (string) $n ] = $e;
				}
			} );
		}
		unset( $GLOBALS['oay_quiet_import'] );
	}
	oay_acc_ok( array( 'dry' => $dry, 'items' => $res ) );
}

/* ======================================================================================
 * 8. «حجز مؤقت»: a team member holds an available plot for a client for 24 / 48 hours — it shows «محجوزة» to all.
 *    «تم دفع العربون» keeps it reserved; otherwise it comes back «متاحة» by itself when the time is up (and the holder is told).
 * ==================================================================================== */
foreach ( array( 'holds', 'hold_set', 'hold_done' ) as $a ) { add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a ); add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a ); }
function oay_holds_all() { $h = get_option( 'oay_holds', array() ); return is_array( $h ) ? $h : array(); }
function oay_hold_row( $id, $h ) {
	$u = get_userdata( (int) $h['uid'] );
	return array( 'id' => $id, 'until' => (int) $h['until'] * 1000, 't' => (int) $h['t'] * 1000, 'client' => (string) $h['client'], 'by' => $u ? $u->display_name : '', 'uid' => (int) $h['uid'] );
}
/** sets a plot's status the way the plot editor does (pictures, prices, payment plan kept) */
function oay_hold_status( $slug, $n, $s, $quiet ) {
	if ( ! function_exists( 'oay_plan_plot' ) || ! function_exists( 'oay_plan_write' ) ) { return false; }
	$i = oay_plan_plot( $slug, $n ); if ( ! $i ) { return false; }
	$prev = $GLOBALS['oay_no_push'] ?? null; $GLOBALS['oay_no_push'] = $quiet;
	$ok = oay_plan_write( $i['proj'], function ( &$st ) use ( $n, $s ) {
		$e = isset( $st['plots'][ (string) $n ] ) && is_array( $st['plots'][ (string) $n ] ) ? $st['plots'][ (string) $n ] : array();
		$e['s'] = $s; $st['plots'][ (string) $n ] = $e;
	} );
	$GLOBALS['oay_no_push'] = $prev;
	return $ok;
}
function oay_acc_holds() { oay_acc_need_office(); $out = array(); foreach ( oay_holds_all() as $id => $h ) { $out[] = oay_hold_row( $id, $h ); } oay_acc_ok( array( 'items' => $out ) ); }
function oay_acc_hold_set() {
	$me = oay_acc_need_office(); list( $slug, $n, $i ) = oay_plot_args(); $id = $slug . ':' . $n;
	$hours = (int) oay_acc_arg( 'hours', 3 ); if ( ! in_array( $hours, array( 24, 48 ), true ) ) { $hours = 24; }
	$client = trim( mb_substr( sanitize_text_field( (string) oay_acc_arg( 'client', 80 ) ), 0, 80 ) ); if ( '' === $client ) { oay_acc_err( 'اكتب اسم العميل' ); }
	$h = oay_holds_all();
	if ( isset( $h[ $id ] ) ) { oay_acc_err( 'القطعة محجوزة مؤقتاً بالفعل لـ ' . $h[ $id ]['client'] ); }
	if ( ( $i['cur']['s'] ?? '' ) !== 'av' ) { oay_acc_err( 'القطعة غير متاحة — الحجز المؤقت للقطع المتاحة فقط' ); }
	if ( ! oay_hold_status( $slug, $n, 'res', true ) ) { oay_acc_err( 'تعذّر الحجز — حاول مرة أخرى' ); }
	$h[ $id ] = array( 'uid' => $me->ID, 'client' => $client, 't' => time(), 'until' => time() + $hours * HOUR_IN_SECONDS, 'warned' => 0 );
	update_option( 'oay_holds', $h, false ); do_action( 'oay_hold_made', $me, $id, $client, $hours );
	oay_audit( $me->ID, 'hold', 'قطعة ' . $n . ' لـ ' . $client . ' (' . $hours . ' ساعة)', $id );
	if ( function_exists( 'oay_push_to' ) ) {
		oay_push_to( array_diff( oay_admin_ids(), array( $me->ID ) ), '⏳ حجز مؤقت · قطعة ' . $n, $me->display_name . ' حجزها مؤقتاً لـ ' . $client . ' لمدة ' . $hours . ' ساعة', array( 'open' => 'land', 'id' => $id ) );
	}
	oay_acc_ok( array( 'hold' => oay_hold_row( $id, $h[ $id ] ) ) );
}
function oay_acc_hold_done() {
	$me = oay_acc_need_office(); $id = (string) oay_acc_arg( 'id', 80 ); $act = oay_acc_arg( 'act', 10 );
	$h = oay_holds_all(); if ( ! isset( $h[ $id ] ) ) { oay_acc_err( 'لا يوجد حجز مؤقت على هذه القطعة' ); }
	$boss = oay_acc_is_admin( $me ) || ( function_exists( 'oay_role' ) && 'mgr' === oay_role( $me ) );
	if ( (int) $h[ $id ]['uid'] !== (int) $me->ID && ! $boss ) { oay_acc_err( 'الحجز باسم ' . ( get_userdata( (int) $h[ $id ]['uid'] )->display_name ?? 'موظف آخر' ) . ' — هو أو المدير فقط' ); }
	list( $slug, $n ) = explode( ':', $id, 2 );
	if ( 'extend' === $act ) { oay_audit( $me->ID, 'hold', 'قطعة ' . $n . ' · ' . $h[ $id ]['client'] . ' — تمديد يوم', $id ); $h[ $id ]['until'] = max( time(), (int) $h[ $id ]['until'] ) + DAY_IN_SECONDS; $h[ $id ]['warned'] = 0; update_option( 'oay_holds', $h, false ); oay_acc_ok( array( 'hold' => oay_hold_row( $id, $h[ $id ] ) ) ); }
	if ( 'release' === $act && ! oay_hold_status( $slug, $n, 'av', false ) ) { oay_acc_err( 'تعذّر إلغاء الحجز — حاول مرة أخرى' ); }
	if ( 'paid' === $act ) { do_action( 'oay_hold_paid', $me, $id, $h[ $id ]['client'] ); }
	oay_audit( $me->ID, 'hold', 'قطعة ' . $n . ' · ' . $h[ $id ]['client'] . ' — ' . ( 'paid' === $act ? 'تم دفع العربون' : 'أُلغي الحجز' ), $id );
	unset( $h[ $id ] ); update_option( 'oay_holds', $h, false );   // 'paid': the deposit is in — it stays «محجوزة» for good
	oay_acc_ok( array( 'hold' => null ) );
}
// every 5 minutes: an hour before the end the holder is reminded; at the end the plot is available again (if nobody changed it meanwhile)
add_action( 'init', function () { if ( ! wp_next_scheduled( 'oay_holds_check' ) ) { wp_schedule_event( time() + 120, 'oay_5min', 'oay_holds_check' ); } } );
add_action( 'oay_holds_check', function () {
	$h = oay_holds_all(); if ( ! $h ) { return; } $dirty = false;
	foreach ( $h as $id => $x ) {
		list( $slug, $n ) = explode( ':', $id, 2 ); $left = (int) $x['until'] - time();
		if ( $left <= 0 ) {
			$i = function_exists( 'oay_plan_plot' ) ? oay_plan_plot( $slug, $n ) : null;
			$still = $i && ( $i['cur']['s'] ?? '' ) === 'res';
			if ( $still ) { oay_hold_status( $slug, $n, 'av', false ); }   // available again: the favourites alert goes out
			if ( function_exists( 'oay_push_to' ) ) {
				oay_push_to( array_unique( array_merge( array( (int) $x['uid'] ), oay_admin_ids() ) ), '⌛ انتهى الحجز المؤقت · قطعة ' . $n,
					'لم يُسجَّل عربون ' . $x['client'] . ( $still ? ' — عادت القطعة متاحة' : '' ), array( 'open' => 'land', 'id' => $id ) );
			}
			unset( $h[ $id ] ); $dirty = true;
		} elseif ( $left <= HOUR_IN_SECONDS && empty( $x['warned'] ) && function_exists( 'oay_push_to' ) ) {
			oay_push_to( array( (int) $x['uid'] ), '⏳ تبقّت ساعة على انتهاء الحجز · قطعة ' . $n, 'تواصل مع ' . $x['client'] . ' بشأن العربون، أو مدّد الحجز يوماً من صفحة القطعة', array( 'open' => 'land', 'id' => $id ) );
			$h[ $id ]['warned'] = 1; $dirty = true;
		}
	}
	if ( $dirty ) { update_option( 'oay_holds', $h, false ); }
} );

/* ======================================================================================
 * 9. «سجل العمليات»: who changed a price or a status, verified / un-verified an account, stopped an account, changed
 *    points or permissions, handed a chat over, held a plot — for the admin.
 * ==================================================================================== */
const OAY_AUDIT_K = array( 'price' => 'تغيير سعر', 'status' => 'تغيير حالة', 'plot_new' => 'إضافة أرض', 'verify' => 'توثيق حساب', 'unverify' => 'إلغاء / رفض توثيق',
	'ban' => 'إيقاف حساب', 'unban' => 'رفع إيقاف', 'points' => 'تعديل نقاط', 'staff' => 'تعديل صلاحيات', 'chat' => 'تحويل محادثة', 'hold' => 'حجز مؤقت',
	'approval' => 'طلب موافقة', 'approved' => 'موافقة الإدارة', 'rejected' => 'رفض الإدارة', 'settings' => 'إعدادات' );
function oay_audit( $uid, $kind, $text, $ref = '' ) {
	$log = get_option( 'oay_audit', array() ); $log = is_array( $log ) ? $log : array();
	array_unshift( $log, array( 't' => oay_g_ms(), 'u' => (int) $uid, 'k' => (string) $kind, 'x' => mb_substr( (string) $text, 0, 240 ), 'r' => mb_substr( (string) $ref, 0, 80 ) ) );
	update_option( 'oay_audit', array_slice( $log, 0, 3000 ), false );
}
/** a plot saved: its price and status before → after */
function oay_audit_plot( $me, $slug, $n, $b, $a, $planFt ) {
	$st = array( 'av' => 'متاحة', 'res' => 'محجوزة', 'sold' => 'مباعة', '' => 'غير معروضة' );
	$tot = function ( $x ) use ( $planFt ) { $t = (int) ( $x['total'] ?? 0 ); if ( ! $t && ! empty( $x['ppf'] ) ) { $t = (int) round( $x['ppf'] * ( (float) ( $x['ft'] ?? 0 ) ?: $planFt ) ); } return $t; };
	$name = function_exists( 'oay_team_plot_label' ) ? oay_team_plot_label( $slug . ':' . $n )['proj'] : $slug; $id = $slug . ':' . $n;
	$sb = (string) ( $b['s'] ?? '' ); $sa = (string) ( $a['s'] ?? '' ); $tb = $tot( $b ); $ta = $tot( $a );
	if ( ! $b || '' === $sb && $sa ) { oay_audit( $me->ID, 'plot_new', 'قطعة ' . $n . ' · ' . $name . ' · ' . ( $st[ $sa ] ?? $sa ) . ( $ta ? ' · ' . number_format( $ta ) . ' د.إ' : '' ), $id ); return; }
	if ( $sb !== $sa ) { oay_audit( $me->ID, 'status', 'قطعة ' . $n . ' · ' . $name . ': ' . ( $st[ $sb ] ?? $sb ) . ' ← ' . ( $st[ $sa ] ?? $sa ), $id ); }
	if ( $tb !== $ta ) { oay_audit( $me->ID, 'price', 'قطعة ' . $n . ' · ' . $name . ': ' . ( $tb ? number_format( $tb ) : '—' ) . ' ← ' . ( $ta ? number_format( $ta ) : '—' ) . ' د.إ' . ( $tb && $ta ? ' (' . ( $ta > $tb ? '+' : '' ) . round( ( $ta - $tb ) * 100 / $tb, 1 ) . '%)' : '' ), $id ); }
}
foreach ( array( 'adm_audit', 'adm_approvals', 'adm_approval_do', 'quick_replies', 'adm_quick_save', 'adm_targets_save', 'need_mkt' ) as $a ) { add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a ); add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a ); }
function oay_acc_adm_audit() {
	oay_acc_need_admin(); $k = sanitize_key( oay_acc_arg( 'kind', 20 ) ); $uid = absint( oay_acc_arg( 'user', 12 ) );
	$log = get_option( 'oay_audit', array() ); $out = array(); $names = array();
	foreach ( (array) $log as $e ) {
		if ( ( $k && $e['k'] !== $k ) || ( $uid && (int) $e['u'] !== $uid ) ) { continue; }
		if ( ! isset( $names[ $e['u'] ] ) ) { $x = get_userdata( (int) $e['u'] ); $names[ $e['u'] ] = $x ? $x->display_name : '—'; }
		$out[] = $e + array( 'by' => $names[ $e['u'] ] ); if ( count( $out ) >= 300 ) { break; }
	}
	oay_acc_ok( array( 'items' => $out, 'kinds' => OAY_AUDIT_K ) );
}

/* ======================================================================================
 * 10. Approvals: a team member's price cut bigger than the admin's limit (10% unless changed)
 *     waits for the admin; the plot stays as it was until then.
 * ==================================================================================== */
function oay_cut_pct() { return max( 1, min( 90, (int) get_option( 'oay_cut_pct', 10 ) ) ); }
function oay_approval_needed( $i, $in ) {
	$c = is_array( $i['cur'] ?? null ) ? $i['cur'] : array(); $was = (string) ( $c['s'] ?? '' ); $s = (string) ( $in['s'] ?? '' );
	unset( $was, $s );   // «محجوزة» and «مباعة» need no approval — only a big price cut does
	$area = (float) ( $in['ft'] ?? 0 ) ?: ( (float) ( $c['ft'] ?? 0 ) ?: (float) ( $i['plot']['ft'] ?? 0 ) );
	$old = (int) ( $c['total'] ?? 0 ) ?: ( ! empty( $c['ppf'] ) && $area ? (int) round( $c['ppf'] * $area ) : 0 );
	$new = (int) round( (float) ( $in['total'] ?? 0 ) ) ?: ( ! empty( $in['ppf'] ) && $area ? (int) round( (float) $in['ppf'] * $area ) : 0 );
	if ( $old && $new && $new < $old * ( 1 - oay_cut_pct() / 100 ) ) { return 'تخفيض السعر ' . round( ( $old - $new ) * 100 / $old, 1 ) . '% (من ' . number_format( $old ) . ' إلى ' . number_format( $new ) . ' د.إ)'; }
	return '';
}
function oay_approvals() { $a = get_option( 'oay_approvals', array() ); return is_array( $a ) ? $a : array(); }
function oay_approval_add( $me, $slug, $n, $in, $why, $i ) {
	$a = oay_approvals(); $id = $slug . ':' . $n;
	$keep = array_intersect_key( (array) $in, array_flip( array( 's', 'total', 'ppf', 'ft', 'inst', 'fe', 'lo', 'quiet' ) ) );
	$a[ $id ] = array( 'id' => $id, 'uid' => (int) $me->ID, 't' => oay_g_ms(), 'why' => $why, 'in' => $keep );
	update_option( 'oay_approvals', $a, false );
	$name = function_exists( 'oay_team_plot_label' ) ? oay_team_plot_label( $id )['proj'] : $slug;
	oay_audit( $me->ID, 'approval', 'قطعة ' . $n . ' · ' . $name . ' — ' . $why, $id );
	if ( function_exists( 'oay_push_to' ) ) { oay_push_to( get_users( array( 'capability' => 'manage_options', 'fields' => 'ID' ) ), '🔒 طلب موافقة · قطعة ' . $n . ' · ' . $name, $me->display_name . ': ' . $why, array( 'open' => 'approvals' ) ); }
}
function oay_acc_adm_approvals() {
	oay_acc_need_admin();
	if ( null !== oay_acc_arg( 'pct', 3 ) && '' !== (string) oay_acc_arg( 'pct', 3 ) ) { $me = oay_acc_need_admin(); update_option( 'oay_cut_pct', max( 1, min( 90, (int) oay_acc_arg( 'pct', 3 ) ) ), false ); oay_audit( $me->ID, 'settings', 'حد التخفيض الذي يحتاج موافقة: ' . oay_cut_pct() . '%' ); }
	$out = array();
	foreach ( oay_approvals() as $x ) { $u = get_userdata( $x['uid'] ); $p = function_exists( 'oay_team_plot_label' ) ? oay_team_plot_label( $x['id'] ) : array( 'n' => $x['id'], 'proj' => '' ); $out[] = $x + array( 'by' => $u ? $u->display_name : '—', 'n' => $p['n'], 'proj' => $p['proj'] ); }
	oay_acc_ok( array( 'items' => array_values( $out ), 'pct' => oay_cut_pct() ) );
}
function oay_acc_adm_approval_do() {
	$me = oay_acc_need_admin(); $id = (string) oay_acc_arg( 'id', 80 ); $ok = '1' === oay_acc_arg( 'ok', 2 );
	$a = oay_approvals(); if ( ! isset( $a[ $id ] ) ) { oay_acc_err( 'الطلب غير موجود — ربما تمت معالجته' ); }
	$x = $a[ $id ]; unset( $a[ $id ] ); update_option( 'oay_approvals', $a, false );
	list( $slug, $n ) = explode( ':', $id, 2 ); $by = get_userdata( $x['uid'] );
	if ( $ok ) {
		$i = function_exists( 'oay_plan_plot' ) ? oay_plan_plot( $slug, $n ) : null; if ( ! $i ) { oay_acc_err( 'القطعة غير موجودة في المخطط' ); }
		oay_plot_save_do( $by ?: $me, $slug, $n, $i, (array) $x['in'] );
	}
	oay_audit( $me->ID, $ok ? 'approved' : 'rejected', 'قطعة ' . $n . ' — ' . $x['why'] . ( $by ? ' (طلب ' . $by->display_name . ')' : '' ), $id );
	if ( $by && function_exists( 'oay_push_to' ) ) { oay_push_to( array( $by->ID ), $ok ? '✓ وافقت الإدارة على تعديل القطعة ' . $n : '✕ لم توافق الإدارة على تعديل القطعة ' . $n, $x['why'], array( 'open' => 'land', 'id' => $id ) ); }
	oay_acc_ok( array() );
}

/* ======================================================================================
 * 11. Chats: ready replies for the team, and an automatic reply when a client writes outside working hours.
 * ==================================================================================== */
function oay_quick_default() {
	return array(
		'أهلاً وسهلاً بك في عمر الياسي للعقارات، كيف يمكننا مساعدتك؟',
		'القطعة متاحة حالياً، هل ترغب في معرفة السعر وخطة الدفع؟',
		'يمكنك الاطلاع على موقع المشروع ومخططه من صفحة القطعة في التطبيق.',
		'تتوفر خطة دفع بالأقساط، وسنرسل لك تفاصيلها الآن.',
		'يسعدنا ترتيب معاينة للأرض، ما الوقت المناسب لك؟',
		'شكراً لتواصلك، سيتصل بك أحد مستشارينا خلال وقت قصير.',
	);
}
function oay_quick_list() { $q = get_option( 'oay_quick', null ); return is_array( $q ) && $q ? $q : oay_quick_default(); }
function oay_hours() { $h = get_option( 'oay_hours', array() ); return array( 'from' => (int) ( $h['from'] ?? 9 ), 'to' => (int) ( $h['to'] ?? 21 ), 'on' => ! isset( $h['on'] ) || ! empty( $h['on'] ), 'text' => (string) ( $h['text'] ?? 'شكراً لتواصلك مع عمر الياسي للعقارات. وصلت رسالتك خارج أوقات العمل، وسيرد عليك فريقنا صباح يوم العمل التالي.' ) ); }
function oay_acc_quick_replies() { oay_acc_need_perm( 'chats' ); oay_acc_ok( array( 'items' => oay_quick_list(), 'hours' => oay_hours() ) ); }
function oay_acc_adm_quick_save() {
	$me = oay_acc_need_admin(); $in = oay_acc_in();
	if ( isset( $in['items'] ) ) { $q = array_values( array_filter( array_map( function ( $t ) { return trim( mb_substr( sanitize_textarea_field( (string) $t ), 0, 500 ) ); }, array_slice( (array) $in['items'], 0, 30 ) ) ) ); update_option( 'oay_quick', $q, false ); }
	if ( isset( $in['hours'] ) && is_array( $in['hours'] ) ) { $h = $in['hours']; update_option( 'oay_hours', array( 'from' => max( 0, min( 23, (int) ( $h['from'] ?? 9 ) ) ), 'to' => max( 1, min( 24, (int) ( $h['to'] ?? 21 ) ) ), 'on' => ! empty( $h['on'] ) ? 1 : 0, 'text' => trim( mb_substr( sanitize_textarea_field( (string) ( $h['text'] ?? '' ) ), 0, 500 ) ) ), false ); }
	oay_audit( $me->ID, 'settings', 'الردود الجاهزة وأوقات العمل' );
	oay_acc_ok( array( 'items' => oay_quick_list(), 'hours' => oay_hours() ) );
}
/** called after a client's message: outside working hours (UAE time) one automatic reply, at most every 12 hours */
function oay_after_hours( $tid ) {
	$h = oay_hours(); if ( ! $h['on'] || '' === trim( $h['text'] ) || ! function_exists( 'oay_chat_add' ) ) { return; }
	$now = (int) current_time( 'G' ); $open = $h['from'] < $h['to'] ? ( $now >= $h['from'] && $now < $h['to'] ) : ( $now >= $h['from'] || $now < $h['to'] );
	if ( $open ) { return; }
	$last = (int) get_post_meta( $tid, 'oay_auto_t', true ); if ( time() - $last < 12 * HOUR_IN_SECONDS ) { return; }
	update_post_meta( $tid, 'oay_auto_t', time() );
	$admin = get_users( array( 'capability' => 'manage_options', 'number' => 1, 'fields' => 'ID' ) );
	oay_chat_add( $tid, $admin ? (int) $admin[0] : 0, 'admin', $h['text'], 0 );
}

/* ======================================================================================
 * 12. Monthly targets per team member (posts, clients followed, holds, deals) — set by the admin; progress in «لوحة الأداء».
 * ==================================================================================== */
function oay_targets() { $t = get_option( 'oay_targets', array() ); return is_array( $t ) ? $t : array(); }
function oay_acc_adm_targets_save() {
	$me = oay_acc_need_admin(); $uid = absint( oay_acc_arg( 'user', 12 ) ); if ( ! $uid || ! get_userdata( $uid ) ) { oay_acc_err( 'اختر الموظف' ); }
	$in = oay_acc_in(); $t = oay_targets(); $x = array();
	foreach ( array( 'posts', 'clients', 'holds', 'deals' ) as $k ) { $v = max( 0, min( 9999, (int) ( $in[ $k ] ?? 0 ) ) ); if ( $v ) { $x[ $k ] = $v; } }
	if ( $x ) { $t[ $uid ] = $x; } else { unset( $t[ $uid ] ); }
	update_option( 'oay_targets', $t, false );
	oay_audit( $me->ID, 'settings', 'الهدف الشهري لـ ' . get_userdata( $uid )->display_name );
	oay_acc_ok( array( 'target' => (object) ( $t[ $uid ] ?? array() ) ) );
}
/** this month's counts per member from the team log, as the board groups them */
function oay_month_counts() {
	$since = strtotime( date( 'Y-m-01 00:00:00', current_time( 'timestamp' ) ) ) - ( current_time( 'timestamp' ) - time() ); $since *= 1000;
	$G = array( 'posts' => array( 'design', 'share_design', 'save_img', 'share_land' ), 'clients' => array( 'lead', 'chat' ), 'holds' => array( 'hold' ), 'deals' => array( 'deal' ) );
	$out = array();
	foreach ( (array) get_option( 'oay_team_log', array() ) as $e ) {
		if ( $e['t'] < $since ) { break; }
		foreach ( $G as $g => $ks ) { if ( in_array( $e['k'], $ks, true ) ) { $out[ (int) $e['u'] ][ $g ] = ( $out[ (int) $e['u'] ][ $g ] ?? 0 ) + 1; } }
	}
	return $out;
}

/* ======================================================================================
 * 13. «أراضي تحتاج تسويقاً»: available company plots nobody in the team designed a post for or shared in the last 7 days;
 *     every morning the designers and marketing get the count.
 * ==================================================================================== */
function oay_marketed_since( $days ) {
	$since = oay_g_ms() - $days * 86400000; $seen = array();
	foreach ( (array) get_option( 'oay_team_log', array() ) as $e ) {
		if ( $e['t'] < $since ) { break; }
		if ( in_array( $e['k'], array( 'design', 'share_design', 'save_img', 'share_land' ), true ) && $e['r'] ) { $seen[ explode( '|', $e['r'] )[0] ] = max( $seen[ explode( '|', $e['r'] )[0] ] ?? 0, (int) $e['t'] ); }
	}
	return $seen;
}
/** when each plot was last designed / shared by the team (kept apart from the activity log, which is trimmed) */
function oay_mkt_mark( $id ) {
	if ( ! preg_match( '/^[a-z0-9-]{2,40}:[A-Za-z0-9-]{1,12}$/', (string) $id ) ) { return; }
	$m = get_option( 'oay_mkt_last', array() ); $m = is_array( $m ) ? $m : array(); $now = oay_g_ms();
	$m[ $id ] = $now; $cut = $now - 120 * 86400000; $m = array_filter( $m, function ( $t ) use ( $cut ) { return $t >= $cut; } );
	update_option( 'oay_mkt_last', $m, false );
}
function oay_acc_need_mkt() {
	oay_acc_need_office(); $all = oay_marketed_since( 90 );
	foreach ( (array) get_option( 'oay_mkt_last', array() ) as $id => $t ) { $all[ $id ] = max( (int) ( $all[ $id ] ?? 0 ), (int) $t ); }
	oay_acc_ok( array( 'last' => (object) $all, 'days' => 14 ) );
}
add_action( 'init', function () { if ( ! wp_next_scheduled( 'oay_mkt_daily' ) ) { wp_schedule_event( strtotime( 'tomorrow 05:10 UTC' ), 'daily', 'oay_mkt_daily' ); } } );
add_action( 'oay_mkt_daily', function () {
	if ( ! function_exists( 'oay_push_to' ) || ! function_exists( 'dnp_projects' ) || ! function_exists( 'oay_plots' ) ) { return; }
	$seen = oay_marketed_since( 14 ); $cut = oay_g_ms() - 14 * 86400000; foreach ( (array) get_option( 'oay_mkt_last', array() ) as $id => $t ) { if ( $t >= $cut ) { $seen[ $id ] = $t; } } $n = 0;
	foreach ( (array) dnp_projects() as $slug => $p ) {
		if ( empty( $p['opt'] ) ) { continue; }
		foreach ( oay_plots( get_option( $p['opt'] ) ) as $pn => $q ) { if ( ( $q['s'] ?? '' ) === 'av' && ! isset( $seen[ $slug . ':' . $pn ] ) ) { $n++; } }
	}
	if ( ! $n ) { return; }
	$to = array_values( array_filter( oay_admin_ids(), function ( $id ) { $u = get_userdata( $id ); return $u && ( oay_acc_can( $u, 'design' ) || ( function_exists( 'oay_role' ) && 'mkt' === oay_role( $u ) ) ); } ) );
	oay_push_to( $to, '📣 ' . $n . ' أرض متاحة لم تُسوَّق منذ أسبوعين', 'افتح «أراضٍ تحتاج تسويقاً» لتصميم منشوراتها', array( 'open' => 'needmkt' ) );
} );

/* «من غيّرها»: who changed each item of «آخر التحديثات» — for the admin only (the public list carries no names) */
add_action( 'wp_ajax_oay_acc_changes_by', 'oay_acc_changes_by' ); add_action( 'wp_ajax_nopriv_oay_acc_changes_by', 'oay_acc_changes_by' );
function oay_acc_changes_by() {
	oay_acc_need_admin();
	$plog = (array) get_option( 'oay_plot_log', array() ); $out = array(); $names = array();
	$who = function ( $uid ) use ( &$names ) { if ( ! isset( $names[ $uid ] ) ) { $u = get_userdata( $uid ); $names[ $uid ] = $u ? ( function_exists( 'oay_shown_name' ) ? oay_shown_name( $u ) : $u->display_name ) : ''; } return $names[ $uid ]; };
	foreach ( (array) get_option( 'oay_changes', array() ) as $c ) {
		$uid = (int) ( $c['by'] ?? 0 );
		if ( ! $uid ) {   // older items: the app's save of the same plot at the same moment
			foreach ( $plog as $e ) { if ( ( $e['id'] ?? '' ) === ( $c['id'] ?? '' ) && abs( (int) $e['t'] - (int) $c['t'] ) < 120000 ) { $uid = (int) $e['uid']; break; } }
		}
		if ( $uid && ( $n = $who( $uid ) ) ) { $out[ $c['t'] . '|' . $c['id'] . '|' . $c['kind'] ] = $n; }
	}
	oay_acc_ok( array( 'by' => (object) $out ) );
}
