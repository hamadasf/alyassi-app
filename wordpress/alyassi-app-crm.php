<?php
/**
 * Plugin Name: Alyassi App – Clients, wanted lands, alerts, targeted push, guide, widget
 * Description: Client follow-up for the office, «مطلوب أرض» requests, «أرض تناسبني» alerts, targeted notifications,
 *              the Sharjah procedures guide and the Android home-screen widget feed. Uses the helpers of alyassi-app-accounts.php.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'adm_leads', 'adm_lead', 'adm_lead_save', 'wanted_submit', 'wanted_mine', 'wanted_list', 'wanted_delete', 'adm_wanted', 'adm_wanted_review',
	'alert_list', 'alert_save', 'alert_delete', 'adm_push', 'adm_push_count', 'guide', 'adm_guide_save', 'widget', 'contact_req', 'adm_contacts' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}
function oay_crm_ms() { return (int) round( microtime( true ) * 1000 ); }

/* ======================================================================================
 * 1. Client follow-up: every signed-in member who shows interest (chat, WhatsApp / call tap,
 *    wanted request, alert) becomes a lead the office can follow up.
 * ==================================================================================== */
const OAY_LEAD_ST = array( 'new' => 'جديد', 'follow' => 'قيد المتابعة', 'won' => 'تم البيع', 'lost' => 'غير مهتم' );
function oay_lead_get( $uid ) {
	$l = get_user_meta( $uid, 'oay_lead', true );
	return is_array( $l ) ? $l + array( 'status' => 'new', 'notes' => array(), 'next' => 0, 'items' => array(), 'last' => 0 ) : null;
}
/** Records interest from a member. $src: chat | wa | call | wanted | alert | calc */
function oay_lead_add( $uid, $src, $lid = '', $name = '' ) {
	$u = get_userdata( $uid ); if ( ! $u || user_can( $u, 'manage_options' ) ) { return; }
	$l = oay_lead_get( $uid ) ?: array( 'status' => 'new', 'notes' => array(), 'next' => 0, 'items' => array(), 'last' => 0, 'created' => oay_crm_ms() );
	$now = oay_crm_ms();
	foreach ( $l['items'] as $it ) { if ( $it['src'] === $src && (string) $it['lid'] === (string) $lid && $now - $it['t'] < DAY_IN_SECONDS * 1000 ) { return; } }   // once a day per listing
	if ( ! $name && $lid ) { $name = function_exists( 'oay_land_name' ) ? oay_land_name( $lid ) : (string) $lid; }
	array_unshift( $l['items'], array( 't' => $now, 'src' => $src, 'lid' => (string) $lid, 'name' => $name ) );
	$l['items'] = array_slice( $l['items'], 0, 60 ); $l['last'] = $now;
	if ( 'lost' === $l['status'] ) { $l['status'] = 'new'; }   // came back
	update_user_meta( $uid, 'oay_lead', $l ); update_user_meta( $uid, 'oay_lead_last', $now );
}
function oay_lead_row( $u ) {
	$l = oay_lead_get( $u->ID ); $v = function_exists( 'oay_verify_get' ) ? oay_verify_get( $u->ID ) : null;
	return array( 'id' => $u->ID, 'name' => $u->display_name, 'email' => $u->user_email, 'phone' => (string) get_user_meta( $u->ID, 'oay_phone', true ) ?: ( $v ? (string) ( $v['phone'] ?? '' ) : '' ),
		'company' => (string) get_user_meta( $u->ID, 'oay_company', true ), 'verified' => (bool) get_user_meta( $u->ID, 'oay_verified', true ), 'avatar' => (string) get_user_meta( $u->ID, 'oay_avatar', true ),
		'status' => $l['status'], 'next' => (int) $l['next'], 'last' => (int) $l['last'], 'count' => count( $l['items'] ), 'top' => $l['items'] ? $l['items'][0] : null, 'notes' => count( $l['notes'] ),
		'online' => function_exists( 'oay_is_online' ) ? oay_is_online( $u->ID ) : false );
}
function oay_acc_adm_leads() {
	oay_acc_need_admin(); $st = oay_acc_arg( 'status', 10 );
	$us = get_users( array( 'meta_key' => 'oay_lead_last', 'orderby' => 'meta_value_num', 'order' => 'DESC', 'number' => 400 ) );
	$rows = array(); $counts = array_fill_keys( array_keys( OAY_LEAD_ST ), 0 ); $due = 0; $end = strtotime( 'tomorrow', current_time( 'timestamp' ) ) - ( current_time( 'timestamp' ) - time() );
	foreach ( $us as $u ) {
		$r = oay_lead_row( $u ); $counts[ $r['status'] ] = ( $counts[ $r['status'] ] ?? 0 ) + 1;
		$isDue = $r['next'] && $r['next'] <= $end * 1000 && in_array( $r['status'], array( 'new', 'follow' ), true ); if ( $isDue ) { $due++; }
		if ( 'due' === $st ? $isDue : ( ! $st || $st === $r['status'] ) ) { $rows[] = $r + array( 'due' => $isDue ); }
	}
	oay_acc_ok( array( 'items' => $rows, 'counts' => $counts, 'due' => $due, 'labels' => OAY_LEAD_ST ) );
}
function oay_acc_adm_lead() {
	oay_acc_need_admin(); $u = get_userdata( absint( oay_acc_arg( 'id', 12 ) ) ); if ( ! $u ) { oay_acc_err( 'غير موجود', 404 ); }
	$l = oay_lead_get( $u->ID ) ?: array( 'status' => 'new', 'notes' => array(), 'next' => 0, 'items' => array(), 'last' => 0 );
	$wanted = array_map( 'oay_wanted_card', get_posts( array( 'post_type' => 'oay_wanted', 'author' => $u->ID, 'post_status' => array( 'publish', 'pending', 'draft' ), 'numberposts' => 20 ) ) );
	oay_acc_ok( array( 'user' => oay_lead_row( $u ), 'lead' => $l, 'wanted' => $wanted, 'alerts' => oay_alerts( $u->ID ), 'labels' => OAY_LEAD_ST ) );
}
function oay_acc_adm_lead_save() {
	$me = oay_acc_need_admin(); $u = get_userdata( absint( oay_acc_arg( 'id', 12 ) ) ); if ( ! $u ) { oay_acc_err( 'غير موجود', 404 ); }
	$l = oay_lead_get( $u->ID ) ?: array( 'status' => 'new', 'notes' => array(), 'next' => 0, 'items' => array(), 'last' => oay_crm_ms(), 'created' => oay_crm_ms() );
	$in = oay_acc_in();
	if ( isset( $in['status'] ) && isset( OAY_LEAD_ST[ $in['status'] ] ) ) { $l['status'] = $in['status']; if ( in_array( $in['status'], array( 'won', 'lost' ), true ) ) { $l['next'] = 0; } }
	if ( isset( $in['next'] ) ) { $l['next'] = max( 0, (int) $in['next'] ); }
	$note = trim( mb_substr( sanitize_textarea_field( (string) ( $in['note'] ?? '' ) ), 0, 1000 ) );
	if ( '' !== $note ) { array_unshift( $l['notes'], array( 't' => oay_crm_ms(), 'text' => $note, 'by' => $me->display_name ) ); $l['notes'] = array_slice( $l['notes'], 0, 100 ); }
	update_user_meta( $u->ID, 'oay_lead', $l ); if ( ! get_user_meta( $u->ID, 'oay_lead_last', true ) ) { update_user_meta( $u->ID, 'oay_lead_last', oay_crm_ms() ); }
	oay_acc_ok( array( 'lead' => $l, 'user' => oay_lead_row( $u ) ) );
}
// interest signals: chat_send (accounts file) and the usage tracker call oay_lead_add()
/** Called from the usage tracker when a signed-in member taps WhatsApp / call on a land. */
function oay_lead_from_track( $uid, $ev ) {
	foreach ( $ev as $e ) { if ( is_array( $e ) && in_array( $e['e'] ?? '', array( 'wa', 'call' ), true ) ) { oay_lead_add( $uid, $e['e'], (string) ( $e['id'] ?? '' ) ); } }
}
// reminders: every morning, the office gets a push with how many clients are due today
add_action( 'init', function () {
	if ( ! wp_next_scheduled( 'oay_leads_daily' ) ) { wp_schedule_event( strtotime( 'tomorrow 04:00 UTC' ), 'daily', 'oay_leads_daily' ); }
} );
add_action( 'oay_leads_daily', function () {
	$end = ( time() + DAY_IN_SECONDS ) * 1000; $n = 0; $names = array();
	foreach ( get_users( array( 'meta_key' => 'oay_lead_last', 'number' => 1000 ) ) as $u ) {
		$l = oay_lead_get( $u->ID ); if ( $l && $l['next'] && $l['next'] <= $end && in_array( $l['status'], array( 'new', 'follow' ), true ) ) { $n++; if ( count( $names ) < 3 ) { $names[] = $u->display_name; } }
	}
	if ( $n && function_exists( 'oay_push_to' ) ) { oay_push_to( oay_admin_ids(), '📋 متابعة العملاء اليوم: ' . $n, implode( '، ', $names ) . ( $n > 3 ? ' وغيرهم' : '' ), array( 'open' => 'leads' ) ); }
} );

