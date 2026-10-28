<?php
/**
 * Plugin Name: Alyassi App – Accounts & land submissions
 * Description: App accounts (email/password or Google), land submissions from the app saved as pending «lands» posts, admin approval, and the approved list for the app.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

const OAY_ACC_ORIGINS = array( 'https://hamadasf.github.io', 'https://localhost', 'http://localhost', 'capacitor://localhost' );
const OAY_ACC_SCHEME  = 'com.omaralyassi.realestate';
const OAY_FEATURE_COST = 70;   // points to feature a land

/* ---------------- helpers ---------------- */
function oay_acc_cors() {
	$o = isset( $_SERVER['HTTP_ORIGIN'] ) ? $_SERVER['HTTP_ORIGIN'] : '';
	if ( in_array( $o, OAY_ACC_ORIGINS, true ) ) { header( 'Access-Control-Allow-Origin: ' . $o ); header( 'Vary: Origin' ); }
	if ( isset( $_SERVER['REQUEST_METHOD'] ) && 'OPTIONS' === $_SERVER['REQUEST_METHOD'] ) {
		header( 'Access-Control-Allow-Methods: POST, GET, OPTIONS' ); header( 'Access-Control-Allow-Headers: Content-Type' ); exit;
	}
	nocache_headers();
}
/** Request body: JSON sent as text/plain (a "simple" request, no CORS preflight). */
function oay_acc_in() {
	static $in = null;
	if ( null === $in ) { $raw = file_get_contents( 'php://input' ); $in = json_decode( $raw ? $raw : '{}', true ); if ( ! is_array( $in ) ) { $in = array(); } }
	return $in;
}
function oay_acc_arg( $k, $max = 500 ) { $in = oay_acc_in(); return isset( $in[ $k ] ) && is_scalar( $in[ $k ] ) ? mb_substr( trim( (string) $in[ $k ] ), 0, $max ) : ''; }
function oay_acc_err( $msg, $code = 400 ) { wp_send_json( array( 'ok' => false, 'error' => $msg ), $code ); }
function oay_acc_ok( $data = array() ) { wp_send_json( array( 'ok' => true ) + $data ); }

/** Simple per-IP limit for login / register attempts. */
function oay_acc_limit( $what, $max ) {
	$ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] : '';
	$key = 'oay_rl_' . $what . '_' . md5( $ip );
	$n   = (int) get_transient( $key );
	if ( $n >= $max ) { oay_acc_err( 'محاولات كثيرة — حاول بعد قليل', 429 ); }
	set_transient( $key, $n + 1, 15 * MINUTE_IN_SECONDS );
}

/* ---------------- app tokens (stored hashed in user meta) ---------------- */
function oay_acc_issue_token( $uid ) {
	$tok  = bin2hex( random_bytes( 24 ) );
	$list = (array) get_user_meta( $uid, 'oay_app_tokens', true );
	$list = array_slice( array_filter( $list, 'is_array' ), -9 );
	$list[] = array( 'h' => hash( 'sha256', $tok ), 't' => time() );
	update_user_meta( $uid, 'oay_app_tokens', $list );
	return $uid . '.' . $tok;
}
function oay_acc_user_from_token( $token ) {
	if ( ! preg_match( '/^(\d+)\.([a-f0-9]{48})$/', (string) $token, $m ) ) { return null; }
	$list = (array) get_user_meta( (int) $m[1], 'oay_app_tokens', true );
	$h    = hash( 'sha256', $m[2] );
	if ( get_user_meta( (int) $m[1], 'oay_banned', true ) ) { return null; }
	foreach ( $list as $e ) { if ( is_array( $e ) && isset( $e['h'] ) && hash_equals( $e['h'], $h ) ) { return get_userdata( (int) $m[1] ); } }
	return null;
}
function oay_acc_need_user() {
	$u = oay_acc_user_from_token( oay_acc_arg( 'token', 120 ) );
	if ( ! $u ) { oay_acc_err( 'انتهت الجلسة — سجّل الدخول مرة أخرى', 401 ); }
	return $u;
}
function oay_acc_is_admin( $u ) { return $u && user_can( $u, 'manage_options' ); }
function oay_acc_userdata( $u ) {
	return array( 'id' => $u->ID, 'name' => $u->display_name, 'email' => $u->user_email, 'phone' => (string) get_user_meta( $u->ID, 'oay_phone', true ),
		'google' => (bool) get_user_meta( $u->ID, 'oay_google_sub', true ), 'points' => (int) get_user_meta( $u->ID, 'oay_points', true ),
		'admin' => oay_acc_is_admin( $u ), 'banned' => (bool) get_user_meta( $u->ID, 'oay_banned', true ), 'avatar' => (string) get_user_meta( $u->ID, 'oay_avatar', true ) );
}
function oay_acc_need_admin() { $u = oay_acc_need_user(); if ( ! oay_acc_is_admin( $u ) ) { oay_acc_err( 'غير مسموح', 403 ); } return $u; }
function oay_acc_new_user( $email, $name, $pass ) {
	$login = sanitize_user( current( explode( '@', $email ) ), true );
	if ( '' === $login || username_exists( $login ) ) { $login = 'u' . wp_generate_password( 8, false, false ); }
	$uid = wp_insert_user( array( 'user_login' => $login, 'user_email' => $email, 'user_pass' => $pass, 'display_name' => $name, 'first_name' => $name, 'role' => get_role( 'oay_customer' ) ? 'oay_customer' : 'subscriber' ) );
	if ( is_wp_error( $uid ) ) { oay_acc_err( 'تعذّر إنشاء الحساب' ); }
	update_user_meta( $uid, 'oay_app_user', 1 );
	return $uid;
}

/* ---------------- account API ---------------- */
$oay_acc_actions = array( 'register', 'login', 'google', 'me', 'profile', 'logout', 'meta', 'upload', 'submit', 'mine', 'public', 'delete', 'plotcheck', 'feature',
	'forgot', 'delete_account', 'avatar',
	'adm_ads', 'adm_review', 'adm_save', 'adm_delete', 'adm_feature', 'adm_users', 'adm_user', 'adm_points', 'adm_ban' );
foreach ( $oay_acc_actions as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}
add_action( 'admin_init', function () {
	if ( wp_doing_ajax() && isset( $_REQUEST['action'] ) && 0 === strpos( (string) $_REQUEST['action'], 'oay_acc_' ) ) { oay_acc_cors(); }
}, 0 );

