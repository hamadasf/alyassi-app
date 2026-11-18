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
const OAY_TEAM_EV = array( 'login' => 'تسجيل دخول', 'design' => 'حفظ تصميم', 'share_design' => 'مشاركة تصميم', 'save_img' => 'حفظ صورة تصميم', 'share_land' => 'مشاركة أرض', 'plot_new' => 'إضافة أرض', 'plot_edit' => 'تعديل أرض', 'chat' => 'رد على عميل', 'lead' => 'متابعة عميل', 'hold' => 'حجز مؤقت', 'deal' => 'صفقة / بيع' );

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
	if ( function_exists( 'oay_mkt_mark' ) ) { oay_mkt_mark( $id ); }   // «أراضٍ تحتاج تسويقاً» leaves it out for a while
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
	if ( 'sold' === $s && 'sold' !== $was ) { oay_team_log( $me->ID, 'deal', 'باع قطعة ' . $n . ' · ' . $p['proj'] . ( $total ? ' · ' . number_format( $total ) . ' د.إ' : '' ), $slug . ':' . $n ); }
	oay_team_log( $me->ID, $new ? 'plot_new' : 'plot_edit', 'قطعة ' . $n . ' · ' . $p['proj'] . ' · ' . ( $st[ $s ] ?? $s ) . ( $s && 'sold' !== $s ? ' · ' . $price : '' ), $slug . ':' . $n );
	if ( ! empty( $GLOBALS['oay_no_push'] ) ) { return; }
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
	elseif ( 'share_land' === $k ) { if ( function_exists( 'oay_mkt_mark' ) ) { oay_mkt_mark( $id ); } $p = oay_team_plot_label( $id ); if ( oay_team_once( 'sl' . $u->ID . $id, 600 ) ) { oay_team_log( $u->ID, 'share_land', 'قطعة ' . $p['n'] . ' · ' . $p['proj'], $id ); } }
	oay_acc_ok( array() );
}

