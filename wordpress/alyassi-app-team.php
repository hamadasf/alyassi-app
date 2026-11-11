<?php
/**
 * Plugin Name: Alyassi App – Team roles, activity and team notifications
 * Description: 1) A role for each member of the office team: موظف · مدير · مدير تسويق (set by the admin with the permissions).
 *              2) The team's activity: sign-ins, designs saved / shared, lands shared, plots added or changed, chat replies;
 *                 «نشاط الفريق» for the admin and the managers: last seen, counts for the week, and a timeline per person.
 *              3) Team notifications: a manager's (or the admin's) design → the rest of the team; a new available plot → the team.
 *              Uses the helpers of alyassi-app-accounts.php / -push.php.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

const OAY_ROLES = array( 'staff' => 'موظف', 'mgr' => 'مدير', 'mkt' => 'مدير تسويق' );
const OAY_TEAM_EV = array( 'login' => 'تسجيل دخول', 'design' => 'حفظ تصميم', 'share_design' => 'مشاركة تصميم', 'save_img' => 'حفظ صورة تصميم', 'share_land' => 'مشاركة أرض', 'plot_new' => 'إضافة أرض', 'plot_edit' => 'تعديل أرض', 'chat' => 'رد على عميل' );

foreach ( array( 'team_ev', 'team_report' ) as $a ) { add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a ); add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a ); }

function oay_team_ms() { return (int) round( microtime( true ) * 1000 ); }
/** 'admin' | 'mgr' | 'mkt' | 'staff' | '' (not in the team) */
function oay_role( $u ) {
	if ( ! $u ) { return ''; }
	if ( oay_acc_is_admin( $u ) ) { return 'admin'; }
	if ( ! oay_staff_perms( $u->ID ) ) { return ''; }
	$r = (string) get_user_meta( $u->ID, 'oay_role', true ); return isset( OAY_ROLES[ $r ] ) ? $r : 'staff';
}
function oay_role_set( $uid, $r ) { if ( isset( OAY_ROLES[ $r ] ) && 'staff' !== $r ) { update_user_meta( $uid, 'oay_role', $r ); } else { delete_user_meta( $uid, 'oay_role' ); } }
function oay_role_label( $u ) { $r = oay_role( $u ); return 'admin' === $r ? 'الإدارة' : ( OAY_ROLES[ $r ] ?? '' ); }
/** the admin and the managers see the team's activity */
function oay_team_lead( $u ) { return in_array( oay_role( $u ), array( 'admin', 'mgr' ), true ); }
function oay_team_ids( $except = 0 ) { return array_values( array_diff( array_map( 'intval', oay_admin_ids() ), array( (int) $except ) ) ); }
function oay_team_name( $u ) { $l = oay_role_label( $u ); return $u->display_name . ( $l ? ' (' . $l . ')' : '' ); }

/* ---------------- the activity log (newest first; 4000 entries) ---------------- */
function oay_team_log( $uid, $type, $text, $ref = '' ) {
	$u = get_userdata( $uid ); if ( ! $u || ! oay_role( $u ) || ! isset( OAY_TEAM_EV[ $type ] ) ) { return; }   // only the office team
	$log = get_option( 'oay_team_log', array() ); $log = is_array( $log ) ? $log : array();
	array_unshift( $log, array( 't' => oay_team_ms(), 'u' => (int) $uid, 'k' => $type, 'x' => mb_substr( (string) $text, 0, 200 ), 'r' => mb_substr( (string) $ref, 0, 80 ) ) );
	update_option( 'oay_team_log', array_slice( $log, 0, 4000 ), false );
}
/** one action of a kind per person and thing in a window (a save, then a share of the same design = one line, one push) */
function oay_team_once( $key, $secs ) { $k = 'oay_t1_' . md5( $key ); if ( get_transient( $k ) ) { return false; } set_transient( $k, 1, $secs ); return true; }
function oay_team_plot_label( $id ) {
	$slug = strstr( $id, ':', true ); $n = substr( strrchr( $id, ':' ), 1 );
	$info = function_exists( 'oay_plot_info' ) ? oay_plot_info( $slug, $n ) : null;
	if ( ! $info && function_exists( 'dnp_projects' ) ) { $p = dnp_projects()[ $slug ] ?? null; $info = $p ? array( 'name' => $p['name'] ?? $slug, 'total' => 0, 's' => '' ) : null; }
	return array( 'n' => $n, 'proj' => $info ? $info['name'] : $slug, 'total' => $info ? (int) $info['total'] : 0, 's' => $info ? $info['s'] : '' );
}