/* ======================================================================================
 * 2. «مطلوب أرض»: buyers post what they want; shown after the office approves it.
 *    Offices answer through the office — the buyer's contact is never shown.
 * ==================================================================================== */
add_action( 'init', function () {
	register_post_type( 'oay_wanted', array( 'public' => false, 'show_ui' => false, 'supports' => array( 'title', 'author', 'editor' ), 'label' => 'طلبات الشراء' ) );
} );
function oay_wanted_card( $p, $admin = false ) {
	$m = function ( $k ) use ( $p ) { return get_post_meta( $p->ID, $k, true ); };
	$plan = (string) $m( 'project' ); $pname = '';
	if ( $plan && function_exists( 'dnp_projects' ) ) { $pr = dnp_projects(); $pname = isset( $pr[ $plan ] ) ? $pr[ $plan ]['name'] : ''; }
	$u = get_userdata( $p->post_author );
	$c = array( 'id' => $p->ID, 'cat' => (string) $m( 'cat' ), 'project' => $plan, 'projectName' => $pname, 'area' => (string) $m( 'area' ), 'budget' => (int) $m( 'budget' ),
		'minFt' => (int) $m( 'minft' ), 'maxFt' => (int) $m( 'maxft' ), 'pay' => (string) $m( 'pay' ), 'notes' => $p->post_content, 'date' => get_post_time( 'U', true, $p ) * 1000,
		'status' => 'publish' === $p->post_status ? 'approved' : ( 'pending' === $p->post_status ? 'pending' : 'rejected' ), 'by' => $u ? ( get_user_meta( $u->ID, 'oay_verified', true ) && get_user_meta( $u->ID, 'oay_company', true ) ? get_user_meta( $u->ID, 'oay_company', true ) : mb_substr( $u->display_name, 0, 1 ) . '•••' ) : '' );
	if ( $admin && $u ) { $c['user'] = array( 'id' => $u->ID, 'name' => $u->display_name, 'email' => $u->user_email, 'phone' => (string) get_user_meta( $u->ID, 'oay_phone', true ) ); }
	return $c;
}
function oay_acc_wanted_submit() {
	$u = oay_acc_need_user(); oay_acc_limit( 'wanted_' . $u->ID, 10 );
	$cat = sanitize_text_field( oay_acc_arg( 'cat', 30 ) ); $plan = sanitize_key( oay_acc_arg( 'project', 60 ) );
	$budget = (int) preg_replace( '/\D/', '', oay_acc_arg( 'budget', 20 ) ); $minft = (int) preg_replace( '/\D/', '', oay_acc_arg( 'minFt', 12 ) ); $maxft = (int) preg_replace( '/\D/', '', oay_acc_arg( 'maxFt', 12 ) );
	$notes = trim( mb_substr( oay_no_phones( sanitize_textarea_field( oay_acc_arg( 'notes', 800 ) ) ), 0, 800 ) );
	$area = mb_substr( sanitize_text_field( oay_acc_arg( 'area', 80 ) ), 0, 80 ); $pay = in_array( oay_acc_arg( 'pay', 10 ), array( 'cash', 'inst', 'any' ), true ) ? oay_acc_arg( 'pay', 10 ) : 'any';
	if ( ! $cat && ! $plan && ! $area ) { oay_acc_err( 'اختر نوع الأرض أو المشروع أو المنطقة' ); }
	$title = trim( 'مطلوب ' . ( $cat ?: 'أرض' ) . ( $plan ? ' · ' . $plan : '' ) . ( $area ? ' · ' . $area : '' ) );
	$admin = oay_acc_is_admin( $u );
	$id = wp_insert_post( array( 'post_type' => 'oay_wanted', 'post_status' => $admin ? 'publish' : 'pending', 'post_title' => $title, 'post_content' => $notes, 'post_author' => $u->ID ) );
	if ( is_wp_error( $id ) || ! $id ) { oay_acc_err( 'تعذّر الحفظ' ); }
	foreach ( array( 'cat' => $cat, 'project' => $plan, 'budget' => $budget, 'minft' => $minft, 'maxft' => $maxft, 'area' => $area, 'pay' => $pay ) as $k => $v ) { update_post_meta( $id, $k, $v ); }
	if ( '1' === oay_acc_arg( 'alert', 2 ) ) { oay_alert_add( $u->ID, array( 'project' => $plan, 'cat' => $cat, 'maxPrice' => $budget, 'minFt' => $minft, 'maxFt' => $maxft ) ); }
	oay_lead_add( $u->ID, 'wanted', '', $title );
	if ( ! $admin && function_exists( 'oay_push_to' ) ) { oay_push_to( oay_notif_filter( oay_admin_ids(), 'reqs' ), 'طلب شراء جديد بانتظار الموافقة', $title . ( $budget ? ' · حتى ' . number_format( $budget ) . ' د.إ' : '' ), array( 'open' => 'admin' ) ); }
	oay_acc_ok( array( 'id' => $id ) );
}
function oay_acc_wanted_mine() { $u = oay_acc_need_user(); oay_acc_ok( array( 'items' => array_map( 'oay_wanted_card', get_posts( array( 'post_type' => 'oay_wanted', 'author' => $u->ID, 'post_status' => array( 'publish', 'pending', 'draft' ), 'numberposts' => 50 ) ) ) ) ); }
function oay_acc_wanted_list() {
	$admin = false; $tok = oay_acc_arg( 'token', 120 ); if ( $tok ) { $u = oay_acc_user_from_token( $tok ); $admin = oay_acc_is_admin( $u ); }
	$ps = get_posts( array( 'post_type' => 'oay_wanted', 'post_status' => 'publish', 'numberposts' => 200, 'date_query' => array( array( 'after' => '120 days ago' ) ) ) );
	oay_acc_ok( array( 'items' => array_map( function ( $p ) use ( $admin ) { return oay_wanted_card( $p, $admin ); }, $ps ) ) );
}
function oay_acc_wanted_delete() {
	$u = oay_acc_need_user(); $p = get_post( absint( oay_acc_arg( 'id', 12 ) ) );
	if ( ! $p || 'oay_wanted' !== $p->post_type || ( (int) $p->post_author !== $u->ID && ! oay_acc_is_admin( $u ) ) ) { oay_acc_err( 'غير موجود', 404 ); }
	wp_delete_post( $p->ID, true ); oay_acc_ok();
}
function oay_acc_adm_wanted() {
	oay_acc_need_admin(); $st = 'publish' === oay_acc_arg( 'status', 10 ) ? 'publish' : 'pending';
	$ps = get_posts( array( 'post_type' => 'oay_wanted', 'post_status' => $st, 'numberposts' => 200 ) );
	oay_acc_ok( array( 'items' => array_map( function ( $p ) { return oay_wanted_card( $p, true ); }, $ps ), 'pending' => (int) wp_count_posts( 'oay_wanted' )->pending ) );
}
function oay_acc_adm_wanted_review() {
	oay_acc_need_admin(); $p = get_post( absint( oay_acc_arg( 'id', 12 ) ) ); if ( ! $p || 'oay_wanted' !== $p->post_type ) { oay_acc_err( 'غير موجود', 404 ); }
	$ok = '1' === oay_acc_arg( 'approve', 2 );
	wp_update_post( array( 'ID' => $p->ID, 'post_status' => $ok ? 'publish' : 'draft' ) );
	if ( function_exists( 'oay_push_to' ) ) { oay_push_to( oay_notif_filter( array( (int) $p->post_author ), 'reqs' ), $ok ? 'تم نشر طلب الشراء ✓' : 'لم يُنشر طلب الشراء', $ok ? 'سنعلمك بأي أرض تناسب طلبك' : 'تواصل مع الإدارة للتفاصيل', array( 'open' => 'account' ) ); }
	oay_acc_ok();
}

