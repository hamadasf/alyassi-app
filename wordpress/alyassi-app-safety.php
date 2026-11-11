<?php
/**
 * Plugin Name: Alyassi App – Safety: backups, plot history & undo, two-step sign-in, error reports, app links
 * Description: 1) A backup of the app's data every day (plans: status, prices, payments; owners, designs, offers, settings,
 *                 the team's roles and permissions) — the last 30 kept on the server, one e-mailed to the office every week;
 *                 the admin can make one now, download it, or restore one.
 *              2) Every plot change keeps the plot before and after: a history per plot, and «تراجع» puts the earlier one back.
 *              3) Two-step sign-in for the management and the managers: a new phone asks for a code sent by e-mail.
 *              4) Error reports from the app (what broke, on which phone and version) for the admin.
 *              5) Share links /l/<project>-<plot> that open the app on Android (App Links) or the website.
 *              Uses the helpers of alyassi-app-accounts.php / -growth.php / -team.php.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'adm_backups', 'adm_backup_now', 'adm_backup_get', 'adm_backup_restore', 'adm_plot_history', 'adm_plot_undo', 'login_2fa', 'err_report', 'adm_errs', 'adm_errs_clear' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a ); add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}
function oay_sf_ms() { return (int) round( microtime( true ) * 1000 ); }

/* =============================== 1) backups =============================== */
/** the app's own data (no passwords, no keys): every project's plan state + the app's settings and lists */
const OAY_BK_OPTS = array( 'oay_owners', 'oay_designs', 'oay_proj_lines', 'oay_proj_pins', 'oay_offers', 'oay_costcfg', 'oay_view_cfg', 'oay_brand', 'oay_news', 'oay_news_speed',
	'oay_guide', 'oay_invites', 'oay_market', 'oay_contacts', 'oay_svc_rates', 'oay_prereg', 'oay_plot_log', 'oay_team_log', 'oay_mail_cfg', 'oay_changes' );