function oay_acc_register() {
	oay_acc_limit( 'reg', 8 );
	$name  = sanitize_text_field( oay_acc_arg( 'name', 80 ) );
	$email = sanitize_email( oay_acc_arg( 'email', 120 ) );
	$phone = preg_replace( '/[^\d+]/', '', oay_acc_arg( 'phone', 20 ) );
	$pass  = oay_acc_arg( 'password', 200 );
	if ( mb_strlen( $name ) < 2 ) { oay_acc_err( 'اكتب الاسم' ); }
	if ( ! is_email( $email ) ) { oay_acc_err( 'البريد الإلكتروني غير صحيح' ); }
	if ( strlen( $pass ) < 8 ) { oay_acc_err( 'كلمة المرور 8 أحرف على الأقل' ); }
	if ( email_exists( $email ) ) { oay_acc_err( 'هذا البريد مسجّل من قبل — سجّل الدخول' ); }
	$uid = oay_acc_new_user( $email, $name, $pass );
	if ( $phone ) { update_user_meta( $uid, 'oay_phone', $phone ); }
	oay_acc_ok( array( 'token' => oay_acc_issue_token( $uid ), 'user' => oay_acc_userdata( get_userdata( $uid ) ) ) );
}
function oay_acc_login() {
	oay_acc_limit( 'login', 12 );
	$email = sanitize_email( oay_acc_arg( 'email', 120 ) );
	$u     = $email ? get_user_by( 'email', $email ) : null;
	if ( ! $u || ! wp_check_password( oay_acc_arg( 'password', 200 ), $u->user_pass, $u->ID ) ) { oay_acc_err( 'البريد أو كلمة المرور غير صحيحة', 401 ); }
	if ( get_user_meta( $u->ID, 'oay_banned', true ) ) { oay_acc_err( 'هذا الحساب موقوف — تواصل مع الإدارة', 403 ); }
	oay_acc_ok( array( 'token' => oay_acc_issue_token( $u->ID ), 'user' => oay_acc_userdata( $u ) ) );
}
/** Google: the app sends the ID token from Google's sign-in button; it is checked with Google before use. */
function oay_acc_google_user( $credential ) {
	$cid = trim( (string) get_option( 'oay_google_client_id', '' ) );
	if ( '' === $cid ) { return new WP_Error( 'cfg', 'تسجيل الدخول بجوجل غير مفعّل بعد' ); }
	$r = wp_remote_get( 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode( $credential ), array( 'timeout' => 10 ) );
	$g = json_decode( wp_remote_retrieve_body( $r ), true );
	if ( ! is_array( $g ) || empty( $g['aud'] ) || $g['aud'] !== $cid || empty( $g['email'] ) || 'true' !== (string) ( isset( $g['email_verified'] ) ? $g['email_verified'] : '' ) || ! in_array( isset( $g['iss'] ) ? $g['iss'] : '', array( 'accounts.google.com', 'https://accounts.google.com' ), true ) || (int) $g['exp'] < time() ) {
		return new WP_Error( 'bad', 'تعذّر التحقق من حساب جوجل' );
	}
	$u = get_users( array( 'meta_key' => 'oay_google_sub', 'meta_value' => $g['sub'], 'number' => 1 ) );
	$u = $u ? $u[0] : get_user_by( 'email', $g['email'] );
	if ( $u && user_can( $u, 'edit_posts' ) && ! user_can( $u, 'manage_options' ) ) { /* staff accounts keep their own login */ }
	if ( ! $u ) { $uid = oay_acc_new_user( $g['email'], isset( $g['name'] ) ? sanitize_text_field( $g['name'] ) : current( explode( '@', $g['email'] ) ), wp_generate_password( 24 ) ); $u = get_userdata( $uid ); }
	update_user_meta( $u->ID, 'oay_google_sub', sanitize_text_field( $g['sub'] ) );
	if ( ! empty( $g['picture'] ) && ! get_user_meta( $u->ID, 'oay_avatar_own', true ) && preg_match( '#^https://[a-z0-9.-]+\.googleusercontent\.com/#', $g['picture'] ) ) { update_user_meta( $u->ID, 'oay_avatar', esc_url_raw( $g['picture'] ) ); }
	return $u;
}
function oay_acc_google() {
	oay_acc_limit( 'google', 20 );
	$u = oay_acc_google_user( oay_acc_arg( 'credential', 4000 ) );
	if ( is_wp_error( $u ) ) { oay_acc_err( $u->get_error_message() ); }
	if ( get_user_meta( $u->ID, 'oay_banned', true ) ) { oay_acc_err( 'هذا الحساب موقوف — تواصل مع الإدارة', 403 ); }
	oay_acc_ok( array( 'token' => oay_acc_issue_token( $u->ID ), 'user' => oay_acc_userdata( $u ) ) );
}
function oay_acc_me() { $u = oay_acc_need_user(); oay_acc_ok( array( 'user' => oay_acc_userdata( $u ) ) ); }
function oay_acc_profile() {
	$u = oay_acc_need_user();
	$name = sanitize_text_field( oay_acc_arg( 'name', 80 ) ); $phone = preg_replace( '/[^\d+]/', '', oay_acc_arg( 'phone', 20 ) );
	if ( $name ) { wp_update_user( array( 'ID' => $u->ID, 'display_name' => $name, 'first_name' => $name ) ); }
	update_user_meta( $u->ID, 'oay_phone', $phone );
	oay_acc_ok( array( 'user' => oay_acc_userdata( get_userdata( $u->ID ) ) ) );
}
function oay_acc_logout() {
	$tok = oay_acc_arg( 'token', 120 ); $u = oay_acc_user_from_token( $tok );
	if ( $u && preg_match( '/\.([a-f0-9]{48})$/', $tok, $m ) ) {
		$h = hash( 'sha256', $m[1] );
		update_user_meta( $u->ID, 'oay_app_tokens', array_values( array_filter( (array) get_user_meta( $u->ID, 'oay_app_tokens', true ), function ( $e ) use ( $h ) { return ! ( is_array( $e ) && $e['h'] === $h ); } ) ) );
	}
	oay_acc_ok();
}