/* ======================================================================================
 * 3. «أرض تناسبني»: saved criteria; a push when a matching land is listed or gets cheaper.
 * ==================================================================================== */
function oay_alerts( $uid ) { $a = get_user_meta( $uid, 'oay_alerts', true ); return is_array( $a ) ? array_values( array_filter( $a, 'is_array' ) ) : array(); }
function oay_alert_add( $uid, $a ) {
	$list = oay_alerts( $uid ); if ( count( $list ) >= 8 ) { array_pop( $list ); }
	$a = array( 'id' => wp_generate_password( 8, false, false ), 't' => oay_crm_ms(), 'project' => sanitize_key( $a['project'] ?? '' ), 'cat' => sanitize_text_field( $a['cat'] ?? '' ),
		'maxPrice' => (int) ( $a['maxPrice'] ?? 0 ), 'minFt' => (int) ( $a['minFt'] ?? 0 ), 'maxFt' => (int) ( $a['maxFt'] ?? 0 ), 'hits' => 0 );
	array_unshift( $list, $a ); update_user_meta( $uid, 'oay_alerts', $list ); update_user_meta( $uid, 'oay_has_alerts', 1 );
	return $a;
}
function oay_acc_alert_list() { $u = oay_acc_need_user(); oay_acc_ok( array( 'items' => oay_alerts( $u->ID ) ) ); }
function oay_acc_alert_save() {
	$u = oay_acc_need_user(); $in = oay_acc_in();
	$num = function ( $k ) use ( $in ) { return (int) preg_replace( '/\D/', '', (string) ( $in[ $k ] ?? '' ) ); };
	$a = oay_alert_add( $u->ID, array( 'project' => $in['project'] ?? '', 'cat' => $in['cat'] ?? '', 'maxPrice' => $num( 'maxPrice' ), 'minFt' => $num( 'minFt' ), 'maxFt' => $num( 'maxFt' ) ) );
	oay_lead_add( $u->ID, 'alert', '', 'تنبيه: ' . oay_alert_text( $a ) );
	oay_acc_ok( array( 'items' => oay_alerts( $u->ID ) ) );
}
function oay_acc_alert_delete() {
	$u = oay_acc_need_user(); $id = oay_acc_arg( 'id', 12 );
	$l = array_values( array_filter( oay_alerts( $u->ID ), function ( $a ) use ( $id ) { return $a['id'] !== $id; } ) );
	update_user_meta( $u->ID, 'oay_alerts', $l ); if ( ! $l ) { delete_user_meta( $u->ID, 'oay_has_alerts' ); }
	oay_acc_ok( array( 'items' => $l ) );
}
function oay_alert_text( $a ) {
	$p = array(); $p[] = $a['cat'] ?: 'أي نوع';
	if ( $a['project'] && function_exists( 'dnp_projects' ) ) { $pr = dnp_projects(); $p[] = isset( $pr[ $a['project'] ] ) ? $pr[ $a['project'] ]['name'] : $a['project']; }
	if ( $a['maxPrice'] ) { $p[] = 'حتى ' . number_format( $a['maxPrice'] ) . ' د.إ'; }
	if ( $a['minFt'] || $a['maxFt'] ) { $p[] = ( $a['minFt'] ? number_format( $a['minFt'] ) : '0' ) . '–' . ( $a['maxFt'] ? number_format( $a['maxFt'] ) : '∞' ) . ' قدم²'; }
	return implode( ' · ', $p );
}
/** Same rule as the app's category(): the kind of a land from its use. */
function oay_cat_of( $use ) {
	if ( preg_match( '/صناع/u', $use ) ) { return 'صناعي'; } if ( preg_match( '/محل/u', $use ) ) { return 'محلات'; } if ( preg_match( '/فلل|فيلا/u', $use ) ) { return 'فلل'; }
	if ( preg_match( '/مكاتب|تجاري/u', $use ) ) { return 'تجاري'; } if ( preg_match( '/سكن/u', $use ) ) { return 'سكني'; } return 'أخرى';
}
/** A project's plots (number → [type use, ft]) from its plan file — cached. */
function oay_plan_plots( $slug ) {
	$k = 'oay_pp2_' . md5( $slug ); $c = get_transient( $k ); if ( is_array( $c ) ) { return $c; }
	$f = WP_PLUGIN_DIR . '/alyassi-dabdaba-plan/assets/p/' . basename( $slug ) . '/plan.json'; $out = array();
	if ( is_readable( $f ) ) {
		$j = json_decode( (string) file_get_contents( $f ), true );
		$types = $j['cfg']['types'] ?? array();
		if ( ! $types ) {   // plans without their own types use the app's defaults (src/config.js DEFAULT_TYPES)
			$types = array( 'magenta' => array( 'use' => 'تجاري سكني' ), 'gold' => array( 'use' => 'تجاري سكني' ), 'yellow' => array( 'use' => 'تجاري سكني' ), 'khaki' => array( 'use' => 'تجاري سكني' ),
				'salmon' => array( 'use' => 'تجاري مكاتب سكني' ), 'darkred' => array( 'use' => 'تجاري مكاتب سكني' ), 'red' => array( 'use' => 'محلات تجارية' ) );
		}
		foreach ( (array) ( $j['plots'] ?? array() ) as $q ) { if ( isset( $q['n'] ) ) { $out[ (string) $q['n'] ] = array( (string) ( $types[ $q['t'] ?? '' ]['use'] ?? '' ), (float) ( $q['ft'] ?? 0 ) ); } }
	}
	set_transient( $k, $out, DAY_IN_SECONDS );
	return $out;
}
function oay_alert_match( $a, $slug, $cat, $price, $ft ) {
	if ( $a['project'] && $a['project'] !== $slug ) { return false; }
	if ( $a['cat'] && $a['cat'] !== $cat && ! ( 'سكني' === $a['cat'] && 'فلل' === $cat ) ) { return false; }
	if ( $a['maxPrice'] && ( ! $price || $price > $a['maxPrice'] ) ) { return false; }
	if ( $a['minFt'] && $ft && $ft < $a['minFt'] ) { return false; }
	if ( $a['maxFt'] && $ft && $ft > $a['maxFt'] ) { return false; }
	return true;
}
/** Sends each member with a matching alert one push (several matches are grouped). */
function oay_alerts_run( $cands ) {
	if ( ! $cands || ! function_exists( 'oay_push_to' ) ) { return; }
	foreach ( get_users( array( 'meta_key' => 'oay_has_alerts', 'meta_value' => '1', 'number' => 3000, 'fields' => 'ID' ) ) as $uid ) {
		$alerts = oay_alerts( $uid ); $hits = array();
		foreach ( $cands as $c ) { foreach ( $alerts as $i => $a ) { if ( oay_alert_match( $a, $c['slug'], $c['cat'], $c['price'], $c['ft'] ) ) { $hits[] = $c; $alerts[ $i ]['hits'] = ( $a['hits'] ?? 0 ) + 1; break; } } }
		if ( ! $hits ) { continue; }
		update_user_meta( $uid, 'oay_alerts', $alerts );
		$c = $hits[0];
		$title = '🔔 ' . ( count( $hits ) > 1 ? count( $hits ) . ' أراضٍ تناسب طلبك' : 'أرض تناسب طلبك' );
		$body = $c['label'] . ( $c['price'] ? ' · ' . number_format( $c['price'] ) . ' د.إ' : '' ) . ( $c['why'] ? ' · ' . $c['why'] : '' );
		oay_push_to( array( $uid ), $title, $body, $c['oland'] ? array( 'open' => 'oland', 'id' => $c['oland'] ) : array( 'open' => 'land', 'id' => $c['slug'] . ':' . $c['n'] ) );
	}
}
// company plots: new available land, back to available, or a lower price (fired by alyassi-app-push.php)
add_action( 'oay_plot_changes', function ( $slug, $name, $ch, $new ) {
	$plots = oay_plan_plots( $slug ); $st = function_exists( 'oay_plots' ) ? oay_plots( $new ) : array(); $cands = array();
	foreach ( $ch as $c ) {
		$n = (string) $c['n']; $q = $st[ $n ] ?? array(); if ( ( $q['s'] ?? '' ) !== 'av' ) { continue; }
		$why = 'new' === $c['kind'] ? 'جديدة' : ( 'status' === $c['kind'] ? 'أصبحت متاحة' : ( 'price' === $c['kind'] && $c['to'] && $c['from'] && $c['to'] < $c['from'] ? 'سعر أقل' : '' ) );
		if ( ! $why ) { continue; }
		$use = $plots[ $n ][0] ?? ''; $ft = (float) ( $q['ft'] ?? ( $plots[ $n ][1] ?? 0 ) );
		$price = ! empty( $q['total'] ) ? (int) $q['total'] : ( ! empty( $q['ppf'] ) && $ft ? (int) round( $q['ppf'] * $ft ) : 0 );
		$cands[] = array( 'slug' => $slug, 'n' => $n, 'cat' => oay_cat_of( $use ), 'price' => $price, 'ft' => $ft, 'label' => 'قطعة ' . $n . ' · ' . $name, 'why' => $why, 'oland' => 0 );
	}
	oay_alerts_run( $cands );
}, 10, 4 );
// lands added by members: when the office approves one
add_action( 'transition_post_status', function ( $new, $old, $post ) {
	if ( 'publish' !== $new || 'publish' === $old || 'lands' !== $post->post_type || ! get_post_meta( $post->ID, '_oay_from_app', true ) ) { return; }
	$t = get_the_terms( $post->ID, 'land_type' ); $use = $t && ! is_wp_error( $t ) ? $t[0]->name : '';
	$plan = (string) get_post_meta( $post->ID, '_oay_plan_slug', true );
	oay_alerts_run( array( array( 'slug' => $plan, 'n' => '', 'cat' => oay_cat_of( $use ), 'price' => (int) get_post_meta( $post->ID, '_oay_price', true ), 'ft' => (float) get_post_meta( $post->ID, '_oay_area', true ),
		'label' => $post->post_title, 'why' => 'إعلان جديد', 'oland' => $post->ID ) ) );
}, 30, 3 );