const OAY_BK_UMETA = array( 'oay_staff', 'oay_role', 'oay_tpl', 'oay_points', 'oay_verified', 'oay_company', 'oay_banned' );
function oay_bk_dir() {
	$u = wp_upload_dir(); $d = trailingslashit( $u['basedir'] ) . 'oay-backups';
	if ( ! is_dir( $d ) ) { wp_mkdir_p( $d ); }
	if ( ! file_exists( $d . '/.htaccess' ) ) { file_put_contents( $d . '/.htaccess', "Require all denied\nDeny from all\n" ); }
	if ( ! file_exists( $d . '/index.php' ) ) { file_put_contents( $d . '/index.php', '<?php // nothing here' ); }
	return $d;
}
function oay_bk_data() {
	$plans = array();
	if ( function_exists( 'dnp_projects' ) ) { foreach ( dnp_projects() as $slug => $p ) { if ( ! empty( $p['opt'] ) ) { $plans[ $slug ] = array( 'opt' => $p['opt'], 'v' => get_option( $p['opt'] ) ); } } }
	$opts = array(); foreach ( OAY_BK_OPTS as $k ) { $v = get_option( $k, null ); if ( null !== $v ) { $opts[ $k ] = $v; } }
	$users = array();
	foreach ( get_users( array( 'meta_key' => 'oay_staff', 'fields' => array( 'ID', 'user_email' ) ) ) as $x ) {
		$m = array(); foreach ( OAY_BK_UMETA as $k ) { $v = get_user_meta( $x->ID, $k, true ); if ( '' !== $v && null !== $v ) { $m[ $k ] = $v; } }
		$users[] = array( 'id' => (int) $x->ID, 'email' => $x->user_email, 'meta' => $m );
	}
	return array( 'v' => 1, 'site' => home_url( '/' ), 't' => oay_sf_ms(), 'plans' => $plans, 'opts' => $opts, 'team' => $users );
}
/** writes a backup file; returns its name */
function oay_bk_make( $why = 'auto' ) {
	$d = oay_bk_dir(); $j = wp_json_encode( oay_bk_data() ); if ( ! $j ) { return ''; }
	$name = wp_date( 'Y-m-d-His' ) . '-' . sanitize_key( $why ) . '-' . wp_generate_password( 10, false ) . '.json.gz';
	file_put_contents( $d . '/' . $name, gzencode( $j, 9 ) );
	$all = oay_bk_files(); foreach ( array_slice( $all, 40 ) as $old ) { @unlink( $d . '/' . $old['name'] ); }   // the last 40 (≈ 30 days + the hand-made ones)
	return $name;
}
function oay_bk_files() {
	$d = oay_bk_dir(); $out = array();
	foreach ( (array) glob( $d . '/*.json.gz' ) as $f ) {
		$b = basename( $f ); if ( ! preg_match( '/^(\d{4}-\d{2}-\d{2})-(\d{6})-([a-z]+)-/', $b, $m ) ) { continue; }
		$out[] = array( 'name' => $b, 'day' => $m[1], 'time' => substr( $m[2], 0, 2 ) . ':' . substr( $m[2], 2, 2 ), 'why' => $m[3], 'size' => (int) filesize( $f ), 't' => (int) filemtime( $f ) * 1000 );
	}
	usort( $out, function ( $a, $b ) { return $b['t'] <=> $a['t']; } );
	return $out;
}
function oay_bk_read( $name ) {
	if ( ! preg_match( '/^[\w\-]+\.json\.gz$/', (string) $name ) ) { return null; }
	$f = oay_bk_dir() . '/' . $name; if ( ! file_exists( $f ) ) { return null; }
	$j = json_decode( (string) gzdecode( (string) file_get_contents( $f ) ), true ); return is_array( $j ) ? $j : null;
}
add_action( 'init', function () { if ( ! wp_next_scheduled( 'oay_backup_daily' ) ) { wp_schedule_event( strtotime( 'tomorrow 02:30' ), 'daily', 'oay_backup_daily' ); } } );
add_action( 'oay_backup_daily', function () {
	$name = oay_bk_make( 'auto' );
	if ( $name && '5' === wp_date( 'w' ) ) {   // every Friday: a copy to the office's e-mail, so a copy lives off the server too
		$to = get_option( 'admin_email' ); $f = oay_bk_dir() . '/' . $name;
		wp_mail( $to, 'نسخة احتياطية أسبوعية — تطبيق عمر الياسي للعقارات', "مرفق نسخة احتياطية من بيانات التطبيق (المخططات والحالات والأسعار والدفعات والإعدادات) بتاريخ " . wp_date( 'Y-m-d' ) . ".\nاحتفظ بها — تُسترجع من التطبيق: لوحة العمل ← النسخ الاحتياطية.", '', array( $f ) );
	}
} );
function oay_acc_adm_backups() { oay_acc_need_admin(); oay_acc_ok( array( 'items' => oay_bk_files() ) ); }
function oay_acc_adm_backup_now() { oay_acc_need_admin(); oay_acc_limit( 'bknow', 6 ); $n = oay_bk_make( 'manual' ); if ( ! $n ) { oay_acc_err( 'تعذّر إنشاء النسخة' ); } oay_acc_ok( array( 'items' => oay_bk_files() ) ); }
/** the backup itself (JSON), to keep a copy on the phone */
function oay_acc_adm_backup_get() {
	oay_acc_need_admin(); $name = (string) oay_acc_arg( 'name', 120 ); $j = oay_bk_read( $name ); if ( ! $j ) { oay_acc_err( 'النسخة غير موجودة' ); }
	oay_acc_ok( array( 'name' => preg_replace( '/\.gz$/', '', $name ), 'data' => $j ) );
}
/** puts a backup back: the plans and the app's lists (a safety copy of now is made first); the team's roles only on request */
function oay_acc_adm_backup_restore() {
	$me = oay_acc_need_admin(); oay_acc_limit( 'bkrest', 4 );
	$j = oay_bk_read( (string) oay_acc_arg( 'name', 120 ) ); if ( ! $j ) { oay_acc_err( 'النسخة غير موجودة' ); }
	oay_bk_make( 'beforerestore' );
	$GLOBALS['oay_quiet_import'] = true;   // no customer notifications for a restore
	$n = 0;
	if ( function_exists( 'dnp_projects' ) ) {
		$ps = dnp_projects();
		foreach ( (array) ( $j['plans'] ?? array() ) as $slug => $x ) {
			if ( empty( $ps[ $slug ] ) || ! is_array( $x['v'] ?? null ) ) { continue; }
			update_option( $ps[ $slug ]['opt'], $x['v'], false ); update_option( $ps[ $slug ]['rev'], (int) get_option( $ps[ $slug ]['rev'] ) + 1, false );
			if ( function_exists( 'dnp_after_save' ) ) { dnp_after_save( $ps[ $slug ] ); }
			$n++;
		}
	}
	foreach ( (array) ( $j['opts'] ?? array() ) as $k => $v ) { if ( in_array( $k, OAY_BK_OPTS, true ) && ! in_array( $k, array( 'oay_team_log', 'oay_plot_log' ), true ) ) { update_option( $k, $v, false ); } }
	if ( oay_acc_arg( 'team', 2 ) ) {
		foreach ( (array) ( $j['team'] ?? array() ) as $x ) { $u = get_user_by( 'id', (int) ( $x['id'] ?? 0 ) ); if ( ! $u || $u->user_email !== ( $x['email'] ?? '' ) ) { continue; } foreach ( OAY_BK_UMETA as $k ) { if ( isset( $x['meta'][ $k ] ) ) { update_user_meta( $u->ID, $k, $x['meta'][ $k ] ); } else { delete_user_meta( $u->ID, $k ); } } }
	}
	$GLOBALS['oay_quiet_import'] = false;
	if ( function_exists( 'oay_team_log' ) ) { oay_team_log( $me->ID, 'plot_edit', 'استرجاع نسخة احتياطية · ' . $n . ' مشروع' ); }
	oay_acc_ok( array( 'projects' => $n, 'items' => oay_bk_files() ) );
}

