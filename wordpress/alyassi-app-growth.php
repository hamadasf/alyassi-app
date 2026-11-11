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
	$hot = array();
	foreach ( $views as $id => $k ) {
		$v = $vc[ $id ] ?? array( 'n' => 0, 't' => $now, 'h' => 0, 'l' => 0 );
		if ( $now - (int) ( $v['l'] ?? 0 ) > 10 * MINUTE_IN_SECONDS ) { $v['n']++; }   // opening it again within 10 minutes is the same visit
		$v['l'] = $now;
		if ( $v['n'] >= 3 && ! $v['h'] ) { $v['h'] = 1; $hot[] = $id; }
		$vc[ $id ] = $v;
	}
	if ( count( $vc ) > 80 ) { uasort( $vc, function ( $a, $b ) { return $b['t'] <=> $a['t']; } ); $vc = array_slice( $vc, 0, 80, true ); }
	update_user_meta( $uid, 'oay_viewc', $vc );
	foreach ( $hot as $id ) {
		$name = function_exists( 'oay_land_name' ) ? oay_land_name( $id ) : $id;
		if ( function_exists( 'oay_lead_add' ) ) { oay_lead_add( $uid, 'hot', $id, $name ); }
		if ( function_exists( 'oay_push_to' ) ) { oay_push_to( oay_g_leads_staff(), '🔥 عميل مهتم · ' . oay_g_who( $uid ), 'فتح ' . $name . ' أكثر من 3 مرات — اتصل به الآن', array( 'open' => 'lead', 'id' => $uid ) ); }
	}
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
	$GLOBALS['oay_no_push'] = ! empty( $in['quiet'] );   // «حفظ بدون إشعار»
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
	oay_acc_ok( array( 'plot' => oay_plot_out( $n, oay_plan_plot( $slug, $n ) ) ) );
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
