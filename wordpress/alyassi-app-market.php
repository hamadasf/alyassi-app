<?php
/**
 * Plugin Name: Alyassi App – Market comparison (office only)
 * Description: «مقارنة بالسوق»: comparable land listings from other sites (Bayut, Property Finder, Dubizzle…), added by
 *              the office from the app with their link, price, area, use and position (corner / lane / regular), plus the
 *              company's own reservations and sales added automatically. The app compares each company land with them.
 *              Visible to the admin and staff with the «listings» permission only. Nothing is fetched from other sites.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

foreach ( array( 'market_list', 'market_save', 'market_del' ) as $a ) {
	add_action( 'wp_ajax_oay_acc_' . $a, 'oay_acc_' . $a );
	add_action( 'wp_ajax_nopriv_oay_acc_' . $a, 'oay_acc_' . $a );
}
const OAY_MKT_SIDES = array( 'زاوية', 'سكة', 'عادية' );

/** the first comparables, from the office's market check of 2 November 2026 (asking prices on the sites that day) */
function oay_market_seed() {
	$pf = 'https://www.propertyfinder.ae/en/plp/buy/';
	$z = $pf . 'land-for-sale-sharjah-al-zubair-al-zubair-orchards-';
	$dz = 'https://uae.dubizzle.com/property-for-sale/land/';
	$rows = array(
		// بساتين الزبير — villa plots (Al Zubair Orchards)
		array( 'basateen-al-zubair', 'فلل', 'pf', $z . '72720103.html', 680000, 5100, 'عادية' ),
		array( 'basateen-al-zubair', 'فلل', 'pf', $z . '155583872.html', 549999, 4848, 'عادية' ),
		array( 'basateen-al-zubair', 'فلل', 'pf', $z . '155939366.html', 550000, 4848, 'عادية' ),
		array( 'basateen-al-zubair', 'فلل', 'pf', $z . '159666066.html', 549555, 4844, 'عادية' ),
		array( 'basateen-al-zubair', 'فلل', 'pf', $z . '83241158.html', 599555, 4844, 'عادية' ),
		array( 'basateen-al-zubair', 'فلل', 'pf', $z . '113703529.html', 570555, 4165, 'عادية' ),
		array( 'basateen-al-zubair', 'فلل', 'pf', $z . '83241232.html', 749555, 5996, 'عادية' ),
		array( 'basateen-al-zubair', 'فلل', 'pf', $z . '155595698.html', 999000, 7193, 'زاوية' ),
		array( 'basateen-al-zubair', 'فلل', 'pf', $z . '161420007.html', 855555, 6110, 'زاوية' ),
		array( 'basateen-al-zubair', 'فلل', 'pf', $z . '161414348.html', 799555, 5652, 'زاوية' ),
		array( 'basateen-al-zubair', 'فلل', 'pf', $z . '161414794.html', 625555, 4166, 'زاوية' ),
		array( 'basateen-al-zubair', 'فلل', 'bayut', '', 680000, 4999, 'عادية' ),
		array( 'basateen-al-zubair', 'فلل', 'bayut', '', 675000, 4972, 'عادية' ),
		array( 'basateen-al-zubair', 'فلل', 'bayut', '', 583100, 4164, 'عادية' ),
		array( 'basateen-al-zubair', 'فلل', 'bayut', '', 604070, 4165, 'عادية' ),
		// الدبدبة شمال — G+2 commercial / residential (Hay Al Dibdibah North)
		array( 'dabdaba-north', 'تجاري', 'pf', $pf . 'land-for-sale-sharjah-al-zubair-hay-al-dibdibah-north-132977102.html', 674999, 2550, 'عادية', 1 ),
		array( 'dabdaba-north', 'تجاري', 'pf', $pf . 'land-for-sale-sharjah-al-zubair-hay-al-dibdibah-north-115035559.html', 678555, 2555, 'عادية' ),
		array( 'dabdaba-north', 'تجاري', 'pf', $pf . 'land-for-sale-sharjah-al-zubair-hay-al-dibdibah-north-102831755.html', 654999, 2422, 'عادية' ),
		array( 'dabdaba-north', 'تجاري', 'pf', $pf . 'land-for-sale-sharjah-al-zubair-hay-al-dibdibah-north-91367515.html', 756000, 2700, 'عادية' ),
		array( 'dabdaba-north', 'تجاري', 'pf', $pf . 'land-for-sale-sharjah-al-zubair-hay-al-dibdibah-north-155057338.html', 842999, 4455, 'زاوية' ),
		// مهذب — villa plots
		array( 'muhathab', 'فلل', 'dubizzle', $dz . '2026/10/8/prime-residential-plot-for-sale-in-al-m-12-313973/', 380000, 2245, 'عادية', 1 ),
		array( 'muhathab', 'فلل', 'pf', $z . '167865092.html', 381409, 2368, 'عادية' ),
		array( 'muhathab', 'فلل', 'pf', $pf . 'land-for-sale-sharjah-al-zubair-al-zubair-1-153745867.html', 381301, 2368, 'عادية', 1 ),
		array( 'muhathab', 'فلل', 'pf', $z . '156015668.html', 381409, 2368, 'عادية' ),
		array( 'muhathab', 'فلل', 'pf', $z . '154593936.html', 378000, 2369, 'عادية' ),
		array( 'muhathab', 'فلل', 'pf', $z . '167879272.html', 378500, 2369, 'عادية' ),
		// الرويضات — G+2 commercial / offices / residential, and a G+7 plot on the main road
		array( 'al-ruwaidat', 'تجاري', 'dubizzle', 'https://uae.dubizzle.com/en/property-for-sale/land/2026/9/22/prime-land-in-al-ruwaidhat-second-block-12-467075/', 765000, 2422, 'عادية', 1 ),
		array( 'al-ruwaidat', 'تجاري', 'dubizzle', $dz . '2026/5/6/land-for-sale-in-al-ruwaidhat-sharjah-12-299768/', 4468800, 11172, 'عادية', 1 ),
		// السحمة — villa plots
		array( 'al-sahma', 'فلل', 'dubizzle', $dz . '2026/4/15/land-for-sale-in-sharjah-al-ruwaidat-al-12-208736/', 390000, 2563, 'عادية' ),
		array( 'al-sahma', 'فلل', 'dubizzle', $dz . '2026/5/20/for-sale-residential-land-at-a-price-be-12-692540/', 430000, 3003, 'عادية' ),
		// المطرق — nearest residential listings (Rawdat Al Qurt, Al Sahma)
		array( 'al-mutraq', 'سكني', 'dubizzle', $dz . '2026/5/12/for-sale-a-corner-residential-land-in-t-12-226025/', 650000, 3656, 'زاوية' ),
		array( 'al-mutraq', 'سكني', 'dubizzle', $dz . '2026/4/15/land-for-sale-in-sharjah-al-ruwaidat-al-12-208736/', 390000, 2563, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'dubizzle', $dz . '2026/5/20/for-sale-residential-land-at-a-price-be-12-692540/', 430000, 3003, 'عادية' ),
	);
	$out = array(); $t = strtotime( '2026-11-02 12:00:00' ) * 1000;
	foreach ( $rows as $i => $r ) {
		$out[] = array( 'id' => 's' . $i, 'slug' => $r[0], 'cat' => $r[1], 'src' => $r[2], 'url' => $r[3], 'price' => $r[4], 'ft' => $r[5], 'side' => $r[6], 'inst' => ! empty( $r[7] ),
			'note' => '', 'seen' => '2026-11-02', 't' => $t, 'by' => 0 );
	}
	return $out;
}
/* second market check (2 Nov 2026): Al Ruwaidat G+2, Al Sahma, Al Mutraq and Al Qasimia Industrial — merged once into an existing list */
function oay_market_seed2() {
	$pf = 'https://www.propertyfinder.ae/en/plp/';
	$se = $pf . 'buy/land-for-sale-sharjah-al-ruwaidat-suburb-al-sehma-';
	$sc = $pf . 'commercial-buy/land-for-sale-sharjah-al-ruwaidat-suburb-al-sehma-';
	$qa = $pf . 'commercial-buy/land-for-sale-sharjah-al-qasimiah-city-';
	$by = 'https://www.bayut.com/property/details-';
	$dz = 'https://sharjah.dubizzle.com/property-for-sale/land/';
	$rows = array(
		// الرويضات — commercial G+2, 2,422 sq ft
		array( 'al-ruwaidat', 'تجاري', 'dubizzle', $dz . '2026/6/9/commercial-plot-in-al-ruwaidat-project--12-380909/', 750000, 2422, 'عادية' ),
		array( 'al-ruwaidat', 'تجاري', 'dubizzle', $dz . '2026/4/15/own-your-commercial-plot-in-al-ruwaidat-12-218381/', 775000, 2422, 'عادية' ),
		array( 'al-ruwaidat', 'تجاري', 'dubizzle', $dz . '2026/6/22/exceptional-investment-opportunity-comm-12-218909/', 751000, 2422, 'عادية' ),
		array( 'al-ruwaidat', 'تجاري', 'dubizzle', $dz . '2026/3/25/best-offer-with-payment-plan-2422-sq-ft-12-242460/', 770000, 2422, 'عادية', 1 ),
		// السحمة — residential / villa plots
		array( 'al-sahma', 'فلل', 'pf', $se . '155076081.html', 375000, 2564, 'عادية' ),
		array( 'al-sahma', 'فلل', 'pf', $se . '154182524.html', 375000, 2564, 'عادية' ),
		array( 'al-sahma', 'فلل', 'pf', $se . '148661371.html', 375000, 2564, 'عادية' ),
		array( 'al-sahma', 'فلل', 'pf', $se . '163694128.html', 440000, 2966, 'عادية' ),
		array( 'al-sahma', 'فلل', 'pf', $se . '159641353.html', 500000, 3074, 'عادية' ),
		array( 'al-sahma', 'فلل', 'pf', $se . '164571080.html', 459999, 3240, 'عادية' ),
		array( 'al-sahma', 'فلل', 'pf', $sc . '143734280.html', 379999, 2579, 'عادية' ),
		array( 'al-sahma', 'فلل', 'pf', $se . '154183390.html', 400000, 2533, 'زاوية' ),
		array( 'al-sahma', 'فلل', 'bayut', '', 330000, 2422, 'عادية' ),
		array( 'al-sahma', 'فلل', 'bayut', '', 380000, 3000, 'عادية' ),
		array( 'al-sahma', 'فلل', 'bayut', '', 350000, 2635, 'عادية' ),
		array( 'al-sahma', 'فلل', 'bayut', '', 410000, 3084, 'عادية' ),
		array( 'al-sahma', 'فلل', 'bayut', '', 405555, 2960, 'عادية' ),
		array( 'al-sahma', 'فلل', 'bayut', '', 360000, 2426, 'زاوية' ),
		array( 'al-sahma', 'فلل', 'bayut', '', 400555, 2498, 'زاوية' ),
		// السحمة — large commercial plots
		array( 'al-sahma', 'تجاري', 'pf', $sc . '161414277.html', 3265555, 18163, 'عادية' ),
		array( 'al-sahma', 'تجاري', 'pf', $sc . '109515420.html', 3260000, 18164, 'عادية' ),
		array( 'al-sahma', 'تجاري', 'pf', $sc . '128839517.html', 3033555, 17331, 'عادية' ),
		array( 'al-sahma', 'تجاري', 'pf', $sc . '119599879.html', 3401010, 21942, 'عادية' ),
		array( 'al-sahma', 'تجاري', 'pf', $sc . '115478760.html', 3450000, 18820, 'زاوية' ),
		// المطرق — residential G+2
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16747932.html', 380000, 2837, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16657789.html', 360000, 2836, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16590132.html', 380000, 2660, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16580696.html', 385000, 2837, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16530347.html', 378000, 2836, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16543807.html', 360000, 2845, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16459494.html', 460000, 3694, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16649735.html', 490000, 3590, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16518952.html', 475000, 3590, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16492834.html', 460000, 3590, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16511749.html', 550000, 3849, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16669374.html', 385000, 2836, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '15894927.html', 410000, 2837, 'عادية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '10702162.html', 449000, 3600, 'زاوية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16492787.html', 392000, 2852, 'زاوية' ),
		array( 'al-mutraq', 'سكني', 'bayut', $by . '16647743.html', 382000, 2545, 'زاوية' ),
		// الصناعية القاسمة 4 — Al Qasimia City industrial plots
		array( 'industrial4', 'صناعي', 'pf', $qa . '141927522.html', 1080000, 12000, 'عادية' ),
		array( 'industrial4', 'صناعي', 'pf', $qa . '150036112.html', 1025000, 12000, 'عادية' ),
		array( 'industrial4', 'صناعي', 'pf', $qa . '144639423.html', 2034480, 19376, 'عادية' ),
		array( 'industrial4', 'صناعي', 'pf', $qa . '144639453.html', 2198455, 19117, 'عادية' ),
		array( 'industrial4', 'صناعي', 'bayut', '', 885000, 12000, 'عادية' ),
		array( 'industrial4', 'صناعي', 'bayut', '', 955840, 11948, 'عادية', 1 ),
		array( 'industrial4', 'صناعي', 'bayut', '', 1541040, 19263, 'عادية' ),
		array( 'industrial4', 'صناعي', 'bayut', '', 1406000, 19263, 'عادية' ),
		array( 'industrial4', 'صناعي', 'bayut', '', 1685000, 19375, 'عادية' ),
		array( 'industrial4', 'صناعي', 'bayut', '', 1329147, 19263, 'عادية', 1 ),
		array( 'industrial4', 'صناعي', 'bayut', '', 1356250, 19375, 'عادية' ),
		array( 'industrial4', 'صناعي', 'bayut', '', 979736, 11948, 'زاوية' ),
	);
	$out = array(); $t = strtotime( '2026-11-02 14:30:00' ) * 1000;
	foreach ( $rows as $i => $r ) {
		$out[] = array( 'id' => 'b' . $i, 'slug' => $r[0], 'cat' => $r[1], 'src' => $r[2], 'url' => $r[3], 'price' => $r[4], 'ft' => $r[5], 'side' => $r[6], 'inst' => ! empty( $r[7] ),
			'note' => '', 'seen' => '2026-11-02', 't' => $t, 'by' => 0 );
	}
	return $out;
}
function oay_market() {
	$m = get_option( 'oay_market', null );
	if ( null === $m ) { $m = oay_market_seed(); update_option( 'oay_market', $m, false ); }
	$m = is_array( $m ) ? array_values( array_filter( $m, 'is_array' ) ) : array();
	if ( (int) get_option( 'oay_market_v', 1 ) < 2 ) {
		$have = array(); foreach ( $m as $x ) { $have[ $x['id'] ?? '' ] = 1; }
		foreach ( oay_market_seed2() as $x ) { if ( empty( $have[ $x['id'] ] ) ) { $m[] = $x; } }
		update_option( 'oay_market', $m, false ); update_option( 'oay_market_v', 2, false );
	}
	return $m;
}
function oay_acc_market_list() { oay_acc_need_perm( 'listings' ); oay_acc_ok( array( 'items' => oay_market() ) ); }
function oay_acc_market_save() {
	$me = oay_acc_need_perm( 'listings' ); $in = oay_acc_in(); $c = is_array( $in['item'] ?? null ) ? $in['item'] : array();
	$url = esc_url_raw( (string) ( $c['url'] ?? '' ) ); if ( $url && ! preg_match( '#^https?://#', $url ) ) { $url = ''; }
	$host = $url ? strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) ) : '';
	$src = preg_match( '/bayut/', $host ) ? 'bayut' : ( preg_match( '/propertyfinder/', $host ) ? 'pf' : ( preg_match( '/dubizzle/', $host ) ? 'dubizzle' : ( preg_match( '/opensooq/', $host ) ? 'opensooq' : sanitize_key( (string) ( $c['src'] ?? 'other' ) ) ) ) );
	$item = array(
		'id' => preg_match( '/^[a-z0-9]{2,20}$/', (string) ( $c['id'] ?? '' ) ) ? (string) $c['id'] : strtolower( wp_generate_password( 10, false, false ) ),
		'slug' => sanitize_key( (string) ( $c['slug'] ?? '' ) ), 'cat' => mb_substr( sanitize_text_field( (string) ( $c['cat'] ?? '' ) ), 0, 20 ),
		'src' => $src ?: 'other', 'url' => $url, 'price' => round( max( 0, (float) ( $c['price'] ?? 0 ) ) ), 'ft' => round( max( 0, (float) ( $c['ft'] ?? 0 ) ) ),
		'side' => in_array( $c['side'] ?? '', OAY_MKT_SIDES, true ) ? $c['side'] : 'عادية', 'inst' => ! empty( $c['inst'] ),
		'note' => mb_substr( sanitize_text_field( (string) ( $c['note'] ?? '' ) ), 0, 120 ),
		'seen' => preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) ( $c['seen'] ?? '' ) ) ? $c['seen'] : wp_date( 'Y-m-d' ), 't' => time() * 1000, 'by' => (int) $me->ID,
	);
	if ( ! $item['slug'] ) { oay_acc_err( 'اختر المشروع / المنطقة' ); }
	if ( $item['price'] < 10000 || $item['ft'] < 100 ) { oay_acc_err( 'اكتب السعر والمساحة' ); }
	$m = oay_market(); $found = false;
	foreach ( $m as $i => $x ) { if ( $x['id'] === $item['id'] ) { $m[ $i ] = $item; $found = true; } }
	if ( ! $found ) { array_unshift( $m, $item ); }
	update_option( 'oay_market', array_slice( $m, 0, 3000 ), false );
	oay_acc_ok( array( 'items' => $m ) );
}
function oay_acc_market_del() {
	oay_acc_need_perm( 'listings' ); $id = (string) oay_acc_arg( 'id', 20 );
	$m = array_values( array_filter( oay_market(), function ( $x ) use ( $id ) { return $x['id'] !== $id; } ) );
	update_option( 'oay_market', $m, false ); oay_acc_ok( array( 'items' => $m ) );
}