/* «نشاط الفريق»: every member with their role, last seen, last sign-in and the week's counts; and the timeline */
function oay_acc_team_report() {
	$me = oay_acc_need_user(); if ( ! oay_team_lead( $me ) ) { oay_acc_err( 'غير مسموح', 403 ); }
	$uid = absint( oay_acc_arg( 'user', 12 ) ); $days = max( 1, min( 90, absint( oay_acc_arg( 'days', 3 ) ) ?: 7 ) ); $since = oay_team_ms() - $days * 86400000;
	$log = get_option( 'oay_team_log', array() ); $log = is_array( $log ) ? $log : array();
	$boss = oay_acc_is_admin( $me );   // the admin sees everyone; a manager sees only the staff and the marketing managers (not the admins, not managers)
	$hide = array(); if ( ! $boss ) { foreach ( oay_admin_ids() as $id ) { $x = get_userdata( $id ); if ( $x && in_array( oay_role( $x ), array( 'admin', 'mgr' ), true ) ) { $hide[ (int) $id ] = 1; } } }
	if ( $hide ) { $log = array_values( array_filter( $log, function ( $e ) use ( $hide ) { return empty( $hide[ (int) $e['u'] ] ); } ) ); }
	if ( isset( $hide[ $uid ] ) ) { $uid = 0; }
	$team = array(); $cnt = array(); $lastLogin = array();
	foreach ( $log as $e ) {
		if ( 'login' === $e['k'] && ! isset( $lastLogin[ $e['u'] ] ) ) { $lastLogin[ $e['u'] ] = $e['t']; }
		if ( $e['t'] >= $since ) { $cnt[ $e['u'] ][ $e['k'] ] = ( $cnt[ $e['u'] ][ $e['k'] ] ?? 0 ) + 1; }
	}
	foreach ( oay_admin_ids() as $id ) {
		$u = get_userdata( $id ); if ( ! $u || ! oay_role( $u ) || isset( $hide[ (int) $id ] ) ) { continue; }
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
	$mc = function_exists( 'oay_month_counts' ) ? oay_month_counts() : array(); $tg = function_exists( 'oay_targets' ) ? oay_targets() : array();
	$rf = function_exists( 'oay_ref_counts' ) ? oay_ref_counts( $since ) : array();
	foreach ( $team as &$x ) { $x['month'] = (object) ( $mc[ $x['id'] ] ?? array() ); $x['target'] = (object) ( $tg[ $x['id'] ] ?? array() ); $x['ref'] = (object) ( $rf[ $x['id'] ] ?? array() ); } unset( $x );
	oay_acc_ok( array( 'team' => $team, 'feed' => $feed, 'kinds' => OAY_TEAM_EV, 'roles' => OAY_ROLES, 'days' => $days, 'boss' => oay_acc_is_admin( $me ) ) );
}

/* the performance board: following clients, temporary holds and deals count too */
add_action( 'oay_lead_worked', function ( $me, $client, $status ) {
	if ( 'won' === $status ) { oay_team_log( $me->ID, 'deal', 'صفقة مع ' . $client->display_name, 'user:' . $client->ID ); return; }
	if ( oay_team_once( 'lead' . $me->ID . ':' . $client->ID, 1800 ) ) { oay_team_log( $me->ID, 'lead', 'تابع ' . $client->display_name, 'user:' . $client->ID ); }
}, 10, 3 );
add_action( 'oay_hold_made', function ( $me, $id, $client, $hours ) {
	$p = oay_team_plot_label( $id ); oay_team_log( $me->ID, 'hold', 'قطعة ' . $p['n'] . ' · ' . $p['proj'] . ' لـ ' . $client . ' (' . $hours . ' ساعة)', $id );
}, 10, 4 );
add_action( 'oay_hold_paid', function ( $me, $id, $client ) {
	$p = oay_team_plot_label( $id ); oay_team_log( $me->ID, 'deal', 'عربون قطعة ' . $p['n'] . ' · ' . $p['proj'] . ' من ' . $client, $id );
}, 10, 3 );

/* ======================================================================================
 * «ملخص الأسبوع»: what the office did in 7 days — sold / reserved (and their value), posts designed,
 * new and hot clients, and the team's best member. Shown at the top of «التقرير الأسبوعي» and sent
 * every Sunday morning to the admin and the managers.
 * ==================================================================================== */
add_action( 'oay_plot_saved', function ( $me, $slug, $n, $was, $s, $total ) {
	if ( ! in_array( $s, array( 'res', 'sold' ), true ) || $s === $was ) { return; }
	$log = get_option( 'oay_status_log', array() ); $log = is_array( $log ) ? $log : array();
	array_unshift( $log, array( 't' => oay_team_ms(), 'id' => $slug . ':' . $n, 's' => $s, 'v' => (int) $total, 'u' => (int) $me->ID ) );
	update_option( 'oay_status_log', array_slice( $log, 0, 1500 ), false );
}, 20, 6 );
function oay_week_biz( $end ) {
	$to = $end * 1000; $from = $to - 7 * 86400000;
	$o = array( 'sold' => 0, 'soldV' => 0, 'res' => 0, 'posts' => 0, 'leads' => 0, 'hot' => 0, 'best' => null, 'team' => array() );
	$last = array();   // a plot reserved then sold in the same week counts once, as sold
	foreach ( (array) get_option( 'oay_status_log', array() ) as $e ) {
		if ( $e['t'] >= $to ) { continue; } if ( $e['t'] < $from ) { break; }
		if ( ! isset( $last[ $e['id'] ] ) ) { $last[ $e['id'] ] = $e; }
	}
	foreach ( $last as $e ) { if ( 'sold' === $e['s'] ) { $o['sold']++; $o['soldV'] += (int) $e['v']; } else { $o['res']++; } }
	$W = array( 'deal' => 5, 'hold' => 3, 'lead' => 1, 'chat' => 0.5, 'design' => 1, 'share_design' => 1, 'save_img' => 1, 'share_land' => 0.5, 'plot_new' => 0.5 );
	$pts = array(); $parts = array(); $posts = array();
	foreach ( (array) get_option( 'oay_team_log', array() ) as $e ) {
		if ( $e['t'] >= $to ) { continue; } if ( $e['t'] < $from ) { break; }
		$u = (int) $e['u'];
		if ( in_array( $e['k'], array( 'design', 'share_design', 'save_img' ), true ) ) { $k = explode( '|', (string) $e['r'] )[0]; if ( isset( $posts[ $u . $k ] ) ) { continue; } $posts[ $u . $k ] = 1; $o['posts']++; $g = 'posts'; }
		elseif ( 'deal' === $e['k'] ) { $g = 'deals'; } elseif ( 'hold' === $e['k'] ) { $g = 'holds'; } elseif ( in_array( $e['k'], array( 'lead', 'chat' ), true ) ) { $g = 'clients'; } else { $g = ''; }
		if ( ! isset( $W[ $e['k'] ] ) ) { continue; }
		$pts[ $u ] = ( $pts[ $u ] ?? 0 ) + $W[ $e['k'] ]; if ( $g ) { $parts[ $u ][ $g ] = ( $parts[ $u ][ $g ] ?? 0 ) + 1; }
	}
	foreach ( get_users( array( 'meta_key' => 'oay_lead_last', 'meta_value' => $from, 'meta_compare' => '>=', 'meta_type' => 'NUMERIC', 'number' => 2000 ) ) as $u ) {
		$l = function_exists( 'oay_lead_get' ) ? oay_lead_get( $u->ID ) : null; if ( ! $l ) { continue; }
		$c = (int) ( $l['created'] ?? 0 ); if ( $c >= $from && $c < $to ) { $o['leads']++; }
		foreach ( $l['items'] as $it ) { if ( $it['t'] < $to && $it['t'] >= $from && in_array( $it['src'], array( 'hot', 'wa', 'call', 'form' ), true ) ) { $o['hot']++; break; } }
	}
	arsort( $pts );
	foreach ( array_slice( $pts, 0, 3, true ) as $uid => $p ) {
		$u = get_userdata( $uid ); if ( ! $u ) { continue; }
		$o['team'][] = array( 'id' => (int) $uid, 'name' => $u->display_name, 'pts' => round( $p, 1 ), 'parts' => (object) ( $parts[ $uid ] ?? array() ) );
	}
	$o['best'] = $o['team'][0] ?? null;
	return $o;
}
/** «1.2 مليون» / «850 ألف» */
function oay_short_aed( $v ) { return $v >= 1000000 ? rtrim( rtrim( number_format( $v / 1000000, 2 ), '0' ), '.' ) . ' مليون' : ( $v >= 1000 ? number_format( round( $v / 1000 ) ) . ' ألف' : (string) $v ); }
function oay_week_biz_text( $b ) {
	$a = array();
	$a[] = $b['sold'] ? 'بيع ' . $b['sold'] . ( $b['soldV'] ? ' (' . oay_short_aed( $b['soldV'] ) . ' درهم)' : '' ) : 'لا مبيعات';
	if ( $b['res'] ) { $a[] = 'حجز ' . $b['res']; }
	$a[] = $b['posts'] . ' بوست'; $a[] = $b['leads'] . ' عميل جديد'; if ( $b['hot'] ) { $a[] = $b['hot'] . ' ساخن'; }
	if ( $b['best'] ) { $a[] = 'الأفضل: ' . $b['best']['name']; }
	return implode( ' · ', $a );
}

/* ======================================================================================
 * «رابط الموظف»: a plot link shared by a team member carries ?r=<their code> — the share page counts who opened it
 * (people, not the WhatsApp preview), and the app hands the code back when the person signs up / signs in:
 * the client then belongs to that member («المتابِع») and counts as theirs.
 * ==================================================================================== */
foreach ( array( 'ref_hit' ) as $a ) { add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a ); add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a ); }
function oay_ref_code( $uid ) { return base_convert( (string) (int) $uid, 10, 36 ); }
function oay_ref_user( $code ) {
	if ( ! preg_match( '/^[0-9a-z]{1,8}$/', (string) $code ) ) { return null; }
	$u = get_userdata( (int) base_convert( $code, 36, 10 ) ); return $u && oay_is_team( $u ) ? $u : null;
}
function oay_ref_log( $uid, $k, $who = '', $id = '' ) {
	$log = get_option( 'oay_ref_log', array() ); $log = is_array( $log ) ? $log : array();
	array_unshift( $log, array( 't' => oay_team_ms(), 'u' => (int) $uid, 'k' => $k, 'w' => (string) $who, 'id' => (string) $id ) );
	update_option( 'oay_ref_log', array_slice( $log, 0, 4000 ), false );
}
/** opens of a member's links (same person, same plot: once in 6 hours; link-preview robots not counted) */
function oay_ref_click( $code, $id ) {
	$m = oay_ref_user( $code ); if ( ! $m ) { return; }
	$ua = (string) ( $_SERVER['HTTP_USER_AGENT'] ?? '' );
	if ( '' === $ua || preg_match( '/bot|crawl|spider|preview|facebookexternalhit|WhatsApp|TelegramBot|Twitterbot|Slackbot|Discordbot|SkypeUriPreview|Google-|HeadlessChrome|curl|wget|python/i', $ua ) ) { return; }
	$key = 'oay_rc_' . md5( $m->ID . '|' . $id . '|' . ( $_SERVER['REMOTE_ADDR'] ?? '' ) . '|' . $ua );
	if ( get_transient( $key ) ) { return; } set_transient( $key, 1, 6 * HOUR_IN_SECONDS );
	oay_ref_log( $m->ID, 'click', '', $id );
}
/** the app: the person opened a member's link — signed in now (or later) → that member follows them */
function oay_acc_ref_hit() {
	$me = oay_acc_user_from_token( oay_acc_arg( 'token', 120 ) ); $m = oay_ref_user( oay_acc_arg( 'r', 10 ) );
	if ( $m && oay_acc_arg( 'open', 2 ) && ( ! $me || ! oay_is_team( $me ) ) ) { oay_ref_click( oay_acc_arg( 'r', 10 ), oay_acc_arg( 'land', 40 ) ); }   // opened straight in the app (Android App Links skip the share page)
	if ( ! $me || ! $m || oay_is_team( $me ) ) { oay_acc_ok( array() ); }
	if ( ! get_user_meta( $me->ID, 'oay_ref_by', true ) ) {
		update_user_meta( $me->ID, 'oay_ref_by', $m->ID );
		$new = strtotime( $me->user_registered . ' UTC' ) > time() - 15 * MINUTE_IN_SECONDS;
		oay_ref_log( $m->ID, $new ? 'reg' : 'lead', $me->ID, oay_acc_arg( 'land', 40 ) );
		if ( function_exists( 'oay_lead_get' ) ) {
			$l = oay_lead_get( $me->ID );
			if ( $l && empty( $l['owner'] ) ) { $l['owner'] = (int) $m->ID; update_user_meta( $me->ID, 'oay_lead', $l ); }
			elseif ( ! $l ) { update_user_meta( $me->ID, 'oay_lead_owner_wait', (int) $m->ID ); oay_lead_add( $me->ID, 'slink', oay_acc_arg( 'land', 40 ) ); }
		}
		if ( function_exists( 'oay_push_to' ) ) { oay_push_to( array( $m->ID ), $new ? '🎉 عميل جديد من رابطك' : '🔗 عميل فتح رابطك', $me->display_name . ( $new ? ' سجّل في التطبيق من رابط شاركته' : ' فتح رابطاً شاركته — أصبح من عملائك' ), array( 'open' => 'lead', 'id' => (string) $me->ID ) ); }
	}
	oay_acc_ok( array() );
}
/** per member: opens of their links, sign-ups and clients they got, since $since (ms) */
function oay_ref_counts( $since ) {
	$o = array();
	foreach ( (array) get_option( 'oay_ref_log', array() ) as $e ) {
		if ( $e['t'] < $since ) { break; }
		$o[ $e['u'] ][ $e['k'] ] = ( $o[ $e['u'] ][ $e['k'] ] ?? 0 ) + 1;
	}
	return $o;
}