/** «نسيت كلمة المرور»: WordPress emails a reset link. The answer is the same whether or not the email exists. */
function oay_acc_forgot() {
	oay_acc_limit( 'forgot', 5 );
	$email = sanitize_email( oay_acc_arg( 'email', 120 ) );
	if ( ! is_email( $email ) ) { oay_acc_err( 'البريد الإلكتروني غير صحيح' ); }
	if ( get_user_by( 'email', $email ) && function_exists( 'retrieve_password' ) ) { retrieve_password( $email ); }
	oay_acc_ok( array( 'message' => 'إذا كان البريد مسجّلاً ستصلك رسالة لتعيين كلمة مرور جديدة' ) );
}
/** The user deletes their own account (their listings are removed with it). */
function oay_acc_delete_account() {
	$u = oay_acc_need_user();
	if ( oay_acc_is_admin( $u ) || user_can( $u, 'edit_others_posts' ) ) { oay_acc_err( 'لا يمكن حذف حساب إداري من التطبيق' ); }
	foreach ( get_posts( array( 'post_type' => 'lands', 'author' => $u->ID, 'post_status' => array( 'publish', 'pending', 'draft' ), 'numberposts' => -1 ) ) as $p ) { wp_trash_post( $p->ID ); }
	require_once ABSPATH . 'wp-admin/includes/user.php';
	wp_delete_user( $u->ID );
	oay_acc_ok();
}
/** Profile photo (sent resized from the phone). */
function oay_acc_avatar() {
	$u = oay_acc_need_user();
	$b64 = oay_acc_in(); $b64 = isset( $b64['data'] ) ? (string) $b64['data'] : '';
	if ( ! preg_match( '/^data:image\/(jpeg|png|webp);base64,/', $b64, $m ) ) { oay_acc_err( 'صورة غير صالحة' ); }
	$bin = base64_decode( substr( $b64, strpos( $b64, ',' ) + 1 ), true );
	if ( ! $bin || strlen( $bin ) > 3 * MB_IN_BYTES ) { oay_acc_err( 'حجم الصورة كبير' ); }
	$up = wp_upload_bits( 'avatar-' . $u->ID . '-' . wp_generate_password( 6, false, false ) . '.jpg', null, $bin );
	if ( ! empty( $up['error'] ) || ! @getimagesize( $up['file'] ) ) { if ( ! empty( $up['file'] ) ) { @unlink( $up['file'] ); } oay_acc_err( 'تعذّر رفع الصورة' ); }
	$old = get_user_meta( $u->ID, 'oay_avatar_file', true ); if ( $old && file_exists( $old ) ) { @unlink( $old ); }
	update_user_meta( $u->ID, 'oay_avatar', $up['url'] ); update_user_meta( $u->ID, 'oay_avatar_file', $up['file'] ); update_user_meta( $u->ID, 'oay_avatar_own', 1 );
	oay_acc_ok( array( 'user' => oay_acc_userdata( get_userdata( $u->ID ) ) ) );
}

/* ---------------- land submissions ---------------- */
function oay_acc_meta() {
	$terms = function ( $tax ) { $t = get_terms( array( 'taxonomy' => $tax, 'hide_empty' => false ) ); return is_array( $t ) ? array_map( function ( $x ) { return array( 'id' => $x->term_id, 'name' => $x->name ); }, $t ) : array(); };
	$plans = array(); if ( function_exists( 'dnp_projects' ) ) { foreach ( dnp_projects() as $slug => $pp ) { $plans[] = array( 'slug' => $slug, 'name' => $pp['name'] ); } }
	oay_acc_ok( array( 'projects' => $terms( 'projects' ), 'types' => $terms( 'land_type' ), 'plans' => $plans, 'cost' => OAY_FEATURE_COST, 'google' => trim( (string) get_option( 'oay_google_client_id', '' ) ) ) );
}
/** One photo per request (JPEG/PNG/WebP as base64), resized on the phone before sending. */
function oay_acc_upload() {
	$u   = oay_acc_need_user();
	$b64 = oay_acc_in(); $b64 = isset( $b64['data'] ) ? (string) $b64['data'] : '';
	if ( preg_match( '/^data:image\/(jpeg|png|webp);base64,/', $b64, $m ) ) { $b64 = substr( $b64, strpos( $b64, ',' ) + 1 ); } else { oay_acc_err( 'صورة غير صالحة' ); }
	$bin = base64_decode( $b64, true );
	if ( ! $bin || strlen( $bin ) > 8 * MB_IN_BYTES ) { oay_acc_err( 'حجم الصورة كبير' ); }
	$ext = 'jpeg' === $m[1] ? 'jpg' : $m[1];
	$up  = wp_upload_bits( 'land-' . $u->ID . '-' . wp_generate_password( 8, false, false ) . '.' . $ext, null, $bin );
	if ( ! empty( $up['error'] ) ) { oay_acc_err( 'تعذّر رفع الصورة' ); }
	$type = wp_check_filetype( $up['file'] );
	if ( ! in_array( $type['type'], array( 'image/jpeg', 'image/png', 'image/webp' ), true ) || ! @getimagesize( $up['file'] ) ) { @unlink( $up['file'] ); oay_acc_err( 'صورة غير صالحة' ); }
	require_once ABSPATH . 'wp-admin/includes/image.php';
	$aid = wp_insert_attachment( array( 'post_mime_type' => $type['type'], 'post_title' => 'صورة أرض', 'post_status' => 'inherit', 'post_author' => $u->ID ), $up['file'] );
	wp_update_attachment_metadata( $aid, wp_generate_attachment_metadata( $aid, $up['file'] ) );
	update_post_meta( $aid, '_oay_app_upload', $u->ID );
	oay_acc_ok( array( 'id' => $aid, 'url' => wp_get_attachment_image_url( $aid, 'medium_large' ) ) );
}
function oay_acc_num( $k ) { return preg_replace( '/[^\d.]/', '', oay_acc_arg( $k, 30 ) ); }
function oay_acc_submit() {
	$u = oay_acc_need_user();
	oay_acc_limit( 'submit_' . $u->ID, 20 );
	$title = sanitize_text_field( oay_acc_arg( 'title', 120 ) );
	$desc  = sanitize_textarea_field( oay_acc_arg( 'description', 3000 ) );
	$area  = oay_acc_num( 'area' ); $price = oay_acc_num( 'price' );
	if ( mb_strlen( $title ) < 3 ) { oay_acc_err( 'اكتب عنواناً للإعلان' ); }
	if ( ! $area ) { oay_acc_err( 'اكتب مساحة الأرض' ); }
	if ( ! $price ) { oay_acc_err( 'اكتب السعر' ); }
	$in   = oay_acc_in();
	$pics = array();
	foreach ( (array) ( isset( $in['photos'] ) ? $in['photos'] : array() ) as $aid ) {
		$aid = absint( $aid );
		if ( $aid && (int) get_post_meta( $aid, '_oay_app_upload', true ) === $u->ID ) { $pics[] = $aid; }
	}
	$pics = array_slice( array_unique( $pics ), 0, 10 );
	$pid  = wp_insert_post( array( 'post_type' => 'lands', 'post_status' => 'pending', 'post_title' => $title, 'post_content' => $desc, 'post_author' => $u->ID ), true );
	if ( is_wp_error( $pid ) ) { oay_acc_err( 'تعذّر حفظ الإعلان' ); }
	oay_acc_save_fields( $pid, $pics, true );
	// tell the office
	$link = admin_url( 'admin.php?page=oay-requests' );
	wp_mail( get_option( 'admin_email' ), 'طلب عرض أرض جديد من التطبيق: ' . $title,
		"وصل طلب جديد لعرض أرض من التطبيق وينتظر موافقتك.\n\nالعنوان: $title\nالمساحة: $area قدم²\nالسعر: $price درهم\nصاحب الطلب: {$u->display_name} ({$u->user_email}) " . get_post_meta( $pid, '_oay_owner_phone', true ) . "\n\nللمراجعة والموافقة:\n$link" );
	oay_acc_ok( array( 'id' => $pid ) );
}
/** Writes the form fields of a land (from the owner's submission or the admin's edit). */
function oay_acc_save_fields( $pid, $pics = null, $new = false ) {
	$in = oay_acc_in();
	$has = function ( $k ) use ( $in ) { return array_key_exists( $k, $in ); };
	$map = array( 'area' => '_oay_area', 'price' => '_oay_price', 'down_payment' => '_oay_down_payment', 'installments' => '_oay_installments' );
	foreach ( $map as $k => $mk ) { if ( $new || $has( $k ) ) { update_post_meta( $pid, $mk, oay_acc_num( $k ) ); } }
	$txt = array( 'land_number' => array( '_oay_land_number', 30 ), 'permit' => array( '_oay_permit', 60 ), 'location' => array( '_oay_location', 160 ) );
	foreach ( $txt as $k => $d ) { if ( $new || $has( $k ) ) { update_post_meta( $pid, $d[0], sanitize_text_field( oay_acc_arg( $k, $d[1] ) ) ); } }
	if ( $new || $has( 'phone' ) ) { update_post_meta( $pid, '_oay_owner_phone', preg_replace( '/[^\d+]/', '', oay_acc_arg( 'phone', 20 ) ) ); }
	if ( $new ) { update_post_meta( $pid, '_oay_status', 'available' ); update_post_meta( $pid, '_oay_from_app', 1 ); }
	if ( $new || $has( 'maps_url' ) ) { $maps = esc_url_raw( oay_acc_arg( 'maps_url', 400 ) ); update_post_meta( $pid, '_oay_maps_url', $maps && preg_match( '#^https://#', $maps ) ? $maps : '' ); }
	if ( $new || $has( 'plan' ) ) {
		$plan = sanitize_key( oay_acc_arg( 'plan', 60 ) ); $proj = $plan && function_exists( 'dnp_projects' ) ? ( dnp_projects()[ $plan ] ?? null ) : null;
		update_post_meta( $pid, '_oay_plan_slug', $proj ? $plan : '' );
		if ( $proj && ! empty( $proj['terms'] ) ) { $t = get_term_by( 'slug', $proj['terms'][0], 'projects' ); if ( $t ) { wp_set_object_terms( $pid, $t->term_id, 'projects', false ); } }
	}
	if ( absint( oay_acc_arg( 'project', 10 ) ) ) { wp_set_object_terms( $pid, absint( oay_acc_arg( 'project', 10 ) ), 'projects', false ); }
	if ( absint( oay_acc_arg( 'land_type', 10 ) ) ) { wp_set_object_terms( $pid, absint( oay_acc_arg( 'land_type', 10 ) ), 'land_type', false ); }
	if ( is_array( $pics ) && $pics ) {
		set_post_thumbnail( $pid, $pics[0] ); update_post_meta( $pid, 'land_gallery_images', $pics );
		foreach ( $pics as $aid ) { wp_update_post( array( 'ID' => $aid, 'post_parent' => $pid ) ); }
	}
}