/* =============================== 2) plot history & undo =============================== */
function oay_sf_log() { $l = get_option( 'oay_plot_log', array() ); return is_array( $l ) ? $l : array(); }
function oay_sf_plot_brief( $p ) {
	if ( ! is_array( $p ) || empty( $p['s'] ) ) { return array( 's' => '', 'total' => 0 ); }
	$t = ! empty( $p['total'] ) ? (int) $p['total'] : ( ( ! empty( $p['ppf'] ) && ! empty( $p['ft'] ) ) ? (int) round( $p['ppf'] * $p['ft'] ) : 0 );
	return array( 's' => (string) $p['s'], 'total' => $t, 'inst' => count( (array) ( $p['inst'] ?? array() ) ) );
}
/** the plot's changes (or, with no plot, the latest changes everywhere) */
function oay_acc_adm_plot_history() {
	oay_acc_need_perm( 'plots' );
	$id = (string) oay_acc_arg( 'id', 60 ); $out = array(); $names = array();
	foreach ( oay_sf_log() as $i => $e ) {
		if ( $id && ( $e['id'] ?? '' ) !== $id ) { continue; }
		$uid = (int) ( $e['uid'] ?? 0 ); if ( ! isset( $names[ $uid ] ) ) { $u = get_userdata( $uid ); $names[ $uid ] = $u ? $u->display_name : '—'; }
		$out[] = array( 'k' => (int) $e['t'], 'id' => $e['id'], 'by' => $names[ $uid ], 'b' => array_key_exists( 'b', $e ) ? oay_sf_plot_brief( $e['b'] ) : null, 'a' => array_key_exists( 'a', $e ) ? oay_sf_plot_brief( $e['a'] ) : oay_sf_plot_brief( array( 's' => $e['s'] ?? '', 'total' => $e['total'] ?? 0 ) ),
			'undo' => array_key_exists( 'b', $e ) && empty( $e['undone'] ), 'undone' => ! empty( $e['undone'] ), 'name' => function_exists( 'oay_land_name' ) ? oay_land_name( $e['id'] ) : $e['id'] );
		if ( count( $out ) >= ( $id ? 40 : 60 ) ) { break; }
	}
	oay_acc_ok( array( 'items' => $out ) );
}
/** «تراجع»: puts the plot back as it was before that change */
function oay_acc_adm_plot_undo() {
	$me = oay_acc_need_perm( 'plots' ); $k = (int) oay_acc_arg( 'k', 20 ); $id = (string) oay_acc_arg( 'id', 60 );
	$log = oay_sf_log(); $hit = null;
	foreach ( $log as $i => $e ) { if ( (int) $e['t'] === $k && ( $e['id'] ?? '' ) === $id ) { $hit = $i; break; } }
	if ( null === $hit || ! array_key_exists( 'b', $log[ $hit ] ) ) { oay_acc_err( 'لا يمكن التراجع عن هذا التعديل' ); }
	if ( ! empty( $log[ $hit ]['undone'] ) ) { oay_acc_err( 'تم التراجع عنه من قبل' ); }
	list( $slug, $n ) = array_pad( explode( ':', $id, 2 ), 2, '' );
	$i = function_exists( 'oay_plan_plot' ) ? oay_plan_plot( $slug, $n ) : null; if ( ! $i ) { oay_acc_err( 'القطعة غير موجودة' ); }
	$before = $log[ $hit ]['b']; $now = is_array( $i['cur'] ?? null ) ? $i['cur'] : null;
	$ok = oay_plan_write( $i['proj'], function ( &$st ) use ( $n, $before ) { if ( is_array( $before ) && $before ) { $st['plots'][ (string) $n ] = $before; } else { unset( $st['plots'][ (string) $n ] ); } } );
	if ( ! $ok ) { oay_acc_err( 'تعذّر الحفظ — حاول مرة أخرى' ); }
	$log[ $hit ]['undone'] = 1;
	array_unshift( $log, array( 't' => oay_sf_ms(), 'uid' => (int) $me->ID, 'id' => $id, 's' => is_array( $before ) ? ( $before['s'] ?? '' ) : '', 'total' => is_array( $before ) ? (int) ( $before['total'] ?? 0 ) : 0, 'b' => $now, 'a' => $before, 'undo' => 1 ) );
	update_option( 'oay_plot_log', array_slice( $log, 0, 300 ), false );
	if ( function_exists( 'oay_team_log' ) ) { oay_team_log( $me->ID, 'plot_edit', 'تراجع عن تعديل · ' . ( function_exists( 'oay_land_name' ) ? oay_land_name( $id ) : $id ), $id ); }
	oay_acc_ok( array( 'ok' => true ) );
}