/* ======================================================================================
 * 4. Targeted notifications: who looked at which project (last 45 days) — by member, or by phone
 *    for visitors who are not signed in (each phone is linked to «dev-<random id>» in OneSignal).
 * ==================================================================================== */
function oay_aud_note( $dev, $uid, $ev ) {
	$slugs = array();
	foreach ( $ev as $e ) {
		if ( ! is_array( $e ) ) { continue; } $id = (string) ( $e['id'] ?? '' );
		if ( in_array( $e['e'] ?? '', array( 'view', 'wa', 'call', 'share' ), true ) && strpos( $id, ':' ) ) { $slugs[] = strtok( $id, ':' ); }
		if ( 'plan' === ( $e['e'] ?? '' ) && $id ) { $slugs[] = $id; }
	}
	$who = $uid ? 'u' . $uid : ( $dev ? 'd' . $dev : '' ); if ( ! $who ) { return; }
	foreach ( array_unique( $slugs ) as $s ) {
		$s = sanitize_key( $s ); if ( ! $s ) { continue; }
		$k = 'oay_aud_' . $s; $a = get_option( $k, array() ); if ( ! is_array( $a ) ) { $a = array(); }
		$a[ $who ] = time();
		if ( count( $a ) > 6000 || 0 === wp_rand( 0, 50 ) ) { $cut = time() - 45 * DAY_IN_SECONDS; $a = array_filter( $a, function ( $t ) use ( $cut ) { return $t > $cut; } ); arsort( $a ); $a = array_slice( $a, 0, 6000, true ); }
		update_option( $k, $a, false );
	}
}
function oay_aud_aliases( $aud, $project = '', $uid = 0 ) {
	$al = array();
	if ( 'project' === $aud ) { $cut = time() - 45 * DAY_IN_SECONDS; foreach ( (array) get_option( 'oay_aud_' . sanitize_key( $project ), array() ) as $who => $t ) { if ( $t > $cut ) { $al[] = 'u' === $who[0] ? 'oay-' . substr( $who, 1 ) : 'dev-' . substr( $who, 1 ); } } }
	elseif ( 'alerts' === $aud ) { foreach ( get_users( array( 'meta_key' => 'oay_has_alerts', 'meta_value' => '1', 'fields' => 'ID', 'number' => 5000 ) ) as $id ) { if ( ! $project || array_filter( oay_alerts( $id ), function ( $a ) use ( $project ) { return ! $a['project'] || $a['project'] === $project; } ) ) { $al[] = 'oay-' . $id; } } }
	elseif ( 'offices' === $aud ) { foreach ( get_users( array( 'meta_key' => 'oay_verified', 'meta_value' => '1', 'fields' => 'ID', 'number' => 5000 ) ) as $id ) { $al[] = 'oay-' . $id; } }
	elseif ( 'members' === $aud ) { foreach ( get_users( array( 'meta_key' => 'oay_app_user', 'fields' => 'ID', 'number' => 20000 ) ) as $id ) { $al[] = 'oay-' . $id; } }
	elseif ( 'leads' === $aud ) { foreach ( get_users( array( 'meta_key' => 'oay_lead_last', 'fields' => 'ID', 'number' => 5000 ) ) as $id ) { $l = oay_lead_get( $id ); if ( $l && in_array( $l['status'], array( 'new', 'follow' ), true ) ) { $al[] = 'oay-' . $id; } } }
	elseif ( 'user' === $aud && $uid ) { $al[] = 'oay-' . (int) $uid; }
	return array_values( array_unique( $al ) );
}
function oay_acc_adm_push_count() {
	oay_acc_need_admin(); $aud = oay_acc_arg( 'audience', 20 );
	oay_acc_ok( array( 'n' => 'all' === $aud ? -1 : count( oay_aud_aliases( $aud, oay_acc_arg( 'project', 60 ), absint( oay_acc_arg( 'uid', 12 ) ) ) ) ) );
}
function oay_acc_adm_push() {
	oay_acc_need_admin(); oay_acc_limit( 'admpush', 30 );
	$key = trim( (string) get_option( 'oay_onesignal_key', '' ) ); if ( '' === $key ) { oay_acc_err( 'مفتاح الإشعارات غير مضبوط' ); }
	$aud = oay_acc_arg( 'audience', 20 ); $title = sanitize_text_field( oay_acc_arg( 'title', 120 ) ); $body = sanitize_textarea_field( oay_acc_arg( 'body', 400 ) );
	if ( mb_strlen( $title ) < 2 || mb_strlen( $body ) < 2 ) { oay_acc_err( 'اكتب العنوان والنص' ); }
	$open = oay_acc_arg( 'open', 20 ); $target = sanitize_text_field( oay_acc_arg( 'target', 300 ) );
	$data = array( 'open' => in_array( $open, array( 'project', 'land', 'news', 'oland', 'wanted', 'url' ), true ) ? $open : 'home', 'id' => $target );
	if ( 'url' === $data['open'] ) { $data['url'] = esc_url_raw( $target ); }
	$msg = array( 'app_id' => OAY_APP_ID, 'target_channel' => 'push', 'headings' => array( 'en' => $title, 'ar' => $title ), 'contents' => array( 'en' => $body, 'ar' => $body ), 'data' => $data, 'web_url' => OAY_APP_URL, 'ttl' => 259200, 'priority' => 10 );
	$sent = 0;
	$post = function ( $m ) use ( $key ) {
		$r = wp_remote_post( 'https://api.onesignal.com/notifications?c=push', array( 'timeout' => 15, 'headers' => array( 'Content-Type' => 'application/json', 'Authorization' => 'Key ' . $key ), 'body' => wp_json_encode( $m ) ) );
		return ! is_wp_error( $r ) && wp_remote_retrieve_response_code( $r ) < 300;
	};
	if ( 'all' === $aud ) { if ( ! $post( $msg + array( 'included_segments' => array( 'Total Subscriptions' ) ) ) && ! $post( $msg + array( 'included_segments' => array( 'Subscribed Users' ) ) ) ) { oay_acc_err( 'تعذّر الإرسال' ); } $sent = -1; }
	else {
		$al = oay_aud_aliases( $aud, oay_acc_arg( 'project', 60 ), absint( oay_acc_arg( 'uid', 12 ) ) );
		if ( ! $al ) { oay_acc_err( 'لا يوجد أحد في هذه الفئة بعد' ); }
		foreach ( array_chunk( $al, 2000 ) as $ch ) { if ( $post( $msg + array( 'include_aliases' => array( 'external_id' => $ch ) ) ) ) { $sent += count( $ch ); } }
		if ( ! $sent ) { oay_acc_err( 'تعذّر الإرسال' ); }
	}
	$log = (array) get_option( 'oay_push_log', array() ); array_unshift( $log, array( 't' => oay_crm_ms(), 'title' => $title, 'aud' => $aud, 'n' => $sent ) ); update_option( 'oay_push_log', array_slice( $log, 0, 50 ), false );
	oay_acc_ok( array( 'sent' => $sent, 'log' => array_slice( $log, 0, 10 ) ) );
}