add_action( 'oay_signed_in', function ( $uid ) { if ( oay_team_once( 'login' . $uid, 1800 ) ) { oay_team_log( $uid, 'login', 'سجّل الدخول للتطبيق' ); } } );
add_action( 'oay_office_reply', function ( $me, $client ) { if ( oay_team_once( 'chat' . $me->ID . ':' . $client->ID, 1800 ) ) { oay_team_log( $me->ID, 'chat', 'ردّ على ' . $client->display_name, 'user:' . $client->ID ); } }, 10, 2 );

/* a design saved / shared: logged; when the designer is a manager, a marketing manager or the admin → the rest of the team */
function oay_team_design( $u, $id, $theme, $kind ) {
	$p = oay_team_plot_label( $id ); $tpl = defined( 'OAY_TPLS' ) && isset( OAY_TPLS[ $theme ] ) ? OAY_TPLS[ $theme ] : ( 'wa' === $theme ? 'قالب واتس أب' : $theme );
	$what = 'قطعة ' . $p['n'] . ' · ' . $p['proj'];
	if ( oay_team_once( $kind . $u->ID . $id . $theme, 600 ) ) { oay_team_log( $u->ID, $kind, $what . ' · ' . $tpl, $id . '|' . $theme ); }
	if ( ! in_array( oay_role( $u ), array( 'admin', 'mgr', 'mkt' ), true ) || ! oay_team_once( 'dpush' . $id . $theme, 1800 ) ) { return; }
	$who = oay_team_name( $u );
	oay_push_to( oay_notif_filter( oay_team_ids( $u->ID ), 'team' ), 'تصميم جديد جاهز للنشر', $who . ' صمّم بوست ' . $what . ' (' . $tpl . ') — اضغط لفتحه ومشاركته',
		array( 'open' => 'design', 'id' => $id, 'theme' => $theme ), function_exists( 'oay_push_img' ) ? oay_push_img( array( 'id' => $id ) ) : array() );
}
add_action( 'oay_design_saved', function ( $u, $id, $theme ) { oay_team_design( $u, $id, $theme, 'design' ); }, 10, 3 );

/* a plot added or changed from the app */
add_action( 'oay_plot_saved', function ( $me, $slug, $n, $was, $s, $total ) {
	$p = oay_team_plot_label( $slug . ':' . $n ); $st = array( 'av' => 'متاحة', 'res' => 'محجوزة', 'sold' => 'مباعة', '' => 'غير معروضة' );
	$price = $total ? number_format( $total ) . ' د.إ' : 'السعر عند الاستفسار';
	$new = '' === $was && 'av' === $s;
	oay_team_log( $me->ID, $new ? 'plot_new' : 'plot_edit', 'قطعة ' . $n . ' · ' . $p['proj'] . ' · ' . ( $st[ $s ] ?? $s ) . ( $s && 'sold' !== $s ? ' · ' . $price : '' ), $slug . ':' . $n );
	if ( ! $new || ! oay_team_once( 'pnew' . $slug . $n, 3600 ) ) { return; }
	oay_push_to( oay_notif_filter( oay_team_ids( $me->ID ), 'team' ), 'أرض جديدة على المخطط · ' . $p['proj'], 'قطعة ' . $n . ' · متاحة · ' . $price . ' — أضافها ' . oay_team_name( $me ),
		array( 'open' => 'land', 'id' => $slug . ':' . $n ), function_exists( 'oay_push_img' ) ? oay_push_img( array( 'id' => $slug . ':' . $n ) ) : array() );
}, 10, 6 );