/* =============================== 3) two-step sign-in =============================== */
/** the management and the managers: a phone it has not seen asks for a code sent to the account's e-mail */
function oay_2fa_needed( $u ) { return $u && ( oay_acc_is_admin( $u ) || ( function_exists( 'oay_role' ) && 'mgr' === oay_role( $u ) ) ); }
function oay_2fa_dev() { $d = preg_replace( '/[^A-Za-z0-9_\-]/', '', (string) oay_acc_arg( 'dev', 80 ) ); return strlen( $d ) >= 12 ? hash( 'sha256', $d ) : ''; }
function oay_2fa_trusted( $uid, $h ) { $t = get_user_meta( $uid, 'oay_trust', true ); return $h && is_array( $t ) && isset( $t[ $h ] ); }
function oay_2fa_mask( $e ) { list( $a, $b ) = array_pad( explode( '@', $e, 2 ), 2, '' ); return mb_substr( $a, 0, 2 ) . str_repeat( '•', max( 2, mb_strlen( $a ) - 2 ) ) . '@' . $b; }
/** a code e-mailed for this sign-in → its ticket; '' when no code is needed (not management, or a phone already confirmed) */
function oay_2fa_ticket( $u, $h ) {
	if ( ! oay_2fa_needed( $u ) || oay_2fa_trusted( $u->ID, $h ) ) { return ''; }
	oay_acc_limit( '2fa_' . $u->ID, 6 );
	$code = (string) wp_rand( 100000, 999999 ); $ticket = wp_generate_password( 32, false );
	set_transient( 'oay_2fa_' . $ticket, array( 'u' => (int) $u->ID, 'h' => wp_hash_password( $code ), 'd' => $h, 'n' => 0 ), 10 * MINUTE_IN_SECONDS );
	$sent = wp_mail( $u->user_email, 'كود الدخول: ' . $code . ' — عمر الياسي للعقارات',
		"مرحباً {$u->display_name}،\n\nطلب دخول إلى حسابك في تطبيق عمر الياسي للعقارات من جهاز جديد.\n\nكود الدخول:   $code\n\nالكود صالح لمدة 10 دقائق. إن لم تكن أنت من يحاول الدخول فغيّر كلمة المرور فوراً." );
	if ( ! $sent ) { delete_transient( 'oay_2fa_' . $ticket ); oay_acc_err( 'تعذّر إرسال كود الدخول إلى بريدك — حاول بعد قليل' ); }
	return $ticket;
}
/** called by the sign-in endpoints before a token is given; stops there with «need2fa» when a code is needed */
function oay_2fa_gate( $u ) {
	$t = oay_2fa_ticket( $u, oay_2fa_dev() ); if ( ! $t ) { return; }
	oay_acc_ok( array( 'need2fa' => true, 'ticket' => $t, 'to' => oay_2fa_mask( $u->user_email ) ) );
}
function oay_acc_login_2fa() {
	oay_acc_limit( 'login2fa', 20 );
	$ticket = preg_replace( '/[^A-Za-z0-9]/', '', (string) oay_acc_arg( 'ticket', 40 ) ); $code = preg_replace( '/\D/', '', strtr( (string) oay_acc_arg( 'code', 12 ), array( '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9' ) ) );
	$t = get_transient( 'oay_2fa_' . $ticket ); if ( ! is_array( $t ) ) { oay_acc_err( 'انتهت صلاحية الكود — سجّل الدخول من جديد' ); }
	if ( $t['n'] >= 5 ) { delete_transient( 'oay_2fa_' . $ticket ); oay_acc_err( 'محاولات كثيرة — سجّل الدخول من جديد' ); }
	if ( ! wp_check_password( $code, $t['h'] ) ) { $t['n']++; set_transient( 'oay_2fa_' . $ticket, $t, 10 * MINUTE_IN_SECONDS ); oay_acc_err( 'الكود غير صحيح' ); }
	delete_transient( 'oay_2fa_' . $ticket );
	$u = get_userdata( $t['u'] ); if ( ! $u || get_user_meta( $u->ID, 'oay_banned', true ) ) { oay_acc_err( 'هذا الحساب موقوف', 403 ); }
	if ( $t['d'] ) { $tr = get_user_meta( $u->ID, 'oay_trust', true ); $tr = is_array( $tr ) ? $tr : array(); $tr[ $t['d'] ] = time(); arsort( $tr ); update_user_meta( $u->ID, 'oay_trust', array_slice( $tr, 0, 10, true ) ); }
	oay_acc_ok( array( 'token' => oay_acc_issue_token( $u->ID ), 'user' => oay_acc_userdata( $u ) ) );
}