/* ---------------- the interactive plan: an approved land with a plot number appears on its project's plan ---------------- */
function oay_plan_plot( $slug, $n ) {
	if ( ! $slug || '' === (string) $n || ! function_exists( 'dnp_projects' ) ) { return null; }
	$proj = dnp_projects()[ $slug ] ?? null; if ( ! $proj ) { return null; }
	static $cache = array();
	if ( ! isset( $cache[ $slug ] ) ) { $j = json_decode( (string) @file_get_contents( WP_PLUGIN_DIR . '/alyassi-dabdaba-plan/assets/p/' . $slug . '/plan.json' ), true ); $cache[ $slug ] = array(); foreach ( (array) ( $j['plots'] ?? array() ) as $q ) { if ( empty( $q['am'] ) && isset( $q['n'] ) ) { $cache[ $slug ][ (string) $q['n'] ] = $q; } } }
	$q = $cache[ $slug ][ (string) $n ] ?? null; if ( ! $q ) { return null; }
	$st = get_option( $proj['opt'] ); $cur = is_array( $st ) && isset( $st['plots'][ (string) $n ] ) ? $st['plots'][ (string) $n ] : null;
	return array( 'proj' => $proj, 'plot' => $q, 'listed' => $cur && ! empty( $cur['s'] ), 'cur' => $cur );
}
function oay_plan_write( $proj, $fn ) {
	$st = get_option( $proj['opt'] ); if ( ! is_array( $st ) ) { return false; }
	$st['plots'] = isset( $st['plots'] ) && is_array( $st['plots'] ) ? $st['plots'] : array();
	if ( false === $fn( $st ) ) { return false; }
	$st['updated'] = wp_date( 'Y-m-d' );
	update_option( $proj['opt'], $st, false );   // the app's notification for new plots listens to this
	update_option( $proj['rev'], (int) get_option( $proj['rev'] ) + 1, false );
	if ( function_exists( 'dnp_after_save' ) ) { dnp_after_save( $proj ); }
	return true;
}
function oay_plan_add( $pid ) {
	$slug = get_post_meta( $pid, '_oay_plan_slug', true ); $n = trim( (string) get_post_meta( $pid, '_oay_land_number', true ) );
	if ( ! $slug || '' === $n ) { delete_post_meta( $pid, '_oay_plan_msg' ); return; }
	$i = oay_plan_plot( $slug, $n );
	if ( ! $i ) { update_post_meta( $pid, '_oay_plan_msg', 'رقم القطعة غير موجود في مخطط المشروع' ); return; }
	if ( $i['listed'] && (int) get_post_meta( $pid, '_oay_plan_added', true ) !== 1 ) { update_post_meta( $pid, '_oay_plan_msg', 'القطعة معروضة مسبقاً على المخطط — لم تُغيَّر' ); return; }
	$total = (int) get_post_meta( $pid, '_oay_price', true ); $ft = (float) ( $i['plot']['ft'] ?? 0 );
	oay_plan_write( $i['proj'], function ( &$st ) use ( $n, $total, $ft ) {
		$e = array( 's' => 'av' ); if ( $total ) { $e['total'] = $total; if ( $ft ) { $e['ppf'] = (int) round( $total / $ft ); } }
		$st['plots'][ (string) $n ] = $e;
	} );
	update_post_meta( $pid, '_oay_plan_added', 1 ); update_post_meta( $pid, '_oay_plan_msg', 'أُضيفت على المخطط التفاعلي كمتاحة' );
}
function oay_plan_remove( $pid ) {
	if ( (int) get_post_meta( $pid, '_oay_plan_added', true ) !== 1 ) { return; }
	$slug = get_post_meta( $pid, '_oay_plan_slug', true ); $n = (string) get_post_meta( $pid, '_oay_land_number', true );
	$i = oay_plan_plot( $slug, $n );
	if ( $i && $i['listed'] ) { oay_plan_write( $i['proj'], function ( &$st ) use ( $n ) { unset( $st['plots'][ $n ] ); } ); }
	delete_post_meta( $pid, '_oay_plan_added' ); update_post_meta( $pid, '_oay_plan_msg', 'أُزيلت من المخطط التفاعلي' );
}
add_action( 'transition_post_status', function ( $new, $old, $post ) {
	if ( 'lands' !== $post->post_type || ! get_post_meta( $post->ID, '_oay_from_app', true ) || $new === $old ) { return; }
	if ( 'publish' === $new ) { oay_plan_add( $post->ID ); }
	elseif ( 'publish' === $old ) { oay_plan_remove( $post->ID ); }
}, 10, 3 );
function oay_acc_plotcheck() {
	$i = oay_plan_plot( sanitize_key( oay_acc_arg( 'plan', 60 ) ), trim( oay_acc_arg( 'n', 30 ) ) );
	oay_acc_ok( array( 'exists' => (bool) $i, 'listed' => $i ? $i['listed'] : false, 'ft' => $i ? (float) ( $i['plot']['ft'] ?? 0 ) : 0 ) );
}