/* ======================================================================================
 * 5. Sharjah procedures guide (the office can edit it from the app)
 * ==================================================================================== */
function oay_guide_default() {
	return array(
		array( 'id' => 'buy', 'title' => 'خطوات شراء أرض وتسجيلها', 'body' => "1. اختر الأرض وتأكد من رقم القطعة وموقعها على المخطط واستخدامها (سكني، تجاري، صناعي).\n2. اتفق مع البائع على السعر وطريقة الدفع ووقّع عقد البيع.\n3. جهّز المستندات المطلوبة (انظر القسم التالي).\n4. توجّه إلى دائرة التسجيل العقاري بالشارقة أو أحد فروعها لتقديم طلب نقل الملكية.\n5. ادفع الرسوم المقررة بعد اعتماد الطلب.\n6. استلم سند الملكية باسمك وتأكد من صحة بياناته.\n\nفريق عمر الياسي للعقارات يرافقك في كل الخطوات." ),
		array( 'id' => 'docs', 'title' => 'المستندات المطلوبة', 'body' => "• الهوية الإماراتية وجواز السفر للبائع والمشتري.\n• سند الملكية الأصلي (من البائع).\n• عقد البيع الموقّع من الطرفين.\n• شهادة عدم ممانعة من المطوّر إن وُجد.\n• ما يثبت سداد الثمن.\n• للشركات: الرخصة التجارية وعقد التأسيس وقرار التفويض.\n• للإرث أو الهبة: حصر الورثة أو المستند الشرعي، وهويات الورثة." ),
		array( 'id' => 'fees', 'title' => 'الرسوم', 'body' => "تُحتسب رسوم نقل الملكية كنسبة من قيمة العقار، تضاف إليها رسوم إدارية وإصدار السند. تختلف النسبة حسب نوع المعاملة والمنطقة وجنسية المشتري، وتعلنها الدائرة عند تقديم الطلب.\n\nلمعرفة الرسوم الدقيقة لأرضك تواصل معنا أو راجع موقع الدائرة." ),
		array( 'id' => 'who', 'title' => 'من يحق له التملك؟', 'body' => "• مواطنو الدولة ومواطنو دول مجلس التعاون: التملك في أغلب مناطق الإمارة.\n• الجنسيات الأخرى: في المشاريع والمناطق المسموح بها فقط ووفق الأنظمة المعتمدة.\n\nأنظمة التملك تُحدَّث من وقت لآخر — تأكد من الدائرة قبل الشراء." ),
		array( 'id' => 'build', 'title' => 'بعد الشراء: رخصة البناء', 'body' => "1. اعتماد المخطط الهندسي من مكتب استشاري معتمد.\n2. تقديم طلب رخصة البناء لدى البلدية المختصة مع سند الملكية.\n3. الالتزام بشروط التخطيط للقطعة (الارتفاع، الارتدادات، الاستخدام).\n\nشروط التخطيط لكل قطعة مذكورة في مخطط الأرض PDF داخل التطبيق." ),
		array( 'id' => 'where', 'title' => 'فروع دائرة التسجيل العقاري', 'body' => "• المقر الرئيسي — الشارقة.\n• فرع مويلح (الجديد).\n• فروع خورفكان وكلباء ودبا الحصن.\n\nالموقع الرسمي: https://www.shjrerd.gov.ae\nمواعيد العمل وأرقام التواصل منشورة في موقع الدائرة." ),
	);
}
function oay_acc_guide() { $g = get_option( 'oay_guide', null ); oay_acc_ok( array( 'sections' => is_array( $g ) && $g ? $g : oay_guide_default(), 'updated' => (int) get_option( 'oay_guide_t', 0 ) ) ); }
function oay_acc_adm_guide_save() {
	oay_acc_need_admin(); $in = oay_acc_in(); $out = array();
	foreach ( array_slice( (array) ( $in['sections'] ?? array() ), 0, 30 ) as $s ) {
		if ( ! is_array( $s ) ) { continue; } $t = sanitize_text_field( mb_substr( (string) ( $s['title'] ?? '' ), 0, 120 ) ); $b = sanitize_textarea_field( mb_substr( (string) ( $s['body'] ?? '' ), 0, 5000 ) );
		if ( '' === $t ) { continue; } $out[] = array( 'id' => sanitize_key( $s['id'] ?? '' ) ?: wp_generate_password( 6, false, false ), 'title' => $t, 'body' => $b );
	}
	update_option( 'oay_guide', $out, false ); update_option( 'oay_guide_t', oay_crm_ms(), false );
	oay_acc_ok( array( 'sections' => $out ) );
}