/* =============================== 4) error reports =============================== */
function oay_acc_err_report() {
	oay_acc_limit( 'errrep', 20 );
	$m = mb_substr( trim( (string) oay_acc_arg( 'm', 400 ) ), 0, 300 ); if ( '' === $m ) { oay_acc_ok( array() ); }
	$k = substr( md5( preg_replace( '/\d+/', '#', $m ) ), 0, 12 );
	$all = get_option( 'oay_errs', array() ); $all = is_array( $all ) ? $all : array();
	$e = $all[ $k ] ?? array( 'm' => $m, 'n' => 0, 'first' => oay_sf_ms(), 'v' => array(), 'p' => array() );
	$e['n']++; $e['last'] = oay_sf_ms(); $e['s'] = mb_substr( (string) oay_acc_arg( 's', 2000 ), 0, 1500 ); $e['url'] = mb_substr( (string) oay_acc_arg( 'url', 200 ), 0, 160 );
	$v = sanitize_text_field( (string) oay_acc_arg( 'v', 20 ) ); $p = sanitize_key( (string) oay_acc_arg( 'plat', 12 ) );
	if ( $v ) { $e['v'][ $v ] = ( $e['v'][ $v ] ?? 0 ) + 1; } if ( $p ) { $e['p'][ $p ] = ( $e['p'][ $p ] ?? 0 ) + 1; }
	$all[ $k ] = $e;
	if ( count( $all ) > 150 ) { uasort( $all, function ( $a, $b ) { return $b['last'] <=> $a['last']; } ); $all = array_slice( $all, 0, 150, true ); }
	update_option( 'oay_errs', $all, false );
	oay_acc_ok( array() );
}
function oay_acc_adm_errs() {
	oay_acc_need_admin(); $all = get_option( 'oay_errs', array() ); $all = is_array( $all ) ? $all : array();
	uasort( $all, function ( $a, $b ) { return $b['last'] <=> $a['last']; } );
	$out = array(); foreach ( $all as $k => $e ) { $out[] = array( 'k' => $k ) + $e; }
	oay_acc_ok( array( 'items' => $out ) );
}
function oay_acc_adm_errs_clear() {
	oay_acc_need_admin(); $k = (string) oay_acc_arg( 'k', 20 );
	if ( $k ) { $all = get_option( 'oay_errs', array() ); unset( $all[ $k ] ); update_option( 'oay_errs', $all, false ); } else { delete_option( 'oay_errs' ); }
	oay_acc_ok( array() );
}