/* ---------------- approve / reject (from the app or the dashboard) ---------------- */
function oay_acc_review( $pid, $approve, $note = '' ) {
	$p = get_post( $pid ); if ( ! $p || 'lands' !== $p->post_type ) { return 'غير موجود'; }
	$owner = get_userdata( $p->post_author );
	if ( $approve ) {
		wp_update_post( array( 'ID' => $pid, 'post_status' => 'publish' ) ); delete_post_meta( $pid, '_oay_reject_note' );
		if ( $owner ) { wp_mail( $owner->user_email, 'تمت الموافقة على عرض أرضك', "مرحباً {$owner->display_name}،\n\nتمت الموافقة على إعلانك «{$p->post_title}» وأصبح معروضاً في تطبيق عمر الياسي للعقارات.\n\nعمر الياسي للعقارات" ); }
	} else {
		wp_update_post( array( 'ID' => $pid, 'post_status' => 'draft' ) ); update_post_meta( $pid, '_oay_reject_note', $note );
		if ( $owner ) { wp_mail( $owner->user_email, 'بخصوص طلب عرض أرضك', "مرحباً {$owner->display_name}،\n\nلم تتم الموافقة على إعلانك «{$p->post_title}»" . ( $note ? ":\n$note" : '.' ) . "\n\nعمر الياسي للعقارات" ); }
	}
	return (string) get_post_meta( $pid, '_oay_plan_msg', true );
}

function oay_acc_card( $p, $mine = false ) {
	$pics = array_values( array_filter( array_map( 'absint', (array) get_post_meta( $p->ID, 'land_gallery_images', true ) ) ) );
	$th   = get_post_thumbnail_id( $p->ID ); if ( $th && ! in_array( $th, $pics, true ) ) { array_unshift( $pics, $th ); }
	$tt   = function ( $tax ) use ( $p ) { $t = get_the_terms( $p->ID, $tax ); return $t && ! is_wp_error( $t ) ? $t[0]->name : ''; };
	$c = array(
		'id' => $p->ID, 'title' => $p->post_title, 'description' => $p->post_content,
		'area' => (float) get_post_meta( $p->ID, '_oay_area', true ), 'price' => (float) get_post_meta( $p->ID, '_oay_price', true ),
		'down' => (float) get_post_meta( $p->ID, '_oay_down_payment', true ), 'installments' => (int) get_post_meta( $p->ID, '_oay_installments', true ),
		'number' => (string) get_post_meta( $p->ID, '_oay_land_number', true ), 'location' => (string) get_post_meta( $p->ID, '_oay_location', true ),
		'maps' => (string) get_post_meta( $p->ID, '_oay_maps_url', true ), 'project' => $tt( 'projects' ), 'type' => $tt( 'land_type' ),
		'status' => (string) get_post_meta( $p->ID, '_oay_status', true ), 'date' => get_post_time( 'U', true, $p ) * 1000,
		'photos' => array_values( array_filter( array_map( function ( $a ) { return wp_get_attachment_image_url( $a, 'large' ); }, $pics ) ) ),
		'url' => get_permalink( $p ), 'featured' => (bool) get_post_meta( $p->ID, '_oay_featured', true ),
		'plan' => (string) get_post_meta( $p->ID, '_oay_plan_slug', true ), 'onPlan' => (int) get_post_meta( $p->ID, '_oay_plan_added', true ) === 1,
	);
	if ( 'admin' === $mine ) {
		$o = get_userdata( $p->post_author );
		$c += array( 'review' => 'publish' === $p->post_status ? 'approved' : ( 'pending' === $p->post_status ? 'pending' : 'rejected' ), 'note' => (string) get_post_meta( $p->ID, '_oay_reject_note', true ),
			'planMsg' => (string) get_post_meta( $p->ID, '_oay_plan_msg', true ), 'ownerPhone' => (string) get_post_meta( $p->ID, '_oay_owner_phone', true ), 'permit' => (string) get_post_meta( $p->ID, '_oay_permit', true ),
			'owner' => $o ? array( 'id' => $o->ID, 'name' => $o->display_name, 'email' => $o->user_email ) : null,
			'projectId' => ( $t = get_the_terms( $p->ID, 'projects' ) ) && ! is_wp_error( $t ) ? $t[0]->term_id : 0, 'typeId' => ( $t = get_the_terms( $p->ID, 'land_type' ) ) && ! is_wp_error( $t ) ? $t[0]->term_id : 0 );
		return $c;
	}
	if ( $mine ) { $c['review'] = 'publish' === $p->post_status ? 'approved' : ( 'pending' === $p->post_status ? 'pending' : 'rejected' ); $c['note'] = (string) get_post_meta( $p->ID, '_oay_reject_note', true ); }
	return $c;
}
function oay_acc_mine() {
	$u = oay_acc_need_user();
	$q = get_posts( array( 'post_type' => 'lands', 'author' => $u->ID, 'post_status' => array( 'publish', 'pending', 'draft' ), 'numberposts' => 50, 'meta_key' => '_oay_from_app' ) );
	oay_acc_ok( array( 'items' => array_map( function ( $p ) { return oay_acc_card( $p, true ); }, $q ) ) );
}
function oay_acc_delete() {
	$u = oay_acc_need_user(); $p = get_post( absint( oay_acc_arg( 'id', 12 ) ) );
	if ( ! $p || 'lands' !== $p->post_type || (int) $p->post_author !== $u->ID ) { oay_acc_err( 'غير موجود', 404 ); }
	wp_trash_post( $p->ID ); oay_acc_ok();
}
/** Approved lands from owners, for the app. */
function oay_acc_public() {
	$q = get_posts( array( 'post_type' => 'lands', 'post_status' => 'publish', 'numberposts' => 200, 'meta_key' => '_oay_from_app', 'orderby' => 'date', 'order' => 'DESC' ) );
	$q = array_values( array_filter( $q, function ( $p ) { return ! get_user_meta( $p->post_author, 'oay_banned', true ); } ) );
	$items = array_map( 'oay_acc_card', $q );
	usort( $items, function ( $a, $b ) { return ( $b['featured'] <=> $a['featured'] ) ?: ( $b['date'] <=> $a['date'] ); } );   // featured first, then newest
	oay_acc_ok( array( 'items' => $items ) );
}