/* ======================================================================================
 * 6. Feed for the Android home-screen widget: latest news + latest offer (or newest land)
 * ==================================================================================== */
function oay_acc_widget() {
	$news = function_exists( 'oay_news_all' ) ? oay_news_all() : array();
	$offer = null;
	if ( function_exists( 'oay_offers' ) ) { foreach ( oay_offers() as $id => $o ) { $offer = array( 'title' => '🔥 عرض · قطعة ' . ( $o['n'] ?? '' ) . ' · ' . ( $o['projectName'] ?? '' ), 'body' => ( ! empty( $o['price'] ) ? number_format( (int) $o['price'] ) . ' د.إ' : '' ) . ( ! empty( $o['note'] ) ? ' · ' . $o['note'] : '' ), 'id' => (string) $id ); break; } }
	if ( ! $offer ) { foreach ( (array) get_option( 'oay_changes', array() ) as $c ) { if ( 'new' === ( $c['kind'] ?? '' ) || 'price' === ( $c['kind'] ?? '' ) ) { $offer = array( 'title' => ( 'new' === $c['kind'] ? '🆕 أرض جديدة · ' : '💲 سعر جديد · ' ) . 'قطعة ' . $c['n'] . ' · ' . $c['projectName'], 'body' => ! empty( $c['to'] ) ? number_format( (int) $c['to'] ) . ' د.إ' : '', 'id' => $c['id'] ); break; } } }
	header( 'Cache-Control: public, max-age=300' );
	wp_send_json( array( 'ok' => true, 'news' => $news ? $news[0]['text'] : '', 'newsCount' => count( $news ), 'offer' => $offer, 't' => oay_crm_ms() ) );
}