/* =============================== 5) links that open the app =============================== */
/* /l/<project>-<plot> → the share page (the app opens it itself on Android once the site is verified for the app) */
add_action( 'init', function () {
	$path = (string) wp_parse_url( $_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH );
	if ( preg_match( '#^/l/([a-z0-9\-]+-[A-Za-z0-9]+)/?$#', $path, $m ) ) { $_GET['oay_p'] = $m[1]; }   // the share page of alyassi-app-crm.php reads oay_p
	if ( '/.well-known/assetlinks.json' === $path ) {
		$fp = array_values( array_unique( array_filter( array_map( 'trim', array_merge( explode( ',', (string) get_option( 'oay_android_sha256', '' ) ), array( OAY_ANDROID_UPLOAD_SHA256 ) ) ) ) ) );
		header( 'Content-Type: application/json' ); header( 'Access-Control-Allow-Origin: *' );
		echo wp_json_encode( $fp ? array( array( 'relation' => array( 'delegate_permission/common.handle_all_urls' ), 'target' => array( 'namespace' => 'android_app', 'package_name' => 'com.omaralyassi.realestate', 'sha256_cert_fingerprints' => $fp ) ) ) : array() );
		exit;
	}
}, 1 );
/* the app's signing fingerprints (Android) — the admin pastes the one from Google Play Console ← App integrity */
const OAY_ANDROID_UPLOAD_SHA256 = '';   // filled in from the build (the key the app on GitHub is signed with)
add_action( 'wp_ajax_oay_acc_adm_applinks', 'oay_acc_adm_applinks' ); add_action( 'wp_ajax_nopriv_oay_acc_adm_applinks', 'oay_acc_adm_applinks' );
function oay_acc_adm_applinks() {
	oay_acc_need_admin(); $in = oay_acc_in();
	if ( isset( $in['sha'] ) ) {
		$list = array_values( array_unique( array_filter( array_map( function ( $x ) { $x = strtoupper( preg_replace( '/[^0-9A-Fa-f]/', '', $x ) ); return 64 === strlen( $x ) ? implode( ':', str_split( $x, 2 ) ) : ''; }, preg_split( '/[\s,]+/', (string) $in['sha'] ) ) ) ) );
		update_option( 'oay_android_sha256', implode( ',', $list ), false );
	}
	oay_acc_ok( array( 'sha' => (string) get_option( 'oay_android_sha256', '' ), 'upload' => OAY_ANDROID_UPLOAD_SHA256 ) );
}