/* the company's own deals count as the best comparables: a plot reserved or sold is added with its price */
add_action( 'oay_plot_changes', function ( $slug, $name, $ch, $new ) {
	$plan = function_exists( 'oay_plan_plots' ) ? oay_plan_plots( $slug ) : array(); $st = function_exists( 'oay_plots' ) ? oay_plots( $new ) : array();
	$m = oay_market(); $added = 0;
	foreach ( (array) $ch as $c ) {
		$n = (string) ( $c['n'] ?? '' ); $q = $st[ $n ] ?? array(); $s = (string) ( $q['s'] ?? '' );
		if ( 'status' !== ( $c['kind'] ?? '' ) || ! in_array( $s, array( 'res', 'sold' ), true ) ) { continue; }
		$ft = (float) ( $q['ft'] ?? ( $plan[ $n ][1] ?? 0 ) ); $price = ! empty( $q['total'] ) ? (float) $q['total'] : ( ! empty( $q['ppf'] ) && $ft ? round( $q['ppf'] * $ft ) : 0 );
		if ( ! $price || ! $ft ) { continue; }
		$use = (string) ( $plan[ $n ][0] ?? '' ); $id = 'o' . substr( md5( $slug . ':' . $n ), 0, 10 );
		$m = array_values( array_filter( $m, function ( $x ) use ( $id ) { return $x['id'] !== $id; } ) );
		array_unshift( $m, array( 'id' => $id, 'slug' => $slug, 'cat' => function_exists( 'oay_cat_of' ) ? oay_cat_of( $use ) : '', 'src' => 'ours', 'url' => '', 'price' => round( $price ), 'ft' => round( $ft ),
			'side' => '', 'ref' => $slug . ':' . $n, 'inst' => ! empty( $q['inst'] ), 'note' => ( 'sold' === $s ? 'بيعت' : 'حُجزت' ) . ' — قطعة ' . $n, 'seen' => wp_date( 'Y-m-d' ), 't' => time() * 1000, 'by' => 0 ) );
		$added++;
	}
	if ( $added ) { update_option( 'oay_market', array_slice( $m, 0, 3000 ), false ); }
}, 20, 4 );