/* ---------------- points: an owner spends points to feature a land ---------------- */
function oay_acc_feature() {
	$u = oay_acc_need_user(); $p = get_post( absint( oay_acc_arg( 'id', 12 ) ) );
	if ( ! $p || 'lands' !== $p->post_type || (int) $p->post_author !== $u->ID ) { oay_acc_err( 'غير موجود', 404 ); }
	if ( get_post_meta( $p->ID, '_oay_featured', true ) ) { oay_acc_err( 'الإعلان مميز بالفعل' ); }
	$pts = (int) get_user_meta( $u->ID, 'oay_points', true );
	if ( $pts < OAY_FEATURE_COST ) { oay_acc_err( 'رصيدك ' . $pts . ' نقطة — تمييز الإعلان يحتاج ' . OAY_FEATURE_COST . ' نقطة' ); }
	update_user_meta( $u->ID, 'oay_points', $pts - OAY_FEATURE_COST ); update_post_meta( $p->ID, '_oay_featured', 1 );
	oay_acc_ok( array( 'points' => $pts - OAY_FEATURE_COST ) );
}

/* ---------------- admin (from the app, signed in with an administrator account) ---------------- */
function oay_acc_adm_ads() {
	oay_acc_need_admin();
	$st = oay_acc_arg( 'status', 20 ); $st = in_array( $st, array( 'pending', 'publish', 'draft' ), true ) ? $st : array( 'pending', 'publish', 'draft' );
	$args = array( 'post_type' => 'lands', 'post_status' => $st, 'numberposts' => 200, 'meta_key' => '_oay_from_app' );
	if ( absint( oay_acc_arg( 'user', 12 ) ) ) { $args['author'] = absint( oay_acc_arg( 'user', 12 ) ); }
	$items = array_map( function ( $p ) { return oay_acc_card( $p, 'admin' ); }, get_posts( $args ) );
	$c = function ( $s ) { return (int) ( new WP_Query( array( 'post_type' => 'lands', 'post_status' => $s, 'meta_key' => '_oay_from_app', 'fields' => 'ids', 'posts_per_page' => 1 ) ) )->found_posts; };
	oay_acc_ok( array( 'items' => $items, 'counts' => array( 'pending' => $c( 'pending' ), 'publish' => $c( 'publish' ), 'draft' => $c( 'draft' ) ) ) );
}
function oay_acc_adm_post() { $p = get_post( absint( oay_acc_arg( 'id', 12 ) ) ); if ( ! $p || 'lands' !== $p->post_type ) { oay_acc_err( 'غير موجود', 404 ); } return $p; }
function oay_acc_adm_review() {
	oay_acc_need_admin(); $p = oay_acc_adm_post();
	$msg = oay_acc_review( $p->ID, '1' === oay_acc_arg( 'approve', 2 ), sanitize_text_field( oay_acc_arg( 'note', 200 ) ) );
	oay_acc_ok( array( 'item' => oay_acc_card( get_post( $p->ID ), 'admin' ), 'planMsg' => $msg ) );
}
function oay_acc_adm_save() {
	oay_acc_need_admin(); $p = oay_acc_adm_post();
	$t = sanitize_text_field( oay_acc_arg( 'title', 120 ) );
	wp_update_post( array( 'ID' => $p->ID, 'post_title' => $t ? $t : $p->post_title, 'post_content' => sanitize_textarea_field( oay_acc_arg( 'description', 3000 ) ) ) );
	$wasOnPlan = (int) get_post_meta( $p->ID, '_oay_plan_added', true ) === 1;
	if ( $wasOnPlan ) { oay_plan_remove( $p->ID ); }
	oay_acc_save_fields( $p->ID );
	if ( 'publish' === get_post_status( $p->ID ) ) { oay_plan_add( $p->ID ); }   // keeps the plan in step with the edited plot / price
	oay_acc_ok( array( 'item' => oay_acc_card( get_post( $p->ID ), 'admin' ) ) );
}
function oay_acc_adm_delete() { oay_acc_need_admin(); $p = oay_acc_adm_post(); wp_trash_post( $p->ID ); oay_acc_ok(); }
function oay_acc_adm_feature() {
	oay_acc_need_admin(); $p = oay_acc_adm_post();
	if ( '1' === oay_acc_arg( 'on', 2 ) ) { update_post_meta( $p->ID, '_oay_featured', 1 ); } else { delete_post_meta( $p->ID, '_oay_featured' ); }
	oay_acc_ok( array( 'item' => oay_acc_card( get_post( $p->ID ), 'admin' ) ) );
}
function oay_acc_adm_userrow( $u ) {
	$n = (int) ( new WP_Query( array( 'post_type' => 'lands', 'author' => $u->ID, 'post_status' => array( 'publish', 'pending', 'draft' ), 'meta_key' => '_oay_from_app', 'fields' => 'ids', 'posts_per_page' => 1 ) ) )->found_posts;
	return oay_acc_userdata( $u ) + array( 'joined' => strtotime( $u->user_registered ) * 1000, 'ads' => $n );
}
function oay_acc_adm_users() {
	oay_acc_need_admin(); $q = sanitize_text_field( oay_acc_arg( 'q', 80 ) );
	$args = array( 'number' => 200, 'orderby' => 'registered', 'order' => 'DESC', 'meta_key' => 'oay_app_user' );
	if ( $q ) { unset( $args['meta_key'] ); $args['search'] = '*' . $q . '*'; $args['search_columns'] = array( 'user_email', 'display_name', 'user_login' ); }
	oay_acc_ok( array( 'items' => array_map( 'oay_acc_adm_userrow', get_users( $args ) ) ) );
}
function oay_acc_adm_target() { $u = get_userdata( absint( oay_acc_arg( 'id', 12 ) ) ); if ( ! $u ) { oay_acc_err( 'غير موجود', 404 ); } return $u; }
function oay_acc_adm_user() {
	oay_acc_need_admin(); $u = oay_acc_adm_target();
	$ads = get_posts( array( 'post_type' => 'lands', 'author' => $u->ID, 'post_status' => array( 'publish', 'pending', 'draft' ), 'numberposts' => 100, 'meta_key' => '_oay_from_app' ) );
	oay_acc_ok( array( 'user' => oay_acc_adm_userrow( $u ), 'ads' => array_map( function ( $p ) { return oay_acc_card( $p, 'admin' ); }, $ads ) ) );
}
function oay_acc_adm_points() {
	oay_acc_need_admin(); $u = oay_acc_adm_target();
	$v = max( 0, (int) get_user_meta( $u->ID, 'oay_points', true ) + (int) oay_acc_arg( 'delta', 8 ) );
	update_user_meta( $u->ID, 'oay_points', $v ); oay_acc_ok( array( 'user' => oay_acc_adm_userrow( $u ) ) );
}
function oay_acc_adm_ban() {
	$me = oay_acc_need_admin(); $u = oay_acc_adm_target();
	if ( $u->ID === $me->ID || oay_acc_is_admin( $u ) ) { oay_acc_err( 'لا يمكن إيقاف حساب إداري' ); }
	if ( '1' === oay_acc_arg( 'on', 2 ) ) {
		update_user_meta( $u->ID, 'oay_banned', 1 ); delete_user_meta( $u->ID, 'oay_app_tokens' );
		foreach ( get_posts( array( 'post_type' => 'lands', 'author' => $u->ID, 'post_status' => 'publish', 'numberposts' => -1, 'meta_key' => '_oay_from_app' ) ) as $p ) {
			wp_update_post( array( 'ID' => $p->ID, 'post_status' => 'draft' ) ); update_post_meta( $p->ID, '_oay_reject_note', 'الحساب موقوف' );
		}
	} else { delete_user_meta( $u->ID, 'oay_banned' ); }
	oay_acc_ok( array( 'user' => oay_acc_adm_userrow( get_userdata( $u->ID ) ) ) );
}