/* the app tells the office what a team member shared (shares happen on the phone) */
function oay_acc_team_ev() {
	$u = oay_acc_need_user(); if ( ! oay_role( $u ) ) { oay_acc_ok( array() ); }
	oay_acc_limit( 'tev_' . $u->ID, 120 );
	$k = sanitize_key( oay_acc_arg( 'kind', 20 ) ); $id = (string) oay_acc_arg( 'id', 60 ); $theme = sanitize_key( oay_acc_arg( 'theme', 12 ) );
	if ( ! preg_match( '/^[a-z0-9-]{2,40}:[A-Za-z0-9-]{1,12}$/', $id ) ) { oay_acc_err( 'غير معروف' ); }
	if ( 'share_design' === $k || 'save_img' === $k ) { oay_team_design( $u, $id, $theme, $k ); }
	elseif ( 'share_land' === $k ) { $p = oay_team_plot_label( $id ); if ( oay_team_once( 'sl' . $u->ID . $id, 600 ) ) { oay_team_log( $u->ID, 'share_land', 'قطعة ' . $p['n'] . ' · ' . $p['proj'], $id ); } }
	oay_acc_ok( array() );
}

/* «نشاط الفريق»: every member with their role, last seen, last sign-in and the week's counts; and the timeline */
function oay_acc_team_report() {
	$me = oay_acc_need_user(); if ( ! oay_team_lead( $me ) ) { oay_acc_err( 'غير مسموح', 403 ); }
	$uid = absint( oay_acc_arg( 'user', 12 ) ); $days = max( 1, min( 90, absint( oay_acc_arg( 'days', 3 ) ) ?: 7 ) ); $since = oay_team_ms() - $days * 86400000;
	$log = get_option( 'oay_team_log', array() ); $log = is_array( $log ) ? $log : array();
	$team = array(); $cnt = array(); $lastLogin = array();
	foreach ( $log as $e ) {
		if ( 'login' === $e['k'] && ! isset( $lastLogin[ $e['u'] ] ) ) { $lastLogin[ $e['u'] ] = $e['t']; }
		if ( $e['t'] >= $since ) { $cnt[ $e['u'] ][ $e['k'] ] = ( $cnt[ $e['u'] ][ $e['k'] ] ?? 0 ) + 1; }
	}
	foreach ( oay_admin_ids() as $id ) {
		$u = get_userdata( $id ); if ( ! $u || ! oay_role( $u ) ) { continue; }
		$team[] = array( 'id' => (int) $id, 'name' => $u->display_name, 'role' => oay_role( $u ), 'roleLabel' => oay_role_label( $u ), 'avatar' => (string) get_user_meta( $id, 'oay_avatar', true ),
			'seen' => oay_seen_ms( $id ), 'online' => oay_is_online( $id ), 'login' => (int) ( $lastLogin[ $id ] ?? 0 ), 'counts' => (object) ( $cnt[ $id ] ?? array() ) );
	}
	usort( $team, function ( $a, $b ) { return $b['seen'] <=> $a['seen']; } );
	$feed = array();
	foreach ( $log as $e ) {
		if ( $e['t'] < $since ) { break; }
		if ( $uid && (int) $e['u'] !== $uid ) { continue; }
		$feed[] = $e; if ( count( $feed ) >= 300 ) { break; }
	}
	oay_acc_ok( array( 'team' => $team, 'feed' => $feed, 'kinds' => OAY_TEAM_EV, 'roles' => OAY_ROLES, 'days' => $days ) );
}
