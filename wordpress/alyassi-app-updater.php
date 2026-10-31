<?php
/**
 * Plugin Name: Alyassi App – Self-update from GitHub
 * Description: Keeps the app's website files (wordpress/alyassi-app-*.php in github.com/hamadasf/alyassi-app) up to date:
 *              every few minutes, and right after each change (the build calls it). A file is only replaced after a full
 *              PHP syntax check; the previous copy is kept as .bak. Settings → «تحديث التطبيق» shows the state.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

const OAY_UPD_REPO = 'hamadasf/alyassi-app';
const OAY_UPD_BRANCH = 'main';

add_filter( 'cron_schedules', function ( $s ) { $s['oay_5min'] = array( 'interval' => 300, 'display' => 'Every 5 minutes' ); return $s; } );
add_action( 'init', function () { if ( ! wp_next_scheduled( 'oay_self_update' ) ) { wp_schedule_event( time() + 60, 'oay_5min', 'oay_self_update' ); } } );
add_action( 'oay_self_update', 'oay_self_update_run' );

function oay_upd_get( $url ) {
	$r = wp_remote_get( $url, array( 'timeout' => 20, 'headers' => array( 'User-Agent' => 'alyassi-app-updater', 'Accept' => 'application/vnd.github+json' ) ) );
	if ( is_wp_error( $r ) || 200 !== wp_remote_retrieve_response_code( $r ) ) { return null; }
	return wp_remote_retrieve_body( $r );
}
/** Checks GitHub; replaces changed files that pass the syntax check. Returns a short report. */
function oay_self_update_run( $force = false ) {
	if ( get_transient( 'oay_upd_lock' ) ) { return 'busy'; }
	set_transient( 'oay_upd_lock', 1, 120 );
	$st = get_option( 'oay_upd_state', array() ); if ( ! is_array( $st ) ) { $st = array(); }
	$st['checked'] = time();
	$c = oay_upd_get( 'https://api.github.com/repos/' . OAY_UPD_REPO . '/commits/' . OAY_UPD_BRANCH );
	$sha = $c ? ( json_decode( $c, true )['sha'] ?? '' ) : '';
	if ( ! preg_match( '/^[0-9a-f]{40}$/', $sha ) ) { $st['error'] = 'GitHub unreachable'; update_option( 'oay_upd_state', $st, false ); delete_transient( 'oay_upd_lock' ); return 'no-github'; }
	if ( ! $force && ( $st['sha'] ?? '' ) === $sha ) { unset( $st['error'] ); update_option( 'oay_upd_state', $st, false ); delete_transient( 'oay_upd_lock' ); return 'up-to-date'; }
	$list = oay_upd_get( 'https://api.github.com/repos/' . OAY_UPD_REPO . '/contents/wordpress?ref=' . $sha );
	$files = array();
	foreach ( (array) json_decode( (string) $list, true ) as $f ) { if ( is_array( $f ) && preg_match( '/^alyassi-app-[a-z0-9-]+\.php$/', $f['name'] ?? '' ) ) { $files[] = $f['name']; } }
	if ( ! $files ) { $st['error'] = 'no files listed'; update_option( 'oay_upd_state', $st, false ); delete_transient( 'oay_upd_lock' ); return 'no-files'; }
	$done = array(); $bad = array();
	foreach ( $files as $name ) {
		$code = oay_upd_get( 'https://raw.githubusercontent.com/' . OAY_UPD_REPO . '/' . $sha . '/wordpress/' . $name );
		if ( ! $code || 0 !== strpos( ltrim( $code ), '<?php' ) || false === strpos( $code, 'Plugin Name: Alyassi App' ) ) { $bad[] = $name . ' (download)'; continue; }
		try { token_get_all( $code, TOKEN_PARSE ); } catch ( \Throwable $e ) { $bad[] = $name . ' (syntax: ' . $e->getMessage() . ')'; continue; }   // never install a file that does not parse
		$path = __DIR__ . '/' . $name;
		if ( file_exists( $path ) && md5_file( $path ) === md5( $code ) ) { continue; }
		if ( file_exists( $path ) ) { @copy( $path, $path . '.bak' ); }
		$tmp = $path . '.tmp'; if ( false === file_put_contents( $tmp, $code ) ) { $bad[] = $name . ' (write)'; continue; }
		if ( @rename( $tmp, $path ) ) { $done[] = $name; } else { $bad[] = $name . ' (rename)'; }
		if ( function_exists( 'opcache_invalidate' ) ) { @opcache_invalidate( $path, true ); }
	}
	if ( ! $bad ) { $st['sha'] = $sha; unset( $st['error'] ); } else { $st['error'] = implode( '; ', $bad ); }
	$st['last'] = array( 't' => time(), 'sha' => substr( $sha, 0, 7 ), 'updated' => $done );
	update_option( 'oay_upd_state', $st, false );
	delete_transient( 'oay_upd_lock' );
	return $done ? 'updated: ' . implode( ', ', $done ) : ( $bad ? 'errors' : 'unchanged' );
}
// the build calls this right after a change (no secret needed: it can only pull this repository's own files)
add_action( 'wp_ajax_nopriv_oay_self_update', 'oay_self_update_ajax' );
add_action( 'wp_ajax_oay_self_update', 'oay_self_update_ajax' );
function oay_self_update_ajax() {
	if ( get_transient( 'oay_upd_recent' ) ) { wp_send_json( array( 'ok' => true, 'result' => 'wait' ) ); }
	set_transient( 'oay_upd_recent', 1, 30 );
	wp_send_json( array( 'ok' => true, 'result' => oay_self_update_run() ) );
}
add_action( 'admin_menu', function () {
	add_options_page( 'تحديث التطبيق', 'تحديث التطبيق', 'manage_options', 'oay-updater', function () {
		$msg = '';
		if ( isset( $_POST['oay_upd_now'] ) && check_admin_referer( 'oay_upd' ) ) { $msg = oay_self_update_run( true ); }
		$st = get_option( 'oay_upd_state', array() );
		echo '<div class="wrap" dir="rtl"><h1>تحديث التطبيق من GitHub</h1>';
		if ( $msg ) { echo '<div class="notice notice-info"><p>' . esc_html( $msg ) . '</p></div>'; }
		echo '<p>النسخة الحالية: <code>' . esc_html( substr( $st['sha'] ?? '—', 0, 7 ) ) . '</code> · آخر فحص: ' . ( ! empty( $st['checked'] ) ? esc_html( wp_date( 'Y-m-d H:i', $st['checked'] ) ) : '—' ) . '</p>';
		if ( ! empty( $st['last'] ) ) { echo '<p>آخر تحديث: ' . esc_html( wp_date( 'Y-m-d H:i', $st['last']['t'] ) ) . ' (' . esc_html( $st['last']['sha'] ) . ') — ' . esc_html( implode( '، ', $st['last']['updated'] ) ?: 'لا تغيير' ) . '</p>'; }
		if ( ! empty( $st['error'] ) ) { echo '<p style="color:#b91c1c">مشكلة: ' . esc_html( $st['error'] ) . '</p>'; }
		echo '<form method="post">'; wp_nonce_field( 'oay_upd' ); submit_button( 'تحديث الآن', 'primary', 'oay_upd_now' ); echo '</form></div>';
	} );
} );