/* ---------------- Google sign-in page for the Android app (Google does not allow sign-in inside an app's web view,
   so the app opens this page in the phone's browser; it hands the session back to the app by its link scheme). ---------------- */
add_action( 'init', function () {
	if ( empty( $_GET['oay_app_google'] ) ) { return; }
	$cid = trim( (string) get_option( 'oay_google_client_id', '' ) );
	if ( isset( $_POST['credential'] ) ) {
		$u = oay_acc_google_user( wp_unslash( $_POST['credential'] ) );
		if ( is_wp_error( $u ) ) { wp_die( esc_html( $u->get_error_message() ) ); }
		if ( get_user_meta( $u->ID, 'oay_banned', true ) ) { wp_die( 'هذا الحساب موقوف — تواصل مع الإدارة' ); }
		$tok  = oay_acc_issue_token( $u->ID );
		$back = OAY_ACC_SCHEME . '://auth?token=' . rawurlencode( $tok );
		$intent = 'intent://auth?token=' . rawurlencode( $tok ) . '#Intent;scheme=' . OAY_ACC_SCHEME . ';package=' . OAY_ACC_SCHEME . ';end';
		nocache_headers();
		echo '<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تم تسجيل الدخول</title><body style="font-family:Tahoma,sans-serif;text-align:center;padding:60px 20px;background:#0e1c36;color:#fff">'
			. '<h2>تم تسجيل الدخول ✓</h2><p>اضغط للعودة إلى التطبيق</p><p><a id="b" href="' . esc_attr( $intent ) . '" style="display:inline-block;background:#c9a14a;color:#0e1c36;padding:14px 28px;border-radius:12px;font-weight:bold;text-decoration:none">العودة إلى التطبيق</a></p>'
			. '<script>setTimeout(function(){location.href=' . wp_json_encode( $intent ) . '},300)</script></body></html>';
		exit;
	}
	nocache_headers();
	echo '<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>الدخول بحساب جوجل</title>'
		. '<body style="font-family:Tahoma,sans-serif;text-align:center;padding:50px 20px;background:#f6f7fb;color:#0e1c36"><h2>عمر الياسي للعقارات</h2><p>سجّل الدخول بحساب جوجل للمتابعة في التطبيق</p>';
	if ( $cid ) {
		echo '<script src="https://accounts.google.com/gsi/client" async></script>'
			. '<div id="g_id_onload" data-client_id="' . esc_attr( $cid ) . '" data-ux_mode="redirect" data-login_uri="' . esc_url( home_url( '/?oay_app_google=1' ) ) . '" data-auto_prompt="false"></div>'
			. '<div style="display:inline-block" class="g_id_signin" data-type="standard" data-size="large" data-text="continue_with" data-locale="ar" data-shape="pill"></div>';
	} else { echo '<p>تسجيل الدخول بجوجل غير مفعّل بعد.</p>'; }
	echo '</body></html>';
	exit;
}, 1 );