/* ======================================================================================
 * 7. Contact like Bayut: every call / WhatsApp tap and «طلب اتصال» on any listing reaches the office
 *    and is logged here with the listing's reference, so the office knows who asked about what.
 * ==================================================================================== */
function oay_contact_log( $e ) {
	$log = get_option( 'oay_contacts', array() ); if ( ! is_array( $log ) ) { $log = array(); }
	array_unshift( $log, $e + array( 't' => oay_crm_ms() ) );
	update_option( 'oay_contacts', array_slice( $log, 0, 1000 ), false );
}
function oay_ref_of( $id ) {
	if ( ctype_digit( (string) $id ) ) { return 'OAY-M' . $id; }
	list( $slug, $n ) = array_pad( explode( ':', (string) $id, 2 ), 2, '' );
	$ab = implode( '', array_map( function ( $w ) { return ctype_digit( $w ) ? $w : mb_substr( $w, 0, 1 ); }, array_filter( preg_split( '/[-_]/', $slug ) ) ) );
	return 'OAY-' . $n . '-' . strtoupper( $ab );
}
function oay_contacts_from_track( $dev, $u, $ev ) {
	foreach ( $ev as $e ) {
		if ( ! is_array( $e ) || ! in_array( $e['e'] ?? '', array( 'wa', 'call' ), true ) ) { continue; }
		$id = substr( preg_replace( '/[^\w:\-]/u', '', (string) ( $e['id'] ?? '' ) ), 0, 60 );
		oay_contact_log( array( 'kind' => $e['e'], 'id' => $id, 'name' => $id && function_exists( 'oay_land_name' ) ? oay_land_name( $id ) : 'عام', 'ref' => $id ? oay_ref_of( $id ) : '',
			'uid' => $u ? $u->ID : 0, 'who' => $u ? $u->display_name : '', 'dev' => substr( md5( (string) $dev ), 0, 8 ) ) );
	}
}
function oay_acc_contact_req() {
	oay_acc_limit( 'cbreq', 15 );
	$name = mb_substr( sanitize_text_field( oay_acc_arg( 'name', 60 ) ), 0, 60 ); $phone = preg_replace( '/[^\d+]/', '', oay_acc_arg( 'phone', 20 ) );
	if ( '' === $name || strlen( preg_replace( '/\D/', '', $phone ) ) < 9 ) { oay_acc_err( 'اكتب الاسم ورقم جوال صحيح' ); }
	$id = substr( preg_replace( '/[^\w:\-]/u', '', oay_acc_arg( 'id', 60 ) ), 0, 60 );
	$msg = mb_substr( sanitize_textarea_field( oay_acc_arg( 'msg', 500 ) ), 0, 500 );
	$u = oay_acc_user_from_token( oay_acc_arg( 'token', 120 ) );
	$title = $id && function_exists( 'oay_land_name' ) ? oay_land_name( $id ) : mb_substr( sanitize_text_field( oay_acc_arg( 'title', 120 ) ), 0, 120 );
	$e = array( 'kind' => 'form', 'id' => $id, 'name' => $title, 'ref' => $id ? oay_ref_of( $id ) : '', 'uid' => $u ? $u->ID : 0, 'who' => $name, 'phone' => $phone, 'msg' => $msg, 'wa' => '1' === oay_acc_arg( 'wa', 2 ), 'done' => false );
	oay_contact_log( $e );
	if ( $u ) { if ( ! get_user_meta( $u->ID, 'oay_phone', true ) ) { update_user_meta( $u->ID, 'oay_phone', $phone ); } oay_lead_add( $u->ID, 'form', $id, $title ); }
	if ( function_exists( 'oay_push_to' ) ) { oay_push_to( oay_admin_ids(), '📩 طلب اتصال · ' . $name, $title . ( $e['ref'] ? ' · ' . $e['ref'] : '' ) . ' · ' . $phone, array( 'open' => 'contacts' ) ); }
	oay_acc_ok();
}
function oay_acc_adm_contacts() {
	oay_acc_need_admin();
	$log = get_option( 'oay_contacts', array() ); if ( ! is_array( $log ) ) { $log = array(); }
	$done = oay_acc_arg( 'done', 30 );   // mark a call-back request as handled
	if ( '' !== $done ) { foreach ( $log as &$x ) { if ( (string) $x['t'] === $done ) { $x['done'] = true; } } unset( $x ); update_option( 'oay_contacts', $log, false ); }
	$k = oay_acc_arg( 'kind', 10 );
	$items = array_values( array_filter( $log, function ( $x ) use ( $k ) { return ! $k || $k === $x['kind']; } ) );
	$week = oay_crm_ms() - 7 * DAY_IN_SECONDS * 1000; $c = array( 'call' => 0, 'wa' => 0, 'form' => 0 );
	foreach ( $log as $x ) { if ( $x['t'] > $week && isset( $c[ $x['kind'] ] ) ) { $c[ $x['kind'] ]++; } }
	oay_acc_ok( array( 'items' => array_slice( $items, 0, 300 ), 'week' => $c, 'open' => count( array_filter( $log, function ( $x ) { return 'form' === $x['kind'] && empty( $x['done'] ); } ) ) ) );
}