/* ---------------- admin: requests page (approve / reject) ---------------- */
add_action( 'admin_menu', function () {
	$n = (int) ( new WP_Query( array( 'post_type' => 'lands', 'post_status' => 'pending', 'meta_key' => '_oay_from_app', 'fields' => 'ids', 'posts_per_page' => 1 ) ) )->found_posts;
	add_menu_page( 'طلبات الأراضي', 'طلبات الأراضي' . ( $n ? ' <span class="awaiting-mod">' . $n . '</span>' : '' ), 'edit_others_posts', 'oay-requests', 'oay_acc_requests_page', 'dashicons-location-alt', 27 );
	add_submenu_page( 'oay-requests', 'إعدادات الحسابات', 'إعدادات الحسابات', 'manage_options', 'oay-accounts', 'oay_acc_settings_page' );
} );
add_action( 'admin_post_oay_review', function () {
	$pid = absint( isset( $_POST['pid'] ) ? $_POST['pid'] : 0 );
	if ( ! current_user_can( 'edit_post', $pid ) || ! check_admin_referer( 'oay_review_' . $pid ) ) { wp_die( 'غير مسموح' ); }
	$p = get_post( $pid ); if ( ! $p || 'lands' !== $p->post_type ) { wp_die( 'غير موجود' ); }
	$approve = isset( $_POST['approve'] );
	oay_acc_review( $pid, $approve, sanitize_text_field( wp_unslash( isset( $_POST['note'] ) ? $_POST['note'] : '' ) ) );
	$msg = $approve ? 'approved' : 'rejected';
	wp_safe_redirect( admin_url( 'admin.php?page=oay-requests&done=' . $msg ) ); exit;
} );
function oay_acc_requests_page() {
	$tab = isset( $_GET['tab'] ) ? sanitize_key( $_GET['tab'] ) : 'pending';
	$st  = array( 'pending' => 'بانتظار الموافقة', 'publish' => 'معروضة', 'draft' => 'مرفوضة' );
	if ( ! isset( $st[ $tab ] ) ) { $tab = 'pending'; }
	echo '<div class="wrap" dir="rtl"><h1>طلبات عرض الأراضي من التطبيق</h1>';
	if ( isset( $_GET['done'] ) ) { echo '<div class="notice notice-success"><p>' . ( 'approved' === $_GET['done'] ? 'تمت الموافقة — الأرض معروضة الآن في التطبيق، وأُرسل بريد لصاحبها.' : 'تم الرفض وإبلاغ صاحب الطلب.' ) . '</p></div>'; }
	echo '<p>الأراضي التي يضيفها المستخدمون من التطبيق تظهر هنا، ولا تُعرض إلا بعد موافقتك.</p><ul class="subsubsub">';
	$i = 0; foreach ( $st as $k => $l ) { $c = (int) ( new WP_Query( array( 'post_type' => 'lands', 'post_status' => $k, 'meta_key' => '_oay_from_app', 'fields' => 'ids', 'posts_per_page' => 1 ) ) )->found_posts; echo ( $i++ ? ' | ' : '' ) . '<li><a ' . ( $k === $tab ? 'class="current" ' : '' ) . 'href="' . esc_url( admin_url( 'admin.php?page=oay-requests&tab=' . $k ) ) . '">' . esc_html( $l ) . ' <span class="count">(' . $c . ')</span></a></li>'; }
	echo '</ul><div style="clear:both"></div>';
	$q = get_posts( array( 'post_type' => 'lands', 'post_status' => $tab, 'meta_key' => '_oay_from_app', 'numberposts' => 100 ) );
	if ( ! $q ) { echo '<p style="margin-top:20px">لا توجد طلبات.</p></div>'; return; }
	foreach ( $q as $p ) {
		$c = oay_acc_card( $p ); $o = get_userdata( $p->post_author ); $ph = get_post_meta( $p->ID, '_oay_owner_phone', true );
		echo '<div style="background:#fff;border:1px solid #dcdcde;border-radius:10px;padding:16px;margin:14px 0;max-width:980px;display:flex;gap:16px;flex-wrap:wrap">';
		echo '<div style="display:flex;gap:6px;flex-wrap:wrap;max-width:340px">'; foreach ( array_slice( $c['photos'], 0, 4 ) as $src ) { echo '<a href="' . esc_url( $src ) . '" target="_blank"><img src="' . esc_url( $src ) . '" style="width:160px;height:110px;object-fit:cover;border-radius:6px"></a>'; } if ( ! $c['photos'] ) { echo '<em>بدون صور</em>'; } echo '</div>';
		echo '<div style="flex:1;min-width:280px"><h2 style="margin:0 0 6px">' . esc_html( $c['title'] ) . '</h2>';
		$rows = array( 'المشروع' => $c['project'], 'النوع' => $c['type'], 'رقم الأرض' => $c['number'], 'المساحة' => $c['area'] ? number_format( $c['area'] ) . ' قدم²' : '', 'السعر' => $c['price'] ? number_format( $c['price'] ) . ' درهم' : '', 'الدفعة المقدمة' => $c['down'] ? number_format( $c['down'] ) . ' درهم' : '', 'عدد الأقساط' => $c['installments'] ?: '', 'الموقع' => $c['location'], 'صاحب الطلب' => $o ? $o->display_name . ' · ' . $o->user_email : '', 'هاتفه' => $ph, 'التاريخ' => get_the_date( 'j/n/Y', $p ) );
		echo '<table class="widefat striped" style="max-width:560px">'; foreach ( $rows as $k => $v ) { if ( '' !== (string) $v ) { echo '<tr><th style="width:130px">' . esc_html( $k ) . '</th><td>' . esc_html( $v ) . '</td></tr>'; } } echo '</table>';
		if ( $c['description'] ) { echo '<p style="white-space:pre-wrap">' . esc_html( $c['description'] ) . '</p>'; }
		if ( $c['maps'] ) { echo '<p><a href="' . esc_url( $c['maps'] ) . '" target="_blank">الموقع على الخريطة ↗</a></p>'; }
		$pm = get_post_meta( $p->ID, '_oay_plan_msg', true ); if ( $c['plan'] ) { echo '<p>المخطط التفاعلي: <b>' . esc_html( $c['plan'] ) . '</b> · قطعة ' . esc_html( $c['number'] ) . ( $pm ? ' — ' . esc_html( $pm ) : '' ) . '</p>'; }
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px"><input type="hidden" name="action" value="oay_review"><input type="hidden" name="pid" value="' . $p->ID . '">' . wp_nonce_field( 'oay_review_' . $p->ID, '_wpnonce', true, false );
		if ( 'publish' !== $tab ) { echo '<button class="button button-primary" name="approve" value="1">✓ موافقة وعرض</button>'; }
		if ( 'draft' !== $tab ) { echo '<input name="note" placeholder="سبب الرفض (اختياري)" style="min-width:220px"><button class="button" name="reject" value="1">✕ رفض' . ( 'publish' === $tab ? ' / إخفاء' : '' ) . '</button>'; }
		echo ' <a class="button-link" href="' . esc_url( get_edit_post_link( $p->ID ) ) . '">تعديل التفاصيل</a></form></div></div>';
	}
	echo '</div>';
}
function oay_acc_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) { return; }
	if ( isset( $_POST['oay_gcid'] ) && check_admin_referer( 'oay_acc_set' ) ) { update_option( 'oay_google_client_id', sanitize_text_field( wp_unslash( $_POST['oay_gcid'] ) ), false ); echo '<div class="notice notice-success"><p>تم الحفظ.</p></div>'; }
	echo '<div class="wrap" dir="rtl"><h1>إعدادات حسابات التطبيق</h1><form method="post">' . wp_nonce_field( 'oay_acc_set', '_wpnonce', true, false );
	echo '<table class="form-table"><tr><th>Google Client ID</th><td><input name="oay_gcid" class="large-text" dir="ltr" value="' . esc_attr( get_option( 'oay_google_client_id', '' ) ) . '" placeholder="xxxxxxxx.apps.googleusercontent.com"><p class="description">يُفعّل زر «الدخول بحساب جوجل» في التطبيق. اتركه فارغاً لإخفائه (يبقى التسجيل بالبريد الإلكتروني).</p></td></tr></table>';
	submit_button( 'حفظ' ); echo '</form></div>';
}
